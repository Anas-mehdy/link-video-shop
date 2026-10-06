-- Read-only: run before mapping CRM entities to the existing tables.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in
  ('stores','store_members','orders','order_items','order_status_history','customers','abandoned_carts','products','product_variants','webhook_events')
order by table_name, ordinal_position;
