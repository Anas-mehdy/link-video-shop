-- Run after crm-whatsapp-delivery.sql and crm-whatsapp-events.sql.
-- Includes schema setup and activates stage two with the approved Link templates.
-- First reminders before activation are excluded; no Salla API requests are made.
begin;
create table if not exists public.crm_cart_second_settings (
 merchant_id bigint primary key,enabled boolean not null default false,started_at timestamptz,
 delay_hours integer not null default 8 check(delay_hours between 4 and 24),
 template_help text not null default '',template_offer text not null default '',
 coupon_10 text not null default '',coupon_15 text not null default '',coupon_20 text not null default '',
 quiet_hours boolean not null default false,updated_at timestamptz not null default now()
);
insert into public.crm_cart_second_settings(merchant_id) values(1829345766) on conflict do nothing;
create table if not exists public.crm_whatsapp_customer_replies (
 merchant_id bigint not null,phone text not null,last_reply_at timestamptz not null,
 primary key(merchant_id,phone),check(phone ~ '^[1-9][0-9]{7,14}$')
);
create table if not exists public.crm_cart_second_deliveries (
 id uuid primary key default gen_random_uuid(),merchant_id bigint not null,
 cart_id uuid not null references public.abandoned_carts(id),first_delivery_id uuid not null references public.crm_cart_deliveries(id),
 scheduled_for timestamptz not null,status text not null default 'pending' check(status in ('pending','sending','accepted','unknown','cancelled')),
 reason text not null default 'delay',offer_amount numeric,discount_amount integer,coupon_code text,template_name text,
 attempted_at timestamptz,attempted_phone text,attempt_token uuid,provider_message_id text,completed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(merchant_id,cart_id)
);
create index if not exists crm_cart_second_due_idx on public.crm_cart_second_deliveries(merchant_id,scheduled_for) where status='pending';
alter table public.crm_cart_second_settings enable row level security;
alter table public.crm_whatsapp_customer_replies enable row level security;
alter table public.crm_cart_second_deliveries enable row level security;
revoke all on public.crm_cart_second_settings,public.crm_whatsapp_customer_replies,public.crm_cart_second_deliveries from public,anon,authenticated;
grant select,insert,update on public.crm_cart_second_settings,public.crm_whatsapp_customer_replies,public.crm_cart_second_deliveries to service_role;

