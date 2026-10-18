-- Private, derived API cache. Consent records and original order payloads are untouched.
create table if not exists public.crm_preorder_order_item_cache (
 merchant_id bigint not null,
 external_order_id text not null check (external_order_id ~ '^[0-9]{1,40}$'),
 snapshot_key text not null check (snapshot_key ~ '^[a-f0-9]{64}$'),
 state text not null check (state in ('pending','ready','error')),
 items jsonb,
 checked_at timestamptz not null default now(),
 retry_after timestamptz not null,
 primary key (merchant_id,external_order_id,snapshot_key),
 check (items is null or (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 100))
);
alter table public.crm_preorder_order_item_cache enable row level security;
revoke all on public.crm_preorder_order_item_cache from public,anon,authenticated,service_role;
grant select,insert,update on public.crm_preorder_order_item_cache to service_role;
