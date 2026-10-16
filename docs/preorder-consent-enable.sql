-- Run only after the consent implementation has been deployed and checked.
-- Changes the new consent flag only; no order/cart/automation changes.
begin;
set local lock_timeout='3s';
set local statement_timeout='10s';
do $$ begin
 if not exists(select 1 from public.crm_preorder_consent_control where merchant_id=1829345766)
 then raise exception 'consent_storage_not_ready'; end if;
end $$;
update public.crm_preorder_consent_control set enabled=true where merchant_id=1829345766;
select enabled as consent_collection_enabled from public.crm_preorder_consent_control where merchant_id=1829345766;
commit;
-- To stop collection again: set enabled=false on the same merchant row.
