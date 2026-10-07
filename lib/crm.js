const crypto = require('node:crypto');
const { sb: database, sbCount, json, requireAdmin, MERCHANT_ID } = require('./supabase');
const sb = (path, options = {}) => database(path, { ...options, signal: AbortSignal.timeout(12000) });

function fail(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }
function equalSecret(a, b) {
  const left = Buffer.from(String(a || '')), right = Buffer.from(String(b || ''));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}
function requireWorker(req) {
  if (!process.env.CRM_WORKER_TOKEN) throw fail(503, 'عامل الأتمتة غير مهيأ');
  if (!equalSecret(req.headers.authorization, `Bearer ${process.env.CRM_WORKER_TOKEN}`)) throw fail(401, 'Unauthorized');
}
function verifyWebhook(req) {
  const secret = process.env.SALLA_WEBHOOK_SECRET;
  if (!secret) throw fail(503, 'مستقبل سلة غير مهيأ');
  // Salla Token strategy sends the configured token in Authorization.
  if (!equalSecret(req.headers.authorization, secret)) throw fail(401, 'Unauthorized');
}
function bodyObject(req) {
  let body = req.body;
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    try { body = JSON.parse(body.toString()); } catch { throw fail(400, 'Invalid JSON'); }
  }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw fail(400, 'Invalid JSON object');
  if (Buffer.byteLength(JSON.stringify(body)) > 512 * 1024) throw fail(413, 'Payload too large');
  return body;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !/token|secret|password|authorization|client_id/i.test(k)).map(([k, v]) => [k, redact(v)]));
}
function encryptionKey() {
  const key = process.env.CRM_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(key)) throw fail(503, 'مفتاح تشفير الربط غير مهيأ');
  return Buffer.from(key, 'hex');
}
function encryptCredentials(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`salla:${MERCHANT_ID}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
function decryptCredentials(value) {
  try {
    const [version, iv, tag, encrypted, extra] = String(value).split('.');
    if (version !== 'v1' || extra || !iv || !tag || !encrypted) throw new Error('Invalid ciphertext');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(`salla:${MERCHANT_ID}`));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString());
  } catch { throw fail(503, 'تعذر قراءة تفويض سلة المحفوظ'); }
}
function normalizeEvent(body) {
  if (!Number.isSafeInteger(Number(body.merchant)) || Number(body.merchant) !== MERCHANT_ID) throw fail(403, 'Store not allowed');
  if (typeof body.event !== 'string' || !/^[a-z][a-z0-9_.]{2,99}$/.test(body.event)) throw fail(400, 'Invalid event');
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw fail(400, 'Invalid event data');
  if (typeof body.created_at !== 'string') throw fail(400, 'Invalid event date');
  // Salla's examples use Saudi local datetime when an offset is omitted.
  const timestamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(body.created_at)
    ? body.created_at.replace(' ', 'T') + '+03:00' : body.created_at;
  const occurredAt = new Date(timestamp);
  if (!Number.isFinite(occurredAt.getTime())) throw fail(400, 'Invalid event date');
  let credentials = null, expiresAt = null;
  if (body.event === 'app.store.authorize') {
    const { access_token, refresh_token, expires, scope } = body.data;
    if (typeof access_token !== 'string' || !access_token || typeof refresh_token !== 'string' || !refresh_token) throw fail(400, 'Missing authorization tokens');
    if (!Number.isFinite(Number(expires)) || Number(expires) <= 0 || Number(expires) > 8640000000000) throw fail(400, 'Invalid token expiry');
    // Salla app.store.authorize uses an absolute Unix timestamp, not expires_in.
    expiresAt = new Date(Number(expires) * 1000).toISOString();
    credentials = encryptCredentials({ access_token, refresh_token, scope: scope || '' });
  }
  return {
    p_merchant_id: MERCHANT_ID,
    p_event_key: crypto.createHash('sha256').update(canonical(body)).digest('hex'),
    p_event_name: body.event,
    p_occurred_at: occurredAt.toISOString(),
    p_payload: redact(body),
    p_credentials: credentials,
    p_expires_at: expiresAt,
  };
}
function noCache(res) { res.setHeader('Cache-Control', 'no-store'); }
function errorResponse(res, e) {
  // Do not expose PostgREST details, payloads, tokens or customer records.
  const status = [400, 401, 403, 405, 413, 503].includes(e.statusCode) ? e.statusCode : 503;
  return json(res, status, { ok: false, error: status === 503 ? 'تعذر الوصول للخدمة؛ تحقق من إعدادات الخادم وتشغيل crm-foundation.sql' : e.message });
}
async function countRows(table) {
  return sbCount(`${table}?merchant_id=eq.${MERCHANT_ID}&select=merchant_id&limit=0`);
}
module.exports = { sb, json, requireAdmin, MERCHANT_ID, fail, equalSecret, requireWorker, verifyWebhook, bodyObject, normalizeEvent, redact, noCache, errorResponse, countRows, decryptCredentials };
