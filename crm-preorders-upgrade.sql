-- Upgrade the previously installed preorder module, preserving all rows.
-- Only preorder objects and its named order-queue trigger are changed.
-- Constraint DROP below replaces FK rules, never drops a table or customer/order row.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.orders in share row exclusive mode;
lock table public.crm_preorder_batches,public.crm_preorder_reservations,
 public.crm_preorder_order_queue,public.crm_preorder_notices,public.crm_preorder_audit
 in share row exclusive mode;

do $$ declare counts jsonb; begin
 if to_regprocedure('public.crm_queue_preorder_order()') is null then raise exception 'previous_preorder_module_missing';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='crm_queue_preorder_order') then
  if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='crm_queue_preorder_order'
   and tgfoid='public.crm_queue_preorder_order()'::regprocedure and tgtype=21) then raise exception 'unexpected_preorder_trigger';end if;
  alter table public.orders disable trigger crm_queue_preorder_order;
 end if;
 counts:=jsonb_build_object(
  'batches',(select count(*) from public.crm_preorder_batches),
  'reservations',(select count(*) from public.crm_preorder_reservations),
  'queue',(select count(*) from public.crm_preorder_order_queue),
  'notices',(select count(*) from public.crm_preorder_notices),
  'audit',(select count(*) from public.crm_preorder_audit));
 perform set_config('link.preorder_upgrade_counts',counts::text,true);
end $$;

alter table public.crm_preorder_reservations add column if not exists external_order_id text;
alter table public.crm_preorder_reservations add column if not exists order_reference text;
update public.crm_preorder_reservations r set external_order_id=o.external_order_id,order_reference=o.order_reference
from public.orders o where r.order_id=o.id and r.merchant_id=o.merchant_id and r.external_order_id is null;
do $$ begin
 if exists(select 1 from public.crm_preorder_reservations where external_order_id is null or external_order_id !~ '^[0-9]{1,40}$') then
  raise exception 'reservation_order_identity_needs_review';
 end if;
end $$;
alter table public.crm_preorder_reservations alter column external_order_id set not null;
alter table public.crm_preorder_reservations alter column order_id drop not null;

-- Replace only the single-column order FK on each of the two preorder tables.
-- Reject unexpected schemas instead of guessing constraint names or dropping other FKs.
do $$ declare table_name text; wanted "char"; constraints text[]; constraint_name text; begin
 foreach table_name in array array['crm_preorder_reservations','crm_preorder_order_queue'] loop
  wanted:=case when table_name='crm_preorder_reservations' then 'n' else 'c' end;
  select array_agg(k.conname) into constraints from pg_constraint k
  join pg_attribute a on a.attrelid=k.conrelid and a.attname='order_id'
  where k.conrelid=to_regclass('public.'||table_name) and k.contype='f'
   and k.confrelid='public.orders'::regclass and k.conkey=array[a.attnum];
  if coalesce(cardinality(constraints),0)<>1 then raise exception 'unexpected_order_foreign_key';end if;
  constraint_name:=constraints[1];
  if not exists(select 1 from pg_constraint where conrelid=to_regclass('public.'||table_name) and conname=constraint_name and confdeltype=wanted) then
   execute format('alter table public.%I drop constraint %I',table_name,constraint_name);
   execute format('alter table public.%I add constraint %I foreign key(order_id) references public.orders(id) on delete %s',
    table_name,constraint_name,case when wanted='n' then 'set null' else 'cascade' end);
  end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.crm_preorder_reservations'::regclass and conname='crm_preorder_external_order_unique') then
  alter table public.crm_preorder_reservations add constraint crm_preorder_external_order_unique unique(merchant_id,external_order_id,item_key);
 end if;
end $$;

-- Current setup definitions follow inside the same transaction.

