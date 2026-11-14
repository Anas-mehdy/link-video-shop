const {test}=require('node:test'),assert=require('node:assert/strict');
const {workingMinutes}=require('../lib/service-shift');
const {prepare,analyze,orderSignals}=require('../lib/service-journey-analysis');
const at=s=>Date.parse('2026-11-'+s+'Z');
test('nighttime is excluded on consecutive days including the weekend',()=>{
 assert.equal(workingMinutes(at('13T19:45:00'),at('14T11:30:00')),45);
 assert.equal(workingMinutes(at('14T20:00:00'),at('15T10:59:00')),0);
 assert.equal(workingMinutes(at('13T19:45:00'),at('15T11:30:00')),585);
});
const journey={conversation:'123',contact:'شخص تجريبي',match:'matched',messages:[{message_id:'1',actor:'customer',body:'أنا شخص تجريبي و جوالي +966 555 123 456، ابغى iPhone 18. https://example.test/path',occurred_at:'2026-11-14T11:33:00Z'}],orders:[{order_reference:'DEMO',ordered_at:'2026-11-14T11:55:00Z'}]};
test('redacts identifying fields and keeps factual order timing outside the model',()=>{
 const {rows}=prepare(journey);
 assert.doesNotMatch(JSON.stringify(rows),/966|example\.test|تجريبي|DEMO/);
 assert.match(rows[0].text,/iPhone 18/);
 assert.equal(orderSignals(journey)[0].minutes,22);
 assert.deepEqual(orderSignals({...journey,match:'ambiguous'}),[]);
});
test('stale snapshot and exhausted budget make no provider requests',async()=>{
 let calls=0;
 const args={db:async p=>p.startsWith('rpc/')?'budget':[],request:async()=>{calls++;}};
 await assert.rejects(()=>analyze(journey,{...args,expected:'stale'}),{statusCode:409});
 await assert.rejects(()=>analyze(journey,args),{statusCode:429});
 assert.equal(calls,0);
});
test('reserves before calling OpenAI and caches structured results without re-spending',async()=>{
 const result={summary:'سأل عن جهازه',intent:null,obstacle:null,strength:null,improvement:null,evidence:[1]};
 let slot, requests=0;
 const db=async (p,o)=>{
  if(p.startsWith('rpc/')){slot={state:'reserved'};return 'reserved';}
  if(o?.method==='PATCH'){slot=JSON.parse(o.body);return;}
  return slot?[slot]:[];
 };
 const request=async(url,o)=>{
  assert.equal(slot.state,'reserved');assert.equal(new URL(url).hostname,'api.openai.com');
  const payload=JSON.parse(o.body);assert.equal(payload.store,false);assert.equal(payload.model,'gpt-6-luna');
  assert.doesNotMatch(payload.input,/DEMO|966/);requests++;
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]})};
 };
 assert.deepEqual(await analyze(journey,{db,request,key:'test'}),{analysis:result,cached:false});
 assert.deepEqual(await analyze(journey,{db,request,key:'test'}),{analysis:result,cached:true});
 assert.equal(requests,1);
});
test('database budget limits the pilot, isolates roles, and refuses duplicate reservations',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs');const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls');
  await db.exec(fs.readFileSync(require.resolve('../crm-service-journey-analysis.sql'),'utf8'));
  const [{read,call}]=(await db.query("select has_table_privilege('authenticated','crm_service_journey_analyses','SELECT') as read, has_function_privilege('anon','crm_reserve_service_analysis(bigint,text,text)','EXECUTE') as call")).rows;
  assert.equal(read,false);assert.equal(call,false);
  await db.exec("set role service_role");
  const reserve=async c=>(await db.query("select public.crm_reserve_service_analysis(1829345766,$1,repeat('a',64)) as result",[c])).rows[0].result;
  assert.equal(await reserve('7'),'reserved');assert.equal(await reserve('7'),'existing');
  await db.exec("reset role; insert into crm_service_journey_analyses(merchant_id,conversation_id,fingerprint) select 1829345766,n::text,repeat('b',64) from generate_series(100,348)n; set role service_role");
  assert.equal(await reserve('8'),'budget');
 }finally{await db.close();}
});
