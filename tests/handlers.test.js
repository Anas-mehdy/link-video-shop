const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='server-secret';
process.env.VIDEO_SHOP_ADMIN_TOKEN='admin-secret';
process.env.SALLA_WEBHOOK_SECRET='webhook-secret';
process.env.CRM_WORKER_TOKEN='worker-secret';
process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);
const webhook=require('../api/salla-webhook');
const admin=require('../api/crm-admin');
const worker=require('../api/crm-worker');
const { normalizeEvent, redact } = require('../lib/crm');
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};}
const event={merchant:1829345766,event:'order.created',created_at:'2026-10-06T10:00:00Z',data:{id:123}};
async function call(handler, method, token, body, query={}){const res=response();await handler({method,headers:{authorization:token},body,query},res);return res;}
test('webhook rejects unauthenticated requests before accessing DB',async()=>{
  global.fetch=()=>{throw new Error('must not call database');};
  assert.equal((await call(webhook,'POST','wrong',event)).statusCode,401);
  assert.equal((await call(webhook,'POST','webhook-secret',{...event,merchant:99})).statusCode,403);
  assert.equal((await call(webhook,'POST','webhook-secret',{...event,created_at:'invalid'})).statusCode,400);
  assert.equal((await call(webhook,'POST','webhook-secret','{')).statusCode,400);
  assert.equal((await call(webhook,'GET','webhook-secret',event)).statusCode,405);
});
test('canonical event keys survive JSON property reordering',()=>{
  const a=normalizeEvent(event),b=normalizeEvent({data:{id:123},created_at:event.created_at,event:event.event,merchant:event.merchant});
  assert.equal(a.p_event_key,b.p_event_key);
  assert.notEqual(a.p_event_key,normalizeEvent({...event,created_at:'2026-10-07T10:00:00Z'}).p_event_key);
  assert.equal(normalizeEvent({...event,created_at:'2026-10-06 13:00:00'}).p_occurred_at,event.created_at.replace('Z','.000Z'));
});
test('authorization tokens are encrypted, redacted recursively and never returned',async()=>{
  const payload={...event,event:'app.store.authorize',data:{access_token:'private-access',refresh_token:'private-refresh',expires:1792000000,scope:'orders.read',nested:{secret:'private',safe:'value'}}};
  const normalized=normalizeEvent(payload);
  assert.ok(!JSON.stringify(normalized.p_payload).includes('private'));
  const [version,iv,tag,data]=normalized.p_credentials.split('.');assert.equal(version,'v1');
  const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(process.env.CRM_ENCRYPTION_KEY,'hex'),Buffer.from(iv,'base64'));
  decipher.setAAD(Buffer.from('salla:1829345766'));decipher.setAuthTag(Buffer.from(tag,'base64'));
  const decoded=JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]));assert.equal(decoded.access_token,'private-access');
  assert.equal(normalized.p_expires_at,new Date(1792000000*1000).toISOString());
  global.fetch=async(url,options)=>{assert.ok(url.endsWith('/rpc/crm_ingest_event'));assert.ok(!JSON.parse(options.body).p_payload.data.access_token);return new Response(JSON.stringify({event_id:'id',duplicate:false}),{status:200});};
  const res=await call(webhook,'POST','webhook-secret',payload);assert.equal(res.statusCode,200);assert.deepEqual(res.body,{ok:true,event_id:'id',duplicate:false});
  process.env.CRM_ENCRYPTION_KEY='';assert.equal((await call(webhook,'POST','webhook-secret',payload)).statusCode,503);
});
test('storage failures do not acknowledge events or leak Supabase errors',async()=>{
  global.fetch=async()=>new Response(JSON.stringify({message:'private-access'}),{status:500});
  const res=await call(webhook,'POST','webhook-secret',event);assert.equal(res.statusCode,503);assert.ok(!JSON.stringify(res.body).includes('private-access'));
});
test('worker and admin credentials are isolated',async()=>{
  global.fetch=async()=>new Response('2',{status:200});
  assert.equal((await call(worker,'POST','Bearer admin-secret')).statusCode,401);
  assert.equal((await call(admin,'GET','Bearer worker-secret')).statusCode,401);
  const res=await call(worker,'POST','Bearer worker-secret');assert.equal(res.statusCode,200);assert.equal(res.body.mode,'dry_run');assert.equal(res.body.processed,2);
});
test('overview uses exact HEAD counts and excludes connection secrets',async()=>{
  global.fetch=async(url,opts)=>{
    if(opts.method==='HEAD'){assert.ok(url.includes('merchant_id=eq.1829345766'));return new Response(null,{status:200,headers:{'content-range':'*/464'}});}
    if(url.includes('/crm_connections?')){assert.ok(!url.includes('credentials'));return new Response('[]',{status:200});}
    if(url.includes('/crm_event_inbox?'))return new Response('{}',{status:503});
    return new Response('[]',{status:200});
  };
  const res=await call(admin,'GET','Bearer admin-secret');assert.equal(res.statusCode,200);assert.equal(res.body.data.products,464);assert.equal(res.body.data.events,null);assert.deepEqual(res.body.unavailable,['events']);assert.equal(res.headers['Cache-Control'],'no-store');
});
test('rule updates are scoped, validated and cannot switch to live mode',async()=>{
  let captured;
  global.fetch=async(url,opts)=>{captured={url,body:JSON.parse(opts.body)};return new Response('[{"id":"ok"}]',{status:200});};
  const body={id:'11111111-1111-4111-8111-111111111111',enabled:true,delay_minutes:60,mode:'live',merchant_id:99};
  assert.equal((await call(admin,'PATCH','Bearer admin-secret',body,{resource:'rules'})).statusCode,200);
  assert.ok(captured.url.includes('merchant_id=eq.1829345766'));assert.deepEqual(Object.keys(captured.body).sort(),['delay_minutes','enabled','updated_at']);
  assert.equal((await call(admin,'PATCH','Bearer admin-secret',{...body,delay_minutes:-1},{resource:'rules'})).statusCode,400);
});
test('redaction strips secrets nested inside arrays',()=>assert.deepEqual(redact({list:[{refresh_token:'secret',id:1}]}),{list:[{id:1}]}));
test('record lists are admin-only, merchant-scoped, paginated and exclude raw payloads',async()=>{
  let calls=0;
  global.fetch=async(url,opts)=>{
    calls++;assert.notEqual(opts.method,'POST');
    const query=new URL(url).searchParams;
    assert.equal(query.get('merchant_id'),'eq.1829345766');
    assert.equal(query.get('offset'),'25');assert.equal(query.get('limit'),'26');
    assert.ok(!query.get('select').includes('source_payload'));assert.ok(!query.get('select').includes('*'));
    assert.ok(query.get('order').endsWith('id.desc'));
    assert.ok(query.get('or').includes('ilike."%عميل%"'));
    return new Response(JSON.stringify(Array.from({length:26},(_,i)=>({id:String(i)}))),{status:200});
  };
  assert.equal((await call(admin,'GET','Bearer wrong',null,{resource:'customers'})).statusCode,401);assert.equal(calls,0);
  for(const resource of ['orders','customers','carts']) {
    const res=await call(admin,'GET','Bearer admin-secret',null,{resource,page:'2',search:'عميل',merchant_id:'99'});
    assert.equal(res.statusCode,200);assert.equal(res.body.records.length,25);assert.equal(res.body.has_more,true);assert.equal(res.body.page,2);
  }
});
test('record search rejects filter injection before querying and quotes email searches',async()=>{
  let calls=0;
  global.fetch=async(url)=>{calls++;const query=new URL(url).searchParams;assert.ok(query.get('or').includes('email.ilike."%a.b@example.com%"'));return new Response('[]',{status:200});};
  for(const query of [{page:'0'},{page:'-1'},{page:'1001'},{search:'x),merchant_id.eq.99'},{search:'%'}]) {
    assert.equal((await call(admin,'GET','Bearer admin-secret',null,{resource:'customers',...query})).statusCode,400);
  }
  assert.equal(calls,0);
  const res=await call(admin,'GET','Bearer admin-secret',null,{resource:'customers',search:'a.b@example.com'});
  assert.equal(res.statusCode,200);assert.equal(res.body.has_more,false);assert.deepEqual(res.body.records,[]);
});
test('record queries only select columns present in the supplied merchant schema',()=>{
  const schema=require('../docs/existing-schema.json'),{resources}=require('../lib/crm-records');
  for(const config of Object.values(resources)) {
    const columns=new Set(schema.filter(r=>r.table_name===config.table).map(r=>r.column_name));
    for(const name of [...config.select.split(','),...config.search])assert.ok(columns.has(name),`${config.table}.${name}`);
  }
});
