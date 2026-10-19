-- Human follow-up replaces stage two only; never sends from the worker.
begin;
create table if not exists public.crm_cart_human_settings (
 merchant_id bigint primary key,enabled boolean not null default true,
 started_at timestamptz not null default now(),threshold numeric not null default 300 check(threshold=300),
 template_name text not null default 'link_cart_personal_help_ar',template_approved boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.crm_cart_human_settings(merchant_id) values(1829345766) on conflict do nothing;
create table if not exists public.crm_cart_human_followups (
 id uuid primary key default gen_random_uuid(),merchant_id bigint not null,cart_id uuid not null references public.abandoned_carts(id),
 status text not null default 'pending' check(status in ('pending','sending','accepted','unknown','dismissed')),
 attempted_at timestamptz,attempted_phone text,attempt_token uuid,provider_message_id text,completed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(merchant_id,cart_id)
);
alter table public.crm_cart_human_settings enable row level security;
alter table public.crm_cart_human_followups enable row level security;
revoke all on public.crm_cart_human_settings,public.crm_cart_human_followups from public,anon,authenticated;
grant select,insert,update on public.crm_cart_human_settings,public.crm_cart_human_followups to service_role;

create or replace function public.crm_cart_human_refresh() returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.crm_cart_delivery_settings where merchant_id=1829345766 for update;
 update public.crm_cart_human_followups set status='unknown',updated_at=now() where status='sending' and merchant_id=1829345766 and attempted_at<now()-interval '2 minutes';
 insert into public.crm_cart_human_followups(merchant_id,cart_id)
 select c.merchant_id,c.id from public.abandoned_carts c
 join public.crm_cart_deliveries f on f.cart_id=c.id and f.merchant_id=c.merchant_id
 join public.crm_cart_human_settings h on h.merchant_id=c.merchant_id and h.enabled
 where c.merchant_id=1829345766 and c.total_amount>h.threshold and c.status in ('active','contacted') and c.recovered_at is null
 and f.status='accepted' and f.completed_at>=now()-interval '48 hours'
 and not exists(select 1 from public.crm_cart_second_deliveries s where s.cart_id=c.id and s.merchant_id=c.merchant_id and (s.attempted_at is not null or s.status in ('sending','accepted','unknown')))
 on conflict(merchant_id,cart_id) do nothing;
 update public.crm_cart_second_deliveries s set status='cancelled',reason='human_followup',updated_at=now()
 where s.merchant_id=1829345766 and s.status='pending' and exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=s.merchant_id and h.cart_id=s.cart_id);
end; $$;

