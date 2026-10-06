begin;
create table if not exists public.crm_admin_members (
  merchant_id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role='admin'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (merchant_id,user_id)
);
alter table public.crm_admin_members enable row level security;
revoke all on public.crm_admin_members from public, anon, authenticated;
grant select, insert, update, delete on public.crm_admin_members to service_role;
notify pgrst, 'reload schema';
commit;

-- After creating your user in Authentication > Users, replace this email and run:
-- insert into public.crm_admin_members (merchant_id,user_id)
-- select 1829345766,id from auth.users where lower(email)=lower('YOUR_EMAIL_HERE')
-- on conflict (merchant_id,user_id) do update set active=true;
-- select u.email,m.active from public.crm_admin_members m join auth.users u on u.id=m.user_id where m.merchant_id=1829345766;
