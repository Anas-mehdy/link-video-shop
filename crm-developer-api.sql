-- Dedicated, revocable API credentials. Raw bearer keys are never stored.
create table if not exists public.crm_developer_keys (
 id uuid primary key default gen_random_uuid(), merchant_id bigint not null,
 name text not null check(length(name) between 1 and 80), key_hash text not null unique check(key_hash ~ '^[a-f0-9]{64}$'),
 key_prefix text not null, scopes text[] not null check(cardinality(scopes) between 1 and 7 and scopes <@ array['store','products','variants','categories','orders','customers','carts']::text[]),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '90 days', revoked_at timestamptz,
 last_used_at timestamptz, total_requests bigint not null default 0,
 minute_at timestamptz, minute_requests integer not null default 0,
 day_at date, day_requests integer not null default 0
);
create index if not exists crm_developer_keys_merchant on public.crm_developer_keys(merchant_id,created_at desc);
alter table public.crm_developer_keys enable row level security;
revoke all on public.crm_developer_keys from public,anon,authenticated;
grant select,insert,update,delete on public.crm_developer_keys to service_role;
create or replace function public.crm_developer_consume(p_merchant_id bigint,p_hash text,p_scope text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare k public.crm_developer_keys%rowtype;m timestamptz:=date_trunc('minute',now());d date:=(now() at time zone 'UTC')::date;mc integer;dc integer;
begin
 select * into k from public.crm_developer_keys where merchant_id=p_merchant_id and key_hash=p_hash for update;
 if not found or k.revoked_at is not null or k.expires_at<=now() then return jsonb_build_object('status',401);end if;
 if not(p_scope=any(k.scopes)) then return jsonb_build_object('status',403);end if;
 mc:=case when k.minute_at=m then k.minute_requests else 0 end;
 dc:=case when k.day_at=d then k.day_requests else 0 end;
 if mc>=60 or dc>=3000 then return jsonb_build_object('status',429,'retry_after',case when dc>=3000 then greatest(1,ceil(extract(epoch from ((d+1)::timestamp at time zone 'UTC')-now()))::int) else 60 end);end if;
 update public.crm_developer_keys set minute_at=m,minute_requests=mc+1,day_at=d,day_requests=dc+1,total_requests=total_requests+1,last_used_at=now() where id=k.id;
 return jsonb_build_object('status',200,'remaining_minute',59-mc,'remaining_day',2999-dc);
end $$;
revoke all on function public.crm_developer_consume(bigint,text,text) from public,anon,authenticated;
grant execute on function public.crm_developer_consume(bigint,text,text) to service_role;
create or replace function public.crm_developer_categories(p_merchant_id bigint,p_offset integer,p_limit integer)
returns table(id text,name text) language sql stable security invoker set search_path='' as $$
 select c->>'id',min(case when jsonb_typeof(c->'name')='string' then c->>'name' else c->'name'->>'ar' end)
 from public.products p cross join lateral jsonb_array_elements(case when jsonb_typeof(p.categories)='array' then p.categories else '[]'::jsonb end)c
 where p.merchant_id=p_merchant_id and c->>'id' ~ '^[0-9]{1,20}$'
 group by c->>'id' order by c->>'id' limit least(greatest(p_limit,1),101) offset least(greatest(p_offset,0),100000)
$$;
revoke all on function public.crm_developer_categories(bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.crm_developer_categories(bigint,integer,integer) to service_role;