create or replace function public.crm_cart_human_list() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform public.crm_cart_human_refresh();
 select coalesce(jsonb_agg(row_data order by sort_at desc),'[]'::jsonb) into result from (
 select h.created_at as sort_at,jsonb_build_object('id',h.id,'cart_id',c.id,'external_cart_id',c.external_cart_id,'customer_name',c.customer_name,
 'phone',f.attempted_phone,'amount',c.total_amount,'currency',c.currency,'items',coalesce(c.source_payload->'items','[]'::jsonb),
 'first_at',f.completed_at,'second_at',s.attempted_at,'scheduled_for',f.completed_at+make_interval(hours=>coalesce(settings.delay_hours,8)),
 'status',h.status,'attempted_at',h.attempted_at,'provider_message_id',h.provider_message_id,'last_reply_at',r.last_reply_at,
 'reason',case when c.recovered_at is not null or c.status not in ('active','contacted') or exists(select 1 from public.orders o where o.merchant_id=c.merchant_id and o.customer_id=c.customer_id and o.ordered_at>=f.activity_at and coalesce(o.status_slug,'') not in ('canceled','cancelled','refunded','restored','restoring','payment_pending')) then 'purchased_or_inactive'
 when exists(select 1 from public.crm_whatsapp_optouts x where x.merchant_id=c.merchant_id and x.phone=f.attempted_phone) then 'optout'
 when h.status<>'pending' then h.status
 when c.total_amount<=300 then 'amount_changed'
 when regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') is distinct from f.attempted_phone then 'phone_changed'
 when r.last_reply_at>=now()-interval '24 hours' then 'window_open'
 when r.last_reply_at>=f.attempted_at then 'customer_replied'
 when f.completed_at<now()-interval '48 hours' then 'expired'
 when f.completed_at+make_interval(hours=>coalesce(settings.delay_hours,8))>now() then 'delay'
 else 'ready' end) row_data
 from public.crm_cart_human_followups h join public.abandoned_carts c on c.id=h.cart_id
 join public.crm_cart_deliveries f on f.cart_id=c.id and f.merchant_id=c.merchant_id
 left join public.crm_cart_second_deliveries s on s.cart_id=c.id and s.merchant_id=c.merchant_id
 left join public.crm_cart_second_settings settings on settings.merchant_id=c.merchant_id
 left join public.crm_whatsapp_customer_replies r on r.merchant_id=c.merchant_id and r.phone=f.attempted_phone
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
 if f.status<>'accepted' or f.attempted_phone !~ '^[1-9][0-9]{7,14}$' then return jsonb_build_object('blocked','invalid_first');end if;
 if exists(select 1 from public.crm_cart_second_deliveries x where x.merchant_id=1829345766 and x.attempted_phone=f.attempted_phone and x.attempted_at>now()-interval '24 hours' and x.status in ('sending','accepted','unknown'))
 or exists(select 1 from public.crm_cart_human_followups x where x.merchant_id=1829345766 and x.attempted_phone=f.attempted_phone and x.attempted_at>now()-interval '24 hours' and x.status in ('sending','accepted','unknown'))
 or exists(select 1 from public.crm_cart_deliveries x where x.merchant_id=1829345766 and x.cart_id<>c.id and x.attempted_phone=f.attempted_phone and x.attempted_at>now()-interval '24 hours' and x.status in ('sending','accepted','unknown')) then return jsonb_build_object('blocked','recent_contact');end if;
 if coalesce(c.checkout_url,'') !~ '^https://mtjr[.]at/[A-Za-z0-9_-]+$' then return jsonb_build_object('blocked','unsupported_url');end if;
 update public.crm_cart_human_followups set status='sending',attempt_token=gen_random_uuid(),attempted_at=now(),attempted_phone=f.attempted_phone,updated_at=now() where id=p_id returning * into h;
 return jsonb_build_object('id',h.id,'attempt_token',h.attempt_token,'phone',h.attempted_phone,'customer_name',c.customer_name,'template_name',s.template_name);
end; $$;

create or replace function public.crm_finish_cart_human(p_id uuid,p_token uuid,p_status text,p_message_id text default null) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_status not in ('accepted','unknown') or p_status is null or (p_status='accepted' and coalesce(p_message_id,'') !~ '^[1-9][0-9]{0,19}$') then raise exception 'Invalid result';end if;
 update public.crm_cart_human_followups set status=p_status,provider_message_id=p_message_id,completed_at=now(),updated_at=now() where id=p_id and merchant_id=1829345766 and attempt_token=p_token and status in ('sending','unknown');
 get diagnostics n=row_count;return n=1;
end; $$;

revoke all on function public.crm_cart_human_refresh(),public.crm_cart_human_list(),public.crm_claim_cart_human(uuid),public.crm_finish_cart_human(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.crm_cart_human_refresh(),public.crm_cart_human_list(),public.crm_claim_cart_human(uuid),public.crm_finish_cart_human(uuid,uuid,text,text) to service_role;

create or replace function public.crm_claim_cart_second(p_merchant_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.crm_cart_second_settings;q public.crm_cart_second_deliveries;cartrec public.abandoned_carts;f public.crm_cart_deliveries;n integer;
begin
 if p_merchant_id is distinct from 1829345766 then raise exception 'Store not allowed'; end if;
 -- Same lock as the first sender and reply receiver.
 perform 1 from public.crm_cart_delivery_settings where merchant_id=p_merchant_id for update;
 perform public.crm_cart_human_refresh();
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
 when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.cart_id=t.cart_id) then 'human_followup'
 when exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.attempted_phone=d.attempted_phone and h.status in ('sending','accepted','unknown') and h.attempted_at>now()-interval '24 hours') then 'recent_contact'
 else null end reason from public.crm_cart_second_deliveries t join public.abandoned_carts c on c.id=t.cart_id join public.crm_cart_deliveries d on d.id=t.first_delivery_id where t.merchant_id=p_merchant_id and t.status='pending')
 update public.crm_cart_second_deliveries t set status='cancelled',reason=b.reason,updated_at=now() from decisions b where t.id=b.id and b.reason is not null;
 update public.crm_cart_second_deliveries t set reason=case when c.total_amount is null or c.total_amount<0 then 'invalid_amount' when coalesce(c.checkout_url,'') !~ '^https://mtjr[.]at/[A-Za-z0-9_-]+$' then 'unsupported_url' else 'delay' end from public.abandoned_carts c where c.id=t.cart_id and t.merchant_id=p_merchant_id and t.status='pending';
 if exists(select 1 from public.crm_event_inbox where merchant_id=p_merchant_id and records_synced_at is null and (event_name like 'order.%' or event_name like 'abandoned.cart%')) then return jsonb_build_object('idle','projection_pending'); end if;
 if s.quiet_hours and (extract(hour from now() at time zone 'Asia/Riyadh')<9 or extract(hour from now() at time zone 'Asia/Riyadh')>=21) then return jsonb_build_object('idle','quiet_hours'); end if;
 select t.* into q from public.crm_cart_second_deliveries t join public.abandoned_carts c on c.id=t.cart_id
 where t.merchant_id=p_merchant_id and t.status='pending' and t.scheduled_for<=now() and c.total_amount>=0
 and not exists(select 1 from public.crm_cart_human_followups h where h.merchant_id=p_merchant_id and h.cart_id=c.id)
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
end; $$;


select public.crm_cart_human_refresh();
notify pgrst,'reload schema';
commit;
