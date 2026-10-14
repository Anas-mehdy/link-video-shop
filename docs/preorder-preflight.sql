-- READ-ONLY inspection of the live Link CRM schema.
-- No customer/order rows, function bodies, keys or tokens are read.
-- Run this file, NOT crm-preorders.sql, while reviewing compatibility.
begin transaction read only;

with required(table_name,column_name,expected_type) as (
 values
 ('orders','id','uuid'),('orders','merchant_id','bigint'),
 ('orders','external_order_id','text'),('orders','order_reference','text'),
 ('orders','customer_id','uuid'),('orders','ordered_at','timestamp with time zone'),
 ('orders','crm_source_at','timestamp with time zone'),('orders','payment_status','text'),
 ('orders','status_slug','text'),('orders','source_payload','jsonb'),
 ('customers','id','uuid'),('customers','merchant_id','bigint'),('customers','name','text')
), column_checks as (
 select r.*,c.data_type actual_type,c.is_nullable,
 case when c.column_name is null then 'missing' when c.data_type<>r.expected_type then 'type_mismatch' else 'ok' end status
 from required r left join information_schema.columns c
 on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
), target_tables as (
 select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in (
 'orders','customers','crm_preorder_batches','crm_preorder_reservations',
 'crm_preorder_order_queue','crm_preorder_notices','crm_preorder_audit')
 and c.relkind in ('r','p')
), relevant_roles as (
 select oid,rolname,rolbypassrls,rolsuper from pg_roles
 where rolname in ('service_role','authenticated','anon','postgres')
), relevant_functions as (
 select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
 p.prosecdef security_definer,pg_get_userbyid(p.proowner) owner,
 array(select s from unnest(p.proconfig) s where s like 'search_path=%') search_path,
 md5(p.prosrc) body_hash
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'crm_preorder_%' or p.proname='crm_queue_preorder_order' or p.proname='crm_apply_salla_records')
)
select 'environment' check_name,'info' status,
 jsonb_build_object('database',current_database(),'reader',current_user,'postgres_version',current_setting('server_version'),
 'readonly',current_setting('transaction_read_only'),'order_table_exists',to_regclass('public.orders') is not null,
 'salla_projection_exists',exists(select 1 from relevant_functions where proname='crm_apply_salla_records')) details
union all
select 'required_columns',case when exists(select 1 from column_checks where status<>'ok') then 'needs_review' else 'ok' end,
 coalesce((select jsonb_agg(to_jsonb(x) order by table_name,column_name) from column_checks x),'[]'::jsonb)
union all
select 'orders_id_unique',case when exists(
 select 1 from pg_constraint k join pg_attribute a on a.attrelid=k.conrelid and a.attname='id'
 where k.conrelid=to_regclass('public.orders') and k.contype in ('p','u') and k.conkey=array[a.attnum]
 ) then 'ok' else 'needs_review' end,
 coalesce((select jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid)))
 from pg_constraint k where k.conrelid=to_regclass('public.orders') and k.contype in ('p','u')),'[]'::jsonb)
union all
select 'orders_triggers','review',coalesce((
 select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,
  'timing',case when (t.tgtype::integer & 2)<>0 then 'before' when (t.tgtype::integer & 64)<>0 then 'instead_of' else 'after' end,
  'insert',(t.tgtype::integer & 4)<>0,'update',(t.tgtype::integer & 16)<>0,'delete',(t.tgtype::integer & 8)<>0,
  'update_columns',array(select a.attname from pg_attribute a where a.attrelid=t.tgrelid and a.attnum=any(t.tgattr::smallint[])),
  'function',p.proname,'function_owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,
  'search_path',array(select s from unnest(p.proconfig) s where s like 'search_path=%')) order by t.tgname)
 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
 where t.tgrelid=to_regclass('public.orders') and not t.tgisinternal
),'[]'::jsonb)
union all
select 'table_privileges_and_rls','review',coalesce((
 select jsonb_agg(jsonb_build_object('table',t.relname,'role',r.rolname,'table_owner',t.owner,
  'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,'role_bypasses_rls',r.rolbypassrls,
  'select',has_table_privilege(r.oid,t.oid,'SELECT'),'insert',has_table_privilege(r.oid,t.oid,'INSERT'),
  'update',has_table_privilege(r.oid,t.oid,'UPDATE'),'delete',has_table_privilege(r.oid,t.oid,'DELETE')) order by t.relname,r.rolname)
 from target_tables t cross join relevant_roles r
),'[]'::jsonb)
union all
select 'policy_metadata','review',coalesce((
 select jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'roles',roles,'command',cmd,'permissive',permissive) order by tablename,policyname)
 from pg_policies where schemaname='public' and tablename in (select relname from target_tables)
),'[]'::jsonb)
union all
select 'foreign_keys_involving_orders','review',coalesce((
 select jsonb_agg(jsonb_build_object('table',k.conrelid::regclass::text,'name',k.conname,
  'referenced_table',k.confrelid::regclass::text,'definition',pg_get_constraintdef(k.oid)) order by k.conname)
 from pg_constraint k where k.contype='f' and (k.conrelid=to_regclass('public.orders') or k.confrelid=to_regclass('public.orders'))
),'[]'::jsonb)
union all
select 'existing_preorder_tables','review',coalesce((
 select jsonb_agg(jsonb_build_object('table',c.table_name,'column',c.column_name,'type',c.data_type,'nullable',c.is_nullable) order by c.table_name,c.ordinal_position)
 from information_schema.columns c where c.table_schema='public' and c.table_name in (
 'crm_preorder_batches','crm_preorder_reservations','crm_preorder_order_queue','crm_preorder_notices','crm_preorder_audit')
),'[]'::jsonb)
union all
select 'existing_functions_and_access','review',coalesce((
 select jsonb_agg(to_jsonb(f)||jsonb_build_object(
  'anon_execute',case when exists(select 1 from pg_roles where rolname='anon') then has_function_privilege('anon',f.oid,'EXECUTE') else null end,
  'authenticated_execute',case when exists(select 1 from pg_roles where rolname='authenticated') then has_function_privilege('authenticated',f.oid,'EXECUTE') else null end,
  'service_execute',case when exists(select 1 from pg_roles where rolname='service_role') then has_function_privilege('service_role',f.oid,'EXECUTE') else null end)
 order by f.proname,f.arguments) from relevant_functions f
),'[]'::jsonb);

commit;
