begin;
create table if not exists public.crm_pp_delivery_control (
 merchant_id bigint primary key,enabled boolean not null default false,enabled_at timestamptz,updated_at timestamptz not null default now()
);
insert into public.crm_pp_delivery_control(merchant_id) values(1829345766) on conflict do nothing;
create table if not exists public.crm_pp_delivery_batches (
 merchant_id bigint not null,batch_at timestamptz not null,attempts integer not null default 0,
 lease_token uuid,lease_until timestamptz,primary key(merchant_id,batch_at)
);
create table if not exists public.crm_pp_deliveries (
 id uuid primary key default gen_random_uuid(),merchant_id bigint not null,order_id uuid not null,
 external_order_id text not null,customer_id uuid not null,phone text not null check(phone ~ '^[1-9][0-9]{7,14}$'),
 batch_at timestamptz not null,attempt_token uuid not null default gen_random_uuid(),
 status text not null default 'sending' check(status in ('sending','accepted','unknown','rejected','cancelled')),
 reason text not null default 'claimed',product_ids text[] not null,model text not null,
 attempted_at timestamptz not null default now(),finished_at timestamptz,provider_message_id text,
 unique(merchant_id,order_id)
);
create index if not exists crm_pp_deliveries_phone_recent on public.crm_pp_deliveries(merchant_id,phone,attempted_at desc);
create or replace function public.crm_pp_delivery_batch()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.crm_postpurchase_settings%rowtype;b public.crm_pp_delivery_batches%rowtype;at timestamptz;t uuid;
begin
 if not exists(select 1 from public.crm_pp_delivery_control where merchant_id=1829345766 and enabled) then return jsonb_build_object('reason','paused');end if;
 select * into s from public.crm_postpurchase_settings where merchant_id=1829345766;
 if s.merchant_id is null or not(extract(hour from now() at time zone 'Asia/Riyadh')::integer=any(s.batch_hours)) then return jsonb_build_object('reason','outside_hours');end if;
 at:=date_trunc('hour',now());
 insert into public.crm_pp_delivery_batches(merchant_id,batch_at) values(1829345766,at) on conflict do nothing;
 select * into b from public.crm_pp_delivery_batches where merchant_id=1829345766 and batch_at=at for update;
 if b.attempts>=s.batch_limit then return jsonb_build_object('reason','batch_full');end if;
 if b.lease_until>now() then return jsonb_build_object('reason','busy');end if;
 t:=gen_random_uuid();update public.crm_pp_delivery_batches set lease_token=t,lease_until=now()+interval '2 minutes' where merchant_id=1829345766 and batch_at=at;
 return jsonb_build_object('reason','reserved','batch_at',at,'token',t,'attempts',b.attempts,'limit',s.batch_limit);
end $$;
create or replace function public.crm_pp_delivery_release(p_batch_at timestamptz,p_token uuid)
returns void language sql security invoker set search_path='' as $$
 update public.crm_pp_delivery_batches set lease_token=null,lease_until=null where merchant_id=1829345766 and batch_at=p_batch_at and lease_token=p_token;
