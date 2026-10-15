-- Run only in the existing Link Store CRM project.
-- Data-only: uses the installed batch RPC; no schema or order-tracking changes.
-- Quantities are the 400-per-color values entered in Salla on 2026-10-15.
begin;
set local statement_timeout='15s';
do $$
declare source public.crm_preorder_batches; existing public.crm_preorder_batches; item record; n integer;
begin
 perform pg_advisory_xact_lock(1829345766::bigint);
 if not public.crm_preorder_tracking_active() then raise exception 'tracking_not_active';end if;
 select * into strict source from public.crm_preorder_batches
 where merchant_id=1829345766 and id='c3f3ec44-d4cc-410f-9dde-5dcfd93f11b4'
 and product_id='318533359' and variant_id='' and status='open';
 if source.expected_arrival<>date '2026-11-03' or source.ship_from<>date '2026-11-04' or source.ship_by<>date '2026-11-06' then
  raise exception 'source_schedule_changed';
 end if;
 for item in select * from (values
  ('1229565720','سيلفر'),('1962143002','سماوي'),('1013934438','أسود')
 ) as colors(product_id,color) loop
  select count(*) into n from public.crm_preorder_batches
  where merchant_id=1829345766 and product_id=item.product_id;
  if n>0 then
   if n<>1 then raise exception 'existing_batches_require_review: %',item.product_id;end if;
   select * into strict existing from public.crm_preorder_batches
   where merchant_id=1829345766 and product_id=item.product_id;
   if existing.variant_id<>'' or existing.color<>item.color or existing.status<>'open'
    or existing.incoming_quantity<>400 or existing.booking_limit<>400
    or existing.expected_arrival<>source.expected_arrival or existing.ship_from<>source.ship_from or existing.ship_by<>source.ship_by then
    raise exception 'existing_batch_requires_review: %',item.product_id;
   end if;
   continue; -- Already configured exactly: never overwrite or reopen a batch.
  end if;
  perform public.crm_preorder_save_batch(1829345766,jsonb_build_object(
   'name','إطارات آيفون 18 برو ماكس — '||item.color||' — نوفمبر 2026',
   'product_id',item.product_id,'variant_id','','product_name','إطار Link المعدني iPhone 18 Pro Max',
   'color',item.color,'incoming_quantity',400,'booking_limit',400,
   'expected_arrival',source.expected_arrival,'ship_from',source.ship_from,'ship_by',source.ship_by,'status','open'
  ));
 end loop;
end $$;
select product_id,color,status,incoming_quantity,booking_limit,expected_arrival,ship_from,ship_by
from public.crm_preorder_batches
where merchant_id=1829345766 and product_id in ('318533359','1229565720','1962143002','1013934438')
order by product_id;
commit;
