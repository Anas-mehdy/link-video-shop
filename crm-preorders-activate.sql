-- Stage 2: enable the single order queue trigger after reviewing live preflight.
-- No DROP, data updates, order-column changes or existing-trigger replacement.
begin;
do $$ begin
 if to_regprocedure('public.crm_queue_preorder_order()') is null then raise exception 'run_preorder_setup_first';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='crm_queue_preorder_order') then
  if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='crm_queue_preorder_order'
   and tgfoid='public.crm_queue_preorder_order()'::regprocedure and tgenabled in ('O','A') and tgtype=21) then
   raise exception 'existing_preorder_trigger_needs_review';
  end if;
 else
  create trigger crm_queue_preorder_order after insert or update of source_payload,status_slug,payment_status on public.orders
  for each row execute function public.crm_queue_preorder_order();
 end if;
end $$;
commit;
