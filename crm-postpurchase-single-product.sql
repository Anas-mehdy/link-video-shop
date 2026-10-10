begin;
-- Preview only: single product, single model, complementary offers. No API or sending.
create or replace function public.crm_postpurchase_preview(p_merchant_id bigint)
returns jsonb language sql security invoker set search_path='' as $$
 with recent as (
 select o.*,c.name customer_name,c.phone,c.normalized_phone,d.delivered_at
 from public.orders o left join public.customers c on c.id=o.customer_id and c.merchant_id=o.merchant_id
 left join public.crm_postpurchase_delivered d on d.order_id=o.id and d.merchant_id=o.merchant_id
 where o.merchant_id=p_merchant_id and o.status_slug='delivered' and o.ordered_at>=now()-interval '30 days'
 order by o.ordered_at desc limit 200
 ), single_orders as materialized (
 select * from recent where jsonb_array_length(case when jsonb_typeof(source_payload->'items')='array' then source_payload->'items' else '[]'::jsonb end)=1
 ), items as (
 select o.id order_id,coalesce(i->'product'->>'id',i->>'product_id') product_id,
 case when exists(select 1 from public.crm_postpurchase_products p where p.merchant_id=p_merchant_id and p.product_id=coalesce(i->'product'->>'id',i->>'product_id') and p.variant_id='' and p.origin='auto') then '' else coalesce(i->'sku'->>'id',i->>'sku_id','') end variant_id
 from single_orders o cross join lateral jsonb_array_elements(case when jsonb_typeof(o.source_payload->'items')='array' then o.source_payload->'items' else '[]'::jsonb end) i
 ), matches as (
 select distinct o.id,o.customer_id,o.external_order_id,o.customer_name,o.delivered_at,o.phone,o.normalized_phone,o.ordered_at,
 r.id rule_id,r.name rule_name,t.name purchased_name,f.name offer_name,f.product_url,
 o.delivered_at+make_interval(days=>s.delay_days) scheduled_for,
 case
 when o.delivered_at is null then 'delivery_date_unknown'
 when o.customer_id is null then 'customer_missing'
 when coalesce(o.normalized_phone,regexp_replace(coalesce(o.phone,''),'[^0-9]','','g')) !~ '^[1-9][0-9]{7,14}$' then 'phone_missing'
 when exists(select 1 from public.crm_whatsapp_optouts z where z.merchant_id=o.merchant_id and z.phone=coalesce(o.normalized_phone,regexp_replace(coalesce(o.phone,''),'[^0-9]','','g'))) then 'optout'
 when exists(select 1 from public.orders later where later.merchant_id=o.merchant_id and later.customer_id=o.customer_id and later.ordered_at>o.ordered_at and coalesce(later.status_slug,'') not in ('cancelled','canceled','refunded')) then 'later_purchase'
 when t.model<>f.model then 'model_mismatch'
 when exists(select 1 from items it left join public.crm_postpurchase_products p on p.merchant_id=o.merchant_id and p.product_id=it.product_id and p.variant_id=it.variant_id where it.order_id=o.id and p.product_id is null) then 'unmapped_items'
 when exists(select 1 from items it join public.crm_postpurchase_products p on p.merchant_id=o.merchant_id and p.product_id=it.product_id and p.variant_id=it.variant_id where it.order_id=o.id and p.model=f.model and p.components && f.components) then 'already_owned'
 when coalesce(f.product_url,'')='' then 'offer_url_missing'
 when o.delivered_at+make_interval(days=>s.delay_days)>now() then 'delay'
 else 'stock_check_required' end reason
 from single_orders o join items it on it.order_id=o.id
 join public.crm_postpurchase_rules r on r.merchant_id=o.merchant_id and r.trigger_product_id=it.product_id and r.trigger_variant_id=it.variant_id and r.active
 join public.crm_postpurchase_products t on t.merchant_id=r.merchant_id and t.product_id=r.trigger_product_id and t.variant_id=r.trigger_variant_id
 join public.crm_postpurchase_products f on f.merchant_id=r.merchant_id and f.product_id=r.offer_product_id and f.variant_id=r.offer_variant_id
 join public.crm_postpurchase_settings s on s.merchant_id=o.merchant_id
 where cardinality(t.components)=1 and t.components[1] in ('case','screen','lens','camera_frame')
 and t.name !~* '(بكج|باقة|bundle|package|pack[[:space:]])'
 and cardinality(f.components)=1 and f.name !~* '(بكج|باقة|bundle|package|pack[[:space:]])'
 and t.model=f.model and not (t.components && f.components)
 ), unmatched as (
 select o.external_order_id,o.customer_name,''::text rule_name,
 coalesce(p.name,o.source_payload->'items'->0->>'name',o.source_payload->'items'->0->'product'->>'name','منتج غير مصنف') purchased_name,
 ''::text offer_name,null::timestamptz scheduled_for,
 case when p.product_id is null then 'product_unclassified' else 'no_complementary_offer' end reason
 from single_orders o join items it on it.order_id=o.id
 left join public.crm_postpurchase_products p on p.merchant_id=p_merchant_id and p.product_id=it.product_id and p.variant_id=it.variant_id
 where not exists(select 1 from matches m where m.id=o.id)
 and (p.product_id is null or (cardinality(p.components)=1 and p.components[1] in ('case','screen','lens','camera_frame') and p.name !~* '(بكج|باقة|bundle|package|pack[[:space:]])'))
 ), display_rows as (
 select external_order_id,customer_name,rule_name,purchased_name,offer_name,scheduled_for,reason from matches
 union all select * from unmatched
 )
 select jsonb_build_object('mode','preview','messages_sent',0,'salla_requests',0,
 'scanned_orders',(select count(*) from recent),
 'scope','single_product',
 'single_product_orders',(select count(*) from single_orders),
 'multiple_product_orders',(select count(*) from recent)-(select count(*) from single_orders),
 'unclassified_orders',(select count(*) from unmatched where reason='product_unclassified'),
 'excluded_bundle_orders',(select count(*) from single_orders)-(select count(distinct id) from matches)-(select count(*) from unmatched),
 'matched_orders',(select count(distinct id) from matches),
 'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select external_order_id,customer_name,rule_name,purchased_name,offer_name,scheduled_for,reason from display_rows order by scheduled_for nulls last,external_order_id limit 100) x),'[]'::jsonb));
$$;
revoke all on function public.crm_postpurchase_preview(bigint) from public,anon,authenticated;
grant execute on function public.crm_postpurchase_preview(bigint) to service_role;
commit;
