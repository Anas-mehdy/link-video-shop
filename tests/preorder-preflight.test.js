const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('preflight executes in read-only mode before/after setup and reports only metadata',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table orders(id uuid primary key default gen_random_uuid(),merchant_id bigint,external_order_id text,order_reference text,customer_id uuid,ordered_at timestamptz,crm_source_at timestamptz,payment_status text,status_slug text,source_payload jsonb);create table customers(id uuid primary key,merchant_id bigint,name text);');
  const sql=fs.readFileSync(__dirname+'/../docs/preorder-preflight.sql','utf8');
  let report=(await db.exec(sql))[1].rows;
  assert.equal(report.find(x=>x.check_name==='environment').details.readonly,'on');
  assert.equal(report.find(x=>x.check_name==='required_columns').status,'ok');
  assert.equal(report.find(x=>x.check_name==='orders_id_unique').status,'ok');
  assert.deepEqual(report.find(x=>x.check_name==='existing_preorder_tables').details,[]);
  const before=(await db.query('select count(*)::int n from pg_class')).rows[0].n;
  await db.exec(sql);assert.equal((await db.query('select count(*)::int n from pg_class')).rows[0].n,before);
  await db.exec(fs.readFileSync(__dirname+'/../crm-preorders.sql','utf8'));
  assert.equal((await db.query('select crm_preorder_tracking_active() active')).rows[0].active,false);
  assert.equal((await db.exec(sql))[1].rows.find(x=>x.check_name==='orders_triggers').details.length,0);
  await db.exec(fs.readFileSync(__dirname+'/../crm-preorders-activate.sql','utf8'));
  await db.exec(fs.readFileSync(__dirname+'/../crm-preorders-activate.sql','utf8'));
  assert.equal((await db.query('select crm_preorder_tracking_active() active')).rows[0].active,true);
  await db.exec("grant usage on schema public to authenticated,service_role;grant insert on orders to authenticated;grant all on orders to service_role;");
  report=(await db.exec(sql))[1].rows;
  assert.equal(report.find(x=>x.check_name==='orders_triggers').details[0].name,'crm_queue_preorder_order');
  assert.ok(report.find(x=>x.check_name==='existing_preorder_tables').details.length>0);
  assert.equal(report.find(x=>x.check_name==='foreign_keys_involving_orders').details.length,2);
  assert.ok(report.find(x=>x.check_name==='existing_functions_and_access').details.every(x=>x.anon_execute===false&&x.authenticated_execute===false&&x.service_execute===true));
  // This is why live callers must be inspected: the new invoker trigger can block
  // an otherwise permitted order INSERT from a role without preorder-table access.
  await db.exec('set role authenticated');
  await assert.rejects(db.exec("insert into orders(merchant_id,source_payload) values(1829345766,'{\"items\":[]}')"),/permission denied/);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);
  await db.exec('set role service_role');
  await db.exec("insert into orders(merchant_id,source_payload) values(1829345766,'{\"items\":[]}')");
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,1);
  // Deleting an existing order stays allowed; retain its reservation for staff review.
  await db.exec("insert into crm_preorder_batches(merchant_id,name,product_id,product_name,color,incoming_quantity,booking_limit,expected_arrival,ship_from,ship_by) values(1829345766,'test','900','frame','burgundy',1,1,'2026-11-03','2026-11-04','2026-11-06');insert into crm_preorder_reservations(merchant_id,batch_id,order_id,external_order_id,item_key,quantity,promised_ship_from,promised_ship_by) select b.merchant_id,b.id,o.id,'100','1',1,b.ship_from,b.ship_by from crm_preorder_batches b cross join orders o;insert into crm_preorder_order_queue select merchant_id,id,now(),null from orders;");
  await db.exec('delete from orders');
  assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);
  const orphan=(await db.query('select * from crm_preorder_reservations')).rows[0];assert.equal(orphan.order_id,null);assert.equal(orphan.external_order_id,'100');assert.equal(orphan.state,'review');assert.equal(orphan.review_reason,'order_deleted');
  assert.equal((await db.query('select count(*)::int n from crm_preorder_order_queue')).rows[0].n,0);
 }finally{await db.close();}
});
