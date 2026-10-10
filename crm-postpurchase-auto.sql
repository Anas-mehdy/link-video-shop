begin;
alter table public.crm_postpurchase_products add column if not exists origin text not null default 'manual' check(origin in ('manual','auto'));
alter table public.crm_postpurchase_rules add column if not exists origin text not null default 'manual' check(origin in ('manual','auto'));
alter table public.crm_postpurchase_rules add column if not exists paused_by_user boolean not null default false;
-- Extend the existing component check without depending on its generated name.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.crm_postpurchase_products'::regclass and contype='c' and pg_get_constraintdef(oid) like '%components%<@%'
 loop execute format('alter table public.crm_postpurchase_products drop constraint %I',c.conname); end loop;
end $$;
alter table public.crm_postpurchase_products add constraint crm_pp_components_auto_check check(components <@ array['case','screen','lens','camera_frame','charger','cable','other']::text[]);

create table if not exists public.crm_postpurchase_catalog_cache(
 merchant_id bigint not null,product_id text not null,product jsonb not null,fetched_at timestamptz not null default now(),primary key(merchant_id,product_id)
);
create table if not exists public.crm_postpurchase_suggestions(
 merchant_id bigint not null,product_id text not null,variant_id text not null default '',name text not null,
 decision text not null check(decision in ('auto','review','excluded')),reasons text[] not null default '{}',suggestion jsonb not null,
 updated_at timestamptz not null default now(),primary key(merchant_id,product_id,variant_id)
);
create table if not exists public.crm_postpurchase_import(
 merchant_id bigint primary key,next_page integer not null default 1,completed boolean not null default false,
 lease_id uuid,lease_until timestamptz,completed_at timestamptz,started_at timestamptz not null default now(),last_error text,updated_at timestamptz not null default now()
);
create table if not exists public.crm_postpurchase_api_usage(
 merchant_id bigint not null,month date not null,requests integer not null default 0 check(requests between 0 and 20),primary key(merchant_id,month)
);

