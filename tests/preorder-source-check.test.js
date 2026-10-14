const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('live preorder source check is read-only and suppresses customer and transaction data',async()=>{
 const db=new PGlite();try{
  await db.exec('create table orders(id int,merchant_id bigint,external_order_id text,payment_status text,status_slug text,source_payload jsonb,crm_source_at timestamptz);create table crm_event_inbox(id int,merchant_id bigint,event_name text,payload jsonb,received_at timestamptz);');
  const snapshot={id:900,payment_status:'paid',status:{slug:'in_progress'},customer:{name:'PRIVATE_NAME',mobile:'PRIVATE_PHONE'},notes:'PRIVATE_NOTE',items:[{id:10,product:{id:318533359,name:'PRIVATE_PRODUCT_TEXT'},quantity:1,notes:'PRIVATE_ENGRAVING'}],payment_actions:{remaining_action:{paid_amount:{amount:89},has_remaining_amount:false},refund_action:{refund_amount:{amount:0},refunded_transactions:['PRIVATE_TRANSACTION']}}};
  await db.query("insert into orders values(1,1829345766,'900','paid','in_progress',$1,now())",[JSON.stringify(snapshot)]);
  await db.query("insert into orders values(2,99,'OTHER_MERCHANT','paid','in_progress',$1,now())",[JSON.stringify(snapshot)]);
  await db.query("insert into crm_event_inbox values(1,1829345766,'order.status.updated',$1,now())",[JSON.stringify({data:{order:snapshot}})]);
  await db.query("insert into crm_event_inbox values(2,1829345766,'order.updated',$1,now())",[JSON.stringify({data:{id:901,items:{not:'an array'}}})]);
  const sql=fs.readFileSync(__dirname+'/../docs/preorder-source-check.sql','utf8');
  const result=await db.exec(sql);const rows=result.find(r=>r.rows?.length)?.rows;
  assert.equal(rows.length,3);const output=JSON.stringify(rows);assert.ok(!output.includes('PRIVATE_'));assert.ok(!output.includes('OTHER_MERCHANT'));
  const order=rows.find(r=>r.source==='stored_order');assert.equal(order.source_shape.items[0].nested_product_id,'318533359');assert.equal(order.source_shape.paid_amount,'89');
  assert.match(sql,/begin transaction read only/i);assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,2);
 }finally{await db.close();}
});
