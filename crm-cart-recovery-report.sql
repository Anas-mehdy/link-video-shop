begin;
create or replace function public.crm_cart_recovery_report(p_page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $fn$
with bounds as (
 select now()-interval '7 days' as since,now() as until
), sends as materialized (
 select cart_id,1 as stage,attempted_at,null::text as coupon_code,null::integer as discount_amount
 from public.crm_cart_deliveries,bounds where merchant_id=1829345766 and status='accepted' and attempted_at between since-interval '72 hours' and until
 union all
 select cart_id,2,attempted_at,coupon_code,discount_amount
 from public.crm_cart_second_deliveries,bounds where merchant_id=1829345766 and status='accepted' and attempted_at between since-interval '72 hours' and until
), valid_orders as (
 select o.id,o.external_order_id,o.order_reference,o.customer_id,o.ordered_at,o.status_slug,o.total_amount,o.currency,
 coalesce(nullif(o.source_payload->>'checkout_id',''),(
  select e.payload#>>'{data,checkout_id}' from public.crm_event_inbox e
  where e.merchant_id=1829345766 and e.event_name='order.created' and e.records_synced_at is not null
   and e.occurred_at between b.since-interval '1 day' and b.until
   and e.payload#>>'{data,id}'=o.external_order_id and e.payload#>>'{data,checkout_id}' ~ '^[0-9]{1,40}$'
  order by e.received_at desc limit 1
 )) as checkout_id
 from public.orders o cross join bounds b
 where o.merchant_id=1829345766 and o.ordered_at between b.since and b.until
 and coalesce(o.status_slug,'') not in ('','canceled','cancelled','refunded','partially_refunded','restored','restoring','returned','returning','payment_pending','pending_payment','payment_failed','failed','draft')
 and coalesce(o.source_payload->>'draft','false')<>'true'
), best as (
 select o.*,m.* from valid_orders o join lateral (
  select s.cart_id,s.stage,s.attempted_at,s.coupon_code,s.discount_amount,c.external_cart_id,c.customer_name,
    case when c.external_cart_id=o.checkout_id then 'exact' else 'after_message' end as match_kind
  from sends s join public.abandoned_carts c on c.id=s.cart_id and c.merchant_id=1829345766
  where s.attempted_at<=o.ordered_at and s.attempted_at>=o.ordered_at-interval '72 hours'
   and (c.external_cart_id=o.checkout_id or c.customer_id=o.customer_id)
  order by (c.external_cart_id is not distinct from o.checkout_id) desc,s.attempted_at desc,s.stage desc,s.cart_id
  limit 1
 ) m on true
), ranked as (
 select *,row_number() over(partition by cart_id order by (match_kind='exact') desc,ordered_at,id) as cart_rank from best
), matched as materialized (
 select external_order_id,order_reference,ordered_at,status_slug,total_amount,currency,external_cart_id,
 customer_name,stage,attempted_at as reminder_at,coupon_code,discount_amount,match_kind
 from ranked where cart_rank=1 or match_kind='exact'
), totals as (
 select count(*) as total,
 count(*) filter(where match_kind='exact') as exact_count,
 count(*) filter(where match_kind='after_message') as after_count,
 coalesce(sum(total_amount) filter(where match_kind='exact' and currency='SAR'),0) as exact_sar,
 count(*) filter(where match_kind='exact' and stage=1) as exact_first,
 count(*) filter(where match_kind='exact' and stage=2) as exact_second
 from matched
)
select jsonb_build_object(
 'since',b.since,'until',b.until,'metrics',to_jsonb(t)||jsonb_build_object(
 'accepted_first',(select count(*) from sends where stage=1 and attempted_at>=b.since),
 'accepted_second',(select count(*) from sends where stage=2 and attempted_at>=b.since)),
 'rows',coalesce((select jsonb_agg(to_jsonb(p) order by ordered_at desc,external_order_id) from
  (select * from matched order by ordered_at desc,external_order_id limit 20 offset ((greatest(1,least(coalesce(p_page,1),10000))-1)*20)) p),'[]'::jsonb)
) from bounds b cross join totals t;
$fn$;
revoke all on function public.crm_cart_recovery_report(integer) from public,anon,authenticated;
grant execute on function public.crm_cart_recovery_report(integer) to service_role;
commit;
