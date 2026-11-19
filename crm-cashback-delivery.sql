-- Requires CRM inbox/projection, WhatsApp consent and post-purchase delivery schemas.
begin;
create table if not exists public.crm_cashback_control (
 merchant_id bigint primary key, enabled boolean not null default false
);
insert into public.crm_cashback_control(merchant_id) values(1829345766) on conflict do nothing;
create table if not exists public.crm_cashback_deliveries (
 merchant_id bigint not null, order_id uuid not null references public.orders(id),
 external_order_id text not null, event_id uuid not null references public.crm_event_inbox(id),
 evidence_ref text not null, phone text not null check(phone ~ '^[1-9][0-9]{7,14}$'),
 approved_at timestamptz not null default now(), expires_at timestamptz not null,
 status text not null default 'queued' check(status in ('queued','sending','accepted','rejected','unknown','cancelled')),
 attempt_token uuid, attempted_at timestamptz, finished_at timestamptz, provider_message_id text,
 destination text, reason text,
 primary key(merchant_id,order_id), unique(merchant_id,evidence_ref)
);
alter table public.crm_cashback_control enable row level security;
alter table public.crm_cashback_deliveries enable row level security;
create or replace view public.crm_cashback_candidates with (security_invoker=true) as
select distinct on(o.id) o.merchant_id,o.id as order_id,o.external_order_id,o.order_reference,
 c.name as customer_name,e.id as event_id,e.occurred_at as delivered_at
from public.crm_event_inbox e join public.orders o
 on o.merchant_id=e.merchant_id and o.external_order_id=coalesce(e.payload#>>'{data,order,id}',e.payload#>>'{data,order_id}')
left join public.customers c on c.merchant_id=o.merchant_id and c.id=o.customer_id
where e.event_name='order.status.updated' and e.records_synced_at is not null
 and e.received_at>=now()-interval '7 days' and e.occurred_at between now()-interval '7 days' and now()
 and coalesce(e.payload#>>'{data,status,slug}',e.payload#>>'{data,order,status,slug}')='delivered'
 and o.status_slug='delivered'
order by o.id,e.occurred_at desc,e.received_at desc,e.id;
create or replace function public.crm_cashback_claim(p_order_id uuid,p_phone text,p_destination text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare claimed uuid; actual_phone text;
begin
 perform 1 from public.crm_cashback_control where merchant_id=1829345766 and enabled for update;
 if not found then return null; end if;
 select coalesce(nullif(c.normalized_phone,''),regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')) into actual_phone
 from public.orders o join public.customers c on c.merchant_id=o.merchant_id and c.id=o.customer_id
 where o.merchant_id=1829345766 and o.id=p_order_id and o.status_slug='delivered' for update of o;
 if not found or actual_phone is distinct from p_phone then return null; end if;
 if exists(select 1 from public.crm_whatsapp_optouts where merchant_id=1829345766 and phone=p_phone)
  or not exists(select 1 from public.crm_whatsapp_consents where merchant_id=1829345766 and phone=p_phone)
  or exists(select 1 from public.crm_pp_deliveries where merchant_id=1829345766 and order_id=p_order_id and status in ('sending','accepted','unknown'))
 then return null; end if;
 if (select count(*) from public.crm_cashback_deliveries where merchant_id=1829345766 and attempted_at>now()-interval '1 hour')>=10 then return null; end if;
 update public.crm_cashback_deliveries set status='sending',attempted_at=now(),attempt_token=gen_random_uuid(),destination=p_destination
 where merchant_id=1829345766 and order_id=p_order_id and phone=p_phone and status='queued'
  and expires_at>now() and exists(select 1 from public.crm_cashback_candidates c where c.merchant_id=1829345766 and c.order_id=p_order_id)
 returning attempt_token into claimed;
 return claimed;
end $$;
-- The existing sender takes a share lock on the order before inserting its claim.
-- Serialize claims for the same order whichever workflow reserves first.
create or replace function public.crm_cashback_guard_postpurchase()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.crm_cashback_deliveries where merchant_id=new.merchant_id and order_id=new.order_id and status in ('sending','accepted','unknown')) then
  raise exception 'cashback already attempted for order' using errcode='P0CBK';
 end if;
 return new;
end $$;
drop trigger if exists crm_cashback_guard_postpurchase on public.crm_pp_deliveries;
create trigger crm_cashback_guard_postpurchase before insert on public.crm_pp_deliveries
 for each row execute function public.crm_cashback_guard_postpurchase();
revoke all on public.crm_cashback_control,public.crm_cashback_deliveries,public.crm_cashback_candidates from public,anon,authenticated;
grant select,insert,update on public.crm_cashback_control,public.crm_cashback_deliveries to service_role;
grant select on public.crm_cashback_candidates to service_role;
revoke all on function public.crm_cashback_claim(uuid,text,text),public.crm_cashback_guard_postpurchase() from public,anon,authenticated;
grant execute on function public.crm_cashback_claim(uuid,text,text),public.crm_cashback_guard_postpurchase() to service_role;
commit;
