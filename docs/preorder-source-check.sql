-- Read-only source-shape check before public preorder launch.
-- Returns whitelisted order/item identifiers and payment amounts only.
-- No names, phone numbers, addresses, notes, URLs or transaction references.
begin transaction read only;
set local statement_timeout='10s';

with recent_orders as (
 select external_order_id,payment_status,status_slug,source_payload as snapshot,crm_source_at as observed_at
 from public.orders where merchant_id=1829345766
 order by crm_source_at desc nulls last,id desc limit 5
), recent_events as (
 select event_name,received_at,
 case when event_name='order.status.updated' then payload->'data'->'order' else payload->'data' end as snapshot
 from public.crm_event_inbox where merchant_id=1829345766 and event_name in
 ('order.created','order.updated','order.payment.updated','order.products.updated','order.status.updated')
 order by received_at desc,id desc limit 5
), samples as (
 select 'stored_order'::text as source,external_order_id,payment_status,status_slug,observed_at,snapshot from recent_orders
 union all
 select event_name,snapshot->>'id',snapshot->>'payment_status',snapshot->'status'->>'slug',received_at,snapshot from recent_events
)
select source,external_order_id,payment_status,status_slug,observed_at,
 jsonb_build_object(
  'keys',coalesce((select jsonb_agg(k order by k) from jsonb_object_keys(case when jsonb_typeof(snapshot)='object' then snapshot else '{}'::jsonb end) k),'[]'::jsonb),
  'items_type',jsonb_typeof(snapshot->'items'),
  'item_count',case when jsonb_typeof(snapshot->'items')='array' then jsonb_array_length(snapshot->'items') else null end,
  'items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',i->>'id','product_id',i->>'product_id','nested_product_id',i->'product'->>'id',
    'sku_id',i->>'sku_id','nested_sku_id',i->'sku'->>'id','sku_type',jsonb_typeof(i->'sku'),
    'quantity',i->>'quantity',
    'keys',(select jsonb_agg(k order by k) from jsonb_object_keys(case when jsonb_typeof(i)='object' then i else '{}'::jsonb end) k)
  )) from (select value i from jsonb_array_elements(case when jsonb_typeof(snapshot->'items')='array' then snapshot->'items' else '[]'::jsonb end) limit 5) x),'[]'::jsonb),
  'currency',snapshot->>'currency','total',snapshot->'amounts'->'total'->>'amount',
  'paid_amount',snapshot->'payment_actions'->'remaining_action'->'paid_amount'->>'amount',
  'has_remaining_amount',snapshot->'payment_actions'->'remaining_action'->'has_remaining_amount',
  'remaining_amount',snapshot->'payment_actions'->'remaining_action'->'remaining_amount'->>'amount',
  'refund_amount',snapshot->'payment_actions'->'refund_action'->'refund_amount'->>'amount',
  'has_refund_amount',snapshot->'payment_actions'->'refund_action'->'has_refund_amount'
 ) as source_shape
from samples order by observed_at desc nulls last,source;

commit;
