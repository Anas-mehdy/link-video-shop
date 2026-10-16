-- Consent bridge preflight. Aggregate shapes only: no customer data or IDs.
-- No schema changes, writes, messages, or changes to order tracking.
begin transaction read only;
set local statement_timeout='10s';

with recent_orders as materialized (
 select external_order_id::text as order_id, source_payload as p
 from public.orders where merchant_id=1829345766
 order by crm_source_at desc nulls last,id desc limit 1000
), recent_carts as materialized (
 select external_cart_id::text as cart_id,source_payload as p
 from public.abandoned_carts where merchant_id=1829345766
 order by crm_source_at desc nulls last,id desc limit 1000
), items as (
 select i from recent_orders
 cross join lateral jsonb_array_elements(case when jsonb_typeof(p->'items')='array' then p->'items' else '[]'::jsonb end) i
), direct_links as (
 -- Native explicit order relation only. Never join by phone/customer/time.
 select o.order_id, o.p->>'checkout_id' as checkout_id,c.cart_id
 from recent_orders o join recent_carts c
 on o.order_id=coalesce(c.p->>'order_id',c.p->'order'->>'id')
), report as (
 select jsonb_build_object(
  'report','preorder_consent_source_v1',
  'orders_sampled',(select count(*) from recent_orders),
  'carts_sampled',(select count(*) from recent_carts),
  'orders_with_checkout_id',(select count(*) from recent_orders where p->>'checkout_id' ~ '^[0-9]{1,40}$'),
  'orders_with_cart_reference_id',(select count(*) from recent_orders where p->>'cart_reference_id' ~ '^[0-9]{1,40}$'),
  'orders_with_full_items',(select count(*) from recent_orders where jsonb_typeof(p->'items')='array' and p->'items'<>'[]'::jsonb),
  'checkout_id_types',(select coalesce(jsonb_agg(distinct jsonb_typeof(p->'checkout_id')) filter(where p ? 'checkout_id'),'[]'::jsonb) from recent_orders),
  'items',jsonb_build_object(
   'total',(select count(*) from items),
   'with_product_id',(select count(*) from items where coalesce(i->'product'->>'id',i->>'product_id') ~ '^[0-9]{1,40}$'),
   'with_sku_id',(select count(*) from items where coalesce(i->>'product_sku_id',i->'sku'->>'id',i->>'sku_id') ~ '^[0-9]{1,40}$'),
   'with_options_array',(select count(*) from items where jsonb_typeof(i->'options')='array'),
   'option_entry_types',(select coalesce(jsonb_agg(distinct jsonb_typeof(v)),'[]'::jsonb) from items cross join lateral jsonb_array_elements(case when jsonb_typeof(i->'options')='array' then i->'options' else '[]'::jsonb end) v),
   'recognized_option_fields',(select coalesce(jsonb_agg(distinct k),'[]'::jsonb) from items cross join lateral jsonb_array_elements(case when jsonb_typeof(i->'options')='array' then i->'options' else '[]'::jsonb end) v cross join lateral jsonb_object_keys(case when jsonb_typeof(v)='object' then v else '{}'::jsonb end) k where k in ('id','option_id','value','values','value_id','option_value_id','type'))
  ),
  'native_link_checks',jsonb_build_object(
   'explicit_cart_order_links',(select count(*) from direct_links),
   'checkout_matches_cart_id',(select count(*) from direct_links where checkout_id=cart_id),
   'checkout_differs_from_cart_id',(select count(*) from direct_links where checkout_id is not null and checkout_id<>cart_id),
   'orders_matching_stored_cart_id',(select count(*) from recent_orders o where exists(select 1 from recent_carts c where c.cart_id=o.p->>'checkout_id'))
  ),
  'note','Shape and linkage diagnostics only; this report does not prove customer consent.'
 ) as diagnostics
)
select diagnostics from report;
commit;