create or replace function public.crm_receive_whatsapp_event_v2(
 p_merchant_id bigint,p_event_key text,p_event_name text,p_message_id text,p_occurred_at timestamptz,p_phone text default null,p_reply_phone text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_merchant_id is distinct from 1829345766 or (p_reply_phone is not null and p_reply_phone !~ '^[1-9][0-9]{7,14}$') then raise exception 'Invalid reply'; end if;
 perform 1 from public.crm_cart_delivery_settings where merchant_id=p_merchant_id for update;
 result:=public.crm_receive_whatsapp_event(p_merchant_id,p_event_key,p_event_name,p_message_id,p_occurred_at,p_phone);
 if p_reply_phone is not null then
  insert into public.crm_whatsapp_customer_replies values(p_merchant_id,p_reply_phone,p_occurred_at)
  on conflict(merchant_id,phone) do update set last_reply_at=greatest(crm_whatsapp_customer_replies.last_reply_at,excluded.last_reply_at);
 end if;
 return result;
end; $$;

create or replace function public.crm_configure_cart_second(p_enabled boolean,p_delay integer,p_quiet boolean,p_help text,p_offer text,p_10 text,p_15 text,p_20 text,p_confirm boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_enabled is null or p_delay is null or p_delay not between 4 and 24 or p_quiet is null then raise exception 'Invalid settings'; end if;
 if p_help is null or p_offer is null or p_10 is null or p_15 is null or p_20 is null then raise exception 'Missing settings'; end if;
 if p_enabled and (p_confirm is distinct from true or p_help !~ '^[a-z][a-z0-9_]{0,100}$' or p_offer !~ '^[a-z][a-z0-9_]{0,100}$' or p_10 !~ '^[A-Za-z0-9_-]{1,50}$' or p_15 !~ '^[A-Za-z0-9_-]{1,50}$' or p_20 !~ '^[A-Za-z0-9_-]{1,50}$') then raise exception 'Configure approved templates and coupons'; end if;
 update public.crm_cart_second_settings set enabled=p_enabled,started_at=case when p_enabled and not enabled then now() else started_at end,
 delay_hours=p_delay,quiet_hours=p_quiet,template_help=p_help,template_offer=p_offer,coupon_10=p_10,coupon_15=p_15,coupon_20=p_20,updated_at=now() where merchant_id=1829345766;
end; $$;

create or replace function public.crm_claim_cart_second(p_merchant_id bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
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
 else null end reason from public.crm_cart_second_deliveries t join public.abandoned_carts c on c.id=t.cart_id join public.crm_cart_deliveries d on d.id=t.first_delivery_id where t.merchant_id=p_merchant_id and t.status='pending')
 update public.crm_cart_second_deliveries t set status='cancelled',reason=b.reason,updated_at=now() from decisions b where t.id=b.id and b.reason is not null;
 update public.crm_cart_second_deliveries t set reason=case when c.total_amount is null or c.total_amount<0 then 'invalid_amount' when coalesce(c.checkout_url,'') !~ '^https://mtjr[.]at/[A-Za-z0-9_-]+$' then 'unsupported_url' else 'delay' end from public.abandoned_carts c where c.id=t.cart_id and t.merchant_id=p_merchant_id and t.status='pending';
 if exists(select 1 from public.crm_event_inbox where merchant_id=p_merchant_id and records_synced_at is null and (event_name like 'order.%' or event_name like 'abandoned.cart%')) then return jsonb_build_object('idle','projection_pending'); end if;
 if s.quiet_hours and (extract(hour from now() at time zone 'Asia/Riyadh')<9 or extract(hour from now() at time zone 'Asia/Riyadh')>=21) then return jsonb_build_object('idle','quiet_hours'); end if;
 select t.* into q from public.crm_cart_second_deliveries t join public.abandoned_carts c on c.id=t.cart_id
 where t.merchant_id=p_merchant_id and t.status='pending' and t.scheduled_for<=now() and c.total_amount>=0
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

create or replace function public.crm_finish_cart_second(p_id uuid,p_token uuid,p_status text,p_message_id text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_status is null or p_status not in ('accepted','unknown') or (p_status='accepted' and (p_message_id is null or p_message_id !~ '^[1-9][0-9]{0,19}$')) then raise exception 'Invalid result'; end if;
 update public.crm_cart_second_deliveries set status=p_status,reason=case when p_status='accepted' then 'provider_accepted' else 'unconfirmed_attempt' end,provider_message_id=p_message_id,completed_at=now(),updated_at=now()
 where id=p_id and merchant_id=1829345766 and attempt_token=p_token and status in ('sending','unknown');
 get diagnostics n=row_count;return n=1;
end; $$;
revoke all on function public.crm_receive_whatsapp_event_v2(bigint,text,text,text,timestamptz,text,text),public.crm_configure_cart_second(boolean,integer,boolean,text,text,text,text,text,boolean),public.crm_claim_cart_second(bigint),public.crm_finish_cart_second(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.crm_receive_whatsapp_event_v2(bigint,text,text,text,timestamptz,text,text),public.crm_configure_cart_second(boolean,integer,boolean,text,text,text,text,text,boolean),public.crm_claim_cart_second(bigint),public.crm_finish_cart_second(uuid,uuid,text,text) to service_role;
select public.crm_configure_cart_second(
 p_enabled => true,
 p_delay => 8,
 p_quiet => false,
 p_help => 'link_cart_second_help_ar',
 p_offer => 'link_cart_second_offer_ar',
 p_10 => 'LINK10',
 p_15 => 'LINK15',
 p_20 => 'LINK20',
 p_confirm => true
);

notify pgrst,'reload schema';
commit;

select enabled,delay_hours,quiet_hours,template_help,template_offer,coupon_10,coupon_15,coupon_20,started_at
from public.crm_cart_second_settings where merchant_id=1829345766;
