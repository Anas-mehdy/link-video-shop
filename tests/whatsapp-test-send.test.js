const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {payload,send}=require('../lib/whatsapp-test-send');
const id='11111111-1111-4111-8111-111111111111',phone='966500000001';
test('WhatsApp test send uses fixed template, own cart URL, allowlisted phone and protected single attempt',async()=>{
 const record={id,phone,checkout_url:'https://mtjr.at/own-cart',customer_name:'Test\nName'};
 const p=payload(record);assert.equal(p.contact.phone_number,'+'+phone);assert.equal(p.message.whatsapp_template.components[2].parameters[0].text,'own-cart');assert.equal(p.message.whatsapp_template.components[2].index,'1');assert.equal(p.contact.name,'Test Name');
 assert.throws(()=>payload({...record,checkout_url:'https://mtjr.at.evil.test/path'}));
 const environment={WHATSAPP_TEST_PHONE:phone,ETISALNA_API_ACCESS_TOKEN:'synthetic-token'};let network=0;const updates=[];
 const database=async(path,opts)=>{if(path.startsWith('rpc/')){assert.equal(JSON.parse(opts.body).p_test_phone,phone);return record;}updates.push(JSON.parse(opts.body));};
 const request=async(url,options)=>{network++;assert.equal(url,'https://business.etisalna.com/developer/api/v1/messages');assert.equal(options.headers.api_account_id,'12');assert.equal(options.redirect,'error');return {status:201,json:async()=>({message_id:456})};};
 assert.equal((await send({cart_id:id,confirm_test:true},{database,request,environment})).status,'accepted');assert.equal(updates[0].provider_message_id,'456');
 for(const blocked of ['optout','already_attempted','phone_mismatch'])assert.equal((await send({cart_id:id,confirm_test:true},{database:async()=>({blocked}),request,environment})).sent,false);
 assert.equal(network,1);
 await assert.rejects(send({cart_id:id},{database,request,environment}),{statusCode:400});
 await assert.rejects(send({cart_id:id,confirm_test:true},{database,request,environment:{}}),{statusCode:503});
 assert.equal(network,1);
 const unknown=await send({cart_id:id,confirm_test:true},{database,request:async()=>{throw new Error('Timeout with secret');},environment});assert.equal(unknown.status,'unknown');assert.equal(unknown.delivery_confirmed,false);
 const mismatch=await send({cart_id:id,confirm_test:true},{database:async(path,opts)=>path.startsWith('rpc/')?{...record,phone:'966500000002'}:updates.push(JSON.parse(opts.body)),request,environment});assert.equal(mismatch.status,'unknown');assert.equal(network,1);
});
test('WhatsApp test SQL blocks optouts, purchases, stale carts, wrong phones and duplicate attempts privately',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
  const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json','utf8'));
  for(const table of schema.reverse())await db.exec(`create table ${table.table_name}(${table.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(table.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
  await db.exec(fs.readFileSync(__dirname+'/../crm-cart-followup.sql','utf8'));
  const sql=fs.readFileSync(__dirname+'/../crm-whatsapp-test-send.sql','utf8');await db.exec(sql);await db.exec(sql);
  const cart=async(external,age='1 hour',number=phone,url='https://mtjr.at/test')=>(await db.query("insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,status,phone,checkout_url) values(1829345766,$1,now()-$2::interval,'active',$3,$4) returning id",[external,age,'+'+number,url])).rows[0].id;
  const call=async(id)=>(await db.query('select crm_claim_whatsapp_test(1829345766,$1,$2) result',[id,phone])).rows[0].result;
  const fresh=await cart('fresh');assert.equal((await call(fresh)).phone,phone);assert.equal((await call(fresh)).blocked,'already_attempted');
  assert.equal((await call(await cart('other','1 hour','966500000002'))).blocked,'phone_mismatch');
  assert.equal((await call(await cart('old','25 hours'))).blocked,'cart_not_recent');
  assert.equal((await call(await cart('badurl','1 hour',phone,'https://evil.test/cart'))).blocked,'unsupported_url');
  const purchased=await cart('purchased');await db.query("update abandoned_carts set status='recovered' where id=$1",[purchased]);assert.equal((await call(purchased)).blocked,'purchased_or_inactive');
  const cust=(await db.query("insert into customers(merchant_id,external_customer_id,name) values(1829345766,'customer','Test') returning id")).rows[0].id;
  const ordered=await cart('ordered');await db.query('update abandoned_carts set customer_id=$1 where id=$2',[cust,ordered]);await db.query("insert into orders(merchant_id,external_order_id,customer_id,ordered_at,status_slug) values(1829345766,'order',$1,now(),'in_progress')",[cust]);assert.equal((await call(ordered)).blocked,'purchased_or_inactive');
  await db.query('insert into crm_whatsapp_optouts(merchant_id,phone) values(1829345766,$1)',[phone]);assert.equal((await call(await cart('opted'))).blocked,'optout');
  assert.equal((await db.query('select count(*)::int n from crm_whatsapp_test_sends')).rows[0].n,1);
  assert.equal((await db.query("select has_table_privilege('authenticated','crm_whatsapp_test_sends','SELECT') allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('anon','crm_claim_whatsapp_test(bigint,uuid,text)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
