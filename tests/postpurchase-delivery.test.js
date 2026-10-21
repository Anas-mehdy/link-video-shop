const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {tick,configure}=require('../lib/postpurchase-delivery');
const env={ETISALNA_API_ACCESS_TOKEN:'test',CRM_WORKER_TOKEN:'test',CRM_ENCRYPTION_KEY:'a'.repeat(64),WHATSAPP_AUTOMATION_ENABLED:'true'};
const uuid='11111111-1111-4111-8111-111111111111';
function mock({batchReason='reserved',claimReason='claimed',optout=false}={}){const calls=[];return {calls,database:async(p,o)=>{calls.push(p);if(p==='rpc/crm_pp_delivery_batch')return {reason:batchReason,token:uuid,batch_at:'2026-10-14T08:00:00Z'};if(p.startsWith('orders?'))return [{id:uuid,customer_id:uuid,external_order_id:'123',source_payload:{customer:{mobile:'+905350215375'}}}];if(p.startsWith('customers?'))return [{name:'أنس',normalized_phone:'905350215375'}];if(p==='rpc/crm_pp_delivery_claim')return {reason:claimReason,id:uuid,token:uuid};if(p.startsWith('crm_pp_delivery_control?'))return [{enabled:true}];if(p.startsWith('crm_whatsapp_optouts?'))return optout?[{phone:'905350215375'}]:[];if(p==='rpc/crm_pp_delivery_finish')return true;return [];}};}
const dependencies={environment:env,review:async()=>({rows:[{reason:'review_ready',external_order_id:'123'}]}),pageData:async()=>({model:'iPhone 17 Pro Max',products:[{id:'2'}],live_stock_checked:true}),seal:()=> 'a'.repeat(120),makePayload:(r,p,phone)=>({phone,p})};
test('paused and outside-hour ticks do not review, check Salla or send',async()=>{
 for(const batchReason of ['paused','outside_hours','batch_full']){const m=mock({batchReason});const r=await tick({...dependencies,database:m.database,review:async()=>{throw Error('must not review')},request:async()=>{throw Error('must not call provider')}});assert.equal(r.worked,false);assert.equal(m.calls.length,1);}
});
test('durable claim precedes one send; accepted is not a delivery confirmation',async()=>{
 const m=mock();let sends=0;const r=await tick({...dependencies,database:m.database,request:async(_,o)=>{sends++;assert.ok(m.calls.includes('rpc/crm_pp_delivery_claim'));assert.equal(JSON.parse(o.body).phone,'905350215375');return {status:201,json:async()=>({message_id:999})};}});assert.equal(sends,1);assert.equal(r.status,'accepted');assert.equal(r.delivery_confirmed,false);assert.equal(m.calls.at(-1),'rpc/crm_pp_delivery_release');
});
test('optout after claim cancels without provider IO; timeout never retries',async()=>{
 const m=mock({optout:true});let sends=0;let r=await tick({...dependencies,database:m.database,request:async()=>sends++});assert.equal(r.status,'cancelled');assert.equal(sends,0);
 const n=mock();r=await tick({...dependencies,database:n.database,request:async()=>{sends++;throw Error('timeout')}});assert.equal(r.status,'unknown');assert.equal(sends,1);
});
test('stock refresh is bounded and never sends in the same tick; duplicate claims block sends',async()=>{
 const m=mock();let checks=0,sends=0;const r=await tick({...dependencies,database:m.database,review:async()=>({rows:[{reason:'stock_check_required',products:[{id:'2',stock:'unchecked'}]}]}),checkStock:async ids=>{checks++;assert.deepEqual(ids,['2']);return {salla_requests:1}},request:async()=>sends++});assert.equal(checks,1);assert.equal(sends,0);assert.equal(r.reason,'checking_stock');assert.ok(!m.calls.includes('rpc/crm_pp_delivery_claim'));
 const n=mock({claimReason:'already_attempted'});await tick({...dependencies,database:n.database,request:async()=>sends++});assert.equal(sends,0);
 await assert.rejects(configure({enabled:true},{environment:env,database:n.database}),/أكّد/);
});
test('SQL defaults paused, enforces batch limit, optouts, durable once-per-order and phone cooldown',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role;create function public.pp_test_now() returns timestamptz language sql as $$select '2026-10-14T08:00:00Z'::timestamptz$$;create table crm_postpurchase_settings(merchant_id bigint primary key,delay_days int,cooldown_days int,batch_hours int[],batch_limit int);insert into crm_postpurchase_settings values(1829345766,7,14,array[11],2);create table orders(id uuid primary key,merchant_id bigint,external_order_id text,customer_id uuid,status_slug text,ordered_at timestamptz,crm_source_at timestamptz,source_payload jsonb);create table customers(id uuid primary key,merchant_id bigint,normalized_phone text,phone text);create table crm_whatsapp_optouts(merchant_id bigint,phone text);create table crm_pp_stock_cache(merchant_id bigint,product_id text,state text,available bool,checked_at timestamptz);create table crm_event_inbox(merchant_id bigint,event_name text,received_at timestamptz);");
 const sql=fs.readFileSync(path.join(__dirname,'../crm-postpurchase-delivery.sql'),'utf8').replaceAll('now()','public.pp_test_now()');await db.exec(sql);await db.exec(sql);
 const get=async()=> (await db.query('select crm_pp_delivery_batch() v')).rows[0].v;
 assert.equal((await get()).reason,'paused');await db.exec('update crm_pp_delivery_control set enabled=true');const b=await get();assert.equal(b.reason,'reserved');assert.equal((await get()).reason,'busy');
 await db.query('insert into customers values($1,1829345766,$2,$2)',[uuid,'905350215375']);
 const add=async(id,ext)=>db.query("insert into orders values($1,1829345766,$2,$3,'delivered','2026-10-06T08:00Z','2026-10-06T08:00Z','{\"items\":[{}]}')",[id,ext,uuid]);await add(uuid,'123');
 await db.exec("insert into crm_pp_stock_cache values(1829345766,'2','checked',true,'2026-10-14T07:00Z')");
 const claim=async(order=uuid)=> (await db.query("select crm_pp_delivery_claim($1,'905350215375',array['2'],'iPhone 17 Pro Max',$2,$3,'2026-10-14T07:59:59Z') v",[order,b.batch_at,b.token])).rows[0].v;
 await db.exec("insert into crm_whatsapp_optouts values(1829345766,'905350215375')");assert.equal((await claim()).reason,'optout');await db.exec('delete from crm_whatsapp_optouts');
 const c=await claim();assert.equal(c.reason,'claimed');assert.equal((await claim()).reason,'already_attempted');
 const another='22222222-2222-4222-8222-222222222222';await add(another,'124');assert.equal((await claim(another)).reason,'cooldown');
 assert.equal((await db.query("select crm_pp_delivery_finish($1,$2,'unknown',null,'timeout') v",[c.id,c.token])).rows[0].v,true);
 assert.equal((await db.query("select has_table_privilege('anon','crm_pp_deliveries','SELECT') v")).rows[0].v,false);
 await db.exec('update crm_pp_delivery_batches set attempts=2');await db.query('select crm_pp_delivery_release($1,$2)',[b.batch_at,b.token]);assert.equal((await get()).reason,'batch_full');
 }finally{await db.close();}
});
test('existing worker preserves odd-minute cart ticks and falls back when aftersales is idle',async()=>{
 const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../api/crm-worker.js'),'utf8');
 for(const [minute,worked] of [[1,true],[2,false],[2,true]]){
 let carts=0,aftersales=0;const modules={
 '../lib/crm':{noCache:()=>{},requireWorker:()=>{},json:(_,status,result)=>result,errorResponse:(_,e)=>{throw e}},
 '../lib/whatsapp-delivery':{readiness:()=>({ready:true}),tick:async()=>{carts++;return {sent:false,reason:'cart_tick'}}},
 '../lib/salla-sync':{processEvents:async()=>{}},
 '../lib/postpurchase-delivery':{tick:async()=>{aftersales++;return {worked,mode:'postpurchase'}}},
 '../lib/etisalna-labels':{recoverOne:async()=>({worked:false})}};
 const context={module:{exports:{}},require:name=>modules[name],Date:class extends Date{getUTCMinutes(){return minute}}};vm.runInNewContext(source,context);
 await context.module.exports({method:'POST',query:{action:'whatsapp-delivery'}},{});
 assert.equal(aftersales,minute===2?1:0);assert.equal(carts,minute===2&&worked?0:1);
 }
});
test('provider rejection keeps HTTP status without persisting private response content',async()=>{
 const m=mock();let finish;
 const database=async(p,o)=>{if(p==='rpc/crm_pp_delivery_finish')finish=JSON.parse(o.body);return m.database(p,o)};
 const result=await tick({...dependencies,database,request:async()=>({status:422,json:async()=>({error:'private customer response'})})});
 assert.equal(result.status,'rejected');assert.equal(finish.p_reason,'provider_rejected_http_422');assert.ok(!JSON.stringify(finish).includes('private'));
});
test('wrong snapshot recipient is blocked before page, claim, stock or send',async()=>{
 const m=mock();let sends=0;const database=async(p,o)=>{const r=await m.database(p,o);if(p.startsWith('orders?'))r[0].source_payload.customer.mobile='+966555000111';return r};
 const r=await tick({...dependencies,database,pageData:async()=>{throw Error('must not create page')},request:async()=>sends++});assert.equal(r.reason,'order_phone_mismatch');assert.equal(sends,0);assert.ok(!m.calls.includes('rpc/crm_pp_delivery_claim'));
});
