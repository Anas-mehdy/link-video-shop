-- Apply once after deploying the matching sender. Start with new delivery events.
begin;

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

-- Only automatic event jobs skip the recorded-consent gate; keep manual approvals unchanged.
create or replace function public.crm_cashback_claim(p_order_id uuid,p_phone text,p_destination text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare claimed uuid; actual_phone text;
begin
 perform 1 from public.crm_cashback_control where merchant_id=1829345766 and enabled for update;
 if not found then return null; end if;
 select coalesce(nullif(c.normalized_phone,''),regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')) into actual_phone
 from public.orders o join public.customers c on c.merchant_id=o.merchant_id and c.id=o.customer_id
 where o.merchant_id=1829345766 and o.id=p_order_id and o.status_slug='delivered' for update of o;
 if not found or actual_phone is distinct from p_phone then return null; end if;
 if exists(select 1 from public.crm_whatsapp_optouts where merchant_id=1829345766 and phone=p_phone)
  or exists(select 1 from public.crm_pp_deliveries where merchant_id=1829345766 and order_id=p_order_id and status in ('sending','accepted','unknown'))
 then return null; end if;
 if (select count(*) from public.crm_cashback_deliveries where merchant_id=1829345766 and attempted_at>now()-interval '1 hour')>=10 then return null; end if;
 update public.crm_cashback_deliveries set status='sending',attempted_at=now(),attempt_token=gen_random_uuid(),destination=p_destination
 where merchant_id=1829345766 and order_id=p_order_id and phone=p_phone and status='queued'
  and expires_at>now() and exists(select 1 from public.crm_cashback_candidates c where c.merchant_id=1829345766 and c.order_id=p_order_id)
  and (evidence_ref='delivered:'||event_id::text
    or exists(select 1 from public.crm_whatsapp_consents where merchant_id=1829345766 and phone=p_phone))
 returning attempt_token into claimed;
 return claimed;
end $$;

revoke all on function public.crm_cashback_enqueue_delivery(uuid), public.crm_cashback_claim(uuid,text,text) from public,anon,authenticated;
grant execute on function public.crm_cashback_enqueue_delivery(uuid), public.crm_cashback_claim(uuid,text,text) to service_role;

update public.crm_cashback_control set auto_started_at=clock_timestamp()
 where merchant_id=1829345766 and enabled;
commit;