create or replace function public.crm_pp_reserve_import(p_merchant_id bigint,p_refresh boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.crm_postpurchase_import; n integer; m date:=date_trunc('month',now() at time zone 'Asia/Riyadh')::date; token uuid;
begin
 if not exists(select 1 from public.crm_postpurchase_settings where merchant_id=p_merchant_id) then raise exception 'Missing postpurchase setup'; end if;
 insert into public.crm_postpurchase_import(merchant_id) values(p_merchant_id) on conflict do nothing;
 select * into r from public.crm_postpurchase_import where merchant_id=p_merchant_id for update;
 if r.lease_until>now() then return jsonb_build_object('idle','busy'); end if;
 if r.completed then
  if not p_refresh or r.completed_at>now()-interval '24 hours' then return jsonb_build_object('idle','cached'); end if;
  r.next_page:=1;
  update public.crm_postpurchase_import set started_at=now() where merchant_id=p_merchant_id;
 end if;
 insert into public.crm_postpurchase_api_usage(merchant_id,month) values(p_merchant_id,m) on conflict do nothing;
 select requests into n from public.crm_postpurchase_api_usage where merchant_id=p_merchant_id and month=m for update;
 if n>=20 or r.next_page>20 then return jsonb_build_object('idle','budget_limit'); end if;
 token:=gen_random_uuid();
 update public.crm_postpurchase_api_usage set requests=requests+1 where merchant_id=p_merchant_id and month=m;
 update public.crm_postpurchase_import set next_page=r.next_page,completed=false,lease_id=token,lease_until=now()+interval '2 minutes',last_error=null,updated_at=now() where merchant_id=p_merchant_id;
 return jsonb_build_object('page',r.next_page,'token',token,'requests',n+1,'budget',20);
end $$;

create or replace function public.crm_pp_finish_import(p_merchant_id bigint,p_token uuid,p_page integer,p_products jsonb,p_done boolean,p_error text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.crm_postpurchase_import; x jsonb;
begin
 select * into r from public.crm_postpurchase_import where merchant_id=p_merchant_id for update;
 if r.lease_id is distinct from p_token or r.next_page<>p_page then return false; end if;
 if p_error is null then
  if jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products)>60 then raise exception 'Invalid page'; end if;
  for x in select value from jsonb_array_elements(p_products) loop
   if coalesce(x->>'id','') !~ '^[0-9]{1,20}$' then raise exception 'Invalid product'; end if;
   insert into public.crm_postpurchase_catalog_cache(merchant_id,product_id,product) values(p_merchant_id,x->>'id',x)
   on conflict(merchant_id,product_id) do update set product=excluded.product,fetched_at=now();
  end loop;
  if p_done then delete from public.crm_postpurchase_catalog_cache where merchant_id=p_merchant_id and fetched_at<r.started_at; end if;
 end if;
 update public.crm_postpurchase_import set lease_id=null,lease_until=null,
 next_page=case when p_error is null and not p_done then next_page+1 else next_page end,
 completed=case when p_error is null then p_done else false end,
 completed_at=case when p_error is null and p_done then now() else completed_at end,
 last_error=left(p_error,200),updated_at=now() where merchant_id=p_merchant_id;
 return true;
end $$;

create or replace function public.crm_pp_apply_suggestions(p_merchant_id bigint,p_suggestions jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare x jsonb; profile jsonb; manual_profile jsonb; generated integer:=0; reviewed integer:=0; excluded integer:=0;
begin
 perform 1 from public.crm_postpurchase_settings where merchant_id=p_merchant_id for update;
 if not found then raise exception 'Missing settings'; end if;
 if jsonb_typeof(p_suggestions)<>'array' or jsonb_array_length(p_suggestions)>1500 then raise exception 'Invalid suggestions'; end if;
 for x in select value from jsonb_array_elements(p_suggestions) loop
  select to_jsonb(p) into manual_profile from public.crm_postpurchase_products p where p.merchant_id=p_merchant_id and p.product_id=x->>'product_id' and p.variant_id=coalesce(x->>'variant_id','') and p.origin='manual';
  if manual_profile is not null and x->>'decision'<>'excluded' then x:=x||jsonb_build_object('decision','auto','profile',manual_profile,'reasons',jsonb_build_array('manual_confirmed')); end if;
  profile:=x->'profile';
  insert into public.crm_postpurchase_suggestions(merchant_id,product_id,variant_id,name,decision,reasons,suggestion)
  values(p_merchant_id,x->>'product_id',coalesce(x->>'variant_id',''),x->>'name',x->>'decision',array(select jsonb_array_elements_text(x->'reasons')),profile)
  on conflict(merchant_id,product_id,variant_id) do update set name=excluded.name,decision=excluded.decision,reasons=excluded.reasons,suggestion=excluded.suggestion,updated_at=now();
  if x->>'decision'='auto' then
   insert into public.crm_postpurchase_products(merchant_id,product_id,variant_id,name,model,components,product_url,origin)
   values(p_merchant_id,x->>'product_id',coalesce(x->>'variant_id',''),profile->>'name',profile->>'model',array(select jsonb_array_elements_text(profile->'components')),profile->>'product_url','auto')
   on conflict(merchant_id,product_id,variant_id) do update set name=excluded.name,model=excluded.model,components=excluded.components,product_url=excluded.product_url,updated_at=now()
   where crm_postpurchase_products.origin='auto';
   generated:=generated+1;
  elsif x->>'decision'='review' then reviewed:=reviewed+1;
  else excluded:=excluded+1;
  end if;
 end loop;
 update public.crm_postpurchase_suggestions s set decision='excluded',reasons=array['removed_from_source'] where s.merchant_id=p_merchant_id and not exists(select 1 from jsonb_array_elements(p_suggestions) incoming(value) where incoming.value->>'product_id'=s.product_id and coalesce(incoming.value->>'variant_id','')=s.variant_id);
 -- Recompute the active automatic set so old alternatives cannot accumulate.
 update public.crm_postpurchase_rules set active=false where merchant_id=p_merchant_id and origin='auto';
 -- High-confidence compatible suggestions are enrolled in preview only. Existing rules retain user pauses.
 insert into public.crm_postpurchase_rules(merchant_id,name,trigger_product_id,trigger_variant_id,offer_product_id,offer_variant_id,origin)
 select p_merchant_id,left(t.name||' ← '||f.name,120),t.product_id,t.variant_id,f.product_id,f.variant_id,'auto'
 from public.crm_postpurchase_products t join lateral (
 select distinct on (candidate.components) candidate.* from public.crm_postpurchase_products candidate
 join public.crm_postpurchase_catalog_cache stock on stock.merchant_id=candidate.merchant_id and stock.product_id=candidate.product_id
 join public.crm_postpurchase_suggestions offer_check on offer_check.merchant_id=candidate.merchant_id and offer_check.product_id=candidate.product_id and offer_check.variant_id=candidate.variant_id and offer_check.decision='auto'
 where candidate.merchant_id=t.merchant_id and candidate.model=t.model and not candidate.components && t.components
 and cardinality(candidate.components)=1 and candidate.components && array['screen','lens','camera_frame']::text[]
 and stock.product->>'status'='sale' and stock.product->>'is_available'='true'
 order by candidate.components,case when jsonb_typeof(stock.product->'quantity')='number' then (stock.product->>'quantity')::numeric else 0 end desc,candidate.product_id,candidate.variant_id
 ) f on true
 join public.crm_postpurchase_suggestions ts on ts.merchant_id=t.merchant_id and ts.product_id=t.product_id and ts.variant_id=t.variant_id and ts.decision='auto'
 join public.crm_postpurchase_suggestions fs on fs.merchant_id=f.merchant_id and fs.product_id=f.product_id and fs.variant_id=f.variant_id and fs.decision='auto'
 where t.merchant_id=p_merchant_id and (t.product_id,t.variant_id)<>(f.product_id,f.variant_id)
 and t.components && array['case','screen','lens','camera_frame']::text[] and f.components && array['screen','lens','camera_frame']::text[]
 and not t.components && f.components and f.product_url is not null
 and exists(select 1 from public.crm_postpurchase_catalog_cache c where c.merchant_id=p_merchant_id and c.product_id=f.product_id and c.product->>'status'='sale' and c.product->>'is_available'='true')
 on conflict(merchant_id,trigger_product_id,trigger_variant_id,offer_product_id,offer_variant_id) do update set active=not crm_postpurchase_rules.paused_by_user,name=excluded.name where crm_postpurchase_rules.origin='auto';
 return jsonb_build_object('auto',generated,'review',reviewed,'excluded',excluded,'salla_requests',0);
end $$;

create or replace function public.crm_postpurchase_preview(p_merchant_id bigint)
returns jsonb language sql security invoker set search_path='' as $$
 with recent as (
 select o.*,c.name customer_name,c.phone,c.normalized_phone,d.delivered_at
 from public.orders o left join public.customers c on c.id=o.customer_id and c.merchant_id=o.merchant_id
 left join public.crm_postpurchase_delivered d on d.order_id=o.id and d.merchant_id=o.merchant_id
 where o.merchant_id=p_merchant_id and o.status_slug='delivered' and o.ordered_at>=now()-interval '30 days'
 order by o.ordered_at desc limit 200
 ), items as (
 select o.id order_id,coalesce(i->'product'->>'id',i->>'product_id') product_id,
 case when exists(select 1 from public.crm_postpurchase_products p where p.merchant_id=p_merchant_id and p.product_id=coalesce(i->'product'->>'id',i->>'product_id') and p.variant_id='' and p.origin='auto') then '' else coalesce(i->'sku'->>'id',i->>'sku_id','') end variant_id
 from recent o cross join lateral jsonb_array_elements(case when jsonb_typeof(o.source_payload->'items')='array' then o.source_payload->'items' else '[]'::jsonb end) i
 ), matches as (
 select distinct o.id,o.customer_id,o.external_order_id,o.customer_name,o.delivered_at,o.phone,o.normalized_phone,o.ordered_at,
 r.id rule_id,r.name rule_name,t.name purchased_name,f.name offer_name,f.product_url,
 o.delivered_at+make_interval(days=>s.delay_days) scheduled_for,
 case
 when o.delivered_at is null then 'delivery_date_unknown'
 when o.customer_id is null then 'customer_missing'
 when coalesce(o.normalized_phone,regexp_replace(coalesce(o.phone,''),'[^0-9]','','g')) !~ '^[1-9][0-9]{7,14}$' then 'phone_missing'
 when exists(select 1 from public.crm_whatsapp_optouts z where z.merchant_id=o.merchant_id and z.phone=coalesce(o.normalized_phone,regexp_replace(coalesce(o.phone,''),'[^0-9]','','g'))) then 'optout'
 when exists(select 1 from public.orders later where later.merchant_id=o.merchant_id and later.customer_id=o.customer_id and later.ordered_at>o.ordered_at and coalesce(later.status_slug,'') not in ('cancelled','canceled','refunded')) then 'later_purchase'
 when t.model<>f.model then 'model_mismatch'
 when exists(select 1 from items it left join public.crm_postpurchase_products p on p.merchant_id=o.merchant_id and p.product_id=it.product_id and p.variant_id=it.variant_id where it.order_id=o.id and p.product_id is null) then 'unmapped_items'
 when exists(select 1 from items it join public.crm_postpurchase_products p on p.merchant_id=o.merchant_id and p.product_id=it.product_id and p.variant_id=it.variant_id where it.order_id=o.id and p.model=f.model and p.components && f.components) then 'already_owned'
 when coalesce(f.product_url,'')='' then 'offer_url_missing'
 when o.delivered_at+make_interval(days=>s.delay_days)>now() then 'delay'
 else 'stock_check_required' end reason
 from recent o join items it on it.order_id=o.id
 join public.crm_postpurchase_rules r on r.merchant_id=o.merchant_id and r.trigger_product_id=it.product_id and r.trigger_variant_id=it.variant_id and r.active
 join public.crm_postpurchase_products t on t.merchant_id=r.merchant_id and t.product_id=r.trigger_product_id and t.variant_id=r.trigger_variant_id
 join public.crm_postpurchase_products f on f.merchant_id=r.merchant_id and f.product_id=r.offer_product_id and f.variant_id=r.offer_variant_id
 join public.crm_postpurchase_settings s on s.merchant_id=o.merchant_id
 )
 select jsonb_build_object('mode','preview','messages_sent',0,'salla_requests',0,
 'scanned_orders',(select count(*) from recent),
 'matched_orders',(select count(distinct id) from matches),
 'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select external_order_id,customer_name,rule_name,purchased_name,offer_name,scheduled_for,reason from matches order by scheduled_for nulls last,external_order_id limit 100) x),'[]'::jsonb));
$$;


alter table public.crm_postpurchase_catalog_cache enable row level security;
alter table public.crm_postpurchase_suggestions enable row level security;
alter table public.crm_postpurchase_import enable row level security;
alter table public.crm_postpurchase_api_usage enable row level security;
revoke all on public.crm_postpurchase_catalog_cache,public.crm_postpurchase_suggestions,public.crm_postpurchase_import,public.crm_postpurchase_api_usage from public,anon,authenticated;
grant all on public.crm_postpurchase_catalog_cache,public.crm_postpurchase_suggestions,public.crm_postpurchase_import,public.crm_postpurchase_api_usage to service_role;
revoke all on function public.crm_pp_reserve_import(bigint,boolean),public.crm_pp_finish_import(bigint,uuid,integer,jsonb,boolean,text),public.crm_pp_apply_suggestions(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.crm_pp_reserve_import(bigint,boolean),public.crm_pp_finish_import(bigint,uuid,integer,jsonb,boolean,text),public.crm_pp_apply_suggestions(bigint,jsonb) to service_role;
commit;
select 'automatic_preview_ready' as status,20 as catalog_monthly_request_limit;
