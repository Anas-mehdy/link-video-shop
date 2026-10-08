begin;
create table if not exists public.crm_cart_followup_settings (
 merchant_id bigint primary key,
 enabled boolean not null default false,
 started_at timestamptz,
 delay_minutes integer not null default 60 check (delay_minutes between 1 and 1440),
 updated_at timestamptz not null default now()
);
create table if not exists public.crm_whatsapp_optouts (
 merchant_id bigint not null,
 phone text not null check (phone ~ '^[1-9][0-9]{7,14}$'),
 created_at timestamptz not null default now(),
 primary key (merchant_id,phone)
);
create table if not exists public.crm_cart_followups (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null,
 cart_id uuid not null references public.abandoned_carts(id),
 scheduled_for timestamptz not null,
 status text not null default 'waiting' check (status in ('waiting','simulated','cancelled','blocked')),
 reason text not null default 'delay',
 simulated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(merchant_id,cart_id)
);
create index if not exists crm_cart_followups_recent_idx on public.crm_cart_followups(merchant_id,created_at desc);
create index if not exists crm_cart_followups_due_idx on public.crm_cart_followups(merchant_id,scheduled_for) where status='waiting';
create index if not exists crm_followup_customer_orders_idx on public.orders(merchant_id,customer_id,ordered_at);
alter table public.crm_cart_followup_settings enable row level security;
alter table public.crm_whatsapp_optouts enable row level security;
alter table public.crm_cart_followups enable row level security;
revoke all on public.crm_cart_followup_settings,public.crm_whatsapp_optouts,public.crm_cart_followups from public,anon,authenticated;
grant select,insert,update on public.crm_cart_followup_settings,public.crm_whatsapp_optouts,public.crm_cart_followups to service_role;

-- One atomic reconciliation. No external requests and no live-send state.
create or replace function public.crm_cart_followup_refresh(p_merchant_id bigint)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_settings public.crm_cart_followup_settings; v_count integer;
begin
 if p_merchant_id<>1829345766 then raise exception 'Store not allowed'; end if;
 select * into v_settings from public.crm_cart_followup_settings where merchant_id=p_merchant_id for update;
 if not found then return 0; end if;
 if v_settings.enabled and v_settings.started_at is not null then
  insert into public.crm_cart_followups(merchant_id,cart_id,scheduled_for)
  select p_merchant_id,c.id,c.abandoned_at+make_interval(mins=>v_settings.delay_minutes)
  from public.abandoned_carts c
  where c.merchant_id=p_merchant_id and c.abandoned_at>=v_settings.started_at
    and c.abandoned_at>=now()-interval '30 days' and c.abandoned_at<=now()
  on conflict(merchant_id,cart_id) do nothing;
 end if;
 update public.crm_cart_followups q set status='cancelled',reason='purchased',updated_at=now()
 from public.abandoned_carts c
 where q.cart_id=c.id and q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id
 and q.status<>'cancelled' and (c.status in ('recovered','purchased') or c.recovered_at is not null or exists(
  select 1 from public.orders o where o.merchant_id=p_merchant_id and o.customer_id=c.customer_id
   and o.ordered_at>=c.abandoned_at and coalesce(o.status_slug,'') not in ('canceled','cancelled','refunded')));
 update public.crm_cart_followups q set status='cancelled',reason='optout',updated_at=now()
 from public.abandoned_carts c
 where q.cart_id=c.id and q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id and q.status<>'cancelled'
 and exists(select 1 from public.crm_whatsapp_optouts x where x.merchant_id=p_merchant_id and x.phone=regexp_replace(coalesce(c.normalized_phone,c.phone,''),'[^0-9]','','g'));
 update public.crm_cart_followups q set status='cancelled',reason='expired',updated_at=now()
 from public.abandoned_carts c
 where q.cart_id=c.id and q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id and q.status in ('waiting','blocked')
 and (c.status in ('expired','cancelled') or c.abandoned_at<now()-interval '24 hours');
 update public.crm_cart_followups q set status='blocked',reason=case
 when regexp_replace(coalesce(c.normalized_phone,c.phone,''),'[^0-9]','','g') !~ '^[1-9][0-9]{7,14}$' then 'missing_phone'
 when coalesce(c.checkout_url,'') !~ '^https://[^[:space:]]+$' then 'missing_url'
 else 'cart_status' end,updated_at=now()
 from public.abandoned_carts c
 where q.cart_id=c.id and q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id and q.status in ('waiting','blocked')
 and (regexp_replace(coalesce(c.normalized_phone,c.phone,''),'[^0-9]','','g') !~ '^[1-9][0-9]{7,14}$'
 or coalesce(c.checkout_url,'') !~ '^https://[^[:space:]]+$' or coalesce(c.status,'') not in ('active','contacted'));
 update public.crm_cart_followups q set status='waiting',reason=case when v_settings.enabled then 'delay' else 'paused' end,updated_at=now()
 from public.abandoned_carts c
 where q.cart_id=c.id and q.merchant_id=p_merchant_id and c.merchant_id=p_merchant_id and q.status in ('waiting','blocked')
 and regexp_replace(coalesce(c.normalized_phone,c.phone,''),'[^0-9]','','g') ~ '^[1-9][0-9]{7,14}$'
 and coalesce(c.checkout_url,'') ~ '^https://[^[:space:]]+$' and c.status in ('active','contacted');
 -- Move a due reminder outside the contact window to the next Saudi 09:00.
 if v_settings.enabled then
  update public.crm_cart_followups set scheduled_for=(
   ((now() at time zone 'Asia/Riyadh')::date + case when extract(hour from now() at time zone 'Asia/Riyadh')>=21 then 1 else 0 end)::timestamp+interval '9 hours'
   ) at time zone 'Asia/Riyadh',reason='quiet_hours',updated_at=now()
  where merchant_id=p_merchant_id and status='waiting' and scheduled_for<=now()
   and (extract(hour from now() at time zone 'Asia/Riyadh')<9 or extract(hour from now() at time zone 'Asia/Riyadh')>=21);
  update public.crm_cart_followups set status='simulated',reason='dry_run',simulated_at=now(),updated_at=now()
  where merchant_id=p_merchant_id and status='waiting' and scheduled_for<=now()
   and extract(hour from now() at time zone 'Asia/Riyadh')>=9 and extract(hour from now() at time zone 'Asia/Riyadh')<21;
 end if;
 select count(*) into v_count from public.crm_cart_followups where merchant_id=p_merchant_id;
 return v_count;
