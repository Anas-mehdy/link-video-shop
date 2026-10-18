const crypto=require('node:crypto');
const {sb,MERCHANT_ID,fail,bodyObject,json}=require('./crm');
const compare=require('./preorder-consent');
const VERSION='together-20261016-v1';
const TEXT='أوافق على انتظار جميع منتجات الطلب حتى وصول آخر دفعة وفحصها. شحنة واحدة، ورسومها تظهر حسب عنواني قبل الدفع.';
const allowed=new Set(['https://linkstore-sa.com','https://www.linkstore-sa.com','https://salla.sa']);
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function secret(){const k=process.env.CRM_ENCRYPTION_KEY;if(!/^[a-f0-9]{64}$/i.test(k||''))throw fail(503,'consent_unavailable');return crypto.createHmac('sha256',Buffer.from(k,'hex')).update('link-preorder-consent-v1').digest();}
function sign(data){const value=Buffer.from(JSON.stringify(data)).toString('base64url');return value+'.'+crypto.createHmac('sha256',secret()).update(value).digest('base64url');}
function verify(token){
 if(typeof token!=='string'||token.length>3000)throw fail(400,'invalid_ticket');
 const [value,mac,extra]=token.split('.');if(extra||!mac)throw fail(400,'invalid_ticket');
 const expected=crypto.createHmac('sha256',secret()).update(value).digest('base64url');
 if(!/^[A-Za-z0-9_-]{43}$/.test(mac)||mac.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(expected)))throw fail(400,'invalid_ticket');
 let data;try{data=JSON.parse(Buffer.from(value,'base64url').toString());}catch{throw fail(400,'invalid_ticket');}
 if(!data||!Number.isSafeInteger(data.expires)||data.expires<Date.now()||!/^[-a-f0-9]{36}$/.test(data.intent_id||'')||!Array.isArray(data.incoming))throw fail(400,'expired_ticket');
 return data;
}
function sanitize(items,allowEmpty=false){if(allowEmpty&&Array.isArray(items)&&items.length===0)return [];return compare.lines(items).map(r=>({product_id:r.product,quantity:r.quantity,...(r.sku?{sku_id:r.sku}:{}),options:r.options}));}
function additions(before,after,incoming){
 const totals=rows=>{const result=new Map();for(const r of rows.length?compare.lines(rows):[]){const key=JSON.stringify({...r,quantity:0});const prev=result.get(key);result.set(key,{product:r.product,quantity:(prev?.quantity||0)+r.quantity});}return result;};
 const a=totals(before),b=totals(after);let added=0;
 for(const [key,r] of a){const n=b.get(key);if(!n||n.quantity<r.quantity)throw fail(400,'cart_changed');}
 for(const [key,r] of b){const delta=r.quantity-(a.get(key)?.quantity||0);if(delta){if(delta<0||!incoming.includes(r.product))throw fail(400,'cart_changed');added+=delta;}}
 if(!added)throw fail(400,'addition_not_observed');
}
async function control(){try{const rows=await sb(`crm_preorder_consent_control?merchant_id=eq.${MERCHANT_ID}&select=enabled&limit=1`);return typeof rows?.[0]?.enabled==='boolean'?rows[0].enabled:null;}catch{return null;}}
async function catalog(){
 const rows=await sb(`crm_preorder_batches?merchant_id=eq.${MERCHANT_ID}&status=in.(open,paused)&select=product_id,variant_id,status,expected_arrival,ship_from,ship_by,revision&limit=201`);
 if(!Array.isArray(rows)||rows.length>200||rows.some(x=>x.variant_id))throw fail(503,'catalog_unavailable');
 const result=new Map();for(const r of rows){if(result.has(String(r.product_id)))throw fail(503,'catalog_unavailable');result.set(String(r.product_id),r);}return result;
}
function selectedSchedules(ids,products){
 const rows=[...new Set(ids)].map(id=>products.get(id)).filter(Boolean);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(rows.some(r=>r.status!=='open'||r.ship_by<today))throw fail(400,'schedule_changed');
 return compare.schedules(rows);
}
async function notOrdered(checkout){const rows=await sb(`orders?merchant_id=eq.${MERCHANT_ID}&source_payload->>checkout_id=eq.${checkout}&select=id&limit=1`);if(!Array.isArray(rows)||rows.length)throw fail(400,'order_already_exists');}
async function append(data){
 const rows=await sb('crm_preorder_consent_records',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({merchant_id:MERCHANT_ID,choice:'together',affirmative:true,policy_version:VERSION,...data})});
 if(!rows?.[0]?.id)throw fail(503,'consent_unavailable');return rows[0];
}
async function begin(body){
 secret();
 if(body.affirmative!==true||body.policy_version!==VERSION||body.policy_text!==TEXT)throw fail(400,'affirmation_required');
 const checkout=compare.id(body.checkout_id),items=sanitize(body.items,true);
 if(!Array.isArray(body.incoming)||!body.incoming.length||body.incoming.length>20)throw fail(400,'incoming_invalid');
 const incoming=[...new Set(body.incoming.map(compare.id))];
 const recent=await sb(`crm_preorder_consent_records?merchant_id=eq.${MERCHANT_ID}&checkout_id=eq.${checkout}&received_at=gte.${new Date(Date.now()-3600000).toISOString()}&select=id&limit=41`);
 if(!Array.isArray(recent)||recent.length>=40)throw fail(429,'too_many_attempts');
 const products=await catalog(),ids=[...items.map(r=>r.product_id),...incoming],schedules=selectedSchedules(ids,products);
 const groups=new Set(ids.map(id=>{const p=products.get(id);return p?p.expected_arrival+':'+p.ship_from+':'+p.ship_by:'ready';}));
 if(groups.size<2)throw fail(400,'combined_choice_not_required');
 if(JSON.stringify(compare.schedules(body.schedules))!==JSON.stringify(schedules))throw fail(400,'schedule_changed');
 await notOrdered(checkout);
 // The installed storage schema disallows empty item arrays. For an empty
 // cart's explicit mixed bulk selection, issue a short-lived signed challenge
 // rather than fabricate an intent row/product. Only a successful final cart
 // becomes durable evidence; an abandoned challenge proves nothing.
 if(!items.length)return {ticket:sign({intent_id:crypto.randomUUID(),checkout_id:checkout,incoming,empty:true,issued_at:new Date().toISOString(),schedule_hash:digest(JSON.stringify(schedules)),policy_version:VERSION,expires:Date.now()+120000})};
 // Bind exact policy, original cart and incoming product identities. The final
 // native cart snapshot is appended only after observing the successful add.
 const record=await append({checkout_id:checkout,stage:'intent',items,schedules,fingerprint:compare.fingerprint(items),policy_text:TEXT});
 return {ticket:sign({intent_id:record.id,checkout_id:checkout,incoming,expires:Date.now()+120000})};
}
async function finish(body){
 const ticket=verify(body.ticket),checkout=compare.id(body.checkout_id);
 if(checkout!==ticket.checkout_id)throw fail(400,'cart_changed');
 const rows=ticket.empty===true?[]:await sb(`crm_preorder_consent_records?merchant_id=eq.${MERCHANT_ID}&id=eq.${ticket.intent_id}&stage=eq.intent&select=*&limit=1`);
 const intent=ticket.empty===true?{items:[],checkout_id:checkout,policy_version:ticket.policy_version,policy_text:TEXT,received_at:ticket.issued_at}:rows?.[0];
 if(!intent||intent.checkout_id!==checkout||intent.policy_version!==VERSION)throw fail(400,'invalid_ticket');
 const items=sanitize(body.items);additions(intent.items,items,ticket.incoming);
 const schedules=selectedSchedules(items.map(r=>r.product_id),await catalog());
 // JSONB does not preserve object key order. Compare canonical values on
 // both sides; raw JSON.stringify(intent.schedules) rejects unchanged dates.
 if(ticket.empty===true?digest(JSON.stringify(schedules))!==ticket.schedule_hash:JSON.stringify(schedules)!==JSON.stringify(compare.schedules(intent.schedules)))throw fail(400,'schedule_changed');
 await notOrdered(checkout);
 const hash=compare.fingerprint(items);
 const recent=await sb(`crm_preorder_consent_records?merchant_id=eq.${MERCHANT_ID}&checkout_id=eq.${checkout}&received_at=gte.${new Date(Date.now()-3600000).toISOString()}&select=id,stage,fingerprint,received_at&limit=41`);
 if(!Array.isArray(recent)||recent.length>=40)throw fail(429,'too_many_attempts');
 const previous=recent.find(r=>r.stage==='finalized'&&r.fingerprint===hash&&Date.parse(r.received_at)>=Date.parse(intent.received_at));
 if(previous)return {recorded:true,record_id:previous.id};
 const record=await append({checkout_id:checkout,stage:'finalized',items,schedules,fingerprint:hash,policy_text:intent.policy_text});
 return {recorded:true,record_id:record.id};
}
async function handle(req,res){
 const origin=req.headers?.origin;
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 if(!allowed.has(origin))return json(res,403,{ok:false,error:'origin_not_allowed'});
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS')return json(res,204,{});
 if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
 try{
  if(!await control())throw fail(503,'consent_not_active');
  const body=bodyObject(req);if(Buffer.byteLength(JSON.stringify(body))>48000)throw fail(413,'payload_too_large');
  const result=body.action==='begin'?await begin(body):body.action==='finish'?await finish(body):null;
  if(!result)throw fail(400,'invalid_action');return json(res,200,{ok:true,...result});
 }catch(e){return json(res,[400,403,413,429,503].includes(e.statusCode)?e.statusCode:503,{ok:false,error:e.statusCode?e.message:'consent_unavailable'});}
}
async function evidence(orders,batches,{resolveItems=order=>require('./preorder-order-items').resolve(order)}={}){
 let lookups=0;
 const results={},products=new Map();
 for(const b of batches){const key=String(b.product_id);if(products.has(key))products.set(key,null);else products.set(key,b);}
 const ids=[];for(const o of orders)try{ids.push(compare.id(o.source_payload?.checkout_id));}catch{}
 let all=[];
 try{
  if(ids.length)all=await sb(`crm_preorder_consent_records?merchant_id=eq.${MERCHANT_ID}&checkout_id=in.(${[...new Set(ids)].join(',')})&select=*&order=received_at.desc,id.desc&limit=1001`);
  if(!Array.isArray(all)||all.length>1000)throw Error('incomplete');
 }catch{for(const o of orders)results[o.external_order_id]={status:'review',reason:'evidence_unavailable'};return results;}
 for(const o of orders){
  const native=o.source_payload?.items;
  if(Array.isArray(native)&&native.length&&native.every(r=>/^\d{1,40}$/.test(String(r.product_id??r.product?.id??'')))){
   const groups=new Set(native.map(r=>{const key=String(r.product_id??r.product?.id),b=products.get(key);return !products.has(key)?'ready':!b?'unknown:'+key:b.expected_arrival+':'+b.ship_from+':'+b.ship_by;}));
   if(groups.size===1&&![...groups][0].startsWith('unknown:')){results[o.external_order_id]={status:'not_required',reason:'single_shipping_group'};continue;}
  }
  let checkout;try{checkout=compare.id(o.source_payload?.checkout_id);}catch{results[o.external_order_id]={status:'review',reason:'checkout_missing'};continue;}
  try{
   const rows=all.filter(r=>r.checkout_id===checkout);
   if(!Array.isArray(rows)||rows.length>40)throw Error('incomplete');
   // Always inspect the newest evidence, including an unfinished newer intent.
   // Never revive an older approval after a later cart operation failed.
   const latest=rows[0];if(!latest){results[o.external_order_id]={status:'unrecorded',reason:'no_record'};continue;}
   const ids=[...new Set((o.source_payload?.items||[]).map(r=>String(r.product_id??r.product?.id??'')))];
   const current=ids.filter(id=>products.has(id)).map(id=>products.get(id));
   if(current.some(b=>!b)||!current.length)throw Error('incomplete');
   const matchingOrder={checkout_id:checkout,ordered_at:o.ordered_at,items:o.source_payload?.items,schedules:current};
   let result=compare.match(latest,matchingOrder);
   const recorded=latest.stage==='finalized'&&latest.affirmative===true&&latest.choice==='together';
   if(recorded&&result.reason==='snapshot_incomplete'&&lookups<2&&Array.isArray(native)&&!native.some(i=>i.notes||i.attachments?.length)){
    lookups++;
    try{const items=await resolveItems(o);if(items)result=compare.match(latest,{...matchingOrder,items});}catch{}
   }
   results[o.external_order_id]={...result,...(recorded?{recorded:true,policy_text:latest.policy_text,schedules:latest.schedules,record_id:latest.id,received_at:latest.received_at,policy_version:latest.policy_version}: {})};
  }catch{results[o.external_order_id]={status:'review',reason:'evidence_unavailable'};}
 }
 return results;
}
async function activity(){
 const enabled=await control();
 try{
  const rows=await sb(`crm_preorder_consent_records?merchant_id=eq.${MERCHANT_ID}&select=id,stage,received_at,items,policy_version&order=received_at.desc,id.desc&limit=20`);
  if(!Array.isArray(rows))throw Error('unavailable');
  return {ready:true,enabled,records:rows.map(r=>({id:r.id,stage:r.stage,received_at:r.received_at,policy_version:r.policy_version,item_count:Array.isArray(r.items)?r.items.length:0}))};
 }catch{return {ready:false,enabled,records:[]};}
}
module.exports={VERSION,TEXT,control,handle,begin,finish,sign,verify,additions,sanitize,evidence,activity};
