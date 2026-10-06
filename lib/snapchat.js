const crypto = require('node:crypto');
const { sb, MERCHANT_ID, fail, equalSecret } = require('./crm');
const CALLBACK = 'https://link-video-shop.vercel.app/api/snapchat-callback';
const COOKIE = '__Host-link_snap_state';
const SCOPE = 'snapchat-marketing-api';
const TOKEN_URL = 'https://accounts.snapchat.com/login/oauth2/access_token';
function missingConfig() {
  return ['SNAPCHAT_CLIENT_ID','SNAPCHAT_CLIENT_SECRET','SNAPCHAT_REDIRECT_URI','CRM_ENCRYPTION_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].filter(k => !process.env[k]);
}
function config() {
  if (missingConfig().length) throw fail(503, 'إعدادات ربط سناب غير مكتملة');
  if (process.env.SNAPCHAT_REDIRECT_URI !== CALLBACK || !/^[a-f0-9]{64}$/i.test(process.env.CRM_ENCRYPTION_KEY)) throw fail(503, 'تحقق من رابط الرجوع ومفتاح التشفير');
  return { client_id: process.env.SNAPCHAT_CLIENT_ID, client_secret: process.env.SNAPCHAT_CLIENT_SECRET, redirect_uri: CALLBACK };
}
function key() { config(); return Buffer.from(process.env.CRM_ENCRYPTION_KEY, 'hex'); }
function aad() { return Buffer.from(`snapchat:${MERCHANT_ID}`); }
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
  return crypto.createHmac('sha256', key()).update(`snapchat:${MERCHANT_ID}:${config().client_id}:${CALLBACK}:${value}`).digest('hex');
}
function cookieHeader(value, maxAge) { return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`; }
function start(res) {
  const state = crypto.randomBytes(32).toString('hex'), value = `${state}.${Date.now()}`;
  res.setHeader('Set-Cookie',cookieHeader(`${value}.${signature(value)}`,600));
  const url = new URL('https://accounts.snapchat.com/login/oauth2/authorize');
  url.search = new URLSearchParams({ client_id: config().client_id, redirect_uri: CALLBACK, response_type:'code',scope:SCOPE,state }).toString();
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
    body:JSON.stringify({merchant_id:MERCHANT_ID,event_key:crypto.createHash('sha256').update(`snapchat:${state}`).digest('hex'),event_name:'snapchat.oauth.callback',payload:{provider:'snapchat',kind:'oauth_state_consumed'},occurred_at:now,received_at:now,status:'processed',processed_at:now}),
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw fail(400,'استُخدم طلب التفويض؛ ابدأ الربط مجدداً');
}
async function exchange(fields) {
  const res = await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...config(),...fields}),signal:AbortSignal.timeout(12000),redirect:'error'});
  if (!res.ok) throw fail(503,'تعذر الحصول على تفويض سناب');
  const data = await res.json();
  if (typeof data.access_token !== 'string' || !data.access_token || data.access_token.length>16384 || typeof data.refresh_token !== 'string' || !data.refresh_token || data.refresh_token.length>16384 || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in)<=0 || Number(data.expires_in)>31536000 || (data.token_type && data.token_type.toLowerCase()!=='bearer') || (data.scope && !String(data.scope).split(/\s+/).includes(SCOPE))) throw fail(503,'استجابة التفويض غير مكتملة');
  return {access_token:data.access_token,refresh_token:data.refresh_token,scope:SCOPE,client_id:config().client_id,expires_at:new Date(Date.now()+Number(data.expires_in)*1000).toISOString()};
}
async function save(tokens) {
  const now = new Date().toISOString();
  const rows = await sb('crm_connections?on_conflict=merchant_id,provider&select=provider,status', {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({merchant_id:MERCHANT_ID,provider:'snapchat',status:'connected',credentials_encrypted:encrypt(tokens),authorized_at:now,token_expires_at:tokens.expires_at,updated_at:now})});
  if (!Array.isArray(rows) || rows.length !== 1) throw fail(503,'تعذر حفظ التفويض');
}
async function refresh() {
  const rows = await sb(`crm_connections?merchant_id=eq.${MERCHANT_ID}&provider=eq.snapchat&select=status,credentials_encrypted,token_expires_at`);
  const connection = rows?.[0];
  if (connection?.status !== 'connected' || !connection.credentials_encrypted) throw fail(400,'اربط حساب سناب أولاً');
  if (new Date(connection.token_expires_at).getTime()>Date.now()+120000) return;
  const old = decrypt(connection.credentials_encrypted);
  if (old.client_id !== config().client_id) throw fail(400,'تغير التطبيق؛ أعد التفويض');
  const tokens = await exchange({grant_type:'refresh_token',refresh_token:old.refresh_token});
  // Compare-and-swap avoids overwriting a newer authorization or token refresh.
  const updated = await sb(`crm_connections?merchant_id=eq.${MERCHANT_ID}&provider=eq.snapchat&credentials_encrypted=eq.${encodeURIComponent(connection.credentials_encrypted)}&select=provider`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({credentials_encrypted:encrypt(tokens),token_expires_at:tokens.expires_at,updated_at:new Date().toISOString()})});
  if (!updated?.length) throw fail(503,'تغير التفويض أثناء التجديد؛ أعد المحاولة');
}
module.exports = { CALLBACK,config,missingConfig,start,validateState,claimState,exchange,save,refresh,encrypt,decrypt,cookieHeader };
