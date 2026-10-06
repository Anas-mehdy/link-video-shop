begin;
create table if not exists public.crm_whatsapp_workspace (
  merchant_id bigint primary key,
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  mode text not null default 'draft' check (mode = 'draft'),
  updated_at timestamptz not null default now()
);
alter table public.crm_whatsapp_workspace enable row level security;
revoke all on public.crm_whatsapp_workspace from public, anon, authenticated;
grant select, insert, update on public.crm_whatsapp_workspace to service_role;
comment on table public.crm_whatsapp_workspace is 'Admin-only WhatsApp setup and drafts; no sending or customer messages.';
notify pgrst, 'reload schema';
commit;
