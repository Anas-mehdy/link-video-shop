const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='db-private';
process.env.VIDEO_SHOP_ADMIN_TOKEN='admin-private';
process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);
process.env.SNAPCHAT_CLIENT_ID='client-id';
process.env.SNAPCHAT_CLIENT_SECRET='client-private';
process.env.SNAPCHAT_REDIRECT_URI='https://link-video-shop.vercel.app/api/snapchat-callback';
const snap=require('../lib/snapchat');
const connect=require('../api/snapchat-connect');
const callback=require('../api/snapchat-callback');
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=value;}};}
function request(method='POST',query={}){return {method,query,headers:{authorization:'Bearer admin-private',origin:'https://link-video-shop.vercel.app'}};}
function issued(){const res=response(),url=new URL(snap.start(res));return {state:url.searchParams.get('state'),cookie:res.headers['Set-Cookie'].split(';')[0],url};}
function cb(auth,extra={}){return {method:'GET',query:{state:auth.state,code:'code-private',...extra},headers:{cookie:auth.cookie}};}
function json(data,status=200){return new Response(JSON.stringify(data),{status});}
const tokens={access_token:'access-private',refresh_token:'refresh-private',expires_in:3600,token_type:'Bearer'};
test('connect requires admin, validates production origin and reports missing configuration safely',async()=>{
  global.fetch=()=>{throw Error('No IO allowed');};
  let r=response();await connect({...request(),headers:{authorization:'wrong'}},r);assert.equal(r.statusCode,401);
  r=response();await connect({...request(),headers:{...request().headers,origin:'https://evil.test'}},r);assert.equal(r.statusCode,403);
  delete process.env.CRM_ENCRYPTION_KEY;
  r=response();await connect(request('GET'),r);const data=JSON.parse(r.body);assert.equal(data.ready,false);assert.deepEqual(data.missing,['CRM_ENCRYPTION_KEY']);assert.ok(!r.body.includes('client-private'));
});
test('start produces scoped URL and a secure browser-bound cookie',async()=>{
  global.fetch=async()=>json([{provider:'snapchat'}]);
  const r=response();await connect(request(),r);const data=JSON.parse(r.body),url=new URL(data.url);
  assert.equal(url.origin,'https://accounts.snapchat.com');assert.equal(url.searchParams.get('redirect_uri'),snap.CALLBACK);assert.equal(url.searchParams.get('scope'),'snapchat-marketing-api');
  assert.match(r.headers['Set-Cookie'],/Secure; HttpOnly; SameSite=Lax; Max-Age=600/);assert.equal(r.headers['Cache-Control'],'no-store');assert.ok(!r.body.includes('client-private'));
});
test('credentials are authenticated, encrypted and merchant/provider-bound',()=>{
  const value=snap.encrypt({access_token:'access-private'});assert.ok(!value.includes('access-private'));assert.equal(snap.decrypt(value).access_token,'access-private');
  const parts=value.split('.');parts[2]=Buffer.alloc(16).toString('base64');assert.throws(()=>snap.decrypt(parts.join('.')));
});
test('missing, mismatched, expired or tampered state never touches external services',async()=>{
  global.fetch=()=>{throw Error('No IO allowed');};
  const a=issued(),tampered={...a,cookie:a.cookie.slice(0,-1)+(a.cookie.endsWith('0')?'1':'0')};
  assert.throws(()=>snap.validateState(cb(tampered)));
  const expired=issued();const originalNow=Date.now;Date.now=()=>originalNow()+601000;
  try{assert.throws(()=>snap.validateState(cb(expired)));}finally{Date.now=originalNow;}
  for(const req of [{method:'GET',query:{},headers:{}},cb(a,{state:'f'.repeat(64)}),{...cb(a),headers:{}}]){const r=response();await callback(req,r);assert.equal(r.headers.Location,'/dashboard?connection=snapchat&result=failed#integrations');assert.ok(!r.headers.Location.includes('code-private'));}
});
test('callback consumes state before token exchange and stores encrypted credentials only',async()=>{
  const a=issued(),calls=[];let saved;
  global.fetch=async(url,opts)=>{calls.push(String(url));
    if(String(url).includes('crm_event_inbox')){const body=JSON.parse(opts.body);assert.equal(body.status,'processed');assert.ok(!opts.body.includes(a.state));assert.ok(!opts.body.includes('code-private'));return json([{id:'audit'}]);}
    if(String(url).includes('/oauth2/access_token')){const form=new URLSearchParams(opts.body);assert.equal(form.get('code'),'code-private');assert.equal(form.get('client_secret'),'client-private');assert.equal(form.get('redirect_uri'),snap.CALLBACK);assert.equal(opts.redirect,'error');return json(tokens);}
    saved=JSON.parse(opts.body);assert.ok(!opts.body.includes('access-private'));return json([{provider:'snapchat',status:'connected'}]);};
  const r=response();await callback(cb(a),r);assert.equal(calls.length,3);assert.equal(saved.provider,'snapchat');assert.equal(saved.merchant_id,1829345766);assert.equal(snap.decrypt(saved.credentials_encrypted).refresh_token,'refresh-private');assert.match(r.headers['Set-Cookie'],/Max-Age=0/);assert.equal(r.headers.Location,'/dashboard?connection=snapchat&result=success#integrations');
});
test('replayed state is rejected before exchange; cancelled consent never overwrites credentials',async()=>{
  let calls=0;global.fetch=async()=>{calls++;return json([]);};
  let r=response();await callback(cb(issued()),r);assert.equal(calls,1);assert.match(r.headers.Location,/result=failed/);
  calls=0;global.fetch=async()=>{calls++;return json([{id:'audit'}]);};
  r=response();await callback(cb(issued(),{error:'access_denied'}),r);assert.equal(calls,1);assert.match(r.headers.Location,/result=cancelled/);
});
test('provider or storage failures never report success or disclose raw errors',async()=>{
  for(const failAt of ['token','storage']){
    global.fetch=async(url)=>{if(String(url).includes('crm_event_inbox'))return json([{id:'audit'}]);if(String(url).includes('/oauth2/access_token'))return failAt==='token'?json({error:'client-private'},401):json(tokens);return json({message:'access-private'},500);};
    const r=response();await callback(cb(issued()),r);assert.match(r.headers.Location,/result=failed/);assert.ok(!JSON.stringify(r).includes('private'));
  }
});
test('refresh uses stored refresh token and conditional encrypted update',async()=>{
  const encrypted=snap.encrypt({...tokens,client_id:'client-id'});let calls=0;
  global.fetch=async(url,opts)=>{calls++;if(opts.method==='POST'){assert.equal(new URLSearchParams(opts.body).get('grant_type'),'refresh_token');assert.equal(new URLSearchParams(opts.body).get('refresh_token'),'refresh-private');return json({...tokens,access_token:'new-private'});}
    if(opts.method==='PATCH'){assert.ok(String(url).includes('credentials_encrypted=eq.'));const body=JSON.parse(opts.body);assert.equal(snap.decrypt(body.credentials_encrypted).access_token,'new-private');assert.ok(!opts.body.includes('new-private'));return json([{provider:'snapchat'}]);}
    return json([{status:'connected',credentials_encrypted:encrypted,token_expires_at:'2026-01-01T00:00:00Z'}]);};
  const r=response();await connect(request('POST',{action:'refresh'}),r);assert.equal(r.statusCode,200);assert.equal(calls,3);assert.deepEqual(JSON.parse(r.body),{ok:true});
});
