const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='private-db';process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);process.env.SALLA_WEBHOOK_SECRET='secret';
const sync=require('../lib/salla-sync'),{normalizeEvent}=require('../lib/crm');const original=global.fetch;afterEach(()=>global.fetch=original);
const encrypted=normalizeEvent({merchant:1829345766,event:'app.store.authorize',created_at:'2026-10-07T10:00:00Z',data:{access_token:'private-access',refresh_token:'private-refresh',expires:2000000000}}).p_credentials;
const response=value=>new Response(JSON.stringify(value),{status:200});
test('bulk API uses private stored token, fixed pagination, linked records and safe output',async()=>{
  const writes=[];
  global.fetch=async(url,options)=>{
    if(url.includes('/crm_connections?'))return response([{status:'connected',credentials_encrypted:encrypted,token_expires_at:'2030-01-01T00:00:00Z'}]);
    if(url.startsWith('https://api.salla.dev/')){
      assert.equal(options.headers.Authorization,'Bearer private-access');const query=new URL(url);assert.equal(query.pathname,'/admin/v2/orders');assert.equal(query.searchParams.get('from_date'),sync.windowDates().from);assert.equal(query.searchParams.get('to_date'),sync.windowDates().to);
      return new Response('{"success":true,"data":[{"id":3076122624318093323,"date":"'+new Date().toISOString()+'","total":{"amount":101.75,"currency":"SAR"},"customer":{"id":1,"name":"Test"}}],"pagination":{"next":"https://evil.test/steal"}}',{status:200});
    }
    if(url.includes('/rpc/crm_apply_salla_records')){writes.push(JSON.parse(options.body));return response(1);}
    throw Error('Unexpected request');
  };
  const result=await sync.page({resource:'orders',page:1});assert.equal(result.next_page,2);assert.equal(result.saved,1);
  assert.equal(writes[0].p_resource,'customers');assert.equal(writes[1].p_records[0].external_order_id,'3076122624318093323');
  assert.ok(!JSON.stringify(result).includes('private-access'));assert.ok(!JSON.stringify(writes).includes('private-refresh'));
});
test('expired tokens and invalid resources stop before provider IO',async()=>{
  let calls=0;global.fetch=async url=>{calls++;assert.ok(url.startsWith('https://test.supabase.co/'));return response([{status:'connected',credentials_encrypted:encrypted,token_expires_at:'2020-01-01T00:00:00Z'}]);};
  await assert.rejects(sync.page({resource:'https://evil.test',page:1}),e=>e.statusCode===400);assert.equal(calls,0);
  await assert.rejects(sync.page({resource:'orders',page:1}),e=>e.sallaSafe);assert.equal(calls,1);
});
test('persisted event processing ignores dry-run state and marks the projection only after save',async()=>{
  const calls=[];global.fetch=async(url,options)=>{
    calls.push(url);
    if(url.includes('/crm_event_inbox?')){assert.ok(url.includes('records_synced_at=is.null'));return response([{id:'event',event_name:'abandoned.cart.purchased',occurred_at:'2026-10-07T10:00:00Z',payload:{data:{id:'123',status:'purchased',created_at:new Date().toISOString()}}}]);}
    if(url.includes('/rpc/crm_apply_salla_records')){const body=JSON.parse(options.body);assert.equal(body.p_event_id,'event');assert.equal(body.p_records[0].status,'recovered');return response(1);}
    throw Error('Unexpected request');
  };
  assert.equal((await sync.processEvents()).processed,1);assert.equal(calls.length,2);
});
test('provider failures expose only HTTP status and retry timing, never raw provider payloads',async()=>{
  global.fetch=async url=>url.includes('/crm_connections?')?response([{status:'connected',credentials_encrypted:encrypted,token_expires_at:'2030-01-01T00:00:00Z'}]):new Response('private provider payload',{status:429,headers:{'Retry-After':'600'}});
  await assert.rejects(sync.page({resource:'customers',page:282}),error=>error.provider_status===429&&error.retry_after===600&&error.retryable&&!error.message.includes('private provider payload'));
  global.fetch=async url=>url.includes('/crm_connections?')?response([{status:'connected',credentials_encrypted:encrypted,token_expires_at:'2030-01-01T00:00:00Z'}]):new Response('private',{status:502});
  await assert.rejects(sync.page({resource:'customers',page:282}),error=>error.provider_status===502&&error.message.includes('HTTP 502'));
});
test('recent-only policy never crawls the cart archive and filters customers at Salla',async()=>{
  let calls=0;global.fetch=()=>{calls++;throw Error('unexpected IO');};
  const carts=await sync.page({resource:'carts',page:1});assert.equal(carts.next_page,null);assert.equal(calls,0);
  global.fetch=async(url,options)=>{
    if(url.includes('/crm_connections?'))return response([{status:'connected',credentials_encrypted:encrypted,token_expires_at:'2030-01-01T00:00:00Z'}]);
    if(url.startsWith('https://api.salla.dev/')){const query=new URL(url).searchParams;assert.equal(query.get('date_from'),sync.windowDates().from);assert.equal(query.get('date_to'),sync.windowDates().to);return response({data:[],pagination:{totalPages:1}});}
    return response(0);
  };
  assert.equal((await sync.page({resource:'customers',page:1})).read,0);
});
