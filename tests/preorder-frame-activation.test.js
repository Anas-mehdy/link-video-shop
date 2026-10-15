const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('combined frame/grip activation uses existing RPC, repeats without edits and rolls back every new batch on a conflict',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
  const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json'));
  for(const t of schema.filter(x=>['customers','orders','abandoned_carts'].includes(x.table_name)))await db.exec(`create table ${t.table_name}(${t.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(t.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
  for(const p of ['crm-foundation.sql','crm-salla-sync.sql','crm-preorders.sql','crm-preorders-activate.sql'])await db.exec(fs.readFileSync(__dirname+'/../'+p,'utf8'));
  await db.exec(`insert into crm_preorder_batches(id,merchant_id,name,product_id,variant_id,product_name,color,incoming_quantity,booking_limit,expected_arrival,ship_from,ship_by,status,opened_at)
   values('c3f3ec44-d4cc-410f-9dde-5dcfd93f11b4',1829345766,'Existing','318533359','','Frame','بورغندي',400,400,'2026-11-03','2026-11-04','2026-11-06','open',now());`);
  const sql=fs.readFileSync(__dirname+'/../docs/preorder-frame-colors-activate.sql','utf8');
  const rows=async()=>(await db.query('select * from crm_preorder_batches order by product_id')).rows;
  const source=await rows();await db.exec(sql);const first=await rows();assert.equal(first.length,5);
  const grip=first.find(b=>b.product_id==='1980971091');assert.equal(grip.incoming_quantity,300);assert.equal(grip.booking_limit,300);assert.equal(grip.expected_arrival.toISOString().slice(0,10),'2026-11-13');assert.equal(grip.ship_from.toISOString().slice(0,10),'2026-11-14');assert.equal(grip.ship_by.toISOString().slice(0,10),'2026-11-16');
  assert.deepEqual(first.find(b=>b.product_id==='318533359'),source[0]);
  await db.exec(sql);assert.deepEqual(await rows(),first);
  assert.equal((await db.query('select count(*)::int n from crm_preorder_audit')).rows[0].n,4);
  // An already executed old three-color file must permit adding only the missing grip.
  await db.exec("delete from crm_preorder_audit;delete from crm_preorder_batches where product_id='1980971091';");
  const beforeGrip=await rows();await db.exec(sql);const afterGrip=await rows();assert.equal(afterGrip.length,5);assert.deepEqual(afterGrip.filter(b=>b.product_id!=='1980971091'),beforeGrip);assert.equal((await db.query('select count(*)::int n from crm_preorder_audit')).rows[0].n,1);
  // A conflict in the last product must roll back all three newly inserted frames.
  await db.exec("delete from crm_preorder_audit;delete from crm_preorder_batches where product_id in ('1229565720','1962143002','1013934438');update crm_preorder_batches set incoming_quantity=299,booking_limit=299 where product_id='1980971091';");
  const conflict=await rows();await assert.rejects(db.exec(sql),/existing_batch_requires_review/);await db.exec('rollback');assert.deepEqual(await rows(),conflict);
  await db.exec("update crm_preorder_batches set ship_by='2026-11-07' where product_id='318533359'");await assert.rejects(db.exec(sql),/source_schedule_changed/);await db.exec('rollback');
 }finally{await db.close();}
});
