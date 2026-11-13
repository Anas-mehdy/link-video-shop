-- Unify cart reminders for all basket values. Apply after the legacy human routing migrations.
begin;
-- Serialize the cutover with both automatic and manual claims.
select merchant_id from public.crm_cart_delivery_settings where merchant_id=1829345766 for update;

CREATE OR REPLACE FUNCTION public.crm_cart_delivery_reconcile(p_merchant_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.crm_cart_delivery_settings;
begin
 if p_merchant_id is distinct from 1829345766 then raise exception 'Store not allowed'; end if;
 select * into s from public.crm_cart_delivery_settings where merchant_id=p_merchant_id for update;
 if not found then return; end if;
 -- A crashed or timed-out provider call is ambiguous; never release it for retry.
 update public.crm_cart_deliveries set status='unknown',reason='unconfirmed_attempt',updated_at=now()
 where merchant_id=p_merchant_id and status='sending' and attempted_at<now()-interval '2 minutes';
 if s.enabled and s.started_at is not null then
  insert into public.crm_cart_deliveries(merchant_id,cart_id,activity_at,scheduled_for)
  select p_merchant_id,c.id,greatest(c.abandoned_at,c.crm_source_at),greatest(c.abandoned_at,c.crm_source_at)+make_interval(mins=>s.delay_minutes)
  from public.abandoned_carts c where c.merchant_id=p_merchant_id
   and greatest(c.abandoned_at,c.crm_source_at)>=s.started_at
   and greatest(c.abandoned_at,c.crm_source_at) between now()-interval '24 hours' and now()
  on conflict(merchant_id,cart_id) do update set
   activity_at=excluded.activity_at,scheduled_for=excluded.scheduled_for,
   status='pending',reason='delay',updated_at=now()
  where excluded.activity_at>crm_cart_deliveries.activity_at and (
   crm_cart_deliveries.status='pending' or (crm_cart_deliveries.status='cancelled'
     and crm_cart_deliveries.reason='human_followup' and crm_cart_deliveries.attempted_at is null
     and excluded.activity_at>crm_cart_deliveries.updated_at));
 end if;
 -- Refresh deadline if delay was edited; duplicate/replayed events never extend it.
 update public.crm_cart_deliveries set scheduled_for=activity_at+make_interval(mins=>s.delay_minutes)
 where merchant_id=p_merchant_id and status='pending';
 update public.crm_cart_deliveries q set status=case when b.reason is not null then 'cancelled' else q.status end,
 reason=coalesce(b.reason,case when not s.enabled then 'paused' when regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') !~ '^[1-9][0-9]{7,14}$' then 'missing_phone'
 when coalesce(c.checkout_url,'') !~ '^https://mtjr[.]at/[A-Za-z0-9_-]+$' then 'unsupported_url'
 when s.quiet_hours and (extract(hour from now() at time zone 'Asia/Riyadh')<9 or extract(hour from now() at time zone 'Asia/Riyadh')>=21) then 'quiet_hours' else 'delay' end),updated_at=now()
 from public.abandoned_carts c cross join lateral (select case
  when c.recovered_at is not null or coalesce(c.status,'') not in ('active','contacted') or exists(
   select 1 from public.orders o where o.merchant_id=p_merchant_id and o.customer_id=c.customer_id and o.ordered_at>=greatest(c.abandoned_at,c.crm_source_at)
   and coalesce(o.status_slug,'') not in ('canceled','cancelled','refunded')) then 'purchased_or_inactive'
  when exists(select 1 from public.crm_whatsapp_optouts x where x.merchant_id=p_merchant_id and x.phone=regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g')) then 'optout'
  when greatest(c.abandoned_at,c.crm_source_at) is null or greatest(c.abandoned_at,c.crm_source_at)>now() then 'invalid_activity'
  when greatest(c.abandoned_at,c.crm_source_at)<now()-interval '24 hours' then 'expired'
  when greatest(c.abandoned_at,c.crm_source_at)<s.started_at then 'before_activation'
  when exists(select 1 from public.crm_whatsapp_test_sends t where t.merchant_id=p_merchant_id and t.cart_id=c.id) then 'test_attempt'
  when exists(select 1 from public.crm_cart_deliveries d where d.merchant_id=p_merchant_id and d.cart_id<>c.id and d.attempted_phone=regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g')
   and d.status in ('sending','accepted','unknown') and d.attempted_at>now()-interval '24 hours') then 'recent_contact'
  when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.cart_id=c.id and (h.attempted_at is not null or h.status in ('sending','accepted','unknown'))) then 'human_followup'
  when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.cart_id=c.id and greatest(c.abandoned_at,c.crm_source_at)<=greatest(h.activity_at,h.created_at)) then 'human_followup'
  when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.attempted_phone=regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') and h.status in ('sending','accepted','unknown') and h.attempted_at>now()-interval '24 hours') then 'recent_contact'
  else null end reason) b
 where q.cart_id=c.id and q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id and q.status='pending';
