const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MERCHANT_ID = Number(process.env.LINK_STORE_MERCHANT_ID || '1829345766');

function assertEnv() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    const err = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    err.statusCode = 500;
    throw err;
  }
}

function headers(extra = {}) {
  assertEnv();
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function sb(path, options = {}) {
  assertEnv();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers || {}),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const err = new Error(`Supabase ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    err.statusCode = res.status;
    throw err;
  }
  return body;
}

function csvIn(values) {
  return values.map(v => encodeURIComponent(String(v))).join(',');
}

async function sbCount(path) {
  assertEnv();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'HEAD', headers: headers({ Prefer: 'count=exact' }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('Supabase count unavailable');
  const count = res.headers.get('content-range')?.split('/')[1];
  if (!count || !/^\d+$/.test(count)) throw new Error('Supabase count unavailable');
  return Number(count);
}

function json(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k,v] of Object.entries(extraHeaders)) res.setHeader(k,v);
  res.end(JSON.stringify(data));
}

function cors(req, res) {
  // The public Video Shop feed is consumed from Salla's theme preview domains
  // as well as the production storefront. The API contains storefront-public
  // data only; admin endpoints still require server-verified authorization.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function requireAdmin(req) { return require('./admin-auth').requireAdmin(req); }

function extractTikTokId(url) {
  const m = String(url || '').match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

module.exports = { sb, sbCount, json, cors, requireAdmin, extractTikTokId, MERCHANT_ID, csvIn };
