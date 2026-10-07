const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const sync=require('../lib/salla-sync');
test('Salla mapping preserves large identifiers, timezone, partial amounts and phones',()=>{
  const input=sync.losslessJSON('{"id":3076122624318093323 ,"note":"id 3076122624318093323","customer":{"id":864587008}}');
  assert.equal(input.id,'3076122624318093323');assert.equal(input.note,'id 3076122624318093323');
  assert.equal(sync.date({date:'2026-10-07 12:06:23.000000',timezone:'Asia/Riyadh'}),'2026-10-07T09:06:23.000Z');
  assert.equal(sync.phone({mobile:573000000,mobile_code:'+966'}),'+966573000000');
  const cart=sync.record('carts',{id:input.id,total:{amount:101.75,currency:'SAR'},items:[{quantity:2}],customer:{id:1,name:'Test'}},'2026-10-07T10:00:00Z','abandoned.cart.purchased');
  assert.equal(cart.external_cart_id,input.id);assert.equal(cart.status,'recovered');assert.equal(cart.items_count,2);assert.equal(cart.total_amount,101.75);
  const order=sync.record('orders',{id:1,status:{slug:'in_progress',name:'قيد التنفيذ'},total:{amount:12,currency:'SAR'}},'2026-10-07T10:00:00Z');
  assert.equal(order.subtotal,undefined);assert.equal(order.status_slug,'in_progress');
  assert.throws(()=>sync.record('carts',{id:3076122624318093323},'2026-10-07T10:00:00Z'));
  assert.equal(sync.nextPage({totalPages:2},1,30),2);assert.equal(sync.nextPage({totalPages:2},2,30),null);
  assert.equal(sync.nextPage({next:null},1,30),null);assert.equal(sync.nextPage(undefined,1,15),2);
});
test('Salla SQL against merchant schema: atomic upserts, stale events, local fields, privileges and stats',async()=>{
  const db=new PGlite();try{
    await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
    const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json','utf8'));
    for(const table of schema.reverse()){
      const columns=table.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`);
      await db.exec(`create table ${table.table_name}(${columns.concat(table.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
    }
    await db.exec(fs.readFileSync(__dirname+'/../crm-foundation.sql','utf8'));
    const sql=fs.readFileSync(__dirname+'/../crm-salla-sync.sql','utf8');await db.exec(sql);await db.exec(sql);
    assert.equal((await db.query('select crm_salla_sync_ready() ready')).rows[0].ready,true);
    async function apply(resource,rows,event=null){return (await db.query('select crm_apply_salla_records($1,$2,$3) n',[resource,JSON.stringify(rows),event])).rows[0].n;}
    const time='2026-10-07T10:00:00Z';
    await apply('customers',[{external_customer_id:'1',name:'First',crm_source_at:time,crm_scope_at:time}]);
    const customer=(await db.query('select * from customers')).rows[0];
    await apply('orders',[{external_order_id:'100',_customer_external_id:'1',total_amount:150,ordered_at:new Date().toISOString(),status_slug:'in_progress',crm_source_at:time}]);
    assert.equal((await db.query('select customer_id from orders')).rows[0].customer_id,customer.id);
    await apply('customers',[{external_customer_id:'1',name:'New',crm_source_at:'2026-10-07T11:00:00Z'}]);
    await apply('customers',[{external_customer_id:'1',name:'Old',crm_source_at:time}]);
    assert.equal((await db.query('select name from customers')).rows[0].name,'New');
    await apply('carts',[{external_cart_id:'3076122624318093323',status:'active',total_amount:101.75,crm_source_at:time}]);
    await db.exec("update abandoned_carts set status='contacted',last_contact_at='2026-10-07T10:05:00Z';");
    await apply('carts',[{external_cart_id:'3076122624318093323',status:'active',crm_source_at:'2026-10-07T11:00:00Z'}]);
    assert.equal((await db.query('select status from abandoned_carts')).rows[0].status,'contacted');
    await apply('carts',[{external_cart_id:'3076122624318093323',status:'recovered',crm_source_at:'2026-10-07T12:00:00Z'}]);
    await apply('carts',[{external_cart_id:'3076122624318093323',status:'active',crm_source_at:'2026-10-07T13:00:00Z'}]);
    const cart=(await db.query('select * from abandoned_carts')).rows[0];assert.equal(cart.status,'recovered');assert.equal(cart.total_amount,'101.75');assert.ok(cart.last_contact_at);
    await assert.rejects(apply('customers',[{external_customer_id:'2',name:'Rollback',crm_source_at:time},{external_customer_id:'3',id:customer.id,crm_source_at:time}]));
    assert.equal((await db.query('select count(*)::int n from customers')).rows[0].n,1);
    const event=(await db.query("select crm_ingest_event(1829345766,repeat('a',64),'customer.updated',now(),'{\"data\":{\"id\":1}}') result")).rows[0].result.event_id;
    assert.equal(await apply('customers',[{external_customer_id:'1',name:'Latest',crm_source_at:'2026-10-07T14:00:00Z'}],event),1);
    assert.equal(await apply('customers',[{external_customer_id:'1',name:'Duplicated',crm_source_at:'2026-10-07T15:00:00Z'}],event),0);
    assert.equal((await db.query('select name from customers')).rows[0].name,'Latest');
    await db.query('select crm_salla_sync_stats()');
    const stats=(await db.query('select orders_count,total_spent from customers')).rows[0];assert.equal(stats.orders_count,1);assert.equal(stats.total_spent,'150');
    assert.equal((await db.query("select has_function_privilege('anon','crm_apply_salla_records(text,jsonb,uuid)','execute') allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_table_privilege('authenticated','orders','select') allowed")).rows[0].allowed,false);
  }finally{await db.close();}
});
