const crypto = require('node:crypto');
const { sb, MERCHANT_ID, fail, equalSecret } = require('./crm');
const CALLBACK = 'https://link-video-shop.vercel.app/api/tiktok-callback';
const COOKIE = '__Host-link_tiktok_state';
const TOKEN_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/';
function missingConfig() {
  return ['TIKTOK_APP_ID','TIKTOK_APP_SECRET','CRM_ENCRYPTION_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k]);
}
function config() {
  if (missingConfig().length) throw fail(503, 'إعدادات ربط تيك توك غير مكتملة');
  if (!/^[a-f0-9]{64}$/i.test(process.env.CRM_ENCRYPTION_KEY)) throw fail(503, 'تحقق من رابط الرجوع ومفتاح التشفير');
  if (!/^\d{1,30}$/.test(process.env.TIKTOK_APP_ID)) throw fail(503, 'معرّف تطبيق تيك توك غير صالح');
  return { client_id: process.env.TIKTOK_APP_ID, client_secret: process.env.TIKTOK_APP_SECRET, redirect_uri: CALLBACK };
}
function key() { config(); return Buffer.from(process.env.CRM_ENCRYPTION_KEY, 'hex'); }
function aad() { return Buffer.from(`tiktok:${MERCHANT_ID}`); }
function encrypt(data) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(aad());
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64')].join('.');
}
function decrypt(value) {
  const [version,iv,tag,data,...extra] = String(value || '').split('.');
  if (version !== 'v1' || extra.length || !data) throw fail(503,'تعذر قراءة التفويض المحفوظ');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv,'base64'));
  decipher.setAAD(aad()); decipher.setAuthTag(Buffer.from(tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString());
}
function signature(value) {
  return crypto.createHmac('sha256', key()).update(`tiktok:${MERCHANT_ID}:${config().client_id}:${CALLBACK}:${value}`).digest('hex');
}
function cookieHeader(value, maxAge) { return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`; }
function start(res) {
  const state = crypto.randomBytes(32).toString('hex'), value = `${state}.${Date.now()}`;
  res.setHeader('Set-Cookie',cookieHeader(`${value}.${signature(value)}`,600));
  const url = new URL('https://business-api.tiktok.com/portal/auth');
  url.search = new URLSearchParams({ app_id: config().client_id, redirect_uri: CALLBACK, state }).toString();
  return url.toString();
}
function validateState(req) {
  const state = req.query?.state;
  if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) throw fail(400,'طلب التفويض غير صالح');
  const cookies = String(req.headers.cookie || '').split(';').map(c=>c.trim()).filter(c=>c.startsWith(`${COOKIE}=`));
  if (cookies.length !== 1) throw fail(400,'ابدأ الربط من الداشبورد في المتصفح نفسه');
  const [nonce,time,mac,...extra] = cookies[0].slice(COOKIE.length+1).split('.');
  if (extra.length || !/^[0-9]{13}$/.test(time || '') || !/^[a-f0-9]{64}$/.test(mac || '') || !equalSecret(state,nonce) || !equalSecret(mac,signature(`${nonce}.${time}`))) throw fail(400,'طلب التفويض غير صالح');
  const age = Date.now()-Number(time);
  if (age < -30000 || age > 600000) throw fail(400,'انتهت مهلة التفويض؛ ابدأ الربط مجدداً');
  return state;
}
async function claimState(state) {
  const now = new Date().toISOString();
  // Unique event key makes state single-use across Vercel instances and concurrent callbacks.
  // The audit entry contains only a hash, never the state, code or tokens.
  const rows = await sb('crm_event_inbox?on_conflict=merchant_id,event_key&select=id', {
    method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},
    body:JSON.stringify({merchant_id:MERCHANT_ID,event_key:crypto.createHash('sha256').update(`tiktok:${state}`).digest('hex'),event_name:'tiktok.oauth.callback',payload:{provider:'tiktok',kind:'oauth_state_consumed'},occurred_at:now,received_at:now,status:'processed',processed_at:now}),
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw fail(400,'استُخدم طلب التفويض؛ ابدأ الربط مجدداً');
}

async function provider(url,options={}) {
  const res=await fetch(url,{...options,signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!res.ok)throw fail(503,'تعذر الاتصال بتيك توك');
  const result=require('./salla-sync').losslessJSON(await res.text());
  if(result.code!==0||!result.data)throw fail(503,'تيك توك رفض الطلب؛ تحقق من التفويض وصلاحيات التطبيق');
  return result.data;
}
const validId=value=>typeof value==='string'&&/^\d{1,30}$/.test(value);
async function exchange(auth_code) {
  const c=config();
  const data=await provider(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:c.client_id,secret:c.client_secret,auth_code})});
  if(typeof data.access_token!=='string'||!data.access_token||data.access_token.length>16384||!Array.isArray(data.advertiser_ids)||!data.advertiser_ids.length)throw fail(503,'استجابة تفويض تيك توك غير مكتملة');
  const advertiser_ids=data.advertiser_ids.map(String);
  if(!advertiser_ids.every(validId))throw fail(503,'قائمة حسابات تيك توك غير صالحة');
  let expires_at=null;
  if(data.expires_in!=null){
    const seconds=Number(data.expires_in);
    if(!Number.isFinite(seconds)||seconds<=0||seconds>315360000)throw fail(503,'صلاحية تفويض تيك توك غير صالحة');
    expires_at=new Date(Date.now()+seconds*1000).toISOString();
  }
  return {access_token:data.access_token,advertiser_ids,scope:data.scope??null,client_id:c.client_id,expires_at};
}
async function save(tokens) {
  const now=new Date().toISOString();
  const rows=await sb('crm_connections?on_conflict=merchant_id,provider&select=provider,status',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({merchant_id:MERCHANT_ID,provider:'tiktok',status:'connected',credentials_encrypted:encrypt(tokens),authorized_at:now,token_expires_at:tokens.expires_at,updated_at:now})});
  if(!Array.isArray(rows)||rows.length!==1)throw fail(503,'تعذر حفظ التفويض');
}
async function session() {
  const rows=await sb(`crm_connections?merchant_id=eq.${MERCHANT_ID}&provider=eq.tiktok&select=status,credentials_encrypted,token_expires_at`);
  const c=rows?.[0];
  if(c?.status!=='connected'||!c.credentials_encrypted)throw fail(400,'اربط تيك توك أولاً');
  if(c.token_expires_at&&Date.parse(c.token_expires_at)<=Date.now())throw fail(400,'انتهت صلاحية التفويض؛ أعد ربط تيك توك');
  const tokens=decrypt(c.credentials_encrypted);
  if(tokens.client_id!==config().client_id)throw fail(400,'تغير التطبيق؛ أعد التفويض');
  return {encrypted:c.credentials_encrypted,tokens};
}
async function authorizedAccounts(tokens) {
  const c=config(),query=new URLSearchParams({app_id:c.client_id,secret:c.client_secret});
  const data=await provider('https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?'+query,{headers:{'Access-Token':tokens.access_token}});
  if(!Array.isArray(data.list)||data.list.length>1000)throw fail(503,'قائمة الحسابات غير مكتملة');
  const seen=new Set();
  return data.list.map(a=>{
    const id=String(a.advertiser_id);
    if(!validId(id)||seen.has(id))throw fail(503,'معرّف حساب غير صالح');
    seen.add(id);
    return {id,name:typeof a.advertiser_name==='string'?a.advertiser_name.slice(0,200):id};
  });
}
async function accounts() {
  const s=await session(),list=await authorizedAccounts(s.tokens);
  return {accounts:list,selected:list.find(a=>a.id===s.tokens.selected_account?.id)||null};
}
async function selectAccount(id) {
  if(!validId(id))throw fail(400,'اختر حسابًا إعلانيًا صالحًا');
  const s=await session(),list=await authorizedAccounts(s.tokens),account=list.find(a=>a.id===id);
  if(!account)throw fail(400,'لا يوجد تفويض لهذا الحساب');
  const rows=await sb(`crm_connections?merchant_id=eq.${MERCHANT_ID}&provider=eq.tiktok&credentials_encrypted=eq.${encodeURIComponent(s.encrypted)}&select=provider`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({credentials_encrypted:encrypt({...s.tokens,selected_account:account}),updated_at:new Date().toISOString()})});
  if(!rows?.length)throw fail(503,'تغير التفويض أثناء الحفظ؛ أعد المحاولة');
  return account;
}
async function admin(req,res){
  const {json,bodyObject}=require('./crm'),action=req.query?.action;
  try{
    if(req.method==='GET'){
      if(action==='report')return json(res,200,{ok:true,...await require('./tiktok-reporting').report(req.query.from,req.query.to)});
      if(action==='accounts')return json(res,200,{ok:true,...await accounts()});
      if(action)return json(res,400,{ok:false,error:'Invalid action'});
      let ready=false;try{config();ready=true;}catch{}
      return json(res,200,{ok:true,ready,missing:missingConfig()});
    }
    if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed'});
    config();
    if(req.headers.origin!==new URL(CALLBACK).origin)return json(res,403,{ok:false,error:'ابدأ الربط من الداشبورد المنشور'});
    if(action==='select')return json(res,200,{ok:true,selected:await selectAccount(bodyObject(req).account_id)});
    if(action&&action!=='start')return json(res,400,{ok:false,error:'Invalid action'});
    await sb(`crm_connections?merchant_id=eq.${MERCHANT_ID}&provider=eq.tiktok&select=provider&limit=1`);
    return json(res,200,{ok:true,url:start(res)});
  }catch(e){return json(res,e.statusCode===400?400:503,{ok:false,error:e.statusCode===400?e.message:'تعذر ربط تيك توك؛ تحقق من إعدادات Vercel والتفويض وصلاحيات التطبيق'});}
}
module.exports={CALLBACK,config,missingConfig,start,validateState,claimState,exchange,save,encrypt,decrypt,cookieHeader,session,accounts,selectAccount,admin};
