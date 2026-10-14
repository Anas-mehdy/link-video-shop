"""Build the one-transaction v1->current SQL deliverable from current setup SQL."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX = """-- Upgrade the previously installed preorder module, preserving all rows.
-- Only preorder objects and its named order-queue trigger are changed.
-- Constraint DROP below replaces FK rules, never drops a table or customer/order row.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.orders in share row exclusive mode;
lock table public.crm_preorder_batches,public.crm_preorder_reservations,
 public.crm_preorder_order_queue,public.crm_preorder_notices,public.crm_preorder_audit
 in share row exclusive mode;

do $$ declare counts jsonb; begin
 if to_regprocedure('public.crm_queue_preorder_order()') is null then raise exception 'previous_preorder_module_missing';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='crm_queue_preorder_order') then
  if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='crm_queue_preorder_order'
   and tgfoid='public.crm_queue_preorder_order()'::regprocedure and tgtype=21) then raise exception 'unexpected_preorder_trigger';end if;
  alter table public.orders disable trigger crm_queue_preorder_order;
 end if;
 counts:=jsonb_build_object(
  'batches',(select count(*) from public.crm_preorder_batches),
  'reservations',(select count(*) from public.crm_preorder_reservations),
  'queue',(select count(*) from public.crm_preorder_order_queue),
  'notices',(select count(*) from public.crm_preorder_notices),
  'audit',(select count(*) from public.crm_preorder_audit));
 perform set_config('link.preorder_upgrade_counts',counts::text,true);
end $$;

alter table public.crm_preorder_reservations add column if not exists external_order_id text;
alter table public.crm_preorder_reservations add column if not exists order_reference text;
update public.crm_preorder_reservations r set external_order_id=o.external_order_id,order_reference=o.order_reference
from public.orders o where r.order_id=o.id and r.merchant_id=o.merchant_id and r.external_order_id is null;
do $$ begin
 if exists(select 1 from public.crm_preorder_reservations where external_order_id is null or external_order_id !~ '^[0-9]{1,40}$') then
  raise exception 'reservation_order_identity_needs_review';
 end if;
end $$;
alter table public.crm_preorder_reservations alter column external_order_id set not null;
alter table public.crm_preorder_reservations alter column order_id drop not null;

-- Replace only the single-column order FK on each of the two preorder tables.
-- Reject unexpected schemas instead of guessing constraint names or dropping other FKs.
do $$ declare table_name text; wanted \"char\"; constraints text[]; constraint_name text; begin
 foreach table_name in array array['crm_preorder_reservations','crm_preorder_order_queue'] loop
  wanted:=case when table_name='crm_preorder_reservations' then 'n' else 'c' end;
  select array_agg(k.conname) into constraints from pg_constraint k
  join pg_attribute a on a.attrelid=k.conrelid and a.attname='order_id'
  where k.conrelid=to_regclass('public.'||table_name) and k.contype='f'
   and k.confrelid='public.orders'::regclass and k.conkey=array[a.attnum];
  if coalesce(cardinality(constraints),0)<>1 then raise exception 'unexpected_order_foreign_key';end if;
  constraint_name:=constraints[1];
  if not exists(select 1 from pg_constraint where conrelid=to_regclass('public.'||table_name) and conname=constraint_name and confdeltype=wanted) then
   execute format('alter table public.%I drop constraint %I',table_name,constraint_name);
   execute format('alter table public.%I add constraint %I foreign key(order_id) references public.orders(id) on delete %s',
    table_name,constraint_name,case when wanted='n' then 'set null' else 'cascade' end);
  end if;
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.crm_preorder_reservations'::regclass and conname='crm_preorder_external_order_unique') then
  alter table public.crm_preorder_reservations add constraint crm_preorder_external_order_unique unique(merchant_id,external_order_id,item_key);
 end if;
end $$;

-- Current setup definitions follow inside the same transaction.
"""
SUFFIX = """
-- Check that all preorder business and queue rows survived the upgrade.
do $$ declare before_counts jsonb; after_counts jsonb; begin
 before_counts:=current_setting('link.preorder_upgrade_counts')::jsonb;
 after_counts:=jsonb_build_object(
  'batches',(select count(*) from public.crm_preorder_batches),
  'reservations',(select count(*) from public.crm_preorder_reservations),
  'queue',(select count(*) from public.crm_preorder_order_queue),
  'notices',(select count(*) from public.crm_preorder_notices),
  'audit',(select count(*) from public.crm_preorder_audit));
 if before_counts<>after_counts then raise exception 'preorder_upgrade_row_count_changed';end if;
end $$;
commit;
select
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='crm_preorder_reservations' and column_name='external_order_id') as updated_schema,
 to_regprocedure('public.crm_preorder_tracking_active()') is not null as updated_functions,
 public.crm_preorder_tracking_active() as order_tracking_active;
"""


def build():
    setup = (ROOT / 'crm-preorders.sql').read_text()
    assert setup.startswith('begin;\n') and setup.rstrip().endswith('commit;')
    setup = setup.removeprefix('begin;\n').rstrip().removesuffix('commit;')
    return PREFIX + setup + SUFFIX


if __name__ == '__main__':
    (ROOT / 'crm-preorders-upgrade.sql').write_text(build())
