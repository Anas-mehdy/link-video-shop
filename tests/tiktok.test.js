const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='db-private';
process.env.VIDEO_SHOP_ADMIN_TOKEN='admin-private';
process.env.TIKTOK_APP_ID='7693876032643350548';
process.env.TIKTOK_APP_SECRET='app-private';
process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);
const tt=require('../lib/tiktok'),admin=require('../api/crm-admin'),callback=require('../api/tiktok-callback');
const original=global.fetch;afterEach(()=>{global.fetch=original;process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}});
const request=(method='GET',action)=>({method,query:{resource:'tiktok',...(action?{action}:{})},headers:{authorization:'Bearer admin-private',origin:'https://link-video-shop.vercel.app'}});
function issued(){const r=res(),url=new URL(tt.start(r));return {state:url.searchParams.get('state'),cookie:r.headers['Set-Cookie'].split(';')[0],url};}
const cb=(a,extra={})=>({method:'GET',query:{state:a.state,auth_code:'code-private',...extra},headers:{cookie:a.cookie}});
const tokenData={access_token:'access-private',advertiser_ids:['7244443234628403202'],scope:[4]};
test('TikTok start is admin-only, origin checked, and does not expose config secrets',async()=>{
  global.fetch=()=>{throw Error('No IO');};let r=res();await admin({...request(),headers:{}},r);assert.equal(r.statusCode,401);
  r=res();await admin({...request('POST','start'),headers:{...request().headers,origin:'https://evil.test'}},r);assert.equal(r.statusCode,403);
  r=res();await admin(request(),r);assert.equal(JSON.parse(r.body).ready,true);assert.ok(!r.body.includes('app-private'));
  global.fetch=async()=>json([]);r=res();await admin(request('POST','start'),r);
  const url=new URL(JSON.parse(r.body).url);assert.equal(url.origin,'https://business-api.tiktok.com');assert.equal(url.pathname,'/portal/auth');assert.equal(url.searchParams.get('app_id'),process.env.TIKTOK_APP_ID);assert.equal(url.searchParams.get('redirect_uri'),tt.CALLBACK);assert.equal(url.searchParams.has('secret'),false);assert.match(r.headers['Set-Cookie'],/Secure; HttpOnly; SameSite=Lax/);
});
test('TikTok callback claims state, exchanges auth_code JSON and stores encrypted tokens and exact IDs',async()=>{
  const a=issued();let saved;const calls=[];
  global.fetch=async(url,options)=>{
    calls.push(url);
    if(url.includes('crm_event_inbox')){assert.ok(!options.body.includes(a.state));assert.ok(!options.body.includes('code-private'));return json([{id:'audit'}]);}
    if(url.includes('/oauth2/access_token/')){assert.equal(options.headers['Content-Type'],'application/json');assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),{app_id:process.env.TIKTOK_APP_ID,secret:'app-private',auth_code:'code-private'});return new Response('{"code":0,"data":{"access_token":"access-private","advertiser_ids":[7244443234628403202]}}');}
    saved=JSON.parse(options.body);return json([{provider:'tiktok'}]);
  };
  const r=res();await callback(cb(a),r);assert.equal(calls.length,3);assert.match(r.headers.Location,/result=success/);assert.match(r.headers['Set-Cookie'],/Max-Age=0/);
  assert.equal(saved.provider,'tiktok');assert.equal(saved.token_expires_at,null);assert.ok(!JSON.stringify(saved).includes('access-private'));assert.deepEqual(tt.decrypt(saved.credentials_encrypted).advertiser_ids,['7244443234628403202']);assert.ok(!JSON.stringify(r).includes('private'));
});
test('invalid state has no IO; replay and cancellation never exchange or overwrite credentials',async()=>{
  global.fetch=()=>{throw Error('No IO');};const a=issued();let r=res();await callback(cb(a,{state:'f'.repeat(64)}),r);assert.match(r.headers.Location,/failed/);
  const now=Date.now;Date.now=()=>now()+601000;try{assert.throws(()=>tt.validateState(cb(a)));}finally{Date.now=now;}
  let calls=0;global.fetch=async()=>{calls++;return json([]);};r=res();await callback(cb(a),r);assert.equal(calls,1);assert.match(r.headers.Location,/failed/);
  calls=0;global.fetch=async()=>{calls++;return json([{id:'audit'}]);};r=res();await callback(cb(issued(),{error:'access_denied'}),r);assert.equal(calls,1);assert.match(r.headers.Location,/cancelled/);
});
test('provider or database failure never reports connection success or leaks errors',async()=>{
  for(const where of ['provider','database']){
    global.fetch=async(url)=>url.includes('crm_event_inbox')?json([{id:'audit'}]):url.includes('/oauth2/access_token/')?where==='provider'?json({code:40001,message:'app-private'}):json({code:0,data:tokenData}):json({message:'access-private'},500);
    const r=res();await callback(cb(issued()),r);assert.match(r.headers.Location,/failed/);assert.ok(!JSON.stringify(r).includes('private'));
  }
});
test('account selection checks current authorization and encrypts through conditional merchant update',async()=>{
  const encrypted=tt.encrypt({...tokenData,client_id:process.env.TIKTOK_APP_ID});let patched=0;
  global.fetch=async(url,options)=>{
    if(url.includes('/oauth2/advertiser/get/')){assert.equal(options.headers['Access-Token'],'access-private');return json({code:0,data:{list:[{advertiser_id:'7244443234628403202',advertiser_name:'Link Store'}]}});}
    if(options.method==='PATCH'){patched++;assert.ok(url.includes('merchant_id=eq.1829345766'));assert.ok(url.includes('credentials_encrypted=eq.'));assert.equal(tt.decrypt(JSON.parse(options.body).credentials_encrypted).selected_account.id,'7244443234628403202');return json([{provider:'tiktok'}]);}
    return json([{status:'connected',credentials_encrypted:encrypted}]);
  };
  const list=await tt.accounts();assert.equal(list.accounts[0].name,'Link Store');assert.ok(!JSON.stringify(list).includes('private'));
  await assert.rejects(tt.selectAccount('111'),e=>e.statusCode===400);assert.equal(patched,0);
  assert.equal((await tt.selectAccount('7244443234628403202')).name,'Link Store');assert.equal(patched,1);
});
