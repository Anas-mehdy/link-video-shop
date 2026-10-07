-- Additive migration for the reviewed Link Store schema. Run once before sync.
begin;
alter table public.customers add column if not exists crm_source_at timestamptz;
alter table public.customers add column if not exists crm_scope_at timestamptz;
alter table public.orders add column if not exists crm_source_at timestamptz;
alter table public.abandoned_carts add column if not exists crm_source_at timestamptz;
alter table public.crm_event_inbox add column if not exists records_synced_at timestamptz;
create index if not exists crm_salla_records_pending_idx on public.crm_event_inbox (merchant_id, occurred_at, received_at) where records_synced_at is null;
create index if not exists crm_salla_order_customer_idx on public.orders (merchant_id, customer_id);
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.abandoned_carts enable row level security;
revoke all on public.customers, public.orders, public.abandoned_carts from public, anon, authenticated;
grant all on public.customers, public.orders, public.abandoned_carts to service_role;

create or replace function public.crm_apply_salla_records(p_resource text, p_records jsonb, p_event_id uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_table text; v_key text; v_allowed text[]; v_row jsonb; v_cols text; v_updates text;
  v_customer uuid; v_old_customer uuid; v_customer_ids uuid[] := '{}';
  v_count integer := 0; v_affected integer; v_merchant bigint := 1829345766;
begin
  case p_resource
    when 'customers' then v_table := 'customers'; v_key := 'external_customer_id';
    when 'orders' then v_table := 'orders'; v_key := 'external_order_id';
    when 'carts' then v_table := 'abandoned_carts'; v_key := 'external_cart_id';
    else raise exception 'Invalid resource';
  end case;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 100 then raise exception 'Invalid records'; end if;
  -- Serializes writes to one resource; preserves local contact fields and UUIDs.
  perform pg_advisory_xact_lock(hashtextextended('link-salla:' || v_table, 0));
  if p_event_id is not null then
    perform 1 from public.crm_event_inbox where id=p_event_id and merchant_id=v_merchant for update;
    if not found then raise exception 'Event not found'; end if;
    if exists (select 1 from public.crm_event_inbox where id=p_event_id and records_synced_at is not null) then return 0; end if;
  end if;
  case v_table
    when 'abandoned_carts' then v_allowed := array['external_cart_id','customer_name','phone','normalized_phone','email','currency','subtotal','total_amount','items_count','checkout_url','status','abandoned_at','recovered_at','source_payload','crm_source_at'] || array['customer_id'];
    when 'customers' then v_allowed := array['external_customer_id','name','first_name','last_name','phone','normalized_phone','email','country_code','city','source_payload','crm_source_at'];
    when 'orders' then v_allowed := array['external_order_id','order_reference','status','status_slug','payment_status','payment_method','shipping_status','shipping_company','currency','subtotal','discount_amount','shipping_amount','tax_amount','total_amount','source','utm_source','utm_medium','utm_campaign','utm_content','utm_term','coupon_code','ordered_at','source_updated_at','source_payload','crm_source_at'] || array['customer_id'];
  end case;
  if v_table='customers' then v_allowed:=v_allowed||array['crm_scope_at']; end if;
  for v_row in select value from jsonb_array_elements(p_records)
  loop
    if jsonb_typeof(v_row) <> 'object' or coalesce(v_row->>v_key,'') !~ '^[0-9]{1,40}$' or v_row->>'crm_source_at' is null then raise exception 'Invalid record'; end if;
    if v_table='orders' then
      select customer_id into v_old_customer from public.orders where merchant_id=v_merchant and external_order_id=v_row->>v_key;
      if v_old_customer is not null then v_customer_ids := array_append(v_customer_ids,v_old_customer); end if;
    end if;
    if v_row ? '_customer_external_id' then
      select id into v_customer from public.customers where merchant_id=v_merchant and external_customer_id=v_row->>'_customer_external_id';
      if v_customer is not null then v_row := v_row || jsonb_build_object('customer_id',v_customer); end if;
      if v_table='orders' and v_customer is not null then v_customer_ids := array_append(v_customer_ids,v_customer); end if;
      v_row := v_row - '_customer_external_id';
    end if;
    if exists (select 1 from jsonb_object_keys(v_row) k where not (k=any(v_allowed))) then raise exception 'Unexpected column'; end if;
    v_row := v_row || jsonb_build_object('merchant_id',v_merchant);
    select string_agg(format('%I',k),',' order by k),
      string_agg(case when v_table='abandoned_carts' and k='status' then
        'status=case when t.status=''recovered'' then t.status when t.status=''contacted'' and excluded.status=''active'' then t.status else excluded.status end'
        else format('%I=excluded.%I',k,k) end,',' order by k)
      into v_cols,v_updates from jsonb_object_keys(v_row) k where k not in ('merchant_id',v_key);
    v_updates := v_updates || ',updated_at=now()';
    select string_agg(format('%I',k),',' order by k) into v_cols from jsonb_object_keys(v_row) k;
    execute format('insert into public.%I as t (%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict (merchant_id,%I) do update set %s where t.crm_source_at is null or excluded.crm_source_at >= t.crm_source_at',v_table,v_cols,v_cols,v_table,v_key,v_updates) using v_row;
    get diagnostics v_affected = row_count;
    v_count := v_count + v_affected;
  end loop;
  if v_table='orders' then
    update public.customers c set orders_count=s.n,total_spent=s.total,first_order_at=s.first_at,last_order_at=s.last_at,crm_scope_at=greatest(c.crm_scope_at,s.last_at)
    from (
      select c2.id,count(o.id)::integer n,
        coalesce(sum(case when coalesce(o.status_slug,'') not in ('cancelled','canceled','refunded') then greatest(o.total_amount,0) else 0 end),0) total,
        min(o.ordered_at) first_at,max(o.ordered_at) last_at
      from public.customers c2 left join public.orders o on o.customer_id=c2.id and o.merchant_id=c2.merchant_id
        and o.ordered_at>=(((now() at time zone 'Asia/Riyadh')::date-29)::timestamp at time zone 'Asia/Riyadh')
      where c2.merchant_id=v_merchant and c2.id=any(v_customer_ids) group by c2.id
    ) s where c.id=s.id and c.merchant_id=v_merchant;
  end if;
  if p_event_id is not null then update public.crm_event_inbox set records_synced_at=now() where id=p_event_id; end if;
  return v_count;
end;
$$;

-- Statistics describe orders imported so far; cancelled/refunded orders excluded from spend.
create or replace function public.crm_salla_sync_stats()
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  update public.customers c set orders_count=s.n, total_spent=s.total,crm_scope_at=greatest(c.crm_scope_at,s.last_at),
    first_order_at=s.first_at,last_order_at=s.last_at
  from (
    select c2.id, count(o.id)::integer n,
      coalesce(sum(case when coalesce(o.status_slug,'') not in ('cancelled','canceled','refunded') then greatest(o.total_amount,0) else 0 end),0) total,
      min(o.ordered_at) first_at, max(o.ordered_at) last_at
    from public.customers c2 left join public.orders o on o.customer_id=c2.id and o.merchant_id=c2.merchant_id
      and o.ordered_at>=(((now() at time zone 'Asia/Riyadh')::date-29)::timestamp at time zone 'Asia/Riyadh')
    where c2.merchant_id=1829345766 group by c2.id
  ) s where c.id=s.id and c.merchant_id=1829345766;
  return jsonb_build_object('customers',(select count(*) from public.customers where merchant_id=1829345766 and crm_scope_at>=(((now() at time zone 'Asia/Riyadh')::date-29)::timestamp at time zone 'Asia/Riyadh')),
    'orders',(select count(*) from public.orders where merchant_id=1829345766 and ordered_at>=(((now() at time zone 'Asia/Riyadh')::date-29)::timestamp at time zone 'Asia/Riyadh')),
    'carts',(select count(*) from public.abandoned_carts where merchant_id=1829345766 and abandoned_at>=(((now() at time zone 'Asia/Riyadh')::date-29)::timestamp at time zone 'Asia/Riyadh')));
end;
$$;
revoke all on function public.crm_apply_salla_records(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.crm_salla_sync_stats() from public,anon,authenticated;
grant execute on function public.crm_apply_salla_records(text,jsonb,uuid) to service_role;
grant execute on function public.crm_salla_sync_stats() to service_role;
-- Read-only preflight: stop before spending Salla API requests on an old schema.
create or replace function public.crm_salla_sync_ready()
returns boolean language sql security invoker set search_path='' as $$
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='customers' and column_name='crm_scope_at')
    and position('crm_scope_at' in pg_get_functiondef('public.crm_apply_salla_records(text,jsonb,uuid)'::regprocedure))>0;
$$;
revoke all on function public.crm_salla_sync_ready() from public,anon,authenticated;
grant execute on function public.crm_salla_sync_ready() to service_role;
commit;
