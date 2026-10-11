const {test}=require('node:test');
const assert=require('node:assert/strict');
const {afterAccepted,fromEvent}=require('../lib/etisalna-labels');
const environment={ETISALNA_API_ACCESS_TOKEN:'synthetic-token'};
const record={p_message_id:'987',p_phone:null};
function mock(){
 const calls=[];let labels=['staff_label'];
 const request=async(url,options)=>{
  calls.push({url,options});assert.ok(url.startsWith('https://business.etisalna.com/api/v1/accounts/12/'));assert.equal(options.headers.api_access_token,'synthetic-token');
  let payload;
  if(url.includes('/contacts/search'))payload=[{id:2,phone_number:'+966500000002'},{id:3,phone_number:'+966500000001'}];
  else if(url.endsWith('/contacts/3/conversations'))payload=[{id:4,inbox_id:41},{id:5,inbox_id:40},{id:6,inbox_id:40}];
  else if(url.endsWith('/conversations/5/messages'))payload=[{id:123,message_type:1,private:false}];
  else if(url.endsWith('/conversations/6/messages'))payload=[{id:987,message_type:1,private:false,inbox_id:40,account_id:12}];
  else if(url.endsWith('/conversations/6/labels')){if(options.method==='POST')labels=JSON.parse(options.body).labels;payload=labels;}
  else assert.fail('wrong target '+url);
  return {ok:true,json:async()=>({payload})};
 };
 return {calls,request,get labels(){return labels;}};
}
test('Accepted reminder tags only its exact message conversation and merges staff labels',async()=>{
 const m=mock();const result=await afterAccepted({phone:'966500000001',messageId:'987',stage:1,request:m.request,environment});
 assert.equal(result.status,'added');assert.deepEqual(m.labels,['staff_label','cart_reminder_1']);
 assert.ok(!m.calls.some(x=>x.url.includes('/contacts/2/')||x.url.includes('/conversations/4/')));
 assert.equal((await afterAccepted({phone:'966500000001',messageId:'987',stage:1,request:m.request,environment})).status,'already_present');
 assert.equal(m.calls.filter(x=>x.options.method==='POST').length,1);
});
test('Failure or missing message never overwrites labels or retries a WhatsApp message',async()=>{
 const m=mock();assert.equal((await afterAccepted({phone:'966500000001',messageId:'988',stage:2,request:m.request,environment})).status,'pending');assert.ok(m.calls.every(x=>x.options.method!=='POST'));
 assert.equal((await afterAccepted({phone:'966500000001',messageId:'987',stage:2,request:async()=>{throw Error('secret must not leak');},environment})).reason,'label_not_confirmed');
 let posts=0;const bad=async(url,opts)=>{if(opts.method==='POST')posts++;return {ok:false};};
 assert.equal((await fromEvent({conversation:{id:6},private:false,message_type:'incoming'},{p_phone:'966500000001'},{request:bad,environment})).status,'pending');assert.equal(posts,0);
});
test('Authenticated outgoing webhook requires stored accepted send; repeated events are idempotent',async()=>{
 const m=mock();let queries=[];
 const database=async path=>{queries.push(path);return path.startsWith('crm_cart_second_deliveries?')?[{id:'second'}]:[];};
 const body={conversation:{id:6},private:false,message_type:'outgoing'};
 assert.equal((await fromEvent(body,record,{database,request:m.request,environment})).label,'cart_reminder_2');
 for(const path of queries){assert.ok(path.includes('merchant_id=eq.1829345766'));assert.ok(path.includes('status=eq.accepted'));assert.ok(path.includes('provider_message_id=eq.987'));}
 assert.equal((await fromEvent(body,record,{database,request:m.request,environment})).status,'already_present');
 assert.equal((await fromEvent(body,record,{database:async()=>[],request:()=>assert.fail('unrelated event'),environment})).status,'ignored');
});
test('Optout tags only the signed event conversation and leaves reminder labels intact',async()=>{
 const m=mock();await afterAccepted({phone:'966500000001',messageId:'987',stage:1,request:m.request,environment});
 const body={conversation:{id:6},private:false,message_type:'incoming'};
 assert.equal((await fromEvent(body,{p_phone:'966500000001'},{request:m.request,environment,database:()=>assert.fail('no query needed')})).status,'added');
 assert.deepEqual(m.labels,['staff_label','cart_reminder_1','whatsapp_optout']);
 assert.equal((await fromEvent({...body,private:true},{p_phone:'966500000001'},{request:()=>assert.fail()})).status,'ignored');
});
test('Both senders save acceptance before labeling; label failure cannot change send result',async()=>{
 const environment={WHATSAPP_AUTOMATION_ENABLED:'true',CRM_WORKER_TOKEN:'synthetic-worker',ETISALNA_API_ACCESS_TOKEN:'synthetic-token'};
 for(const [module,claim,finish] of [['whatsapp-delivery','crm_claim_cart_delivery','crm_finish_cart_delivery'],['cart-reminder-two','crm_claim_cart_second','crm_finish_cart_second']]){
  let saved=false,sends=0;
  const database=async(path,options)=>{if(path.endsWith(claim))return {id:'11111111-1111-4111-8111-111111111111',attempt_token:'22222222-2222-4222-8222-222222222222',phone:'966500000001',customer_name:'Test',checkout_url:'https://mtjr.at/cart',template_name:'help_ar',discount_amount:0};assert.ok(path.endsWith(finish));assert.equal(JSON.parse(options.body).p_status,'accepted');saved=true;return true;};
  const request=async url=>{if(url.endsWith('/developer/api/v1/messages')){sends++;return {status:201,json:async()=>({message_id:987})};}assert.equal(saved,true);throw Error('labels unavailable');};
  const result=await require('../lib/'+module).tick({database,request,environment});assert.equal(result.status,'accepted');assert.equal(result.sent,true);assert.equal(result.labeling.status,'pending');assert.equal(sends,1);
 }
});
const {recoverOne}=require('../lib/etisalna-labels');
const eventId='11111111-1111-4111-8111-111111111111',cartId='22222222-2222-4222-8222-222222222222';
const recoveryTime=Date.parse('2026-10-11T15:00:00Z');
function recoveryDb({cart=true,send=true,payload={data:{id:'3122162686596967249'}},attempts=0}={}){
 const calls=[];let patch;
 const database=async(path,options)=>{
  calls.push(path);
  if(options?.method==='PATCH'){patch=JSON.parse(options.body);return [];}
  if(path.startsWith('crm_event_inbox?'))return [{id:eventId,occurred_at:'2026-10-11T14:00:00Z',payload:{...payload,_crm_recovery_attempts:attempts}}];
  if(path.startsWith('abandoned_carts?')){assert.ok(path.includes('external_cart_id=eq.3122162686596967249'));assert.ok(path.includes('status=eq.recovered'));return cart?[{id:cartId}]:[];}
  if(path.startsWith('crm_cart_second_deliveries?'))return [];
  if(path.startsWith('crm_cart_deliveries?')){assert.ok(path.includes('cart_id=eq.'+cartId));assert.ok(path.includes('attempted_at=lte.'));assert.ok(path.includes('status=eq.accepted'));return send?[{provider_message_id:'987',attempted_phone:'966500000001'}]:[];}
  assert.fail('unexpected query '+path);
 };
 return {database,calls,get patch(){return patch;}};
}
test('Recovery requires the exact purchased cart and a prior accepted reminder, preserving event data',async()=>{
 const db=recoveryDb(),m=mock();
 const result=await recoverOne({database:db.database,request:m.request,environment,now:recoveryTime});
 assert.equal(result.labeling.status,'added');assert.deepEqual(m.labels,['staff_label','cart_recovered']);
 assert.equal(db.patch.payload._crm_recovery_label,'done');assert.equal(db.patch.payload.data.id,'3122162686596967249');
 const query=new URL('https://test/'+db.calls[0]).searchParams;
 assert.equal(query.get('event_name'),'eq.abandoned.cart.purchased');assert.equal(query.get('records_synced_at'),'not.is.null');assert.equal(query.get('limit'),'1');assert.equal(query.get('occurred_at'),'gte.2026-09-11T15:00:00.000Z');
 assert.ok(query.get('or').includes('pending'));assert.ok(m.calls.every(x=>!x.url.includes('/developer/')));
});
test('No arbitrary order/active cart, uncontacted cart, or rounded identifier can receive recovery label',async()=>{
 for(const options of [{cart:false},{send:false},{payload:{data:{id:9007199254740992}}}]){
  const db=recoveryDb(options);const r=await recoverOne({database:db.database,request:()=>assert.fail('must not call provider'),environment,now:recoveryTime});
  assert.equal(r.labeling.status,'ignored');assert.equal(db.patch.payload._crm_recovery_label,'ignored');
 }
 assert.deepEqual(await recoverOne({database:async()=>[],request:()=>assert.fail('no pending event'),now:recoveryTime}),{worked:false});
});
test('Failed recovery labels are persisted for bounded retry, never re-send WhatsApp',async()=>{
 for(const [attempts,state] of [[0,'pending'],[4,'exhausted']]){
  const db=recoveryDb({attempts});let requests=0;
  const r=await recoverOne({database:db.database,request:async url=>{requests++;assert.ok(!url.includes('/developer/'));throw Error('provider unavailable');},environment,now:recoveryTime});
  assert.equal(r.labeling.status,'pending');assert.equal(requests,1);assert.equal(db.patch.payload._crm_recovery_label,state);assert.equal(db.patch.payload._crm_recovery_attempts,attempts+1);assert.equal(db.patch.payload._crm_recovery_retry_at,'2026-10-11T15:15:00.000Z');
 }
});
test('Minute worker processes recovery locally without sending; empty/failed label job allows reminders',async()=>{
 const labels=require('../lib/etisalna-labels'),delivery=require('../lib/whatsapp-delivery'),sync=require('../lib/salla-sync');
 const original={recover:labels.recoverOne,tick:delivery.tick,process:sync.processEvents};
 const keys=['CRM_WORKER_TOKEN','ETISALNA_API_ACCESS_TOKEN','WHATSAPP_AUTOMATION_ENABLED'],env=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const worker=require('../api/crm-worker');let sent=0,projections=0;
 try {
  process.env.CRM_WORKER_TOKEN='worker-label-test';process.env.ETISALNA_API_ACCESS_TOKEN='synthetic-token';process.env.WHATSAPP_AUTOMATION_ENABLED='true';
  sync.processEvents=async(event,options)=>{projections++;assert.equal(event,undefined);assert.equal(options.localOnly,true);return {processed:0};};
  delivery.tick=async()=>{sent++;return {sent:true,status:'accepted'};};
  const run=async()=>{const res={setHeader(){},end(raw){this.body=JSON.parse(raw);}};await worker({method:'POST',headers:{authorization:'Bearer worker-label-test'},query:{action:'whatsapp-delivery'}},res);assert.equal(res.statusCode,200);return res.body;};
  labels.recoverOne=async()=>({worked:true,labeling:{status:'added',label:'cart_recovered'}});assert.equal((await run()).reason,'recovery_label_processed');assert.equal(sent,0);
  labels.recoverOne=async()=>({worked:false});assert.equal((await run()).sent,true);assert.equal(sent,1);
  labels.recoverOne=async()=>{throw Error('unavailable');};assert.equal((await run()).sent,true);assert.equal(sent,2);assert.equal(projections,3);
 } finally {
  labels.recoverOne=original.recover;delivery.tick=original.tick;sync.processEvents=original.process;
  for(const k of keys)if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];
 }
});
