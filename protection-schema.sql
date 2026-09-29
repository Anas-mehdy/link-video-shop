-- Run once in the same Supabase project used by Video Shop.
-- The storefront reads only through /api/protection-feed. No database key is exposed.
create table if not exists public.protection_settings (
  merchant_id bigint primary key,
  enabled boolean not null default false,
  default_mode text not null default 'off' check (default_mode in ('off','protection','accessories')),
  updated_at timestamptz not null default now()
);

create table if not exists public.protection_product_rules (
  merchant_id bigint not null,
  external_product_id bigint not null,
  mode text not null default 'off' check (mode in ('off','protection','accessories')),
  brand text,
  model text,
  role text,
  color text,
  recommendations jsonb not null default '[]'::jsonb check (jsonb_typeof(recommendations) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (merchant_id, external_product_id)
);

create index if not exists protection_product_rules_merchant_mode_idx
  on public.protection_product_rules (merchant_id, mode);

alter table public.protection_settings enable row level security;
alter table public.protection_product_rules enable row level security;
revoke all on public.protection_settings from anon, authenticated;
revoke all on public.protection_product_rules from anon, authenticated;
grant select, insert, update, delete on public.protection_settings to service_role;
grant select, insert, update, delete on public.protection_product_rules to service_role;

insert into public.protection_settings (merchant_id,enabled,default_mode)
values (1829345766,false,'off')
on conflict (merchant_id) do nothing;

insert into public.protection_product_rules
  (merchant_id,external_product_id,mode,brand,model,role,recommendations)
values
  (1829345766,965494067,'protection','iphone','iPhone 18 Pro Max','lens',
   '[1724249566,474220781,1494831445,1936666261]'::jsonb)
on conflict (merchant_id,external_product_id) do nothing;
