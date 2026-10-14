-- Targeted update: preorder functions and ONE draft batch only.
-- No orders/customers writes, table changes, trigger activation or messages.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public'
 and table_name='crm_preorder_reservations' and column_name='external_order_id') then
 raise exception 'run_preorder_upgrade_first';end if;
end $$;
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

revoke all on function public.crm_preorder_payment(text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_preorder_payment(text,jsonb) to service_role;
-- Existing CREATE OR REPLACE functions retain their existing access grants.
do $$ declare bid uuid; n integer; begin
 perform pg_advisory_xact_lock(1829345766::bigint);
 select count(*) into n from public.crm_preorder_batches
 where merchant_id=1829345766 and product_id='318533359';
 if n>1 then raise exception 'multiple_product_batches_need_review';end if;
 select id into bid from public.crm_preorder_batches
 where merchant_id=1829345766 and product_id='318533359';
 if bid is not null and exists(select 1 from public.crm_preorder_batches where id=bid and (status<>'draft' or opened_at is not null)) then
 raise exception 'existing_batch_is_not_a_draft';end if;
 perform public.crm_preorder_save_batch(1829345766::bigint,jsonb_build_object(
 'id',bid,'name','بورغندي — دفعة نوفمبر 2026','product_id','318533359','variant_id','',
 'product_name','إطار Link المعدني iPhone 18 Pro Max','color','بورغندي',
 'incoming_quantity',400,'booking_limit',400,'expected_arrival','2026-11-03',
 'ship_from','2026-11-04','ship_by','2026-11-06','status','draft'));
end $$;
notify pgrst,'reload schema';
commit;
select public.crm_preorder_tracking_active() as order_tracking_active,
 id as batch_id,status,incoming_quantity,booking_limit,expected_arrival,ship_from,ship_by
from public.crm_preorder_batches where merchant_id=1829345766 and product_id='318533359';