-- Refuse an older preorder schema rather than modifying its constraints silently.
do $$ begin
 if to_regclass('public.crm_preorder_reservations') is not null and not exists(
  select 1 from information_schema.columns where table_schema='public' and table_name='crm_preorder_reservations' and column_name='external_order_id'
 ) then raise exception 'preorder_schema_version_mismatch';end if;
end $$;

-- Stage 1: internal batch/reservation management. No Salla writes or outbound messages.
create table if not exists public.crm_preorder_batches (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null,
 name text not null check(length(name) between 1 and 150),
 product_id text not null check(product_id ~ '^[0-9]{1,40}$'),
 variant_id text not null default '' check(variant_id='' or variant_id ~ '^[0-9]{1,40}$'),
 product_name text not null check(length(product_name) between 1 and 150),
 color text not null check(length(color) between 1 and 80),
 incoming_quantity integer not null check(incoming_quantity between 1 and 100000),
 booking_limit integer not null check(booking_limit between 1 and 100000),
 expected_arrival date not null,
 ship_from date not null,
 ship_by date not null,
 status text not null default 'draft' check(status in ('draft','open','paused','received','closed')),
 opened_at timestamptz,
 received_quantity integer not null default 0 check(received_quantity between 0 and 100000),
 received_at timestamptz,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(booking_limit<=incoming_quantity),
 check(expected_arrival<=ship_from and ship_from<=ship_by),
 unique(merchant_id,id)
);
create index if not exists crm_preorder_batch_lookup on public.crm_preorder_batches(merchant_id,product_id,variant_id,status);
create table if not exists public.crm_preorder_reservations (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null,
 batch_id uuid not null,
 order_id uuid references public.orders(id) on delete set null,
 external_order_id text not null check(external_order_id ~ '^[0-9]{1,40}$'),
 order_reference text,
 item_key text not null,
 quantity integer not null check(quantity between 1 and 100000),
 allocated_quantity integer not null default 0 check(allocated_quantity>=0 and allocated_quantity<=quantity),
 state text not null default 'payment_pending' check(state in ('payment_pending','reserved','allocated','shipped','delivered','cancelled','refunded','review')),
 review_reason text,
 paid_at timestamptz,
 payment_status text,
 promised_ship_from date not null,
 promised_ship_by date not null,
 promise_evidence text not null default 'batch_at_first_observation',
 mixed_order boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(merchant_id,batch_id) references public.crm_preorder_batches(merchant_id,id),
 unique(merchant_id,order_id,item_key),
 unique(merchant_id,external_order_id,item_key)
);
create index if not exists crm_preorder_reservation_batch on public.crm_preorder_reservations(merchant_id,batch_id,state,paid_at);
create table if not exists public.crm_preorder_order_queue (
 merchant_id bigint not null,
 order_id uuid not null references public.orders(id) on delete cascade,
 queued_at timestamptz not null default now(),
 last_error text,
 primary key(merchant_id,order_id)
);
create table if not exists public.crm_preorder_notices (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null,
 reservation_id uuid not null references public.crm_preorder_reservations(id),
 kind text not null check(kind in ('confirmation','schedule_change','ready')),
 revision integer not null,
 status text not null default 'review' check(status in ('review','dismissed')),
 details jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(merchant_id,reservation_id,kind,revision)
);
create table if not exists public.crm_preorder_audit (
 id uuid primary key default gen_random_uuid(),
 merchant_id bigint not null,
 batch_id uuid not null,
 action text not null,
 details jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(merchant_id,batch_id) references public.crm_preorder_batches(merchant_id,id)
);

