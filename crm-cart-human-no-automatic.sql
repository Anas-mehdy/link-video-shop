begin;
alter table public.crm_cart_human_followups add column if not exists activity_at timestamptz;
alter table public.crm_cart_human_followups add column if not exists routed_phone text;
create or replace function public.crm_cart_human_refresh() returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.crm_cart_delivery_settings where merchant_id=1829345766 for update;
 update public.crm_cart_human_followups set status='unknown',updated_at=now() where status='sending' and merchant_id=1829345766 and attempted_at<now()-interval '2 minutes';
 insert into public.crm_cart_human_followups(merchant_id,cart_id,activity_at,routed_phone)
 select c.merchant_id,c.id,greatest(c.abandoned_at,c.crm_source_at),regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') from public.abandoned_carts c
 left join public.crm_cart_deliveries f on f.cart_id=c.id and f.merchant_id=c.merchant_id
 join public.crm_cart_human_settings h on h.merchant_id=c.merchant_id and h.enabled
 where c.merchant_id=1829345766 and c.total_amount>h.threshold and c.status in ('active','contacted') and c.recovered_at is null
 and greatest(c.abandoned_at,c.crm_source_at) between now()-interval '48 hours' and now()
 and coalesce(f.status,'pending') not in ('sending','unknown')
 and not exists(select 1 from public.crm_cart_second_deliveries s where s.cart_id=c.id and s.merchant_id=c.merchant_id and (s.attempted_at is not null or s.status in ('sending','accepted','unknown')))
 on conflict(merchant_id,cart_id) do nothing;
 update public.crm_cart_human_followups h set activity_at=greatest(c.abandoned_at,c.crm_source_at),routed_phone=coalesce(h.routed_phone,regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g')),updated_at=now()
 from public.abandoned_carts c where h.cart_id=c.id and h.merchant_id=1829345766 and h.status='pending' and (h.activity_at is null or greatest(c.abandoned_at,c.crm_source_at)>h.activity_at);
 update public.crm_cart_deliveries f set status='cancelled',reason='human_followup',updated_at=now()
 where f.merchant_id=1829345766 and f.status='pending' and exists(select 1 from public.crm_cart_human_followups h where h.cart_id=f.cart_id and h.merchant_id=f.merchant_id);
 update public.crm_cart_second_deliveries s set status='cancelled',reason='human_followup',updated_at=now()
 where s.merchant_id=1829345766 and s.status='pending' and exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=s.merchant_id and h.cart_id=s.cart_id);
end; $$;

create or replace function public.crm_cart_human_list() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform public.crm_cart_human_refresh();
 select coalesce(jsonb_agg(row_data order by sort_at desc),'[]'::jsonb) into result from (
 select h.created_at as sort_at,jsonb_build_object('id',h.id,'cart_id',c.id,'external_cart_id',c.external_cart_id,'customer_name',c.customer_name,
 'phone',coalesce(h.routed_phone,f.attempted_phone),'amount',c.total_amount,'currency',c.currency,'items',coalesce(c.source_payload->'items','[]'::jsonb),
 'first_at',f.completed_at,'second_at',s.attempted_at,'activity_at',h.activity_at,'scheduled_for',h.activity_at+interval '1 hour',
 'status',h.status,'attempted_at',h.attempted_at,'provider_message_id',h.provider_message_id,'last_reply_at',r.last_reply_at,
 'reason',case when c.recovered_at is not null or c.status not in ('active','contacted') or exists(select 1 from public.orders o where o.merchant_id=c.merchant_id and o.customer_id=c.customer_id and o.ordered_at>=h.activity_at and coalesce(o.status_slug,'') not in ('canceled','cancelled','refunded','restored','restoring','payment_pending')) then 'purchased_or_inactive'
 when exists(select 1 from public.crm_whatsapp_optouts x where x.merchant_id=c.merchant_id and x.phone=coalesce(h.routed_phone,f.attempted_phone)) then 'optout'
 when h.status<>'pending' then h.status
 when f.status in ('sending','unknown') then 'first_unconfirmed'
 when c.total_amount<=300 then 'amount_changed'
 when regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') is distinct from coalesce(h.routed_phone,f.attempted_phone) then 'phone_changed'
 when r.last_reply_at>=now()-interval '24 hours' then 'window_open'
 when r.last_reply_at>=coalesce(f.attempted_at,h.activity_at) then 'customer_replied'
 when h.activity_at<now()-interval '48 hours' then 'expired'
 when h.activity_at+interval '1 hour'>now() then 'delay'
 else 'ready' end) row_data
 from public.crm_cart_human_followups h join public.abandoned_carts c on c.id=h.cart_id
 left join public.crm_cart_deliveries f on f.cart_id=c.id and f.merchant_id=c.merchant_id
 left join public.crm_cart_second_deliveries s on s.cart_id=c.id and s.merchant_id=c.merchant_id
 left join public.crm_cart_second_settings settings on settings.merchant_id=c.merchant_id
 left join public.crm_whatsapp_customer_replies r on r.merchant_id=c.merchant_id and r.phone=coalesce(h.routed_phone,f.attempted_phone)
 where h.merchant_id=1829345766 order by h.created_at desc limit 200
 ) rows;
 return jsonb_build_object('configuration',(select to_jsonb(h) from public.crm_cart_human_settings h where merchant_id=1829345766),'queue',result,
 'previous_second',coalesce((select jsonb_agg(t) from (select c.customer_name,c.external_cart_id,c.total_amount,s.status,s.attempted_at from public.crm_cart_second_deliveries s join public.abandoned_carts c on c.id=s.cart_id where s.merchant_id=1829345766 and c.total_amount>300 and s.attempted_at is not null order by s.attempted_at desc limit 50)t),'[]'::jsonb));
