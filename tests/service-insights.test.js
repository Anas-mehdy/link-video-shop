const {test}=require('node:test'),assert=require('node:assert/strict');
const {aggregate,outcomes,periodFor,load}=require('../lib/service-insights');
const {dataset,stamp}=require('./fixtures/service-insights');
const taxonomy=require('../lib/service-taxonomy');
const now=new Date('2026-11-14T20:00:00Z'),period=periodFor({},now);
const build=overrides=>aggregate({period,...dataset(),...overrides},now);
test('counts distinct conversations, uses one latest complete snapshot and never infers legacy categories',()=>{
 const data=dataset();data.analyses.push({...data.analyses[0],created_at:stamp(17),fingerprint:'c'.repeat(64)});
 data.analyses.push({...data.analyses[0],state:'failed',created_at:stamp(19)});
 const result=build(data);
 assert.deepEqual([result.coverage.total,result.coverage.analyzed,result.coverage.percent,result.coverage.classified,result.coverage.legacy],[18,10,56,8,2]);
 assert.deepEqual(result.improvements.map(x=>[x.code,x.count]),[['fit_unclear',3],['shipping_delayed',2],['incomplete',1]]);
 assert.equal(result.topics.find(x=>x.code==='price').count,1);
 assert.equal(result.barriers.some(x=>x.code==='price_objection'),false);
 assert.equal(result.barriers.some(x=>x.conversation_ids.includes('11')),false);
 assert.equal(result.conversations.find(c=>c.id==='11').saved_analysis.legacy,true);
});
test('newest saved analysis replaces old categories rather than unioning snapshots',()=>{
 const data=dataset(),first=data.analyses[0];
 data.analyses.push({...first,created_at:stamp(19),fingerprint:'d'.repeat(64),result:{summary:'نص قديم غير مصنف',obstacle:'تأخر الشحن'}});
 const result=build(data);assert.equal(result.coverage.analyzed,10);assert.equal(result.coverage.legacy,3);
 assert.equal(result.barriers.find(x=>x.code==='fit_unclear').count,2);
});
test('topic does not imply a barrier; wrong roles, missing references and out-of-period evidence are omitted',()=>{
 const data=dataset();const cls=data.analyses[0].result.classification;
 cls.barriers=[{...cls.barriers[0],actor:'employee'},{...cls.barriers[0],code:'fabricated'},{...cls.barriers[0],at:'2026-10-01T00:00:00Z'}];
 cls.coaching=[{code:'incomplete',actor:'customer',at:stamp(14),message_id:'1-101',excerpt:'سؤال'}];
 const result=build(data);assert.equal(result.barriers.find(x=>x.code==='fit_unclear').count,2);
 assert.equal(result.coaching[0].count,1);assert.ok(result.topics.find(x=>x.code==='fit').conversation_ids.includes('1'));
});
test('deduplicates orders across conversations and categories; keeps phone association separate from tracking',()=>{
 const result=build(),rows=result.outcomes;
 assert.deepEqual(rows.map(r=>[r.code,r.count,r.order_count]),[['tracked',1,1],['phone_after',3,3],['prior_support',1,1],['uncertain',13,0]]);
 const orderIds=rows.flatMap(x=>x.order_ids);assert.equal(orderIds.length,new Set(orderIds).size);
 assert.equal(rows.reduce((sum,x)=>sum+x.count,0),18);
 assert.equal(result.conversations.find(c=>c.id==='13').outcome.code,'uncertain');
 assert.match(result.conversations.find(c=>c.id==='13').outcome.reason,/مرة واحدة/);
});
test('order UTM plus copied code is insufficient without the code in a verified employee message',()=>{
 const data=dataset();data.messages=data.messages.map(m=>m.conversation_id==='1'&&m.actor==='employee'?{...m,body:'تم الرد'}:m);
 const result=build(data);assert.equal(result.outcomes.find(x=>x.code==='tracked').count,0);
 assert.ok(result.outcomes.find(x=>x.code==='phone_after').order_ids.includes('order-1'));
});
test('unverified outgoing links, late copy logs and reused codes cannot prove tracking',()=>{
 for(const mode of ['unverified','late','reuse']){
  const data=dataset(),link=data.messages.find(m=>m.conversation_id==='1'&&m.body?.includes('utm_term'));
  if(mode==='unverified')link.actor='unverified';
  if(mode==='late')data.copied[0].occurred_at=stamp(16);
  if(mode==='reuse'){const other=data.messages.find(m=>m.conversation_id==='13'&&m.actor==='employee');other.body=link.body;other.occurred_at=link.occurred_at;}
  assert.equal(build(data).outcomes.find(x=>x.code==='tracked').count,0,mode);
 }
});
test('a prior order alone is not customer support and cancellations do not inflate purchase outcomes',()=>{
 const data=dataset();data.messages=data.messages.map(m=>m.conversation_id==='7'?{...m,body:'أريد شراء حماية جديدة'}:m);
 const result=build(data);assert.equal(result.outcomes.find(x=>x.code==='prior_support').count,0);
 assert.equal(result.conversations.find(c=>c.id==='8').outcome.code,'uncertain');
});
test('ambiguous customers and store outages fail closed without inventing zero purchases',()=>{
 const data=dataset();data.customers.push({id:'another-1',normalized_phone:data.customers[0].normalized_phone});
 assert.equal(build(data).outcomes.find(x=>x.code==='tracked').count,0);
 const result=build({storeUnavailable:true});assert.equal(result.outcomes.find(x=>x.code==='uncertain').count,18);
 assert.match(result.conversations[0].outcome.reason,/غير متاح/);
});
test('partial data and analysis outages never show a full coverage percentage; empty is not 100%',()=>{
 assert.equal(build({limited:true}).coverage.percent,null);
 assert.equal(build({analysesUnavailable:true,analyses:[]}).coverage.analyzed,null);
 assert.equal(build({messages:[],analyses:[]}).coverage.percent,null);
 assert.deepEqual(build({messages:[],analyses:[]}).improvements,[]);
});
test('Riyadh day boundaries and validation cover invalid, future and excessive ranges',()=>{
 const p=periodFor({from:'2026-11-14',to:'2026-11-14'},now);
 assert.equal(p.start,'2026-11-13T21:00:00.000Z');assert.equal(p.end,now.toISOString());
 for(const query of [{from:'2026-02-30'},{from:'2026-11-15'},{from:'2026-01-01'},{from:'x'},{from:'2026-11-14',to:'2026-11-13'}])assert.throws(()=>periodFor(query,now),{statusCode:400});
 assert.equal(build({period:periodFor({from:'2026-11-13',to:'2026-11-13'},now)}).coverage.total,0);
});
test('manual classification preserves stable message IDs, rejects wrong actors and never remaps free text',()=>{
 const journey={messages:[{message_id:'long-id-1',occurred_at:stamp(14)},{message_id:'long-id-2',occurred_at:stamp(15)}]};
 const rows=[{ref:1,role:'customer',text:'كم سعر الحماية؟'},{ref:2,role:'employee',text:'أهلًا بك'}];
 const result=taxonomy.normalize({topics:[{code:'price',ref:1}],barriers:[],coaching:[{code:'incomplete',ref:1}]},rows,journey);
 assert.equal(result.topics[0].message_id,'long-id-1');assert.deepEqual(result.coaching,[]);assert.deepEqual(result.barriers,[]);
 assert.equal(taxonomy.normalize({intent:'سعر',obstacle:'تأخر'},rows,journey),null);
});
test('loader reads only scoped local database records and degrades independently when saved analyses are unavailable',async()=>{
 const data=dataset(),seen=[];
 const db=async(p,options)=>{
  seen.push(p);assert.equal(options,undefined);const url=new URL('https://local.test/'+p);assert.equal(url.searchParams.get('merchant_id'),'eq.1829345766');
  if(p.startsWith('crm_service_monitor_messages?'))return data.messages;
  if(p.startsWith('crm_service_journey_analyses?'))throw Error('table unavailable');
  if(p.startsWith('customers?'))return data.customers;
  if(p.startsWith('orders?'))return data.orders;
  if(p.startsWith('crm_event_inbox?'))return data.copied;
  throw Error('Unexpected request');
 };
 const result=await load({},db,now);assert.equal(result.coverage.analyzed,null);assert.equal(result.analyses_unavailable,true);
 assert.equal(result.outcomes.find(r=>r.code==='tracked').count,1);assert.ok(seen.every(p=>!p.startsWith('rpc/')));
 await assert.rejects(()=>load({from:'invalid'},()=>{throw Error('must validate first');},now),{statusCode:400});
});
test('manual analysis stores classifications with stable evidence and leaves cached legacy results untouched',async()=>{
 const {analyze}=require('../lib/service-journey-analysis');
 const journey={conversation:'1',messages:[{message_id:'message-1',actor:'customer',body:'كم سعر الحماية؟',occurred_at:stamp(14)}],orders:[],match:'unlinked'};
 const value={summary:'سؤال سعر',intent:'السعر',obstacle:null,strength:null,improvement:null,evidence:[1],classification:{topics:[{code:'price',ref:1}],barriers:[],coaching:[]}};
 let stored,requests=0;
 const db=async(p,o)=>{if(p.startsWith('rpc/'))return 'reserved';if(o?.method==='PATCH'){stored=JSON.parse(o.body);return;}return [];};
 const request=async(url,o)=>{requests++;const payload=JSON.parse(o.body);assert.equal(payload.max_output_tokens,700);assert.equal(payload.store,false);assert.ok(payload.text.format.schema.required.includes('classification'));return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})};};
 const result=await analyze(journey,{db,request,key:'test'});assert.equal(requests,1);assert.equal(stored.result.classification.topics[0].message_id,'message-1');assert.deepEqual(result.analysis.classification.barriers,[]);
 const legacy={summary:'تحليل قديم',intent:null,obstacle:null,strength:null,improvement:null,evidence:[1]};
 const cached=await analyze(journey,{db:async()=>[{state:'complete',result:legacy}],request:()=>{throw Error('No reanalysis');}});
 assert.equal(cached.cached,true);assert.deepEqual(cached.analysis,legacy);
});
test('insight route keeps the existing administrator boundary and validates before database reads',async()=>{
 process.env.VIDEO_SHOP_ADMIN_TOKEN='insights-admin-test';process.env.CRM_SERVICE_MONITOR_ENABLED='true';
 const handler=require('../api/crm-admin'),before=global.fetch;let calls=0;global.fetch=()=>{calls++;throw Error('No external requests');};
 const response=()=>({setHeader(){},end(body){this.body=JSON.parse(body);}});
 try{
  const unauthorized=response();await handler({method:'GET',headers:{authorization:'Bearer wrong'},query:{resource:'service-monitor',view:'insights'}},unauthorized);assert.equal(unauthorized.statusCode,401);
  const invalid=response();await handler({method:'GET',headers:{authorization:'Bearer insights-admin-test'},query:{resource:'service-monitor',view:'insights',from:'invalid'}},invalid);assert.equal(invalid.statusCode,400);assert.equal(calls,0);
 }finally{global.fetch=before;delete process.env.CRM_SERVICE_MONITOR_ENABLED;delete process.env.VIDEO_SHOP_ADMIN_TOKEN;}
});
test('descending database pages produce the same pending-state queue as chronological messages',()=>{
 const data=dataset(),asc=build(data),desc=build({...data,messages:data.messages.slice().reverse()});
 assert.deepEqual(desc.conversations.map(c=>[c.id,c.pending_since,c.last_at,c.last_human_at,c.unverified_after]),asc.conversations.map(c=>[c.id,c.pending_since,c.last_at,c.last_human_at,c.unverified_after]));
});
