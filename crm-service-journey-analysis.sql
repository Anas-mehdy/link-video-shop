begin;
create table if not exists public.crm_service_journey_analyses (
 merchant_id bigint not null,
 conversation_id text not null,
 fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
 state text not null default 'reserved' check (state in ('reserved','complete','failed')),
 result jsonb,
 created_at timestamptz not null default now(),
 primary key(merchant_id, conversation_id, fingerprint)
);
alter table public.crm_service_journey_analyses enable row level security;
revoke all on public.crm_service_journey_analyses from public,anon,authenticated;
grant select,update on public.crm_service_journey_analyses to service_role;
create or replace function public.crm_reserve_service_analysis(p_merchant_id bigint,p_conversation text,p_fingerprint text)
returns text language plpgsql security definer set search_path='' as $$
begin
 if p_conversation is null or p_conversation !~ '^[1-9][0-9]{0,19}$' or p_merchant_id is distinct from 1829345766 then
  raise exception 'Invalid service analysis scope';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(1829345766,4217);
 if exists(select 1 from public.crm_service_journey_analyses where merchant_id=p_merchant_id and conversation_id=p_conversation and fingerprint=p_fingerprint) then
  return 'existing';
 end if;
 -- Each reservation covers up to USD 0.004, including ambiguous attempts.
 if (select count(*) from public.crm_service_journey_analyses where merchant_id=p_merchant_id)>=250 then return 'budget'; end if;
 insert into public.crm_service_journey_analyses(merchant_id,conversation_id,fingerprint) values(p_merchant_id,p_conversation,p_fingerprint);
 return 'reserved';
end;
$$;
revoke all on function public.crm_reserve_service_analysis(bigint,text,text) from public,anon,authenticated;
grant execute on function public.crm_reserve_service_analysis(bigint,text,text) to service_role;
notify pgrst,'reload schema';
commit;
