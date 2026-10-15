-- Read-only operational audit for Link CRM. No order/customer identifiers returned.
-- Counts are evidence of tracking only, NOT proof of a shipping lock in Salla.
begin transaction read only;
select
 public.crm_preorder_tracking_active() as order_tracking_active,
 count(distinct external_order_id) filter(where mixed_order and state in ('payment_pending','reserved','review')) as mixed_orders_waiting_or_review,
 count(distinct external_order_id) filter(where mixed_order and state='allocated') as mixed_orders_with_allocated_reservations,
 count(distinct external_order_id) filter(where review_reason='shipment_before_allocation') as orders_shipped_before_allocation_for_review
from public.crm_preorder_reservations
where merchant_id=1829345766;
commit;
