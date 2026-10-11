const { sb, MERCHANT_ID } = require('./crm');
const BASE = 'https://business.etisalna.com/api/v1/accounts/12';
const id = value => /^[1-9]\d{0,15}$/.test(String(value || '')) && Number.isSafeInteger(Number(value));
const phone = value => /^\+?[1-9]\d{7,14}$/.test(value || '') ? value.replace(/^\+/, '') : null;
const LABELS = new Set(['cart_reminder_1', 'cart_reminder_2', 'whatsapp_optout', 'cart_recovered']);
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
async function labelMessage({phone:recipient,messageId,label,request=fetch,environment=process.env}) {
 if (!phone(recipient) || !id(messageId) || !LABELS.has(label)) return failed();
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
    if (match) return await merge(api,conversation.id,label);
   }
  }
  return failed();
 } catch { return failed(); }
}
async function afterAccepted(options) {
 if (![1,2].includes(options.stage)) return failed();
 return labelMessage({...options,label:'cart_reminder_'+options.stage});
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
// Durable retry state is appended to the existing signed event inbox payload.
// Process one recovery at a time; this path never calls Salla or sends messages.
async function recoverOne({database=sb,request=fetch,environment=process.env,now=Date.now()}={}) {
 const timestamp=new Date(now).toISOString();
 const query=new URLSearchParams({merchant_id:`eq.${MERCHANT_ID}`,event_name:'eq.abandoned.cart.purchased',records_synced_at:'not.is.null',occurred_at:'gte.'+new Date(now-30*86400000).toISOString(),or:`(payload->>_crm_recovery_label.is.null,and(payload->>_crm_recovery_label.eq.pending,payload->>_crm_recovery_retry_at.lte.${timestamp}))`,select:'id,payload,occurred_at',order:'occurred_at.asc',limit:'1'});
 const events=await database('crm_event_inbox?'+query);
 if (!events.length) return {worked:false};
 const event=events[0],data=event.payload?.data;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if (!uuid.test(event.id||'')) throw Error('invalid_recovery_event');
 const raw=data?.id??data?.cart_id;
 const cartId=(typeof raw==='string'||(typeof raw==='number'&&Number.isSafeInteger(raw)))&&/^\d{1,40}$/.test(String(raw))?String(raw):null;
 let labeling={status:'ignored',reason:'cart_not_confirmed'};
 if (cartId) {
  const carts=await database(`abandoned_carts?merchant_id=eq.${MERCHANT_ID}&external_cart_id=eq.${encodeURIComponent(cartId)}&status=eq.recovered&select=id&limit=1`);
  if (carts.length && uuid.test(carts[0].id||'')) {
   const sends=[];
   for (const table of ['crm_cart_second_deliveries','crm_cart_deliveries']) {
    const rows=await database(`${table}?merchant_id=eq.${MERCHANT_ID}&cart_id=eq.${carts[0].id}&status=eq.accepted&attempted_at=lte.${encodeURIComponent(event.occurred_at)}&select=provider_message_id,attempted_phone&limit=1`);
    sends.push(...rows);
   }
   const send=sends.find(x=>id(x.provider_message_id)&&phone(x.attempted_phone));
   labeling=send?await labelMessage({phone:send.attempted_phone,messageId:send.provider_message_id,label:'cart_recovered',request,environment}):{status:'ignored',reason:'no_accepted_cart_reminder'};
  }
 }
 const attempts=(Number.isInteger(event.payload?._crm_recovery_attempts)?event.payload._crm_recovery_attempts:0)+1;
 const state=['added','already_present'].includes(labeling.status)?'done':labeling.status==='ignored'?'ignored':attempts>=5?'exhausted':'pending';
 await database(`crm_event_inbox?id=eq.${event.id}&merchant_id=eq.${MERCHANT_ID}`,{method:'PATCH',body:JSON.stringify({payload:{...event.payload,_crm_recovery_label:state,_crm_recovery_attempts:attempts,_crm_recovery_retry_at:new Date(now+15*60000).toISOString()}})});
 return {worked:true,event_id:event.id,labeling};
}
module.exports = {afterAccepted,fromEvent,recoverOne};
