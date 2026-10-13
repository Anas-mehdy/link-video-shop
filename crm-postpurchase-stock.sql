begin;
create table if not exists public.crm_pp_stock_usage (
 merchant_id bigint not null, month date not null, requests integer not null default 0 check(requests>=0),
 primary key(merchant_id,month)
);
create table if not exists public.crm_pp_stock_cache (
 merchant_id bigint not null, product_id text not null check(product_id ~ '^[0-9]{1,20}$'),
 state text not null default 'unknown' check(state in ('unknown','checking','checked','error')),
 available boolean not null default false, snapshot jsonb not null default '{}'::jsonb,
 checked_at timestamptz, attempted_at timestamptz, retry_after timestamptz,
 lease_token uuid, lease_until timestamptz,
 primary key(merchant_id,product_id)
);
create or replace function public.crm_pp_stock_reserve(p_merchant_id bigint,p_product_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.crm_pp_stock_cache%rowtype; u public.crm_pp_stock_usage%rowtype; b integer; m date; t uuid;
begin
 if p_merchant_id<>1829345766 or p_product_id is null or p_product_id !~ '^[0-9]{1,20}$' then raise exception 'invalid scope'; end if;
 select least(stock_api_budget,700) into b from public.crm_postpurchase_settings where merchant_id=p_merchant_id;
 if b is null then return jsonb_build_object('reason','not_configured'); end if;
 m:=date_trunc('month',now() at time zone 'Asia/Riyadh')::date;
 insert into public.crm_pp_stock_usage(merchant_id,month) values(p_merchant_id,m) on conflict do nothing;
 select * into u from public.crm_pp_stock_usage where merchant_id=p_merchant_id and month=m for update;
 insert into public.crm_pp_stock_cache(merchant_id,product_id) values(p_merchant_id,p_product_id) on conflict do nothing;
 select * into c from public.crm_pp_stock_cache where merchant_id=p_merchant_id and product_id=p_product_id for update;
 if c.state='checked' and c.checked_at>now()-interval '4 hours' then return jsonb_build_object('reason','cached','available',c.available,'requests',u.requests,'budget',b); end if;
 if c.lease_until>now() then return jsonb_build_object('reason','busy','requests',u.requests,'budget',b); end if;
 if c.retry_after>now() then return jsonb_build_object('reason','retry_later','requests',u.requests,'budget',b); end if;
 if u.requests>=b then return jsonb_build_object('reason','budget_limit','requests',u.requests,'budget',b); end if;
 t:=gen_random_uuid();
 update public.crm_pp_stock_usage set requests=requests+1 where merchant_id=p_merchant_id and month=m;
 update public.crm_pp_stock_cache set state='checking',available=false,attempted_at=now(),lease_token=t,lease_until=now()+interval '2 minutes',retry_after=null where merchant_id=p_merchant_id and product_id=p_product_id;
 return jsonb_build_object('reason','reserved','token',t,'requests',u.requests+1,'budget',b);
end $$;
create or replace function public.crm_pp_stock_finish(p_merchant_id bigint,p_product_id text,p_token uuid,p_snapshot jsonb,p_error boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_merchant_id<>1829345766 then raise exception 'invalid scope'; end if;
 if not p_error and (jsonb_typeof(p_snapshot) is distinct from 'object' or jsonb_typeof(p_snapshot->'available') is distinct from 'boolean' or p_snapshot->>'id' is distinct from p_product_id) then raise exception 'invalid snapshot'; end if;
 update public.crm_pp_stock_cache set state=case when p_error then 'error' else 'checked' end,
 available=case when p_error then false else (p_snapshot->>'available')::boolean end,
 snapshot=case when p_error then '{}'::jsonb else p_snapshot end,
 checked_at=case when p_error then null else now() end,
 retry_after=case when p_error then now()+interval '15 minutes' else null end,
 lease_token=null,lease_until=null
 where merchant_id=p_merchant_id and product_id=p_product_id and lease_token=p_token and state='checking';
 get diagnostics n=row_count;return n=1;
end $$;
alter table public.crm_pp_stock_cache enable row level security;
alter table public.crm_pp_stock_usage enable row level security;
revoke all on public.crm_pp_stock_cache,public.crm_pp_stock_usage from public,anon,authenticated;
grant all on public.crm_pp_stock_cache,public.crm_pp_stock_usage to service_role;
revoke all on function public.crm_pp_stock_reserve(bigint,text),public.crm_pp_stock_finish(bigint,text,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.crm_pp_stock_reserve(bigint,text),public.crm_pp_stock_finish(bigint,text,uuid,jsonb,boolean) to service_role;
update public.crm_postpurchase_settings set stock_api_budget=700,updated_at=now() where merchant_id=1829345766;
commit;
select 'stock_check_ready' as result;
