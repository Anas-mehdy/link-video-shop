"""Build the targeted, transactional live payment adapter + draft batch update."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
source = (root / 'crm-preorders.sql').read_text()
functions = []
for name in ['crm_queue_preorder_order', 'crm_preorder_payment', 'crm_preorder_reconcile']:
    functions.append(re.search(r'create or replace function public\.' + name + r'\(.*?end \$\$;', source, re.S).group())
prefix = '''-- Targeted update: preorder functions and ONE draft batch only.
-- No orders/customers writes, table changes, trigger activation or messages.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public'
 and table_name='crm_preorder_reservations' and column_name='external_order_id') then
 raise exception 'run_preorder_upgrade_first';end if;
end $$;
'''
suffix = '''
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
'''
(root / 'crm-preorders-payment-update.sql').write_text(prefix + '\n\n'.join(functions) + '\n' + suffix)