$$;
create or replace function public.crm_pp_delivery_claim(p_order_id uuid,p_phone text,p_products text[],p_model text,p_batch_at timestamptz,p_batch_token uuid,p_reviewed_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.crm_postpurchase_settings%rowtype;o public.orders%rowtype;b public.crm_pp_delivery_batches%rowtype;c public.customers%rowtype;d public.crm_pp_deliveries%rowtype;
begin
 select * into s from public.crm_postpurchase_settings where merchant_id=1829345766;
 if not found then return jsonb_build_object('reason','settings_missing');end if;
 -- Settings row serializes phone cooldown and ledger claims across callers.
 perform 1 from public.crm_pp_delivery_control where merchant_id=1829345766 and enabled for update;
 if not found then return jsonb_build_object('reason','paused');end if;
 select * into b from public.crm_pp_delivery_batches where merchant_id=1829345766 and batch_at=p_batch_at for update;
 if not found or p_batch_token is null or b.lease_until is null or b.lease_token is distinct from p_batch_token or b.lease_until<=now() or b.attempts>=s.batch_limit or p_batch_at<>date_trunc('hour',now()) or not(extract(hour from now() at time zone 'Asia/Riyadh')::integer=any(s.batch_hours)) then return jsonb_build_object('reason','invalid_batch');end if;
 if p_reviewed_at is null or p_reviewed_at<now()-interval '60 seconds' or p_reviewed_at>now() then return jsonb_build_object('reason','review_expired');end if;
 select * into o from public.orders where merchant_id=1829345766 and id=p_order_id for share;
 if not found or o.status_slug<>'delivered' or o.ordered_at<now()-interval '30 days' or o.ordered_at+make_interval(days=>s.delay_days)>now() or jsonb_typeof(o.source_payload->'items') is distinct from 'array' then return jsonb_build_object('reason','order_ineligible');end if;
 if jsonb_array_length(o.source_payload->'items')<>1 then return jsonb_build_object('reason','order_ineligible');end if;
 select * into c from public.customers where merchant_id=1829345766 and id=o.customer_id for share;
 if not found or p_phone is distinct from coalesce(nullif(c.normalized_phone,''),regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')) then return jsonb_build_object('reason','phone_changed');end if;
 if exists(select 1 from public.crm_whatsapp_optouts where merchant_id=1829345766 and phone=p_phone) then return jsonb_build_object('reason','optout');end if;
 if exists(select 1 from public.orders where merchant_id=1829345766 and customer_id=o.customer_id and crm_source_at>=p_reviewed_at) then return jsonb_build_object('reason','purchase_changed');end if;
 if exists(select 1 from public.crm_event_inbox where merchant_id=1829345766 and event_name like 'order.%' and received_at>=p_reviewed_at) then return jsonb_build_object('reason','order_event_arrived');end if;
 if exists(select 1 from public.crm_pp_deliveries where merchant_id=1829345766 and order_id=o.id) then return jsonb_build_object('reason','already_attempted');end if;
 if exists(select 1 from public.crm_pp_deliveries where merchant_id=1829345766 and phone=p_phone and attempted_at>now()-make_interval(days=>s.cooldown_days)) then return jsonb_build_object('reason','cooldown');end if;
 if p_products is null or cardinality(p_products)<1 or cardinality(p_products)>60 or p_model is null or length(p_model)>100 then return jsonb_build_object('reason','invalid_products');end if;
 if exists(select 1 from unnest(p_products) x where x is null or x !~ '^[0-9]{1,20}$' or not exists(select 1 from public.crm_pp_stock_cache k where k.merchant_id=1829345766 and k.product_id=x and k.state='checked' and k.available and k.checked_at>now()-interval '4 hours')) then return jsonb_build_object('reason','stock_not_fresh');end if;
 insert into public.crm_pp_deliveries(merchant_id,order_id,external_order_id,customer_id,phone,batch_at,product_ids,model) values(1829345766,o.id,o.external_order_id,o.customer_id,p_phone,p_batch_at,p_products,p_model) returning * into d;
 update public.crm_pp_delivery_batches set attempts=attempts+1 where merchant_id=1829345766 and batch_at=p_batch_at;
 return jsonb_build_object('reason','claimed','id',d.id,'token',d.attempt_token);
end $$;
create or replace function public.crm_pp_delivery_finish(p_id uuid,p_token uuid,p_status text,p_message_id text,p_reason text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_status not in ('accepted','unknown','rejected','cancelled') then raise exception 'invalid status';end if;
 update public.crm_pp_deliveries set status=p_status,provider_message_id=p_message_id,reason=left(p_reason,100),finished_at=now() where merchant_id=1829345766 and id=p_id and attempt_token=p_token and status='sending';get diagnostics n=row_count;return n=1;
end $$;
alter table public.crm_pp_delivery_control enable row level security;
alter table public.crm_pp_delivery_batches enable row level security;
alter table public.crm_pp_deliveries enable row level security;
revoke all on public.crm_pp_delivery_control,public.crm_pp_delivery_batches,public.crm_pp_deliveries from public,anon,authenticated;
grant all on public.crm_pp_delivery_control,public.crm_pp_delivery_batches,public.crm_pp_deliveries to service_role;
revoke all on function public.crm_pp_delivery_batch(),public.crm_pp_delivery_release(timestamptz,uuid),public.crm_pp_delivery_claim(uuid,text,text[],text,timestamptz,uuid,timestamptz),public.crm_pp_delivery_finish(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.crm_pp_delivery_batch(),public.crm_pp_delivery_release(timestamptz,uuid),public.crm_pp_delivery_claim(uuid,text,text[],text,timestamptz,uuid,timestamptz),public.crm_pp_delivery_finish(uuid,uuid,text,text,text) to service_role;
commit;
select enabled from public.crm_pp_delivery_control where merchant_id=1829345766;
