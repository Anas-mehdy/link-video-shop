const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(__dirname+'/../'+name,'utf8');
async function fixture(){
 const db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table orders(id uuid primary key default gen_random_uuid(),merchant_id bigint,external_order_id text,order_reference text,ordered_at timestamptz,crm_source_at timestamptz,payment_status text,status_slug text,source_payload jsonb);');
 await db.exec(read('tests/fixtures/preorders-v1.sql'));
 return db;
}
const m=1829345766;
const addOrder=(db,id)=>db.query("insert into orders(merchant_id,external_order_id,order_reference,ordered_at,crm_source_at,payment_status,status_slug,source_payload) values($1,$2,$2,now()+interval '1 minute',now(),'paid','in_progress',$3)",[m,id,JSON.stringify({items:[{id:10,product:{id:900},quantity:1}]})]);
test('legacy upgrade preserves orders, reservations, promises, notices and pending work; activation catches paused orders',async()=>{
 const db=await fixture();try{
 await db.exec("insert into crm_preorder_batches(merchant_id,name,product_id,product_name,color,incoming_quantity,booking_limit,expected_arrival,ship_from,ship_by,status,opened_at) values(1829345766,'shipment','900','frame','burgundy',5,4,'2026-11-03','2026-11-04','2026-11-06','open',now()-interval '1 hour');");
 await addOrder(db,'100');await db.query('select crm_preorder_reconcile($1,20)',[m]);
 await db.exec("update orders set status_slug=status_slug;");
 const before=(await db.query('select * from crm_preorder_reservations')).rows[0];
 const source=JSON.stringify((await db.query('select * from orders')).rows);
 const notices=JSON.stringify((await db.query('select * from crm_preorder_notices')).rows);
 const q=(await db.query('select count(*)::int n from crm_preorder_order_queue')).rows[0].n;
 const result=await db.exec(read('crm-preorders-upgrade.sql'));
 const version=result.at(-1).rows[0];assert.deepEqual(version,{updated_schema:true,updated_functions:true,order_tracking_active:false});
 let after=(await db.query('select * from crm_preorder_reservations')).rows[0];
 for(const k of ['id','batch_id','order_id','state','quantity','allocated_quantity','paid_at','promised_ship_from','promised_ship_by','created_at','updated_at'])assert.deepEqual(after[k],before[k],k);
 assert.equal(after.external_order_id,'100');assert.equal(after.order_reference,'100');
 assert.equal(JSON.stringify((await db.query('select * from orders')).rows),source);
 assert.equal(JSON.stringify((await db.query('select * from crm_preorder_notices')).rows),notices);
 assert.equal((await db.query('select count(*)::int n from crm_preorder_order_queue')).rows[0].n,q);
 // Repeating the upgrade is harmless and keeps tracking paused.
 await db.exec(read('crm-preorders-upgrade.sql'));assert.equal((await db.query('select crm_preorder_tracking_active() active')).rows[0].active,false);
 await addOrder(db,'101');assert.equal((await db.query('select count(*)::int n from crm_preorder_order_queue')).rows[0].n,q);
 // Explicit activation catches missed snapshots, does not duplicate queue entries.
 await db.exec(read('crm-preorders-activate.sql'));await db.exec(read('crm-preorders-activate.sql'));
 assert.equal((await db.query('select crm_preorder_tracking_active() active')).rows[0].active,true);
 assert.equal((await db.query('select count(*)::int n from crm_preorder_order_queue')).rows[0].n,2);
 await db.query('select crm_preorder_reconcile($1,20)',[m]);
 assert.equal((await db.query('select count(*)::int n from crm_preorder_reservations')).rows[0].n,2);
 // New FK behavior allows deletion without losing a reservation.
 await db.exec("delete from orders where external_order_id='100'");
 after=(await db.query('select * from crm_preorder_reservations where id=$1',[before.id])).rows[0];
 assert.equal(after.order_id,null);assert.equal(after.review_reason,'order_deleted');assert.equal(after.external_order_id,'100');
 }finally{await db.close();}
});
test('failed upgrade rolls back columns, copied identities and trigger state together',async()=>{
 const db=await fixture();try{
 await db.exec("insert into crm_preorder_batches(merchant_id,name,product_id,product_name,color,incoming_quantity,booking_limit,expected_arrival,ship_from,ship_by) values(1829345766,'shipment','900','frame','burgundy',5,4,'2026-11-03','2026-11-04','2026-11-06');insert into orders(merchant_id,external_order_id) values(1829345766,'invalid-reference');insert into crm_preorder_reservations(merchant_id,batch_id,order_id,item_key,quantity,promised_ship_from,promised_ship_by) select b.merchant_id,b.id,o.id,'10',1,b.ship_from,b.ship_by from crm_preorder_batches b cross join orders o;");
 await assert.rejects(db.exec(read('crm-preorders-upgrade.sql')),/reservation_order_identity_needs_review/);
 await db.exec('rollback');
 assert.equal((await db.query("select exists(select 1 from information_schema.columns where table_name='crm_preorder_reservations' and column_name='external_order_id') found")).rows[0].found,false);
 assert.equal((await db.query("select tgenabled from pg_trigger where tgname='crm_queue_preorder_order'")).rows[0].tgenabled,'O');
 assert.equal((await db.query('select count(*)::int n from crm_preorder_reservations')).rows[0].n,1);
 }finally{await db.close();}
});