-- Queue only eligible new orders, or already enrolled reservations (even after 30 days).
-- A failure in later processing cannot lose the source order update.
create or replace function public.crm_queue_preorder_order()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.crm_preorder_reservations r where r.merchant_id=new.merchant_id and (r.order_id=new.id or r.external_order_id=new.external_order_id))
 or exists(
  select 1 from public.crm_preorder_batches b
  cross join lateral jsonb_array_elements(case when jsonb_typeof(new.source_payload->'items')='array' then new.source_payload->'items' else '[]'::jsonb end) i
  where b.merchant_id=new.merchant_id and b.status='open' and new.ordered_at>=b.opened_at
  and coalesce(i->'product'->>'id',i->>'product_id')=b.product_id
  and (b.variant_id='' or coalesce(i->>'product_sku_id',i->'sku'->>'id',i->>'sku_id','')=b.variant_id)
 ) then
  insert into public.crm_preorder_order_queue(merchant_id,order_id) values(new.merchant_id,new.id)
  on conflict(merchant_id,order_id) do update set queued_at=now(),last_error=null;
 end if;
 return new;
end $$;
-- The orders trigger is deliberately installed separately by crm-preorders-activate.sql.
create or replace function public.crm_preorder_tracking_active()
returns boolean language sql security invoker set search_path='' as $$
 select exists(select 1 from pg_trigger where tgrelid=to_regclass('public.orders')
 and tgname='crm_queue_preorder_order' and tgfoid='public.crm_queue_preorder_order()'::regprocedure and tgenabled in ('O','A'));
$$;

-- Only the NEW reservation row is changed. No reads/writes to unrelated tables
-- occur during an orders DELETE's FK SET NULL operation.
create or replace function public.crm_preorder_order_detached()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.order_id is not null and new.order_id is null and new.state not in ('cancelled','refunded') then
  new.state:='review';new.review_reason:='order_deleted';new.updated_at:=now();
 end if;
 return new;
end $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.crm_preorder_reservations'::regclass and tgname='crm_preorder_order_detached') then
  create trigger crm_preorder_order_detached before update of order_id on public.crm_preorder_reservations
  for each row execute function public.crm_preorder_order_detached();
 end if;
end $$;

create or replace function public.crm_preorder_notice(p_reservation uuid,p_kind text,p_revision integer)
returns void language sql security invoker set search_path='' as $$
 insert into public.crm_preorder_notices(merchant_id,reservation_id,kind,revision,details)
 select r.merchant_id,r.id,p_kind,p_revision,jsonb_build_object(
  'product_name',b.product_name,'color',b.color,'quantity',r.quantity,
  'external_order_id',o.external_order_id,'original_ship_from',r.promised_ship_from,'original_ship_by',r.promised_ship_by,
  'current_ship_from',b.ship_from,'current_ship_by',b.ship_by,'message_sent',false)
 from public.crm_preorder_reservations r join public.crm_preorder_batches b on b.id=r.batch_id and b.merchant_id=r.merchant_id
 join public.orders o on o.id=r.order_id and o.merchant_id=r.merchant_id
 where r.id=p_reservation on conflict do nothing;
$$;

