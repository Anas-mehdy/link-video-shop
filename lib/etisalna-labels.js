const { sb, MERCHANT_ID } = require('./crm');
const BASE = 'https://business.etisalna.com/api/v1/accounts/12';
const id = value => /^[1-9]\d{0,15}$/.test(String(value || '')) && Number.isSafeInteger(Number(value));
const phone = value => /^\+?[1-9]\d{7,14}$/.test(value || '') ? value.replace(/^\+/, '') : null;
const LABELS = new Set(['cart_reminder_1', 'cart_reminder_2', 'whatsapp_optout']);
function client(request, environment) {
 const signal = AbortSignal.timeout(12000);
 return async (path, body) => {
  if (!environment.ETISALNA_API_ACCESS_TOKEN) throw Error('label_token_missing');
  const response = await request(BASE + path, {method:body ? 'POST' : 'GET', headers:{api_access_token:environment.ETISALNA_API_ACCESS_TOKEN, ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal, redirect:'error'});
  if (!response.ok) throw Error('label_provider_error');
  return response.json();
 };
}
async function merge(api, conversationId, label) {
 if (!id(conversationId) || !LABELS.has(label)) throw Error('invalid_label_target');
 const path = `/conversations/${conversationId}/labels`;
 const current = await api(path);
 // Etisalna replaces the complete list. Never POST after an invalid/failed GET.
 if (!Array.isArray(current.payload) || current.payload.some(x => typeof x !== 'string')) throw Error('invalid_labels');
 if (current.payload.includes(label)) return {status:'already_present',label};
 const labels = [...new Set([...current.payload,label])];
 const saved = await api(path,{labels});
 if (!Array.isArray(saved.payload) || labels.some(x => !saved.payload.includes(x))) throw Error('label_not_confirmed');
 return {status:'added',label};
}
function failed() { return {status:'pending',reason:'label_not_confirmed'}; }
async function afterAccepted({phone:recipient,messageId,stage,request=fetch,environment=process.env}) {
 if (!phone(recipient) || !id(messageId) || ![1,2].includes(stage)) return failed();
 const api = client(request,environment);
 try {
  const contacts = await api('/contacts/search?q='+encodeURIComponent('+'+phone(recipient)));
  const exact = (contacts.payload || []).filter(x => id(x.id) && phone(x.phone_number) === phone(recipient));
  // Never choose a fuzzy match or guess the newest conversation.
  for (const contact of exact.slice(0,2)) {
   const conversations = await api(`/contacts/${contact.id}/conversations`);
   for (const conversation of (conversations.payload || []).filter(x => id(x.id) && x.inbox_id === 40).slice(0,3)) {
    const messages = await api(`/conversations/${conversation.id}/messages`);
    const match = (messages.payload || []).some(x => String(x.id) === String(messageId) && x.private === false && [1,'outgoing'].includes(x.message_type) && (x.inbox_id == null || x.inbox_id === 40) && (x.account_id == null || x.account_id === 12));
    if (match) return await merge(api,conversation.id,'cart_reminder_'+stage);
   }
  }
  return failed();
 } catch { return failed(); }
}
// Called only with the authenticated webhook body, after durable event storage.
async function fromEvent(body, record, {database=sb,request=fetch,environment=process.env}={}) {
 if (!id(body?.conversation?.id) || body.private !== false) return {status:'ignored'};
 const api = client(request,environment);
 try {
  if (record.p_phone) return await merge(api,body.conversation.id,'whatsapp_optout');
  if (body.message_type !== 'outgoing') return {status:'ignored'};
  for (const [table,label] of [['crm_cart_deliveries','cart_reminder_1'],['crm_cart_second_deliveries','cart_reminder_2']]) {
   const rows = await database(`${table}?merchant_id=eq.${MERCHANT_ID}&provider_message_id=eq.${record.p_message_id}&status=eq.accepted&select=id&limit=1`);
   if (rows.length) return await merge(api,body.conversation.id,label);
  }
  return {status:'ignored'};
 } catch { return failed(); }
}
module.exports = {afterAccepted,fromEvent};
