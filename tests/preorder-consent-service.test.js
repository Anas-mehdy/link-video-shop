const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const compare=require('../lib/preorder-consent');
function harness(){
 const records=[],orders=[],queries=[];let active=true;
 const batches=[{product_id:'900',variant_id:'',status:'open',revision:1,expected_arrival:'2099-11-03',ship_from:'2099-11-04',ship_by:'2099-11-06'}];
 const sb=async(path,options={})=>{
  queries.push(path);
  if(path.startsWith('crm_preorder_consent_control'))return [{enabled:active}];
  if(path.startsWith('crm_preorder_batches'))return batches;
  if(path.startsWith('orders?'))return orders.filter(o=>String(o.source_payload.checkout_id)===new URLSearchParams(path.split('?')[1]).get('source_payload->>checkout_id')?.slice(3));
  assert.ok(path.startsWith('crm_preorder_consent_records'));
  if(options.method==='POST'){
   const data=JSON.parse(options.body);assert.equal(data.received_at,undefined);assert.equal(data.merchant_id,1829345766);
   const r={...data,id:require('node:crypto').randomUUID(),received_at:new Date(Date.now()+records.length).toISOString()};records.push(r);return [r];
  }
  const q=new URLSearchParams(path.split('?')[1]);
  return records.filter(r=>{
   for(const k of ['checkout_id','id','stage'])if(q.has(k)){const x=q.get(k);if(x.startsWith('eq.')&&String(r[k])!==x.slice(3))return false;if(x.startsWith('in.(')&&!x.slice(4,-1).split(',').includes(String(r[k])))return false;}
   return true;
  }).sort((a,b)=>b.received_at.localeCompare(a.received_at)).slice(0,Number(q.get('limit')||1000));
 };
 const crm={sb,MERCHANT_ID:1829345766,fail:(statusCode,message)=>Object.assign(Error(message),{statusCode}),bodyObject:r=>r.body,json:(_res,status,data)=>({status,data})};
 const context={module:{exports:{}},require:name=>name==='./crm'?crm:name==='./preorder-consent'?compare:require(name),Buffer,Date,Intl,URLSearchParams,process:{env:{CRM_ENCRYPTION_KEY:'ab'.repeat(32)}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../lib/preorder-consent-service.js','utf8'),context);
 const service=context.module.exports;
 const body=()=>({action:'begin',affirmative:true,policy_version:service.VERSION,policy_text:service.TEXT,checkout_id:'3212565107043415786',items:[{product_id:'901',quantity:1,options:[]}],incoming:['900'],schedules:batches.map(b=>({...b}))});
 return {service,records,orders,batches,queries,body,setActive:value=>active=value};
}
test('public service records intent then actual native result, compares against trusted order, and never treats newer unfinished evidence as consent',async()=>{
 const h=harness(),b=h.body();
 const result=await h.service.begin(b);assert.equal(h.records.length,1);assert.equal(h.records[0].stage,'intent');
 const items=[...b.items,{product_id:'900',quantity:2,options:[]}];
 const finish={action:'finish',ticket:result.ticket,checkout_id:b.checkout_id,items};
 await assert.rejects(h.service.finish({...finish,checkout_id:'3212565107043415787'}),/cart_changed/);
 await assert.rejects(h.service.finish({...finish,items:[...items,{product_id:'999',quantity:1,options:[]}]}),/cart_changed/);
 await assert.rejects(h.service.finish({...finish,items:items.slice(1)}),/cart_changed/);
 await assert.rejects(h.service.finish({...finish,ticket:result.ticket+'bad'}),/invalid_ticket/);
 assert.equal(h.records.length,1);
 const done=await h.service.finish(finish);assert.equal(done.recorded,true);assert.equal(h.records.length,2);assert.equal(h.records[1].stage,'finalized');
 await h.service.finish(finish);assert.equal(h.records.length,2,'retry is idempotent');
 const order={external_order_id:'123',ordered_at:new Date(Date.now()+1000).toISOString(),source_payload:{checkout_id:b.checkout_id,items}};
 const evidence=await h.service.evidence([order],h.batches);
 assert.equal(evidence['123'].status,'browser_record_matched');assert.equal(evidence['123'].policy_text,h.service.TEXT);
 const activity=await h.service.activity();assert.equal(activity.enabled,true);assert.equal(activity.records[0].stage,'finalized');assert.equal(activity.records[0].item_count,2);
 assert.equal(activity.records[0].items,undefined);assert.ok(!JSON.stringify(activity).includes(b.checkout_id));
 h.orders.push(order);
 await assert.rejects(h.service.begin(b),/order_already_exists/);
 h.orders.length=0;
 await h.service.begin(b);
 assert.equal((await h.service.evidence([order],h.batches))['123'].reason,'not_finalized');
 assert.ok(h.queries.every(q=>!q.includes('PRIVATE_PHONE')));
});
test('disabled collection and foreign origins never write; forged disclosure, option loss, changed schedules and expired capabilities fail',async()=>{
 const h=harness(),res={setHeader(){}};
 h.setActive(false);
 const req={method:'POST',headers:{origin:'https://linkstore-sa.com'},body:h.body()};
 assert.equal((await h.service.handle(req,res)).status,503);assert.equal(h.records.length,0);
 assert.equal((await h.service.handle({...req,headers:{origin:'https://evil.example'}},res)).status,403);
 h.setActive(true);
 for(const change of [{affirmative:false},{policy_text:'forged'},{policy_version:'old'},{schedules:[{...h.batches[0],revision:9}]},{items:[{product_id:'901',quantity:1}]}])await assert.rejects(h.service.begin({...h.body(),...change}));
 assert.equal(h.records.length,0);
 const result=await h.service.begin(h.body());
 h.batches[0].revision=2;
 await assert.rejects(h.service.finish({ticket:result.ticket,checkout_id:h.body().checkout_id,items:[...h.body().items,{product_id:'900',quantity:1,options:[]}]}),/schedule_changed/);
 assert.throws(()=>h.service.verify(h.service.sign({intent_id:h.records[0].id,incoming:['900'],expires:0})),/expired_ticket/);
 assert.equal(h.records.length,1);
});
test('empty cart mixed bulk uses a signed empty challenge and never invents an item in storage',async()=>{
 const h=harness(),b={...h.body(),items:[],incoming:['900','901']};
 const result=await h.service.begin(b);assert.equal(h.records.length,0);
 const items=[{product_id:'900',quantity:1,options:[]},{product_id:'901',quantity:3,options:[]}];
 await h.service.finish({ticket:result.ticket,checkout_id:b.checkout_id,items});
 assert.equal(h.records.length,1);assert.equal(h.records[0].stage,'finalized');assert.equal(h.records[0].items.length,2);
});
test('finalization compares schedule values after JSONB round-trip, independent of object key order',async()=>{
 const h=harness(),b=h.body(),result=await h.service.begin(b);
 h.records[0].schedules=h.records[0].schedules.map(row=>Object.fromEntries(Object.entries(row).reverse()));
 const finish={ticket:result.ticket,checkout_id:b.checkout_id,items:[...b.items,{product_id:'900',quantity:1,options:[]}]};
 await h.service.finish(finish);
 assert.equal(h.records[1].stage,'finalized');
});
test('a saved consent stays visible while thin order items are enriched; missing evidence never triggers a provider lookup',async()=>{
 const h=harness(),b=h.body(),intent=await h.service.begin(b),items=[...b.items,{product_id:'900',quantity:1,options:[]}];
 await h.service.finish({ticket:intent.ticket,checkout_id:b.checkout_id,items});
 const o={external_order_id:'123',ordered_at:new Date(Date.now()+1000).toISOString(),source_payload:{checkout_id:b.checkout_id,items:items.map(i=>({...i,options:undefined}))}};
 const unresolved=await h.service.evidence([o],h.batches,{resolveItems:async()=>null});assert.equal(unresolved['123'].recorded,true);assert.equal(unresolved['123'].reason,'snapshot_incomplete');
 const resolved=await h.service.evidence([o],h.batches,{resolveItems:async()=>items});assert.equal(resolved['123'].status,'browser_record_matched');
 const unknown={...o,external_order_id:'124',source_payload:{...o.source_payload,checkout_id:'123456'}};
 const missing=await h.service.evidence([unknown],h.batches,{resolveItems:()=>{throw Error('must not fetch');}});assert.equal(missing['124'].reason,'no_record');assert.equal(missing['124'].recorded,undefined);
});
