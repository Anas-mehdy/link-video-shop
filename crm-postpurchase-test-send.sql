begin;
create table if not exists public.crm_postpurchase_test_sends (
 id uuid primary key,
 merchant_id bigint not null,
 external_order_id text not null,
 offer_product_id text not null,
 test_phone text not null,
 status text not null default 'sending' check(status in ('sending','accepted','rejected','unknown')),
 provider_message_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.crm_postpurchase_test_sends enable row level security;
revoke all on public.crm_postpurchase_test_sends from public,anon,authenticated;
grant select,insert,update on public.crm_postpurchase_test_sends to service_role;
commit;
