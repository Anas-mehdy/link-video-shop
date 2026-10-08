const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('Cart followup SQL: new carts only, dedupe, quiet hours, optouts and purchases; private dry run',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
  const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json','utf8'));
  for(const table of schema.reverse()){
   const columns=table.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`);
   await db.exec(`create table ${table.table_name}(${columns.concat(table.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
  }
  await db.exec('create table test_clock(t timestamptz);insert into test_clock values(\'2026-10-08T05:00:00Z\');create function public.followup_test_now() returns timestamptz language sql as $$ select t from public.test_clock $$;');
  const sql=fs.readFileSync(__dirname+'/../crm-cart-followup.sql','utf8').replaceAll('now()','public.followup_test_now()');
  await db.exec(sql);await db.exec(sql);
  await db.exec("insert into crm_cart_followup_settings values(1829345766,true,'2026-10-08T00:00:00Z',60,'2026-10-08T00:00:00Z');");
  async function cart(id,at='2026-10-08T03:00:00Z',extra={}){
   return (await db.query("insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,status,phone,checkout_url,customer_id) values(1829345766,$1,$2,$3,$4,$5,$6) returning id",[id,at,extra.status||'active',extra.phone||'+966500000001',extra.url||'https://mtjr.at/test',extra.customer||null])).rows[0].id;
  }
  const old=await cart('old','2026-10-07T20:00:00Z'),fresh=await cart('fresh');
  await db.query('select crm_cart_followup_refresh(1829345766)');
  assert.equal((await db.query('select count(*)::int n from crm_cart_followups')).rows[0].n,1);
  let q=(await db.query('select * from crm_cart_followups')).rows[0];assert.equal(q.reason,'quiet_hours');assert.equal(q.scheduled_for.toISOString(),'2026-10-08T06:00:00.000Z');
  await db.query("update abandoned_carts set customer_name='Updated' where id=$1",[fresh]);await db.query('select crm_cart_followup_refresh(1829345766)');
  assert.equal((await db.query('select count(*)::int n from crm_cart_followups')).rows[0].n,1);
  await db.exec("update test_clock set t='2026-10-08T06:00:00Z';");await db.query('select crm_cart_followup_refresh(1829345766)');
  q=(await db.query('select * from crm_cart_followups')).rows[0];assert.equal(q.status,'simulated');const simulated=q.simulated_at;
  await db.query('select crm_cart_followup_refresh(1829345766)');assert.deepEqual((await db.query('select simulated_at from crm_cart_followups')).rows[0].simulated_at,simulated);
  await db.query("update abandoned_carts set status='recovered' where id=$1",[fresh]);assert.equal((await db.query('select status from crm_cart_followups')).rows[0].status,'cancelled');
  const opted=await cart('opted');await db.exec("insert into crm_whatsapp_optouts(merchant_id,phone) values(1829345766,'966500000001');");await db.query('select crm_cart_followup_refresh(1829345766)');assert.equal((await db.query('select reason from crm_cart_followups where cart_id=$1',[opted])).rows[0].reason,'optout');
  const cust=(await db.query("insert into customers(merchant_id,external_customer_id,name) values(1829345766,'1','Test') returning id")).rows[0].id;
  const purchase=await cart('purchase',undefined,{phone:'+966500000002',customer:cust});
  await db.query("insert into orders(merchant_id,external_order_id,customer_id,ordered_at,status_slug) values(1829345766,'order1',$1,'2026-10-08T06:00:00Z','in_progress')",[cust]);
  assert.equal((await db.query('select reason from crm_cart_followups where cart_id=$1',[purchase])).rows[0].reason,'purchased');
  const missing=await cart('missing',undefined,{phone:'bad'});await db.query('select crm_cart_followup_refresh(1829345766)');assert.equal((await db.query('select reason from crm_cart_followups where cart_id=$1',[missing])).rows[0].reason,'missing_phone');
  await db.exec("update crm_cart_followup_settings set enabled=false;");const paused=await cart('paused',undefined,{phone:'+966500000003'});await db.query('select crm_cart_followup_refresh(1829345766)');assert.equal((await db.query('select count(*)::int n from crm_cart_followups where cart_id=$1',[paused])).rows[0].n,0);
  assert.equal((await db.query("select has_table_privilege('anon','crm_cart_followups','SELECT') allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','crm_cart_followup_refresh(bigint)','EXECUTE') allowed")).rows[0].allowed,false);
  assert.equal((await db.query('select count(*)::int n from crm_cart_followups where cart_id=$1',[old])).rows[0].n,0);
  await db.exec("update crm_cart_followup_settings set enabled=true;update test_clock set t='2026-10-08T19:00:00Z';");
  const night=await cart('night','2026-10-08T17:00:00Z',{phone:'+966500000004'});
  await db.query('select crm_cart_followup_refresh(1829345766)');
  assert.equal((await db.query('select scheduled_for from crm_cart_followups where cart_id=$1',[night])).rows[0].scheduled_for.toISOString(),'2026-10-09T06:00:00.000Z');
  await db.exec("update test_clock set t='2026-10-10T06:00:00Z';");await db.query('select crm_cart_followup_refresh(1829345766)');
  assert.equal((await db.query('select reason from crm_cart_followups where cart_id=$1',[night])).rows[0].reason,'expired');
  await assert.rejects(db.query('select crm_cart_followup_refresh(123)'));
 }finally{await db.close();}
});
