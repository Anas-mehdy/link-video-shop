-- Stage 2: enable the single order queue trigger after reviewing live preflight.
-- No DROP, order-data updates, order-column changes or existing-trigger replacement.
begin;
do $$ begin
 if to_regprocedure('public.crm_queue_preorder_order()') is null then raise exception 'run_preorder_setup_first';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='crm_queue_preorder_order') then
  if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='crm_queue_preorder_order'
   and tgfoid='public.crm_queue_preorder_order()'::regprocedure and tgenabled in ('O','A','D') and tgtype=21) then
   raise exception 'existing_preorder_trigger_needs_review';
  end if;
  alter table public.orders enable trigger crm_queue_preorder_order;
 else
  create trigger crm_queue_preorder_order after insert or update of source_payload,status_slug,payment_status on public.orders
  for each row execute function public.crm_queue_preorder_order();
 end if;
end $$;
-- Catch orders saved while tracking was paused without changing the source rows.
insert into public.crm_preorder_order_queue(merchant_id,order_id)
select o.merchant_id,o.id from public.orders o
where o.merchant_id=1829345766 and (
 exists(select 1 from public.crm_preorder_reservations r where r.merchant_id=o.merchant_id and r.external_order_id=o.external_order_id)
 or exists(
  select 1 from public.crm_preorder_batches b
  cross join lateral jsonb_array_elements(case when jsonb_typeof(o.source_payload->'items')='array' then o.source_payload->'items' else '[]'::jsonb end) i
  where b.merchant_id=o.merchant_id and b.status='open' and o.ordered_at>=b.opened_at
  and b.product_id=coalesce(i->'product'->>'id',i->>'product_id')
  and (b.variant_id='' or b.variant_id=coalesce(i->>'product_sku_id',i->'sku'->>'id',i->>'sku_id',''))
 )
)
on conflict(merchant_id,order_id) do nothing;
commit;
