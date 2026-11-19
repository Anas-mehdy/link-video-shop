const test=require('node:test');
const {strict:assert}=require('node:assert');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {destination,payload,tick,approve}=require('../lib/cashback-delivery');
const orderId='11111111-1111-4111-8111-111111111111',customer='22222222-2222-4222-8222-222222222222',event='33333333-3333-4333-8333-333333333333',phone='966550000001';
const env={ETISALNA_API_ACCESS_TOKEN:'mock',CRM_ENCRYPTION_KEY:'aa'.repeat(32),WHATSAPP_AUTOMATION_ENABLED:'true'};
const order={id:orderId,customer_id:customer,status_slug:'delivered',source_payload:{customer:{mobile:phone},items:[{name:'كفر دريب iPhone 18 Pro Max'}]}};
test('all sends and previews point to the cashback page through the approved dynamic suffix',()=>{
 const target=destination(order,{environment:env,expiresAt:new Date(Date.now()+60000).toISOString()});
 assert.equal(target.kind,'cashback');assert.match(target.suffix,/^#link-complete=[-_A-Za-z0-9]{80,300}$/);
 const preview=destination(order,{environment:env,preview:true});
 assert.notEqual(preview.suffix,target.suffix);
 assert.throws(()=>destination(order,{environment:env,expiresAt:new Date(Date.now()-60000).toISOString()}),/صلاحية/);
 const {whatsapp_template:t}=payload('اسم اختبار',phone,target).message;
 assert.equal(t.name,'link_cashback_delivered_ar');
 assert.deepEqual(t.components.map(x=>[x.type,x.index,x.parameters[0].text??x.parameters[0].payload]),[
  ['body',undefined,'اسم اختبار'],['button','0','unsubscribe'],['button','1',target.suffix]
 ]);
});
test('paused worker makes no send; opted out/expired jobs cancel before claim; uncertain sends are not retried',async()=>{
 for(const mode of ['paused','optout','expired','timeout','accepted']){
  let sends=0,status='queued',claims=0;
  const database=async(path,opt)=>{
   if(path.startsWith('crm_cashback_control?'))return [{enabled:mode!=='paused'}];
   if(path.startsWith('crm_cashback_deliveries?')){
    if(opt?.method==='PATCH'){status=JSON.parse(opt.body).status;return null;}
    return status==='queued'?[{order_id:orderId,phone,expires_at:new Date(Date.now()+(mode==='expired'?-60000:60000)).toISOString()}]:[];
   }
   if(path.startsWith('crm_cashback_candidates?'))return [{order_id:orderId}];
   if(path.startsWith('orders?'))return [order];
   if(path.startsWith('customers?'))return [{name:'اختبار',normalized_phone:phone}];
   if(path.startsWith('crm_whatsapp_consents?'))return [{}];
   if(path.startsWith('crm_whatsapp_optouts?'))return mode==='optout'?[{}]:[];
   if(path.startsWith('crm_pp_deliveries?'))return [];
   if(path==='rpc/crm_cashback_claim'){claims++;status='sending';return event;}
   throw Error(path);
  };
  const request=async()=>{sends++;if(mode==='timeout')throw Error();return {status:201,json:async()=>({message_id:1})};};
  const params={database,request,environment:env,pick:async()=>({kind:'model',suffix:'iphone-18-pro-max/c1913975646'})};
  await tick(params);await tick(params);
  assert.equal(sends,mode==='timeout'||mode==='accepted'?1:0);
  assert.equal(claims,sends);
  assert.equal(status,{paused:'queued',optout:'cancelled',expired:'cancelled',timeout:'unknown',accepted:'accepted'}[mode]);
 }
});
test('admin cannot approve a delivery event without evidence and registered consent',async()=>{
 await assert.rejects(approve({order_id:orderId,confirm_deposit:false},{database:async()=>{throw Error('unexpected read')}}),/معرّف الحركة/);
 await assert.rejects(approve({order_id:orderId,confirm_deposit:true,evidence_ref:'98',expires_at:new Date(Date.now()+60000).toISOString()},{database:async path=>{
  if(path.startsWith('crm_cashback_candidates?'))return [{event_id:event,external_order_id:'123'}];
  if(path.startsWith('orders?'))return [order];
  if(path.startsWith('customers?'))return [{normalized_phone:phone}];
  if(path.startsWith('crm_whatsapp_'))return [];
  throw Error('unexpected write');
 }}),/موافقة واتساب/);
});
test('SQL joins actual order ID, ignores non-delivered events, prevents double claim and overlap',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table orders(id uuid primary key,merchant_id bigint,external_order_id text,order_reference text,customer_id uuid,status_slug text);
   create table customers(id uuid primary key,merchant_id bigint,name text,normalized_phone text,phone text);
   create table crm_event_inbox(id uuid primary key,merchant_id bigint,event_name text,payload jsonb,occurred_at timestamptz,received_at timestamptz,records_synced_at timestamptz);
   create table crm_whatsapp_optouts(merchant_id bigint,phone text);
   create table crm_whatsapp_consents(merchant_id bigint,phone text);
   create table crm_pp_deliveries(merchant_id bigint,order_id uuid,status text);
   insert into customers values('${customer}',1829345766,'اختبار','${phone}',null);
   insert into orders values('${orderId}',1829345766,'123','789','${customer}','delivered');
   insert into crm_event_inbox values('${event}',1829345766,'order.status.updated','{"data":{"id":998,"order":{"id":123,"status":{"slug":"delivered"}}}}',now(),now(),now());
   insert into crm_event_inbox values(gen_random_uuid(),1829345766,'order.status.updated','{"data":{"id":999,"order":{"id":123,"status":{"slug":"shipped"}}}}',now(),now(),now());
   insert into crm_event_inbox values(gen_random_uuid(),1829345766,'order.status.updated','{"data":{"order_id":123,"status":{"slug":"delivered"}}}',now()-interval '8 days',now(),now());`);
  const sql=fs.readFileSync(__dirname+'/../crm-cashback-delivery.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('select event_id,order_reference from crm_cashback_candidates')).rows,[{event_id:event,order_reference:'789'}]);
  await db.exec(`insert into crm_cashback_deliveries(merchant_id,order_id,external_order_id,event_id,evidence_ref,phone,expires_at) values(1829345766,'${orderId}','123','${event}','901','${phone}',now()+interval '1 hour')`);
  const claim=async()=> (await db.query('select crm_cashback_claim($1,$2,$3) token',[orderId,phone,'model'])).rows[0].token;
  assert.equal(await claim(),null);
  await db.exec('update crm_cashback_control set enabled=true');
  assert.equal(await claim(),null);
  await db.exec(`insert into crm_whatsapp_consents values(1829345766,'${phone}');insert into crm_whatsapp_optouts values(1829345766,'${phone}')`);
  assert.equal(await claim(),null);
  await db.exec('delete from crm_whatsapp_optouts');
  assert.match(await claim(),/^[a-f0-9-]{36}$/);assert.equal(await claim(),null);
  await assert.rejects(db.query("insert into crm_pp_deliveries values(1829345766,$1,'sending')",[orderId]),e=>e.code==='P0CBK');
  assert.equal((await db.query("select has_table_privilege('authenticated','crm_cashback_candidates','SELECT') val")).rows[0].val,false);
 }finally{await db.close();}
});
test('one test send to the server allowlist uses the cashback template and a preview link without enabling live delivery',async()=>{
 const {sendTest}=require('../lib/cashback-delivery');
 const testId='44444444-4444-4444-8444-444444444444',body={order_id:orderId,request_id:testId,test_phone:'+'+phone,test_name:'اختبار',confirm_test:true};
 const environment={...env,WHATSAPP_TEST_PHONE:phone,WHATSAPP_AUTOMATION_ENABLED:'false'};
 let claimed=false,sends=0;
 const database=async(path,options)=>{
  if(path.startsWith('crm_cashback_candidates?'))return [{external_order_id:'789'}];
  if(path==='crm_postpurchase_test_sends'){
   if(claimed)throw Object.assign(new Error('duplicate'),{statusCode:409});
   claimed=true;assert.equal(JSON.parse(options.body).offer_product_id,'cashback');return null;
  }
  if(path.startsWith('crm_postpurchase_test_sends?')){assert.equal(JSON.parse(options.body).status,'accepted');return null;}
  assert.fail(path);
 };
 const request=async(url,options)=>{
  sends++;assert.ok(claimed);
  const msg=JSON.parse(options.body);assert.equal(msg.contact.phone_number,'+'+phone);
  assert.equal(msg.message.whatsapp_template.name,'link_cashback_delivered_ar');
  assert.match(msg.message.whatsapp_template.components[2].parameters[0].text,/^#link-complete=[a-zA-Z0-9_-]+$/);
  return {status:201,json:async()=>({message_id:42})};
 };
 await assert.rejects(sendTest({...body,test_phone:'+966550000000'},{database,environment,request}),/لا يطابق/);
 assert.equal((await sendTest(body,{database,environment,request})).status,'accepted');
 assert.equal((await sendTest(body,{database,environment,request})).status,'duplicate');
 assert.equal(sends,1);
});
