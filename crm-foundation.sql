-- Run in Link Store CRM only. Additive: existing store/catalog/video tables are untouched.
begin;

create table if not exists public.crm_connections (
  merchant_id bigint not null,
  provider text not null check (provider in ('salla','meta','tiktok','snapchat','whatsapp')),
  status text not null default 'pending' check (status in ('pending','connected','revoked')),
  credentials_encrypted text,
  authorized_at timestamptz,
  token_expires_at timestamptz,
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (merchant_id, provider)
);
create table if not exists public.crm_event_inbox (
  id uuid primary key default gen_random_uuid(),
  merchant_id bigint not null,
  event_key text not null check (length(event_key) = 64),
  event_name text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processed')),
  processed_at timestamptz,
  unique (merchant_id, event_key)
);
create index if not exists crm_event_inbox_queue_idx on public.crm_event_inbox (merchant_id, received_at) where status = 'pending';
create index if not exists crm_event_inbox_recent_idx on public.crm_event_inbox (merchant_id, received_at desc);
create table if not exists public.crm_automation_rules (
  id uuid primary key default gen_random_uuid(),
  merchant_id bigint not null,
  name text not null check (length(name) between 1 and 100),
  event_name text not null check (event_name in ('abandoned.cart','order.created','order.status.updated','customer.created')),
  enabled boolean not null default false,
  delay_minutes integer not null default 0 check (delay_minutes between 0 and 10080),
  mode text not null default 'dry_run' check (mode = 'dry_run'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, name)
);
create table if not exists public.crm_automation_runs (
  id uuid primary key default gen_random_uuid(),
  merchant_id bigint not null,
  rule_id uuid not null references public.crm_automation_rules(id),
  event_id uuid not null references public.crm_event_inbox(id),
  status text not null default 'simulated' check (status = 'simulated'),
  scheduled_for timestamptz not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  unique (event_id, rule_id)
);
create index if not exists crm_automation_runs_recent_idx on public.crm_automation_runs (merchant_id, created_at desc);

alter table public.crm_connections enable row level security;
alter table public.crm_event_inbox enable row level security;
alter table public.crm_automation_rules enable row level security;
alter table public.crm_automation_runs enable row level security;
revoke all on public.crm_connections, public.crm_event_inbox, public.crm_automation_rules, public.crm_automation_runs from anon, authenticated;
grant all on public.crm_connections, public.crm_event_inbox, public.crm_automation_rules, public.crm_automation_runs to service_role;

-- SECURITY INVOKER: only service_role may call these functions.
create or replace function public.crm_ingest_event(
  p_merchant_id bigint, p_event_key text, p_event_name text,
  p_occurred_at timestamptz, p_payload jsonb,
  p_credentials text default null, p_expires_at timestamptz default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_merchant_id is null or p_event_name is null or p_occurred_at is null then
    raise exception 'Invalid event';
  end if;
  if p_event_name = 'app.store.authorize' and (p_credentials is null or p_expires_at is null) then
    raise exception 'Missing encrypted credentials';
  end if;
  insert into public.crm_event_inbox (merchant_id, event_key, event_name, occurred_at, payload)
  values (p_merchant_id, p_event_key, p_event_name, p_occurred_at, p_payload)
  on conflict (merchant_id, event_key) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.crm_event_inbox where merchant_id = p_merchant_id and event_key = p_event_key;
    return jsonb_build_object('event_id', v_id, 'duplicate', true);
  end if;
  if p_event_name in ('app.store.authorize','app.uninstalled') then
    insert into public.crm_connections (merchant_id, provider, status, credentials_encrypted, authorized_at, token_expires_at, last_event_at)
    values (p_merchant_id, 'salla', case when p_event_name = 'app.uninstalled' then 'revoked' else 'connected' end,
      case when p_event_name = 'app.uninstalled' then null else p_credentials end,
      case when p_event_name = 'app.uninstalled' then null else p_occurred_at end,
      case when p_event_name = 'app.uninstalled' then null else p_expires_at end, p_occurred_at)
    on conflict (merchant_id, provider) do update set
      status = excluded.status, credentials_encrypted = excluded.credentials_encrypted,
      authorized_at = excluded.authorized_at, token_expires_at = excluded.token_expires_at,
      last_event_at = excluded.last_event_at, updated_at = now()
    where public.crm_connections.last_event_at is null or excluded.last_event_at > public.crm_connections.last_event_at
      or (excluded.last_event_at = public.crm_connections.last_event_at and excluded.status = 'revoked');
  end if;
  return jsonb_build_object('event_id', v_id, 'duplicate', false);
end;
$$;

-- Atomically claim pending events. Concurrent workers skip each other's locked rows.
-- No outbound HTTP calls/messages exist in this foundation.
create or replace function public.crm_process_events(p_merchant_id bigint, p_limit integer default 20)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_event public.crm_event_inbox%rowtype; v_count integer := 0;
begin
  for v_event in select * from public.crm_event_inbox
    where merchant_id = p_merchant_id and status = 'pending'
    order by received_at limit greatest(1, least(coalesce(p_limit,20),100)) for update skip locked
  loop
    insert into public.crm_automation_runs (merchant_id, rule_id, event_id, scheduled_for, summary)
    select p_merchant_id, r.id, v_event.id, v_event.occurred_at + r.delay_minutes * interval '1 minute',
      jsonb_build_object('rule_name',r.name,'event_name',v_event.event_name,'mode','dry_run','message_sent',false)
    from public.crm_automation_rules r
    where r.merchant_id = p_merchant_id and r.enabled and r.event_name = v_event.event_name
    on conflict (event_id, rule_id) do nothing;
    update public.crm_event_inbox set status = 'processed', processed_at = now() where id = v_event.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.crm_ingest_event(bigint,text,text,timestamptz,jsonb,text,timestamptz) from public, anon, authenticated;
revoke all on function public.crm_process_events(bigint,integer) from public, anon, authenticated;
grant execute on function public.crm_ingest_event(bigint,text,text,timestamptz,jsonb,text,timestamptz) to service_role;
grant execute on function public.crm_process_events(bigint,integer) to service_role;

insert into public.crm_connections (merchant_id, provider)
select 1829345766, p from unnest(array['salla','meta','tiktok','snapchat','whatsapp']) as p
on conflict do nothing;
insert into public.crm_automation_rules (merchant_id, name, event_name, delay_minutes)
values (1829345766, 'تذكير السلة المتروكة', 'abandoned.cart', 60),
       (1829345766, 'متابعة الطلب الجديد', 'order.created', 0),
       (1829345766, 'متابعة تغيير حالة الطلب', 'order.status.updated', 1440)
on conflict do nothing;
commit;