-- Every mutation uses the same merchant lock: receipt, FIFO allocation and order changes cannot race.
create or replace function public.crm_preorder_allocate(p_merchant_id bigint,p_batch_id uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare b public.crm_preorder_batches; r public.crm_preorder_reservations; remaining integer; n integer:=0;
begin
 perform pg_advisory_xact_lock(p_merchant_id);
 select * into b from public.crm_preorder_batches where merchant_id=p_merchant_id and id=p_batch_id for update;
 if b.status<>'received' then return 0; end if;
 select b.received_quantity-coalesce(sum(allocated_quantity),0)::integer into remaining
 from public.crm_preorder_reservations where merchant_id=p_merchant_id and batch_id=p_batch_id;
 for r in select * from public.crm_preorder_reservations
 where merchant_id=p_merchant_id and batch_id=p_batch_id and state='reserved' and order_id is not null
 order by paid_at,created_at,id for update loop
  -- Do not skip the first customer's larger reservation to fulfill a later one.
  if r.quantity>remaining then exit; end if;
  update public.crm_preorder_reservations set allocated_quantity=quantity,state='allocated',updated_at=now() where id=r.id;
  perform public.crm_preorder_notice(r.id,'ready',b.revision);
  remaining:=remaining-r.quantity;n:=n+1;
 end loop;
 return n;
end $$;

-- Payment evidence is normalized only inside preorders; source orders are unchanged.
create or replace function public.crm_preorder_payment(p_status text,p_payload jsonb)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare s text:=lower(coalesce(p_status,'')); a jsonb:=p_payload->'payment_actions';
 total numeric; received numeric; refunded numeric; remaining numeric; currency text;
begin
 -- An order's shipping status or selected payment method never proves payment.
 if p_payload->>'_crm_preorder_refund_observed'='true'
 or a->'refund_action'->>'has_refund_amount'='true'
 or coalesce(a->'refund_action'->'pending_refund_amount'->>'amount',a->'refund_action'->>'pending_refund_amount','0') not in ('0','0.0','0.00','null')
 or (jsonb_typeof(a->'refund_action'->'refunded_transactions')='array' and jsonb_array_length(a->'refund_action'->'refunded_transactions')>0)
 then return 'partially_refunded';end if;
 if coalesce(a->'refund_action'->'refund_amount'->>'amount','0') !~ '^[0-9]+([.][0-9]{1,2})?$' then return 'unknown';end if;
 refunded:=coalesce(a->'refund_action'->'refund_amount'->>'amount','0')::numeric;
 if refunded>0 then return 'partially_refunded';end if;
 if s in ('refunded','partially_refunded','partial_refund','partially_paid') then return s;end if;
 if p_payload->>'is_pending_payment'='true' then return 'pending';end if;
 if a->'remaining_action'->>'has_remaining_amount'='true' then return 'partially_paid';end if;
 if s<>'' and s not in ('paid','completed') then return s;end if;
 -- Legacy explicit statuses remain supported when no modern money evidence exists.
 if a is null or a='null'::jsonb then return case when s in ('paid','completed') then s else 'unknown' end;end if;
 if coalesce(p_payload->'amounts'->'total'->>'amount',p_payload->'total'->>'amount','') !~ '^[0-9]+([.][0-9]{1,2})?$'
 or coalesce(a->'remaining_action'->'paid_amount'->>'amount','') !~ '^[0-9]+([.][0-9]{1,2})?$'
 or coalesce(a->'remaining_action'->'remaining_amount'->>'amount','0') !~ '^[0-9]+([.][0-9]{1,2})?$' then return 'unknown';end if;
 total:=coalesce(p_payload->'amounts'->'total'->>'amount',p_payload->'total'->>'amount')::numeric;
 received:=(a->'remaining_action'->'paid_amount'->>'amount')::numeric;
 remaining:=coalesce(a->'remaining_action'->'remaining_amount'->>'amount','0')::numeric;
 currency:=p_payload->>'currency';
 if currency is distinct from 'SAR'
 or coalesce(p_payload->'amounts'->'total'->>'currency',p_payload->'total'->>'currency',currency)<>currency
 or coalesce(a->'remaining_action'->'paid_amount'->>'currency',currency)<>currency then return 'unknown';end if;
 if total>0 and received=total and remaining=0
 and a->'remaining_action'->>'has_remaining_amount'='false'
 and a->'refund_action'->>'has_refund_amount'='false'
 and a->'refund_action'->'refund_amount'->>'amount' is not null then return 'paid';end if;
 if received>0 then return 'partially_paid';end if;
 return 'pending';
end $$;

create or replace function public.crm_preorder_reconcile(p_merchant_id bigint,p_limit integer default 20)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q record; o public.orders; b public.crm_preorder_batches; r public.crm_preorder_reservations;
 item jsonb; items jsonb; key text; product text; variant text; qty integer; seen text[];
 used integer; paid boolean; old_state text; new_state text; reason text; touched uuid[];
 processed integer:=0; errors integer:=0; payment text;
begin
 if p_limit not between 1 and 50 then raise exception 'invalid_limit'; end if;
 perform pg_advisory_xact_lock(p_merchant_id);
 for q in select * from public.crm_preorder_order_queue where merchant_id=p_merchant_id
 order by (last_error is not null),queued_at,order_id limit p_limit for update loop
  begin
   select * into strict o from public.orders where id=q.order_id and merchant_id=p_merchant_id;
   seen:=array[]::text[];touched:=array[]::uuid[];
   payment:=public.crm_preorder_payment(o.payment_status,o.source_payload);
   paid:=payment in ('paid','completed');
   items:=case when jsonb_typeof(o.source_payload->'items')='array' then o.source_payload->'items' else null end;
   -- Partial snapshots cannot remove paid lines or prove which variant was ordered.
   if items is null then raise exception 'items_snapshot_missing'; end if;
   for item in select value from jsonb_array_elements(items) loop
    product:=coalesce(item->'product'->>'id',item->>'product_id');variant:=coalesce(item->>'product_sku_id',item->'sku'->>'id',item->>'sku_id','');
    key:=item->>'id';
    select * into r from public.crm_preorder_reservations where merchant_id=p_merchant_id and external_order_id=o.external_order_id and item_key=key;
    if r.id is not null then
     -- Re-importing a deleted order reattaches its reservation, but retains review.
     if r.order_id is null then update public.crm_preorder_reservations set order_id=o.id where id=r.id;end if;
     select * into b from public.crm_preorder_batches where merchant_id=p_merchant_id and id=r.batch_id for update;
    else
     select * into b from public.crm_preorder_batches where merchant_id=p_merchant_id and status='open'
     and product_id=product and (variant_id='' or variant_id=variant) and o.ordered_at>=opened_at for update;
    end if;
    if b.id is null then continue; end if;
    if key is null or key !~ '^[0-9]{1,40}$' then raise exception 'item_identifier_missing'; end if;
    if key=any(seen) then raise exception 'duplicate_item_identifier'; end if;
    seen:=array_append(seen,key);touched:=array_append(touched,b.id);
    if coalesce(item->>'quantity','') !~ '^[0-9]{1,6}$' then raise exception 'invalid_item_quantity'; end if;
    qty:=(item->>'quantity')::integer;if qty not between 1 and 100000 then raise exception 'invalid_item_quantity'; end if;
    reason:=null;old_state:=r.state;
    if r.id is null then
     insert into public.crm_preorder_reservations(merchant_id,batch_id,order_id,external_order_id,order_reference,item_key,quantity,promised_ship_from,promised_ship_by,mixed_order)
     values(p_merchant_id,b.id,o.id,o.external_order_id,o.order_reference,key,qty,b.ship_from,b.ship_by,jsonb_array_length(items)>1) returning * into r;
    end if;
    new_state:=r.state;
    if product<>b.product_id or (b.variant_id<>'' and variant<>b.variant_id) or qty<>r.quantity then
     new_state:='review';reason:='item_changed';
    elsif o.status_slug in ('cancelled','canceled','refunded','restored') or payment='refunded' then
     if r.state in ('shipped','delivered') or r.allocated_quantity>0 and r.state='review' then new_state:='review';reason:='return_stock_unverified';
     else new_state:=case when o.status_slug in ('refunded','restored') or payment='refunded' then 'refunded' else 'cancelled' end;
      update public.crm_preorder_reservations set allocated_quantity=0 where id=r.id;
     end if;
    elsif o.source_payload->>'_crm_preorder_refund_observed'='true' then
     -- A refund event alone does not prove a full refund of this particular line.
     new_state:='review';reason:='refund_needs_review';
    elsif payment in ('partially_refunded','partial_refund','partially_paid') then
     new_state:='review';reason:='payment_review';
    elsif r.state in ('cancelled','refunded','review') then
     -- Do not reopen a cancelled reservation or silently clear an operational review.
     new_state:=r.state;reason:=r.review_reason;
    elsif o.status_slug in ('shipped','delivering','delivered') then
     if r.allocated_quantity=r.quantity then new_state:=case when o.status_slug='delivering' then 'shipped' else o.status_slug end;
     else new_state:='review';reason:='shipment_before_allocation';end if;
    elsif paid then
     if r.state='payment_pending' then
      select coalesce(sum(quantity),0)::integer into used from public.crm_preorder_reservations
      where merchant_id=p_merchant_id and batch_id=b.id and id<>r.id and state in ('reserved','allocated','shipped','delivered','review') and paid_at is not null;
      if used+r.quantity>b.booking_limit then new_state:='review';reason:='booking_capacity_exceeded';else new_state:='reserved';end if;
     end if;
    elsif r.paid_at is not null then new_state:='review';reason:='payment_changed';
    end if;
    update public.crm_preorder_reservations set state=new_state,review_reason=reason,payment_status=payment,
     paid_at=case when paid then coalesce(paid_at,o.crm_source_at,now()) else paid_at end,
     mixed_order=jsonb_array_length(items)>1,updated_at=now() where id=r.id;
    if new_state='reserved' and old_state is distinct from 'reserved' then perform public.crm_preorder_notice(r.id,'confirmation',1);end if;
    if new_state in ('cancelled','refunded','review') then
     update public.crm_preorder_notices set status='dismissed' where reservation_id=r.id and status='review';
    end if;
   end loop;
   -- A removed line is reviewed; paid money and already allocated stock need reconciliation.
   update public.crm_preorder_reservations set state='review',review_reason='item_removed',updated_at=now()
   where merchant_id=p_merchant_id and order_id=o.id and not(item_key=any(seen)) and state not in ('cancelled','refunded');
   update public.crm_preorder_notices set status='dismissed' where status='review' and reservation_id in
    (select id from public.crm_preorder_reservations where merchant_id=p_merchant_id and order_id=o.id and state='review');
   for b in select * from public.crm_preorder_batches where merchant_id=p_merchant_id and id=any(touched) loop
    perform public.crm_preorder_allocate(p_merchant_id,b.id);
   end loop;
   delete from public.crm_preorder_order_queue where merchant_id=p_merchant_id and order_id=o.id;
   processed:=processed+1;
  exception when others then
   -- Keep failures durable; never expose raw payloads or provider errors to the dashboard.
   update public.crm_preorder_order_queue set last_error=case when SQLERRM in ('items_snapshot_missing','item_identifier_missing','duplicate_item_identifier','invalid_item_quantity') then SQLERRM else 'order_sync_failed' end
   where merchant_id=p_merchant_id and order_id=q.order_id;
   errors:=errors+1;
  end;
 end loop;
 return jsonb_build_object('processed',processed,'errors',errors,'messages_sent',0,'salla_requests',0);
end $$;

create or replace function public.crm_preorder_save_batch(p_merchant_id bigint,p_data jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare b public.crm_preorder_batches; bid uuid; changed boolean; desired text; r record;
begin
 perform pg_advisory_xact_lock(p_merchant_id);
 bid:=nullif(p_data->>'id','')::uuid;desired:=coalesce(p_data->>'status','draft');
 if desired not in ('draft','open','paused','closed') then raise exception 'invalid_status';end if;
 if desired='open' and not public.crm_preorder_tracking_active() then raise exception 'tracking_not_active';end if;
 if bid is not null then
  select * into strict b from public.crm_preorder_batches where id=bid and merchant_id=p_merchant_id for update;
  if b.status='received' then raise exception 'received_batch_locked';end if;
  if b.opened_at is not null and (desired='draft' or b.product_id<>p_data->>'product_id' or b.variant_id<>coalesce(p_data->>'variant_id','') or b.color<>p_data->>'color') then raise exception 'batch_identity_locked';end if;
  if desired='closed' and exists(select 1 from public.crm_preorder_reservations where merchant_id=p_merchant_id and batch_id=bid and state not in ('cancelled','refunded','delivered','shipped')) then raise exception 'unfulfilled_reservations';end if;
 end if;
 if desired='open' and exists(select 1 from public.crm_preorder_batches x where x.merchant_id=p_merchant_id
  and x.id is distinct from bid and x.status in ('open','paused') and x.product_id=p_data->>'product_id'
  and (x.variant_id=coalesce(p_data->>'variant_id','') or x.variant_id='' or coalesce(p_data->>'variant_id','')='')) then raise exception 'overlapping_batch';end if;
 if b.id is not null and (p_data->>'booking_limit')::integer<b.booking_limit and exists(select 1 from public.crm_preorder_reservations where merchant_id=p_merchant_id and batch_id=bid and paid_at is not null and state not in ('cancelled','refunded')
  group by batch_id having sum(quantity)>(p_data->>'booking_limit')::integer) then raise exception 'limit_below_reservations';end if;
 changed:=b.id is not null and (b.ship_from<>(p_data->>'ship_from')::date or b.ship_by<>(p_data->>'ship_by')::date);
 if bid is null then
  insert into public.crm_preorder_batches(merchant_id,name,product_id,variant_id,product_name,color,incoming_quantity,booking_limit,expected_arrival,ship_from,ship_by,status,opened_at)
  values(p_merchant_id,p_data->>'name',p_data->>'product_id',coalesce(p_data->>'variant_id',''),p_data->>'product_name',p_data->>'color',
   (p_data->>'incoming_quantity')::integer,(p_data->>'booking_limit')::integer,(p_data->>'expected_arrival')::date,(p_data->>'ship_from')::date,(p_data->>'ship_by')::date,desired,
   case when desired='open' then now() end) returning id into bid;
 else
  update public.crm_preorder_batches set name=p_data->>'name',product_id=p_data->>'product_id',variant_id=coalesce(p_data->>'variant_id',''),product_name=p_data->>'product_name',color=p_data->>'color',
   incoming_quantity=(p_data->>'incoming_quantity')::integer,booking_limit=(p_data->>'booking_limit')::integer,expected_arrival=(p_data->>'expected_arrival')::date,
   ship_from=(p_data->>'ship_from')::date,ship_by=(p_data->>'ship_by')::date,status=desired,
   opened_at=coalesce(opened_at,case when desired='open' then now() end),revision=revision+case when changed then 1 else 0 end,updated_at=now()
  where id=bid and merchant_id=p_merchant_id;
 end if;
 insert into public.crm_preorder_audit(merchant_id,batch_id,action,details) values(p_merchant_id,bid,'save',jsonb_build_object('before',to_jsonb(b),'after',p_data));
 if changed then
  for r in select id from public.crm_preorder_reservations where merchant_id=p_merchant_id and batch_id=bid and state in ('reserved','allocated') loop
   perform public.crm_preorder_notice(r.id,'schedule_change',b.revision+1);
  end loop;
 end if;
 return bid;
end $$;

create or replace function public.crm_preorder_receive(p_merchant_id bigint,p_batch_id uuid,p_quantity integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.crm_preorder_batches; n integer;
begin
 perform pg_advisory_xact_lock(p_merchant_id);
 select * into strict b from public.crm_preorder_batches where merchant_id=p_merchant_id and id=p_batch_id for update;
 if b.status not in ('open','paused','received') or p_quantity not between 0 and b.incoming_quantity then raise exception 'invalid_receipt';end if;
 if b.status='received' and p_quantity=b.received_quantity then return jsonb_build_object('allocated',0,'duplicate',true);end if;
 -- Cumulative verified quantity allows a second partial delivery, never a duplicate increment.
 if p_quantity<b.received_quantity then raise exception 'receipt_cannot_decrease';end if;
 perform public.crm_preorder_reconcile(p_merchant_id,50);
 if exists(select 1 from public.crm_preorder_order_queue where merchant_id=p_merchant_id) then raise exception 'pending_order_sync';end if;
 update public.crm_preorder_batches set received_quantity=p_quantity,received_at=coalesce(received_at,now()),status='received',updated_at=now() where id=b.id;
 n:=public.crm_preorder_allocate(p_merchant_id,p_batch_id);
 insert into public.crm_preorder_audit(merchant_id,batch_id,action,details) values(p_merchant_id,p_batch_id,'receipt',jsonb_build_object('previous',b.received_quantity,'verified_total',p_quantity,'allocated_reservations',n));
 return jsonb_build_object('allocated',n,'duplicate',false);
end $$;

create or replace function public.crm_preorder_summary(p_merchant_id bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
  select b.id,
   coalesce(sum(r.quantity) filter(where r.state in ('reserved','allocated','shipped','delivered','review') and r.paid_at is not null),0) paid_quantity,
   coalesce(sum(r.allocated_quantity),0) allocated_quantity,
   count(r.id) filter(where r.state='review') review_count,
   count(r.id) filter(where r.state='payment_pending') pending_count,
   coalesce(sum(r.quantity) filter(where r.state='reserved'),0) waiting_quantity,
   count(r.id) filter(where r.state='allocated') ready_orders
  from public.crm_preorder_batches b left join public.crm_preorder_reservations r on r.batch_id=b.id and r.merchant_id=b.merchant_id
  where b.merchant_id=p_merchant_id group by b.id order by b.created_at desc limit 200
 ) x;
$$;

-- Private to the server. There are deliberately no anon/authenticated policies.
do $$ declare t text; begin
 foreach t in array array['crm_preorder_batches','crm_preorder_reservations','crm_preorder_order_queue','crm_preorder_notices','crm_preorder_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on function public.crm_queue_preorder_order(),public.crm_preorder_notice(uuid,text,integer),public.crm_preorder_allocate(bigint,uuid),public.crm_preorder_reconcile(bigint,integer),public.crm_preorder_save_batch(bigint,jsonb),public.crm_preorder_receive(bigint,uuid,integer),public.crm_preorder_summary(bigint) from public,anon,authenticated;
grant execute on function public.crm_queue_preorder_order(),public.crm_preorder_notice(uuid,text,integer),public.crm_preorder_allocate(bigint,uuid),public.crm_preorder_reconcile(bigint,integer),public.crm_preorder_save_batch(bigint,jsonb),public.crm_preorder_receive(bigint,uuid,integer),public.crm_preorder_summary(bigint) to service_role;
revoke all on function public.crm_preorder_tracking_active(),public.crm_preorder_order_detached() from public,anon,authenticated;
grant execute on function public.crm_preorder_tracking_active(),public.crm_preorder_order_detached() to service_role;
revoke all on function public.crm_preorder_payment(text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_preorder_payment(text,jsonb) to service_role;
notify pgrst,'reload schema';

-- Check that all preorder business and queue rows survived the upgrade.
do $$ declare before_counts jsonb; after_counts jsonb; begin
 before_counts:=current_setting('link.preorder_upgrade_counts')::jsonb;
 after_counts:=jsonb_build_object(
  'batches',(select count(*) from public.crm_preorder_batches),
  'reservations',(select count(*) from public.crm_preorder_reservations),
  'queue',(select count(*) from public.crm_preorder_order_queue),
  'notices',(select count(*) from public.crm_preorder_notices),
  'audit',(select count(*) from public.crm_preorder_audit));
 if before_counts<>after_counts then raise exception 'preorder_upgrade_row_count_changed';end if;
end $$;
commit;
select
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='crm_preorder_reservations' and column_name='external_order_id') as updated_schema,
 to_regprocedure('public.crm_preorder_tracking_active()') is not null as updated_functions,
 public.crm_preorder_tracking_active() as order_tracking_active;
