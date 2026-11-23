create or replace function public.crm_cashback_guard_postpurchase()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.model='عرض LUX' then
  if new.product_ids is distinct from array['387390654']::text[]
   or not exists(select 1 from public.crm_pp_delivery_control where merchant_id=new.merchant_id and lux_enabled)
   or not exists(select 1 from public.crm_pp_lux_candidates() where external_order_id=new.external_order_id)
   or (select count(*) from public.crm_pp_deliveries
       where merchant_id=new.merchant_id and model='عرض LUX'
         and attempted_at>=date_trunc('day',now(),'Asia/Riyadh'))>=20
  then raise exception 'LUX no longer eligible or daily limit reached' using errcode='P0LUX';end if;
 elsif exists(select 1 from public.crm_cashback_deliveries where merchant_id=new.merchant_id and order_id=new.order_id and status in ('sending','accepted','unknown')) then
  raise exception 'cashback already attempted for order' using errcode='P0CBK';
 end if;
 return new;
end $$;
