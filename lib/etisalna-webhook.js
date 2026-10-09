const crypto = require('node:crypto');
const { fail, bodyObject, sb, MERCHANT_ID, json } = require('./crm');

function normalize(envelope, secret, now = Date.now()) {
  if (!secret) throw fail(503, 'ETISALNA_WEBHOOK_SECRET غير مهيأ');
  const encoded = envelope.raw_body_base64;
  if (typeof encoded !== 'string' || !encoded || encoded.length > 350000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw fail(400, 'Invalid raw body');
  const raw = Buffer.from(encoded, 'base64');
  if (raw.length > 256 * 1024 || raw.toString('base64') !== encoded) throw fail(400, 'Invalid raw body');
  const headers = envelope.headers || {};
  const timestamp = headers['x-chatwoot-timestamp'];
  const signature = headers['x-chatwoot-signature'];
  if (typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) throw fail(401, 'Invalid webhook timestamp');
  if (typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) throw fail(401, 'Invalid webhook signature');
  const expected = crypto.createHmac('sha256', secret).update(timestamp + '.').update(raw).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) throw fail(401, 'Invalid webhook signature');
  let body;
  try { body = JSON.parse(raw.toString('utf8')); } catch { throw fail(400, 'Invalid event JSON'); }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw fail(400, 'Invalid event');
  if (body.account?.id !== 12 || body.inbox?.id !== 40 || (body.conversation?.inbox_id != null && body.conversation.inbox_id !== 40) || (body.conversation?.channel && body.conversation.channel !== 'Channel::Whatsapp')) throw fail(403, 'Inbox not allowed');
  if (!['message_created', 'message_updated'].includes(body.event)) throw fail(400, 'Unsupported event');
  const id = body.id;
  if (!(typeof id === 'number' && Number.isSafeInteger(id) && id > 0) && !(typeof id === 'string' && /^[1-9]\d{0,19}$/.test(id))) throw fail(400, 'Invalid message ID');
  const occurred = new Date(body.created_at);
  if (typeof body.created_at !== 'string' || !Number.isFinite(occurred.getTime())) throw fail(400, 'Invalid event date');
  const content = typeof body.content === 'string' ? body.content.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآ]/g, 'ا').trim().replace(/\s+/g, ' ').toLowerCase() : '';
  const optout = body.message_type === 'incoming' && body.private === false && body.content_type === 'text' && ['الغاء الاشتراك', 'stop', 'unsubscribe'].includes(content);
  let replyPhone=null;
  if(body.message_type==='incoming' && body.private===false && /^\+?[1-9][0-9]{7,14}$/.test(body.sender?.phone_number||''))replyPhone=body.sender.phone_number.replace(/^\+/, '');
  let phone = null;
  if (optout) {
    const original = body.sender?.phone_number;
    if (typeof original !== 'string' || !/^\+?[1-9][0-9]{7,14}$/.test(original)) throw fail(400, 'Invalid optout phone');
    phone = original.replace(/^\+/, '');
  }
  return { p_merchant_id: MERCHANT_ID, p_event_key: crypto.createHash('sha256').update(raw).digest('hex'), p_event_name: body.event, p_message_id: String(id), p_occurred_at: occurred.toISOString(), p_phone: phone, p_reply_phone:replyPhone };
}

async function handle(req, res) {
  try {
    const record = normalize(bodyObject(req), process.env.ETISALNA_WEBHOOK_SECRET);
    let result;
    try{result=await sb('rpc/crm_receive_whatsapp_event_v2',{method:'POST',body:JSON.stringify(record)});}
    catch(e){if(!/PGRST202|42883/.test(e.message))throw e;const {p_reply_phone,...legacy}=record;result=await sb('rpc/crm_receive_whatsapp_event',{method:'POST',body:JSON.stringify(legacy)});}
    return json(res, 200, { ok: true, ...result });
  } catch (error) {
    const status = [400, 401, 403, 413, 503].includes(error.statusCode) ? error.statusCode : 503;
    return json(res, status, { ok: false, error: status === 503 ? 'تحقق من ETISALNA_WEBHOOK_SECRET وتشغيل crm-whatsapp-events.sql' : error.message });
  }
}
module.exports = { normalize, handle };