end; $$;
revoke all on function public.crm_cart_followup_refresh(bigint) from public,anon,authenticated;
grant execute on function public.crm_cart_followup_refresh(bigint) to service_role;
-- Cart projections enqueue atomically with their database update, including retries.
create or replace function public.crm_cart_followup_cart_event()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.crm_cart_followups(merchant_id,cart_id,scheduled_for)
 select new.merchant_id,new.id,new.abandoned_at+make_interval(mins=>s.delay_minutes)
 from public.crm_cart_followup_settings s
 where s.merchant_id=new.merchant_id and s.enabled and new.abandoned_at>=s.started_at
  and new.abandoned_at>=now()-interval '30 days' and new.abandoned_at<=now()
 on conflict(merchant_id,cart_id) do nothing;
 if new.status in ('recovered','purchased','expired','cancelled') or new.recovered_at is not null then
  update public.crm_cart_followups set status='cancelled',reason=case when new.status in ('recovered','purchased') or new.recovered_at is not null then 'purchased' else 'expired' end,updated_at=now()
  where merchant_id=new.merchant_id and cart_id=new.id and status<>'cancelled';
 end if;
 return new;
end; $$;
create or replace function public.crm_cart_followup_order_event()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.customer_id is not null and coalesce(new.status_slug,'') not in ('canceled','cancelled','refunded') then
  update public.crm_cart_followups q set status='cancelled',reason='purchased',updated_at=now()
  from public.abandoned_carts c where q.cart_id=c.id and q.merchant_id=new.merchant_id and c.merchant_id=new.merchant_id
   and c.customer_id=new.customer_id and new.ordered_at>=c.abandoned_at and q.status<>'cancelled';
 end if;
 return new;
end; $$;
revoke all on function public.crm_cart_followup_cart_event(),public.crm_cart_followup_order_event() from public,anon,authenticated;
grant execute on function public.crm_cart_followup_cart_event(),public.crm_cart_followup_order_event() to service_role;
drop trigger if exists crm_cart_followup_cart_event on public.abandoned_carts;
create trigger crm_cart_followup_cart_event after insert or update on public.abandoned_carts for each row execute function public.crm_cart_followup_cart_event();
drop trigger if exists crm_cart_followup_order_event on public.orders;
create trigger crm_cart_followup_order_event after insert or update on public.orders for each row execute function public.crm_cart_followup_order_event();
notify pgrst,'reload schema';
commit;
