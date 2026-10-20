begin;
create or replace function public.crm_cart_human_list() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform public.crm_cart_human_refresh();
 select coalesce(jsonb_agg(row_data order by sort_at desc),'[]'::jsonb) into result from (
 select h.created_at as sort_at,jsonb_build_object('id',h.id,'cart_id',c.id,'external_cart_id',c.external_cart_id,'customer_name',c.customer_name,
 'phone',f.attempted_phone,'amount',c.total_amount,'currency',c.currency,'items',coalesce(c.source_payload->'items','[]'::jsonb),
 'first_at',f.completed_at,'second_at',s.attempted_at,'scheduled_for',f.completed_at+interval '1 hour',
 'status',h.status,'attempted_at',h.attempted_at,'provider_message_id',h.provider_message_id,'last_reply_at',r.last_reply_at,
 'reason',case when c.recovered_at is not null or c.status not in ('active','contacted') or exists(select 1 from public.orders o where o.merchant_id=c.merchant_id and o.customer_id=c.customer_id and o.ordered_at>=f.activity_at and coalesce(o.status_slug,'') not in ('canceled','cancelled','refunded','restored','restoring','payment_pending')) then 'purchased_or_inactive'
 when exists(select 1 from public.crm_whatsapp_optouts x where x.merchant_id=c.merchant_id and x.phone=f.attempted_phone) then 'optout'
 when h.status<>'pending' then h.status
 when c.total_amount<=300 then 'amount_changed'
 when regexp_replace(coalesce(nullif(c.normalized_phone,''),c.phone,''),'[^0-9]','','g') is distinct from f.attempted_phone then 'phone_changed'
 when r.last_reply_at>=now()-interval '24 hours' then 'window_open'
 when r.last_reply_at>=f.attempted_at then 'customer_replied'
 when f.completed_at<now()-interval '48 hours' then 'expired'
 when f.completed_at+interval '1 hour'>now() then 'delay'
 else 'ready' end) row_data
 from public.crm_cart_human_followups h join public.abandoned_carts c on c.id=h.cart_id
 join public.crm_cart_deliveries f on f.cart_id=c.id and f.merchant_id=c.merchant_id
 left join public.crm_cart_second_deliveries s on s.cart_id=c.id and s.merchant_id=c.merchant_id
 left join public.crm_cart_second_settings settings on settings.merchant_id=c.merchant_id
 left join public.crm_whatsapp_customer_replies r on r.merchant_id=c.merchant_id and r.phone=f.attempted_phone
 where h.merchant_id=1829345766 order by h.created_at desc limit 200
 ) rows;
 return jsonb_build_object('configuration',(select to_jsonb(h) from public.crm_cart_human_settings h where merchant_id=1829345766),'queue',result,
 'previous_second',coalesce((select jsonb_agg(t) from (select c.customer_name,c.external_cart_id,c.total_amount,s.status,s.attempted_at from public.crm_cart_second_deliveries s join public.abandoned_carts c on c.id=s.cart_id where s.merchant_id=1829345766 and c.total_amount>300 and s.attempted_at is not null order by s.attempted_at desc limit 50)t),'[]'::jsonb));
end; $$;


notify pgrst,'reload schema';
commit;
