-- SETUP ONLY: does not activate collection, alter existing tables/functions,
-- install triggers, change order tracking, or backfill past approvals.
-- Uses new names exclusively. A rerun fails atomically rather than silently
-- trusting an existing table with a potentially incompatible schema.
begin;
set local lock_timeout='3s';
set local statement_timeout='10s';

create table public.crm_preorder_consent_control (
 merchant_id bigint primary key check(merchant_id=1829345766),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.crm_preorder_consent_records (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null check(merchant_id=1829345766),
 checkout_id text not null check(checkout_id ~ '^[0-9]{1,40}$'),
 stage text not null check(stage in ('intent','finalized')),
 choice text not null check(choice='together'),
 affirmative boolean not null check(affirmative),
 policy_version text not null check(length(policy_version) between 1 and 80),
 policy_text text not null check(length(policy_text) between 1 and 12000),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100),
 schedules jsonb not null check(jsonb_typeof(schedules)='array' and jsonb_array_length(schedules) between 1 and 100),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 received_at timestamptz not null default now(),
 provenance text not null default 'browser_interaction' check(provenance='browser_interaction')
);
create index crm_preorder_consent_records_checkout_idx
 on public.crm_preorder_consent_records(merchant_id,checkout_id,received_at desc);

alter table public.crm_preorder_consent_control enable row level security;
alter table public.crm_preorder_consent_records enable row level security;
revoke all on public.crm_preorder_consent_control from public,anon,authenticated,service_role;
revoke all on public.crm_preorder_consent_records from public,anon,authenticated,service_role;
grant select on public.crm_preorder_consent_control to service_role;
-- Service may append evidence, never edit/delete it through the Data API.
grant select on public.crm_preorder_consent_records to service_role;
grant insert(merchant_id,checkout_id,stage,choice,affirmative,policy_version,policy_text,items,schedules,fingerprint)
 on public.crm_preorder_consent_records to service_role;

insert into public.crm_preorder_consent_control(merchant_id,enabled) values(1829345766,false);
select enabled as consent_collection_enabled,
 'storage_ready_not_active'::text as status
 from public.crm_preorder_consent_control where merchant_id=1829345766;
commit;