end; $$;

create or replace function public.crm_claim_cart_human(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.crm_cart_human_followups;c public.abandoned_carts;f public.crm_cart_deliveries;s public.crm_cart_human_settings;blocked text;
begin
 perform 1 from public.crm_cart_delivery_settings where merchant_id=1829345766 for update;
 perform public.crm_cart_human_refresh();
 select * into s from public.crm_cart_human_settings where merchant_id=1829345766;
 if not s.enabled or not s.template_approved then return jsonb_build_object('blocked','template_not_ready');end if;
 if not exists(select 1 from public.crm_cart_delivery_settings where merchant_id=1829345766 and enabled) then return jsonb_build_object('blocked','paused');end if;
 if exists(select 1 from public.crm_event_inbox where merchant_id=1829345766 and records_synced_at is null and (event_name like 'order.%' or event_name like 'abandoned.cart%')) then return jsonb_build_object('blocked','projection_pending');end if;
 select * into h from public.crm_cart_human_followups where id=p_id and merchant_id=1829345766 for update;
 if not found or h.status<>'pending' then return jsonb_build_object('blocked','already_attempted');end if;
 select * into c from public.abandoned_carts where id=h.cart_id;
 select * into f from public.crm_cart_deliveries where cart_id=h.cart_id and merchant_id=1829345766;
 select e->>'reason' into blocked from jsonb_array_elements(public.crm_cart_human_list()->'queue')e where e->>'id'=p_id::text;
 if blocked is distinct from 'ready' then return jsonb_build_object('blocked',coalesce(blocked,'not_eligible'));end if;
 if coalesce(h.routed_phone,'') !~ '^[1-9][0-9]{7,14}$' then return jsonb_build_object('blocked','invalid_first');end if;
 if exists(select 1 from public.crm_cart_second_deliveries x where x.merchant_id=1829345766 and x.attempted_phone=h.routed_phone and x.attempted_at>now()-interval '24 hours' and x.status in ('sending','accepted','unknown'))
 or exists(select 1 from public.crm_cart_human_followups x where x.merchant_id=1829345766 and x.attempted_phone=h.routed_phone and x.attempted_at>now()-interval '24 hours' and x.status in ('sending','accepted','unknown'))
 or exists(select 1 from public.crm_cart_deliveries x where x.merchant_id=1829345766 and x.cart_id<>c.id and x.attempted_phone=h.routed_phone and x.attempted_at>now()-interval '24 hours' and x.status in ('sending','accepted','unknown')) then return jsonb_build_object('blocked','recent_contact');end if;
 if coalesce(c.checkout_url,'') !~ '^https://mtjr[.]at/[A-Za-z0-9_-]+$' then return jsonb_build_object('blocked','unsupported_url');end if;
 update public.crm_cart_human_followups set status='sending',attempt_token=gen_random_uuid(),attempted_at=now(),attempted_phone=h.routed_phone,updated_at=now() where id=p_id returning * into h;
 return jsonb_build_object('id',h.id,'attempt_token',h.attempt_token,'phone',h.attempted_phone,'customer_name',c.customer_name,'template_name',s.template_name);
end; $$;

create or replace function public.crm_cart_delivery_reconcile(p_merchant_id bigint)
returns void language plpgsql security invoker set search_path='' as $$
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
   activity_at=excluded.activity_at,scheduled_for=excluded.scheduled_for,updated_at=now()
  where crm_cart_deliveries.status='pending' and excluded.activity_at>crm_cart_deliveries.activity_at;
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
  when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.cart_id=c.id) then 'human_followup'
  when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.attempted_phone=regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') and h.status in ('sending','accepted','unknown') and h.attempted_at>now()-interval '24 hours') then 'recent_contact'
  else null end reason) b
 where q.cart_id=c.id and q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id and q.status='pending';
 perform public.crm_cart_human_refresh();
end; $$;

select public.crm_cart_human_refresh();
notify pgrst,'reload schema';
commit;
