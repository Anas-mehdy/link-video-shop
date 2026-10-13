const crypto = require('node:crypto');

const EMPLOYEE = Object.freeze({ id: 'ghofran', name: 'غفران' });
const PLATFORMS = Object.freeze(['instagram', 'facebook', 'tiktok']);
const UTM_MEDIUM = 'customer_service';
const UTM_CAMPAIGN = 'assisted_sales';
const TRACKING_PREFIX = `cs_${EMPLOYEE.id}_`;

function fail(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }
function normalizePlatform(value) {
  const platform = String(value || '').trim().toLowerCase();
  if (!PLATFORMS.includes(platform)) throw fail(400, 'اختر منصة صحيحة');
  return platform;
}
function parseStoreUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); } catch { throw fail(400, 'أدخل رابطًا صحيحًا من متجر لنك'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.protocol !== 'https:' || host !== 'linkstore-sa.com') throw fail(400, 'الرابط يجب أن يكون من linkstore-sa.com');
  return url;
}
function buildTrackedUrl(rawUrl, platformValue, trackingCode = '') {
  const url = parseStoreUrl(rawUrl), platform = normalizePlatform(platformValue);
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(key => url.searchParams.delete(key));
  url.searchParams.set('utm_source', platform);
  url.searchParams.set('utm_medium', UTM_MEDIUM);
  url.searchParams.set('utm_campaign', UTM_CAMPAIGN);
  url.searchParams.set('utm_content', EMPLOYEE.id);
  if (trackingCode) url.searchParams.set('utm_term', `${TRACKING_PREFIX}${trackingCode}`);
  return url.toString();
}
function makeTrackingCode() { return crypto.randomBytes(6).toString('base64url').toLowerCase(); }
function trackingCodeFromTerm(value) {
  const term = String(value || '');
  return term.startsWith(TRACKING_PREFIX) ? term.slice(TRACKING_PREFIX.length) : '';
}
function sourceDetails(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 7) return null;
  if (!Array.isArray(value) && value.source_details && typeof value.source_details === 'object') return value.source_details;
  if (!Array.isArray(value) && ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].some(k => Object.hasOwn(value, k))) return value;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = sourceDetails(child, depth + 1); if (found) return found;
  }
  return null;
}
function attributionFromPayload(payload) {
  const details = sourceDetails(payload) || {};
  const content = String(details.utm_content || '').trim().toLowerCase();
  const medium = String(details.utm_medium || '').trim().toLowerCase();
  const campaign = String(details.utm_campaign || '').trim().toLowerCase();
  if (content !== EMPLOYEE.id || medium !== UTM_MEDIUM || campaign !== UTM_CAMPAIGN) return null;
  return {
    employee: EMPLOYEE.id,
    platform: String(details.utm_source || 'unknown').trim().toLowerCase() || 'unknown',
    tracking_code: trackingCodeFromTerm(details.utm_term),
    utm_term: String(details.utm_term || ''),
  };
}
function isValidOrder(order) {
  const value = `${order?.status_slug || ''} ${order?.status || ''}`.toLowerCase();
  return !/(cancel|refund|restor|failed|deleted|ملغ|مرتجع|استرجاع)/i.test(value);
}
function moneyNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function eventData(event) { return event?.payload?.data && typeof event.payload.data === 'object' ? event.payload.data : (event?.payload || {}); }
function platformLabel(value) { return ({instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok'})[value] || value || 'غير معروف'; }

async function ingest(eventName, data) {
  const { sb, MERCHANT_ID } = require('./crm');
  const now = new Date().toISOString(), nonce = crypto.randomUUID();
  const payload = { merchant: MERCHANT_ID, event: eventName, created_at: now, data: { ...data, employee: EMPLOYEE.id, employee_name: EMPLOYEE.name, nonce } };
  const eventKey = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return sb('rpc/crm_ingest_event', { method:'POST', body:JSON.stringify({
    p_merchant_id: MERCHANT_ID, p_event_key: eventKey, p_event_name: eventName,
    p_occurred_at: now, p_payload: payload, p_credentials: null, p_expires_at: null,
  })});
}

async function generate(rawUrl, platformValue) {
  const platform = normalizePlatform(platformValue), url = buildTrackedUrl(rawUrl, platform);
  await ingest('staff.link.generated', { platform, original_url: parseStoreUrl(rawUrl).toString(), generated_url: url });
  return { url, platform, employee: EMPLOYEE };
}
async function copy(rawUrl, platformValue) {
  const platform = normalizePlatform(platformValue), trackingCode = makeTrackingCode();
  const url = buildTrackedUrl(rawUrl, platform, trackingCode);
  await ingest('staff.link.copied', { platform, original_url: parseStoreUrl(rawUrl).toString(), tracked_url: url, tracking_code: trackingCode });
  return { url, platform, tracking_code: trackingCode, employee: EMPLOYEE };
}

async function stats(days = 30) {
  const { sb, MERCHANT_ID } = require('./crm');
  const safeDays = Math.max(1, Math.min(Number(days) || 30, 30));
  const start = new Date(Date.now() - (safeDays - 1) * 86400000); start.setUTCHours(0,0,0,0);
  const since = start.toISOString();
  const eventParams = new URLSearchParams({ merchant_id:`eq.${MERCHANT_ID}`, event_name:'in.(staff.link.generated,staff.link.copied)', occurred_at:`gte.${since}`, select:'event_name,occurred_at,payload', order:'occurred_at.desc', limit:'5000' });
  const orderParams = new URLSearchParams({ merchant_id:`eq.${MERCHANT_ID}`, ordered_at:`gte.${since}`, select:'external_order_id,order_reference,status,status_slug,currency,total_amount,ordered_at,source_payload', order:'ordered_at.desc', limit:'1000' });
  const [events, orders] = await Promise.all([sb(`crm_event_inbox?${eventParams}`), sb(`orders?${orderParams}`)]);
  const generated = events.filter(e => e.event_name === 'staff.link.generated');
  const copied = events.filter(e => e.event_name === 'staff.link.copied');
  const copiedCodes = new Set(copied.map(e => String(eventData(e).tracking_code || '')).filter(Boolean));
  const attributed = orders.map(order => ({ order, attribution: attributionFromPayload(order.source_payload) })).filter(x => x.attribution);
  const valid = attributed.filter(x => isValidOrder(x.order));
  const matched = valid.filter(x => x.attribution.tracking_code && copiedCodes.has(x.attribution.tracking_code));
  const sales = valid.reduce((sum, x) => sum + moneyNumber(x.order.total_amount), 0);
  const platforms = PLATFORMS.map(platform => {
    const pCopies = copied.filter(e => eventData(e).platform === platform).length;
    const pOrders = valid.filter(x => x.attribution.platform === platform);
    return { platform, label:platformLabel(platform), generated:generated.filter(e => eventData(e).platform === platform).length, copies:pCopies, orders:pOrders.length, sales:pOrders.reduce((sum,x)=>sum+moneyNumber(x.order.total_amount),0), conversion_rate:pCopies ? (pOrders.length / pCopies) * 100 : 0 };
  });
  return {
    employee: EMPLOYEE, days:safeDays, since,
    metrics: { generated:generated.length, copies:copied.length, orders:valid.length, matched_orders:matched.length, sales, conversion_rate:copied.length ? (valid.length / copied.length) * 100 : 0 },
    platforms,
    recent_orders: valid.slice(0,30).map(({order,attribution}) => ({ id:order.external_order_id, reference:order.order_reference, status:order.status || order.status_slug, status_slug:order.status_slug, amount:moneyNumber(order.total_amount), currency:order.currency || 'SAR', ordered_at:order.ordered_at, platform:attribution.platform, tracking_code:attribution.tracking_code, matched_copy:!!(attribution.tracking_code && copiedCodes.has(attribution.tracking_code)) })),
    recent_activity: events.slice(0,40).map(e => ({ type:e.event_name === 'staff.link.copied' ? 'copy' : 'generate', at:e.occurred_at, platform:eventData(e).platform, url:eventData(e).original_url || '', tracking_code:eventData(e).tracking_code || '' })),
  };
}

module.exports = { EMPLOYEE, PLATFORMS, UTM_MEDIUM, UTM_CAMPAIGN, buildTrackedUrl, trackingCodeFromTerm, sourceDetails, attributionFromPayload, isValidOrder, generate, copy, stats };
