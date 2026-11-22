alter table public.crm_pp_delivery_control add column if not exists lux_enabled boolean not null default false;

create or replace function public.crm_pp_lux_candidates()
returns table (external_order_id text, purchased_name text)
language sql stable security invoker set search_path='' as $$
 with eligible as (
  select o.external_order_id, d.delivered_at, o.id, n.phone, v.purchased_name
  from public.crm_postpurchase_delivered d
  join public.orders o on o.id=d.order_id and o.merchant_id=d.merchant_id
  join public.customers c on c.id=o.customer_id and c.merchant_id=o.merchant_id
  join public.crm_postpurchase_settings s on s.merchant_id=o.merchant_id
  cross join lateral (select coalesce(nullif(c.normalized_phone,''),regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')) as phone) n
  cross join lateral (select
   regexp_replace(regexp_replace(coalesce(nullif(o.source_payload#>>'{customer,mobile}',''),nullif(o.source_payload#>>'{customer,phone_number}',''),o.source_payload#>>'{customer,phone}',''),'[^0-9]','','g'),'^00','') as mobile,
   regexp_replace(regexp_replace(coalesce(nullif(o.source_payload#>>'{customer,mobile_code}',''),nullif(o.source_payload#>>'{customer,dial_code}',''),o.source_payload#>>'{customer,country_code}',''),'[^0-9]','','g'),'^00','') as prefix) snapshot
  join (values
   ('284157041','كفر دريب ماج سيف'),('101121129','كفر دريب ماج سيف'),('1335345819','كفر دريب ماج سيف'),
   ('1931422196','كفر دريب ماج سيف'),('728672372','كفر دريب ماج سيف'),('1720649668','كفر دريب ماج سيف'),
   ('1762234597','كفر سليم ماج سيف'),('1234498619','كفر سليم ماج سيف'),('368743206','كفر سليم ماج سيف'),
   ('1142994364','كفر سليم ماج سيف'),('1404266361','كفر سليم ماج سيف'),('2043217838','كفر سليم ماج سيف'),('1128190372','كفر سليم ماج سيف'),
   ('428080745','بكج كفر سليم ماج سيف'),('603754862','بكج كفر سليم ماج سيف'),
   ('1948753871','بكج الحماية مع كفر دريب ماج سيف'),('1558395701','بكج الحماية مع كفر دريب ماج سيف'),
   ('1073931571','بكج الحماية مع كفر دريب ماج سيف'),('1079324876','بكج الحماية مع كفر دريب ماج سيف')
  ) v(product_id,purchased_name) on v.product_id=coalesce(o.source_payload#>>'{items,0,product,id}',o.source_payload#>>'{items,0,product_id}')
  where o.merchant_id=1829345766 and o.status_slug='delivered'
    and d.delivered_at<=now()-interval '7 days'
    and o.ordered_at>=now()-interval '30 days'
    and o.ordered_at+make_interval(days=>s.delay_days)<=now()
    and case when jsonb_typeof(o.source_payload->'items')='array' then jsonb_array_length(o.source_payload->'items')=1 else false end
    and n.phone ~ '^[1-9][0-9]{7,14}$' and snapshot.mobile<>''
    and case when snapshot.prefix<>'' and not starts_with(snapshot.mobile,snapshot.prefix)
       then snapshot.prefix||regexp_replace(snapshot.mobile,'^0','') else snapshot.mobile end
       = regexp_replace(n.phone,'^00','')
    and not exists(select 1 from public.crm_whatsapp_optouts x where x.merchant_id=o.merchant_id and x.phone=n.phone)
    and not exists(select 1 from public.crm_pp_deliveries x where x.merchant_id=o.merchant_id
      and (x.order_id=o.id or (x.phone=n.phone and (x.model='عرض LUX' or x.attempted_at>now()-make_interval(days=>s.cooldown_days)))))
    and not exists(select 1 from public.crm_cart_deliveries x where x.merchant_id=o.merchant_id
      and x.attempted_phone=n.phone and x.status in ('sending','accepted','unknown') and x.attempted_at>now()-interval '24 hours')
    and not exists(select 1 from public.crm_cashback_deliveries x where x.merchant_id=o.merchant_id
      and x.phone=n.phone and x.status in ('sending','accepted','unknown') and x.attempted_at>now()-make_interval(days=>s.cooldown_days))
    and not exists(
     select 1 from public.orders h
     cross join lateral jsonb_array_elements(case when jsonb_typeof(h.source_payload->'items')='array' then h.source_payload->'items' else '[]'::jsonb end) i
     where h.merchant_id=o.merchant_id and h.customer_id=o.customer_id
       and (coalesce(i#>>'{product,id}',i->>'product_id')='387390654'
         or coalesce(i->>'name',i#>>'{product,name}','') ~* '(حامل.*\mLUX\M|\mLUX\M.*حامل)')
    )
 ), unique_phones as (
  select distinct on (phone) eligible.* from eligible order by phone, delivered_at desc, id
 )
 select p.external_order_id::text, p.purchased_name from unique_phones p order by p.delivered_at desc,p.id;
$$;
revoke all on function public.crm_pp_lux_candidates() from public,anon,authenticated;
grant execute on function public.crm_pp_lux_candidates() to service_role;

-- The normal offer still cannot use a cashback order. The separate LUX follow-up
-- may do so once the existing marketing cooldown has passed.
create or replace function public.crm_cashback_guard_postpurchase()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.model='عرض LUX' then
  if new.product_ids is distinct from array['387390654']::text[]
   or not exists(select 1 from public.crm_pp_delivery_control where merchant_id=new.merchant_id and lux_enabled)
   or not exists(select 1 from public.crm_pp_lux_candidates() where external_order_id=new.external_order_id)
   or (select count(*) from public.crm_pp_deliveries
       where merchant_id=new.merchant_id and model='عرض LUX'
         and attempted_at>=date_trunc('day',now(),'Asia/Riyadh'))>=5
  then raise exception 'LUX no longer eligible or daily limit reached' using errcode='P0LUX';end if;
 elsif exists(select 1 from public.crm_cashback_deliveries where merchant_id=new.merchant_id and order_id=new.order_id and status in ('sending','accepted','unknown')) then
  raise exception 'cashback already attempted for order' using errcode='P0CBK';
 end if;
 return new;
end $$;
