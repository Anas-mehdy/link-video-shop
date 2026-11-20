-- Installed separately from the existing manual queue. The activation date is set
-- after deploying the event handler. Existing events are not eligible retroactively.
begin;
alter table public.crm_cashback_control add column if not exists auto_started_at timestamptz;

create or replace view public.crm_cashback_candidates with (security_invoker=true) as
select distinct on(o.id) o.merchant_id,o.id as order_id,o.external_order_id,o.order_reference,
 c.name as customer_name,e.id as event_id,e.occurred_at as delivered_at,
 exists(select 1 from public.crm_whatsapp_consents w where w.merchant_id=o.merchant_id
   and w.phone=coalesce(nullif(c.normalized_phone,''),regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'))) as consent_recorded
from public.crm_event_inbox e join public.orders o
 on o.merchant_id=e.merchant_id and o.external_order_id=coalesce(e.payload#>>'{data,order,id}',e.payload#>>'{data,order_id}')
left join public.customers c on c.merchant_id=o.merchant_id and c.id=o.customer_id
where e.event_name='order.status.updated' and e.records_synced_at is not null
 and e.received_at>=now()-interval '7 days' and e.occurred_at between now()-interval '7 days' and now()
 and coalesce(e.payload#>>'{data,status,slug}',e.payload#>>'{data,order,status,slug}')='delivered'
 and o.status_slug='delivered'
order by o.id,e.occurred_at desc,e.received_at desc,e.id;

create or replace function public.crm_cashback_enqueue_delivery(p_event_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer; v_order_id uuid;
begin
 with eligible as (
  select o.merchant_id,o.id as order_id,o.external_order_id,e.id as event_id,
    e.occurred_at+interval '7 days' as expires_at, c.phone
  from public.crm_cashback_control cfg
  join public.crm_event_inbox e on e.merchant_id=cfg.merchant_id
  join public.orders o on o.merchant_id=e.merchant_id
    and o.external_order_id=coalesce(e.payload#>>'{data,order,id}',e.payload#>>'{data,order_id}')
  join lateral (
    select coalesce(nullif(c.normalized_phone,''),regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')) as phone
    from public.customers c where c.merchant_id=o.merchant_id and c.id=o.customer_id
  ) c on true
  where cfg.merchant_id=1829345766 and cfg.enabled and cfg.auto_started_at is not null
    and (p_event_id is null or e.id=p_event_id)
    and e.event_name='order.status.updated' and e.records_synced_at is not null
    and e.received_at>=greatest(cfg.auto_started_at,now()-interval '7 days')
    and e.occurred_at between greatest(cfg.auto_started_at,now()-interval '7 days') and now()
    and coalesce(e.payload#>>'{data,status,slug}',e.payload#>>'{data,order,status,slug}')='delivered'
    and o.status_slug='delivered' and c.phone ~ '^[1-9][0-9]{7,14}$'
    and exists(select 1 from public.crm_whatsapp_consents w where w.merchant_id=o.merchant_id and w.phone=c.phone)
    and not exists(select 1 from public.crm_whatsapp_optouts w where w.merchant_id=o.merchant_id and w.phone=c.phone)
    and not exists(select 1 from public.crm_cashback_deliveries d where d.merchant_id=o.merchant_id and d.order_id=o.id)
    and not exists(select 1 from public.crm_pp_deliveries a where a.merchant_id=o.merchant_id and a.order_id=o.id and a.status in ('sending','accepted','unknown'))
  order by e.occurred_at,e.id
  limit 20
 ), inserted as (
  insert into public.crm_cashback_deliveries(merchant_id,order_id,external_order_id,event_id,evidence_ref,phone,expires_at,reason)
  select merchant_id,order_id,external_order_id,event_id,'delivered:'||event_id::text,phone,expires_at,'delivery_event' from eligible
  on conflict do nothing returning order_id
 )
 select count(*)::integer, (array_agg(order_id))[1] into n,v_order_id from inserted;
 return jsonb_build_object('queued',n,'order_id',case when p_event_id is not null then v_order_id end);
end $$;
revoke all on public.crm_cashback_candidates from public,anon,authenticated;
grant select on public.crm_cashback_candidates to service_role;
revoke all on function public.crm_cashback_enqueue_delivery(uuid) from public,anon,authenticated;
grant execute on function public.crm_cashback_enqueue_delivery(uuid) to service_role;
commit;
