begin;
-- Local order snapshots only. No external requests, classification writes or sending.
create or replace function public.crm_postpurchase_single_context(p_merchant_id bigint)
returns jsonb language sql security invoker set search_path='' as $$
 with recent as materialized (
 select o.*,c.name customer_name,c.phone,c.normalized_phone,d.delivered_at,s.delay_days
 from public.orders o
 join public.crm_postpurchase_settings s on s.merchant_id=o.merchant_id
 left join public.customers c on c.id=o.customer_id and c.merchant_id=o.merchant_id
 left join public.crm_postpurchase_delivered d on d.order_id=o.id and d.merchant_id=o.merchant_id
 where o.merchant_id=p_merchant_id and o.status_slug='delivered' and o.ordered_at>=now()-interval '30 days'
 order by o.ordered_at desc,o.id limit 200
 ), single_orders as (
 select * from recent where jsonb_array_length(case when jsonb_typeof(source_payload->'items')='array' then source_payload->'items' else '[]'::jsonb end)=1
 ), context as (
 select o.id,external_order_id,customer_name,delivered_at+make_interval(days=>delay_days) scheduled_for,
 jsonb_build_object(
 'product_id',coalesce(i->'product'->>'id',i->>'product_id'),
 'variant_id',coalesce(i->'sku'->>'id',i->>'sku_id',''),
 'name',left(coalesce(nullif(i->>'name',''),i->'product'->>'name',''),150),
 'options',coalesce(i->'options','[]'::jsonb)) item,
 case
 when o.customer_id is null then 'customer_missing'
 when coalesce(o.normalized_phone,regexp_replace(coalesce(o.phone,''),'[^0-9]','','g')) !~ '^[1-9][0-9]{7,14}$' then 'phone_missing'
 when exists(select 1 from public.crm_whatsapp_optouts z where z.merchant_id=o.merchant_id and z.phone=coalesce(o.normalized_phone,regexp_replace(coalesce(o.phone,''),'[^0-9]','','g'))) then 'optout'
 when exists(select 1 from public.orders later where later.merchant_id=o.merchant_id and later.customer_id=o.customer_id and later.ordered_at>o.ordered_at and coalesce(later.status_slug,'') not in ('cancelled','canceled','refunded')) then 'later_purchase'
 when o.delivered_at is null then 'delivery_date_unknown'
 when o.delivered_at+make_interval(days=>o.delay_days)>now() then 'delay'
 else 'stock_check_required' end reason
 from single_orders o cross join lateral (select o.source_payload->'items'->0 i) x
 )
 select jsonb_build_object('scanned_orders',(select count(*) from recent),
 'single_product_orders',(select count(*) from single_orders),
 'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.scheduled_for nulls last,x.external_order_id) from context x),'[]'::jsonb));
$$;
revoke all on function public.crm_postpurchase_single_context(bigint) from public,anon,authenticated;
grant execute on function public.crm_postpurchase_single_context(bigint) to service_role;
commit;
