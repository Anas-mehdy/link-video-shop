-- Run once after crm-postpurchase-auto.sql. Safe to run again.
-- Uses saved catalog data only; does not send messages or call Salla.
begin;
create index if not exists crm_pp_products_model_idx
 on public.crm_postpurchase_products(merchant_id,model);

create or replace function public.crm_pp_apply_suggestions(p_merchant_id bigint,p_suggestions jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_effective jsonb; v_auto integer; v_review integer; v_excluded integer;
begin
 perform 1 from public.crm_postpurchase_settings where merchant_id=p_merchant_id for update;
 if not found then raise exception 'Missing settings'; end if;
 if p_suggestions is null or jsonb_typeof(p_suggestions)<>'array' then raise exception 'Invalid suggestions'; end if;
 if jsonb_array_length(p_suggestions)>1500 then raise exception 'Invalid suggestions'; end if;
 if exists(select 1 from jsonb_array_elements(p_suggestions) x
  group by x->>'product_id',coalesce(x->>'variant_id','') having count(*)>1)
 then raise exception 'Duplicate suggestions'; end if;

 -- Resolve manual overrides in one join, then bulk-save the effective set.
 select coalesce(jsonb_agg(case when p.product_id is not null and x->>'decision'<>'excluded'
  then x||jsonb_build_object('decision','auto','profile',to_jsonb(p),'reasons',jsonb_build_array('manual_confirmed'))
  else x end),'[]'::jsonb) into v_effective
 from jsonb_array_elements(p_suggestions) x
 left join public.crm_postpurchase_products p on p.merchant_id=p_merchant_id
  and p.product_id=x->>'product_id' and p.variant_id=coalesce(x->>'variant_id','') and p.origin='manual';

 insert into public.crm_postpurchase_suggestions(merchant_id,product_id,variant_id,name,decision,reasons,suggestion)
 select p_merchant_id,x->>'product_id',coalesce(x->>'variant_id',''),x->>'name',x->>'decision',
  array(select jsonb_array_elements_text(x->'reasons')),x->'profile'
 from jsonb_array_elements(v_effective) x
 on conflict(merchant_id,product_id,variant_id) do update set name=excluded.name,decision=excluded.decision,
  reasons=excluded.reasons,suggestion=excluded.suggestion,updated_at=now();

 insert into public.crm_postpurchase_products(merchant_id,product_id,variant_id,name,model,components,product_url,origin)
 select p_merchant_id,x->>'product_id',coalesce(x->>'variant_id',''),x->'profile'->>'name',x->'profile'->>'model',
  array(select jsonb_array_elements_text(x->'profile'->'components')),x->'profile'->>'product_url','auto'
 from jsonb_array_elements(v_effective) x where x->>'decision'='auto'
 on conflict(merchant_id,product_id,variant_id) do update set name=excluded.name,model=excluded.model,
  components=excluded.components,product_url=excluded.product_url,updated_at=now()
 where crm_postpurchase_products.origin='auto';

 with incoming as materialized(
  select x->>'product_id' product_id,coalesce(x->>'variant_id','') variant_id from jsonb_array_elements(v_effective) x
 )
 update public.crm_postpurchase_suggestions s set decision='excluded',reasons=array['removed_from_source']
 where s.merchant_id=p_merchant_id and not exists(
  select 1 from incoming i where i.product_id=s.product_id and i.variant_id=s.variant_id
 );

 update public.crm_postpurchase_rules set active=false
 where merchant_id=p_merchant_id and origin='auto' and active;

 -- Materialize each valid profile once, and rank offers once per model/component.
 -- This replaces the previous per-trigger repeated lateral scan and sort.
 with eligible as materialized(
  select p.* from public.crm_postpurchase_products p
  join public.crm_postpurchase_suggestions s using(merchant_id,product_id,variant_id)
  where p.merchant_id=p_merchant_id and s.decision='auto'
 ), offers as materialized(
  select p.*,row_number() over(partition by p.model,p.components
   order by case when jsonb_typeof(c.product->'quantity')='number' then (c.product->>'quantity')::numeric else 0 end desc,
    p.product_id,p.variant_id) preference
  from eligible p join public.crm_postpurchase_catalog_cache c using(merchant_id,product_id)
  where cardinality(p.components)=1 and p.components && array['screen','lens','camera_frame']::text[]
   and p.product_url is not null and c.product->>'status'='sale' and c.product->>'is_available'='true'
 )
 insert into public.crm_postpurchase_rules(merchant_id,name,trigger_product_id,trigger_variant_id,offer_product_id,offer_variant_id,origin)
 select p_merchant_id,left(t.name||' ← '||f.name,120),t.product_id,t.variant_id,f.product_id,f.variant_id,'auto'
 from eligible t join offers f on f.model=t.model and f.preference=1
 where t.components && array['case','screen','lens','camera_frame']::text[]
  and not t.components && f.components and (t.product_id,t.variant_id)<>(f.product_id,f.variant_id)
 on conflict(merchant_id,trigger_product_id,trigger_variant_id,offer_product_id,offer_variant_id)
 do update set active=not crm_postpurchase_rules.paused_by_user,name=excluded.name
 where crm_postpurchase_rules.origin='auto';

 select count(*) filter(where x->>'decision'='auto'),count(*) filter(where x->>'decision'='review'),
  count(*) filter(where x->>'decision'='excluded') into v_auto,v_review,v_excluded
 from jsonb_array_elements(v_effective) x;
 return jsonb_build_object('auto',v_auto,'review',v_review,'excluded',v_excluded,'salla_requests',0);
end $$;
revoke all on function public.crm_pp_apply_suggestions(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.crm_pp_apply_suggestions(bigint,jsonb) to service_role;
commit;