end; $function$;
CREATE OR REPLACE FUNCTION public.crm_claim_cart_second(p_merchant_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.crm_cart_second_settings;q public.crm_cart_second_deliveries;cartrec public.abandoned_carts;f public.crm_cart_deliveries;n integer;
begin
 if p_merchant_id is distinct from 1829345766 then raise exception 'Store not allowed'; end if;
 -- Same lock as the first sender and reply receiver.
 perform 1 from public.crm_cart_delivery_settings where merchant_id=p_merchant_id for update;
 select * into s from public.crm_cart_second_settings where merchant_id=p_merchant_id for update;
 if not found or not s.enabled then return jsonb_build_object('idle','second_disabled'); end if;
 if not exists(select 1 from public.crm_cart_delivery_settings where merchant_id=p_merchant_id and enabled) then return jsonb_build_object('idle','paused'); end if;
 update public.crm_cart_second_deliveries set status='unknown',reason='unconfirmed_attempt',updated_at=now() where merchant_id=p_merchant_id and status='sending' and attempted_at<now()-interval '2 minutes';
 insert into public.crm_cart_second_deliveries(merchant_id,cart_id,first_delivery_id,scheduled_for)
 select p_merchant_id,d.cart_id,d.id,d.completed_at+make_interval(hours=>s.delay_hours) from public.crm_cart_deliveries d
 where d.merchant_id=p_merchant_id and d.status='accepted' and d.completed_at>=s.started_at and d.completed_at>=now()-interval '48 hours'
 on conflict(merchant_id,cart_id) do nothing;
 update public.crm_cart_second_deliveries t set scheduled_for=d.completed_at+make_interval(hours=>s.delay_hours)
 from public.crm_cart_deliveries d where t.first_delivery_id=d.id and t.merchant_id=p_merchant_id and t.status='pending';
 with decisions as (select t.id,case
 when c.recovered_at is not null or coalesce(c.status,'') not in ('active','contacted') or exists(select 1 from public.orders o where o.merchant_id=p_merchant_id and o.customer_id=c.customer_id and o.ordered_at>=d.activity_at and coalesce(o.status_slug,'') not in ('canceled','cancelled','refunded')) then 'purchased_or_inactive'
 when exists(select 1 from public.crm_whatsapp_optouts x where x.merchant_id=p_merchant_id and x.phone=d.attempted_phone) then 'optout'
 when exists(select 1 from public.crm_whatsapp_customer_replies r where r.merchant_id=p_merchant_id and r.phone=d.attempted_phone and r.last_reply_at>=d.attempted_at) then 'customer_replied'
 when d.completed_at<now()-interval '48 hours' or d.completed_at<s.started_at then 'expired'
 when regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') is distinct from d.attempted_phone then 'phone_changed'
 when exists(select 1 from public.crm_cart_second_deliveries x where x.merchant_id=p_merchant_id and x.cart_id<>t.cart_id and x.attempted_phone=d.attempted_phone and x.status in ('sending','accepted','unknown') and x.attempted_at>now()-interval '24 hours') then 'recent_contact'
 when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.cart_id=t.cart_id and (h.attempted_at is not null or h.status in ('sending','accepted','unknown'))) then 'human_followup'
 when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.cart_id=t.cart_id and greatest(c.abandoned_at,c.crm_source_at)<=greatest(h.activity_at,h.created_at)) then 'human_followup'
 when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.attempted_phone=d.attempted_phone and h.status in ('sending','accepted','unknown') and h.attempted_at>now()-interval '24 hours') then 'recent_contact'
 else null end reason from public.crm_cart_second_deliveries t join public.abandoned_carts c on c.id=t.cart_id join public.crm_cart_deliveries d on d.id=t.first_delivery_id where t.merchant_id=p_merchant_id and t.status='pending')
 update public.crm_cart_second_deliveries t set status='cancelled',reason=b.reason,updated_at=now() from decisions b where t.id=b.id and b.reason is not null;
 update public.crm_cart_second_deliveries t set reason=case when c.total_amount is null or c.total_amount<0 then 'invalid_amount' when coalesce(c.checkout_url,'') !~ '^https://mtjr[.]at/[A-Za-z0-9_-]+$' then 'unsupported_url' else 'delay' end from public.abandoned_carts c where c.id=t.cart_id and t.merchant_id=p_merchant_id and t.status='pending';
 if exists(select 1 from public.crm_event_inbox where merchant_id=p_merchant_id and records_synced_at is null and (event_name like 'order.%' or event_name like 'abandoned.cart%')) then return jsonb_build_object('idle','projection_pending'); end if;
 if s.quiet_hours and (extract(hour from now() at time zone 'Asia/Riyadh')<9 or extract(hour from now() at time zone 'Asia/Riyadh')>=21) then return jsonb_build_object('idle','quiet_hours'); end if;
 select t.* into q from public.crm_cart_second_deliveries t join public.abandoned_carts c on c.id=t.cart_id
 where t.merchant_id=p_merchant_id and t.status='pending' and t.scheduled_for<=now() and c.total_amount>=0
 and not exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.cart_id=c.id and (h.attempted_at is not null or h.status in ('sending','accepted','unknown')))
 and coalesce(c.checkout_url,'') ~ '^https://mtjr[.]at/[A-Za-z0-9_-]+$'
 order by t.scheduled_for,t.id limit 1 for update of t skip locked;
 if not found then return jsonb_build_object('idle','no_due'); end if;
 select * into cartrec from public.abandoned_carts where id=q.cart_id;
 select * into f from public.crm_cart_deliveries where id=q.first_delivery_id;
 n:=case when cartrec.total_amount<101 then 0 when cartrec.total_amount<200 then 10 when cartrec.total_amount<300 then 15 else 20 end;
 update public.crm_cart_second_deliveries set status='sending',reason='provider_request',attempted_at=now(),attempt_token=gen_random_uuid(),attempted_phone=f.attempted_phone,
 offer_amount=cartrec.total_amount,discount_amount=n,coupon_code=case n when 10 then s.coupon_10 when 15 then s.coupon_15 when 20 then s.coupon_20 else null end,
 template_name=case when n=0 then s.template_help else s.template_offer end,updated_at=now() where id=q.id returning * into q;
 return jsonb_build_object('id',q.id,'attempt_token',q.attempt_token,'phone',q.attempted_phone,'customer_name',coalesce(nullif(cartrec.customer_name,''),'عميل لنك'),'checkout_url',cartrec.checkout_url,'template_name',q.template_name,'discount_amount',q.discount_amount,'coupon_code',q.coupon_code);
end; $function$;

-- Retain history and allow in-flight attempts to finish, but never claim a new manual send.
create or replace function public.crm_claim_cart_human(p_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('blocked','unified_automation');
$$;

-- Old clients can still read legacy history. Refresh cannot route or cancel any cart.
create or replace function public.crm_cart_human_refresh()
returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.crm_cart_human_followups set status='unknown',updated_at=now()
 where merchant_id=1829345766 and status='sending' and attempted_at<now()-interval '2 minutes';
end;
$$;

-- No legacy cancellations are reopened without fresh activity. Attempted sends are preserved.
notify pgrst,'reload schema';
commit;
