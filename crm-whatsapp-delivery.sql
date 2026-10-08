-- Additive production queue; all sending is disabled until explicitly enabled.
-- Requires crm-salla-sync.sql, crm-whatsapp-events.sql and crm-whatsapp-test-send.sql.
begin;
create table if not exists public.crm_cart_delivery_settings (
 merchant_id bigint primary key,
 enabled boolean not null default false,
 started_at timestamptz,
 delay_minutes integer not null default 60 check(delay_minutes between 60 and 120),
 quiet_hours boolean not null default false,
 last_worker_at timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.crm_cart_delivery_settings(merchant_id) values(1829345766) on conflict do nothing;
create table if not exists public.crm_whatsapp_consents (
 merchant_id bigint not null,
 phone text not null check(phone ~ '^[1-9][0-9]{7,14}$'),
 consent_at timestamptz not null default now(),
 source text not null check(length(source) between 3 and 300),
 primary key(merchant_id,phone)
);
create table if not exists public.crm_cart_deliveries (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null,
 cart_id uuid not null references public.abandoned_carts(id),
 activity_at timestamptz not null,
 scheduled_for timestamptz not null,
 status text not null default 'pending' check(status in ('pending','sending','accepted','unknown','cancelled')),
 reason text not null default 'delay',
 attempt_token uuid,
 attempted_at timestamptz,
 attempted_phone text,
 provider_message_id text,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(merchant_id,cart_id)
);
create index if not exists crm_cart_delivery_due_idx on public.crm_cart_deliveries(merchant_id,scheduled_for) where status='pending';
create index if not exists crm_cart_delivery_phone_idx on public.crm_cart_deliveries(merchant_id,attempted_phone,attempted_at) where status in ('sending','accepted','unknown');
alter table public.crm_cart_delivery_settings enable row level security;
alter table public.crm_whatsapp_consents enable row level security;
alter table public.crm_cart_deliveries enable row level security;
revoke all on public.crm_cart_delivery_settings,public.crm_whatsapp_consents,public.crm_cart_deliveries from public,anon,authenticated;
grant select,insert,update on public.crm_cart_delivery_settings,public.crm_whatsapp_consents,public.crm_cart_deliveries to service_role;

create or replace function public.crm_configure_cart_delivery(p_enabled boolean,p_delay integer,p_quiet boolean,p_confirm boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_enabled is null or p_delay is null or p_delay not between 60 and 120 or p_quiet is null or (p_enabled and p_confirm is distinct from true) then raise exception 'Invalid delivery settings'; end if;
 update public.crm_cart_delivery_settings set
 started_at=case when p_enabled and not enabled then now() else started_at end,
 enabled=p_enabled,delay_minutes=p_delay,quiet_hours=p_quiet,updated_at=now() where merchant_id=1829345766;
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
 reason=coalesce(b.reason,case when not s.enabled then 'paused' when not exists(
  select 1 from public.crm_whatsapp_consents x where x.merchant_id=p_merchant_id and x.phone=regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g')
 ) then 'no_consent' when regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') !~ '^[1-9][0-9]{7,14}$' then 'missing_phone'
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
  else null end reason) b
 where q.cart_id=c.id and q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id and q.status='pending';
end; $$;

create or replace function public.crm_claim_cart_delivery(p_merchant_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.crm_cart_delivery_settings; q public.crm_cart_deliveries; c public.abandoned_carts;
begin
 perform public.crm_cart_delivery_reconcile(p_merchant_id);
 select * into s from public.crm_cart_delivery_settings where merchant_id=p_merchant_id;
 update public.crm_cart_delivery_settings set last_worker_at=now() where merchant_id=p_merchant_id;
 if not s.enabled then return jsonb_build_object('idle','paused'); end if;
 -- Never send from stale local records while a received purchase/cart event
 -- is still waiting for projection. Repair/replay it through the Salla worker.
 if exists(select 1 from public.crm_event_inbox where merchant_id=p_merchant_id and records_synced_at is null
   and (event_name like 'order.%' or event_name like 'abandoned.cart%')) then
  return jsonb_build_object('idle','projection_pending');
 end if;
 if s.quiet_hours and (extract(hour from now() at time zone 'Asia/Riyadh')<9 or extract(hour from now() at time zone 'Asia/Riyadh')>=21) then return jsonb_build_object('idle','quiet_hours'); end if;
 select * into q from public.crm_cart_deliveries where merchant_id=p_merchant_id and status='pending' and reason='delay' and scheduled_for<=now()
 order by scheduled_for,id limit 1 for update skip locked;
 if not found then return jsonb_build_object('idle','no_due'); end if;
 select * into c from public.abandoned_carts where id=q.cart_id and merchant_id=p_merchant_id;
 update public.crm_cart_deliveries set status='sending',reason='provider_request',attempt_token=gen_random_uuid(),attempted_at=now(),
 attempted_phone=regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g'),updated_at=now()
 where id=q.id returning * into q;
 return jsonb_build_object('id',q.id,'attempt_token',q.attempt_token,'phone',q.attempted_phone,'checkout_url',c.checkout_url,'customer_name',coalesce(nullif(c.customer_name,''),'عميل لنك'));
end; $$;

create or replace function public.crm_finish_cart_delivery(p_id uuid,p_token uuid,p_status text,p_message_id text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_status is null or p_status not in ('accepted','unknown') or (p_status='accepted' and (p_message_id is null or p_message_id !~ '^[1-9][0-9]{0,19}$')) then raise exception 'Invalid send result'; end if;
 update public.crm_cart_deliveries set status=p_status,provider_message_id=p_message_id,reason=case when p_status='accepted' then 'provider_accepted' else 'unconfirmed_attempt' end,completed_at=now(),updated_at=now()
 where id=p_id and merchant_id=1829345766 and attempt_token=p_token and status in ('sending','unknown');
 get diagnostics n=row_count;return n=1;
end; $$;

create or replace function public.crm_record_whatsapp_consent(p_phone text,p_source text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_phone is null or p_phone !~ '^[1-9][0-9]{7,14}$' or p_source is null or length(trim(p_source)) not between 3 and 300 then raise exception 'Invalid consent'; end if;
 insert into public.crm_whatsapp_consents(merchant_id,phone,source) values(1829345766,p_phone,trim(p_source))
 on conflict(merchant_id,phone) do update set consent_at=now(),source=excluded.source;
 -- Explicit new consent does not silently clear a later unsubscribe.
end; $$;
revoke all on function public.crm_configure_cart_delivery(boolean,integer,boolean,boolean),public.crm_cart_delivery_reconcile(bigint),public.crm_claim_cart_delivery(bigint),public.crm_finish_cart_delivery(uuid,uuid,text,text),public.crm_record_whatsapp_consent(text,text) from public,anon,authenticated;
grant execute on function public.crm_configure_cart_delivery(boolean,integer,boolean,boolean),public.crm_cart_delivery_reconcile(bigint),public.crm_claim_cart_delivery(bigint),public.crm_finish_cart_delivery(uuid,uuid,text,text),public.crm_record_whatsapp_consent(text,text) to service_role;
notify pgrst,'reload schema';
commit;
