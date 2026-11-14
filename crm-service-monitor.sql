begin;
create table if not exists public.crm_service_monitor_messages (
 merchant_id bigint not null,
 message_id text not null,
 conversation_id text not null,
 contact_phone text,
 contact_name text,
 actor text not null check (actor in ('customer','employee','automation','unverified')),
 body text,
 occurred_at timestamptz not null,
 primary key (merchant_id,message_id)
);
create index if not exists crm_service_monitor_timeline on public.crm_service_monitor_messages(merchant_id,conversation_id,occurred_at,message_id);
create index if not exists crm_service_monitor_period on public.crm_service_monitor_messages(merchant_id,occurred_at,message_id);
alter table public.crm_service_monitor_messages enable row level security;
revoke all on public.crm_service_monitor_messages from public,anon,authenticated;
grant select,insert on public.crm_service_monitor_messages to service_role;
notify pgrst,'reload schema';
commit;
