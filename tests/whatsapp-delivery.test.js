const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {tick,readiness,save,consent}=require('../lib/whatsapp-delivery');
const id='11111111-1111-4111-8111-111111111111',token='22222222-2222-4222-8222-222222222222';
test('Automatic sender fails closed before IO, uses fixed template, and never retries ambiguous sends',async()=>{
 let io=0;const request=async()=>{io++;return {status:201,json:async()=>({message_id:987})};};
 assert.equal(readiness({}).ready,false);
 const environment={WHATSAPP_AUTOMATION_ENABLED:'true',ETISALNA_API_ACCESS_TOKEN:'test-secret',CRM_WORKER_TOKEN:'test-worker'};
 let dbCalls=0;const finish=[];
 const database=async(path,opts)=>{dbCalls++;if(path.endsWith('crm_claim_cart_delivery'))return {id,attempt_token:token,phone:'966500000001',customer_name:'Test',checkout_url:'https://mtjr.at/cart'};finish.push(JSON.parse(opts.body));return true;};
 assert.equal((await tick({database,request,environment:{}})).reason,'server_disabled');assert.equal(dbCalls,0);assert.equal(io,0);
 assert.equal((await tick({database:async()=>({idle:'paused'}),request,environment})).sent,false);assert.equal(io,0);
 const good=await tick({database,request:async(url,options)=>{assert.equal(url,'https://business.etisalna.com/developer/api/v1/messages');assert.equal(options.headers.api_account_id,'12');assert.equal(JSON.parse(options.body).message.whatsapp_template.name,'link_abandoned_cart_ar');return request();},environment});
 assert.equal(good.status,'accepted');assert.equal(good.delivery_confirmed,false);assert.equal(finish[0].p_token,token);
 for(const response of [async()=>{throw new Error('Timeout');},async()=>({status:422}),async()=>({status:201,json:async()=>({message_id:9007199254740992})})])assert.equal((await tick({database,request:response,environment})).status,'unknown');
 assert.equal(io,1);assert.equal(finish.length,4);
 await assert.rejects(tick({database:async(path)=>path.endsWith('crm_claim_cart_delivery')?{id,attempt_token:token,phone:'966500000001',checkout_url:'https://mtjr.at/cart'}:false,request,environment}),{statusCode:503});
 await assert.rejects(save({enabled:true,delay_minutes:1,quiet_hours:false,confirm_live:true}),{statusCode:400});
 await assert.rejects(consent({phone:'+966500000001',source:'Assumed',confirm_consent:false}),{statusCode:400});
});
test('Automatic worker requires worker authentication even when server sending is disabled',async()=>{
 const original=process.env.CRM_WORKER_TOKEN,gate=process.env.WHATSAPP_AUTOMATION_ENABLED;
 const worker=require('../api/crm-worker');const res=()=>({setHeader(){},end(raw){this.body=JSON.parse(raw);}});
 try{
  process.env.CRM_WORKER_TOKEN='worker-test-only';delete process.env.WHATSAPP_AUTOMATION_ENABLED;
  let r=res();await worker({method:'POST',headers:{authorization:'wrong'},query:{action:'whatsapp-delivery'}},r);assert.equal(r.statusCode,401);
  r=res();await worker({method:'POST',headers:{authorization:'Bearer worker-test-only'},query:{action:'whatsapp-delivery'}},r);assert.equal(r.statusCode,200);assert.equal(r.body.reason,'server_disabled');
 }finally{if(original===undefined)delete process.env.CRM_WORKER_TOKEN;else process.env.CRM_WORKER_TOKEN=original;if(gate===undefined)delete process.env.WHATSAPP_AUTOMATION_ENABLED;else process.env.WHATSAPP_AUTOMATION_ENABLED=gate;}
});
test('Production queue: recent updates, reset delay, consent, purchases, optouts, one-per-cart/phone, pause and uncertain claims',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
  const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json','utf8'));
  for(const table of schema.reverse())await db.exec(`create table ${table.table_name}(${table.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(table.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
  await db.exec("alter table abandoned_carts add column if not exists crm_source_at timestamptz;create table crm_event_inbox(id uuid primary key,merchant_id bigint,event_name text,records_synced_at timestamptz);create table test_clock(t timestamptz);insert into test_clock values('2026-10-08T12:00:00Z');create function public.delivery_now() returns timestamptz language sql as $$ select t from public.test_clock $$;");
  for(const file of ['crm-cart-followup.sql','crm-whatsapp-test-send.sql'])await db.exec(fs.readFileSync(__dirname+'/../'+file,'utf8').replaceAll('now()','public.delivery_now()'));
  const sql=fs.readFileSync(__dirname+'/../crm-whatsapp-delivery.sql','utf8').replaceAll('now()','public.delivery_now()');await db.exec(sql);await db.exec(sql);
  const claim=async()=>(await db.query('select crm_claim_cart_delivery(1829345766) result')).rows[0].result;
  const reconcile=()=>db.query('select crm_cart_delivery_reconcile(1829345766)');
  const cart=async(key,phone,age='65 minutes',creation='21 days')=>(await db.query("insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,crm_source_at,status,phone,checkout_url) values(1829345766,$1,public.delivery_now()-$2::interval,public.delivery_now()-$3::interval,'active',$4,'https://mtjr.at/test') returning id",[key,creation,age,'+'+phone])).rows[0].id;
  const consent=phone=>db.query("select crm_record_whatsapp_consent($1,'Explicit test consent')",[phone]);
  const reason=async(id)=>(await db.query('select status,reason from crm_cart_deliveries where cart_id=$1',[id])).rows[0];
  assert.equal((await claim()).idle,'paused');
  await assert.rejects(db.query('select crm_configure_cart_delivery(true,60,false,false)'));
  await db.exec("update crm_cart_delivery_settings set enabled=true,started_at=public.delivery_now()-interval '2 hours';");
  const first=await cart('first','966500000001');await consent('966500000001');
  await db.exec("insert into crm_event_inbox values(gen_random_uuid(),1829345766,'order.created',null);");assert.equal((await claim()).idle,'projection_pending');await db.exec('update crm_event_inbox set records_synced_at=public.delivery_now();');
  const a=await claim();assert.ok(a.id);assert.equal(a.phone,'966500000001');
  assert.equal((await db.query("select crm_finish_cart_delivery($1,$2,'accepted','123') ok",[a.id,'33333333-3333-4333-8333-333333333333'])).rows[0].ok,false);
  assert.equal((await db.query("select crm_finish_cart_delivery($1,$2,'accepted','123') ok",[a.id,a.attempt_token])).rows[0].ok,true);
  assert.equal((await claim()).idle,'no_due');assert.equal((await reason(first)).status,'accepted');
  const samePhone=await cart('samephone','966500000001');await reconcile();assert.equal((await reason(samePhone)).reason,'recent_contact');
  const old=await cart('before','966500000002','3 hours');await reconcile();assert.equal(await reason(old),undefined);
  const updated=await cart('reset','966500000003');await consent('966500000003');await reconcile();
  await db.query("update abandoned_carts set crm_source_at=public.delivery_now()-interval '5 minutes' where id=$1",[updated]);assert.equal((await claim()).idle,'no_due');
  const scheduled=(await db.query('select scheduled_for from crm_cart_deliveries where cart_id=$1',[updated])).rows[0].scheduled_for.toISOString();assert.equal(scheduled,'2026-10-08T12:55:00.000Z');
  await reconcile();assert.equal((await db.query('select scheduled_for from crm_cart_deliveries where cart_id=$1',[updated])).rows[0].scheduled_for.toISOString(),scheduled);
  const unconsented=await cart('no-consent','966500000004');await reconcile();assert.equal((await reason(unconsented)).reason,'no_consent');
  const opted=await cart('opted','966500000005');await consent('966500000005');await db.exec("insert into crm_whatsapp_optouts values(1829345766,'966500000005',public.delivery_now());");await reconcile();assert.equal((await reason(opted)).reason,'optout');
  const purchased=await cart('purchased','966500000006');await consent('966500000006');await db.query("update abandoned_carts set status='recovered' where id=$1",[purchased]);await reconcile();assert.equal((await reason(purchased)).reason,'purchased_or_inactive');
  const customer=(await db.query("insert into customers(merchant_id,external_customer_id,name) values(1829345766,'1','Test') returning id")).rows[0].id;
  const ordered=await cart('ordered','966500000007');await consent('966500000007');await db.query('update abandoned_carts set customer_id=$1 where id=$2',[customer,ordered]);
  await db.query("insert into orders(merchant_id,external_order_id,customer_id,ordered_at,status_slug) values(1829345766,'order',$1,public.delivery_now(),'in_progress')",[customer]);await reconcile();assert.equal((await reason(ordered)).reason,'purchased_or_inactive');
  const tested=await cart('tested','966500000008');await consent('966500000008');await db.query("insert into crm_whatsapp_test_sends(merchant_id,cart_id,status) values(1829345766,$1,'accepted')",[tested]);await reconcile();assert.equal((await reason(tested)).reason,'test_attempt');
  await db.exec("update test_clock set t='2026-10-08T13:00:00Z';");const b=await claim();assert.ok(b.id);assert.equal(b.phone,'966500000003');
  await db.exec("update test_clock set t='2026-10-08T13:03:00Z';");await reconcile();assert.equal((await reason(updated)).status,'unknown');assert.equal((await claim()).idle,'no_due');
  await db.exec("update test_clock set t='2026-10-08T19:00:00Z';update crm_cart_delivery_settings set quiet_hours=true;");
  const night=await cart('night','966500000009');await consent('966500000009');assert.equal((await claim()).idle,'quiet_hours');
  await db.exec('update crm_cart_delivery_settings set quiet_hours=false;');assert.equal((await claim()).phone,'966500000009');
  await db.exec('update crm_cart_delivery_settings set enabled=false;');assert.equal((await claim()).idle,'paused');
  await db.exec("update test_clock set t='2026-10-10T12:00:00Z';");await reconcile();assert.equal((await reason(unconsented)).reason,'expired');
  assert.equal((await db.query("select has_table_privilege('anon','crm_cart_deliveries','SELECT') allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','crm_claim_cart_delivery(bigint)','EXECUTE') allowed")).rows[0].allowed,false);
  await assert.rejects(db.query('select crm_claim_cart_delivery(123)'));
 }finally{await db.close();}
});
