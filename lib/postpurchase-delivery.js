const {identityReason}=require('./postpurchase-identity');
const {sb,MERCHANT_ID,fail}=require('./crm');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rpc=(db,name,body={})=>db('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
const scope='merchant_id=eq.'+MERCHANT_ID;
function readiness(env=process.env){return ['ETISALNA_API_ACCESS_TOKEN','CRM_WORKER_TOKEN','CRM_ENCRYPTION_KEY'].every(k=>env[k])&&env.WHATSAPP_AUTOMATION_ENABLED==='true';}
function missing(e){return /PGRST202|PGRST205|42P01|42883/.test(e.code||e.message||'');}
async function load({database=sb,environment=process.env}={}){
 try{const [control,queue]=await Promise.all([database('crm_pp_delivery_control?'+scope+'&select=enabled,enabled_at&limit=1'),database('crm_pp_deliveries?'+scope+'&select=external_order_id,status,reason,attempted_at,provider_message_id,model&order=attempted_at.desc&limit=100')]);return {storage_ready:!!control[0],server_ready:readiness(environment),enabled:control[0]?.enabled===true,queue};}
 catch(e){if(missing(e))return {storage_ready:false,server_ready:readiness(environment),enabled:false,queue:[]};throw e;}
}
async function configure(body,{database=sb,environment=process.env}={}){
 if(typeof body.enabled!=='boolean'||body.enabled&&body.confirm_live!==true)throw fail(400,'أكّد تشغيل الإرسال للزبائن');
 if(body.enabled&&!readiness(environment))throw fail(400,'إعدادات واتساب أو تشفير الروابط غير جاهزة');
 const state=await load({database,environment});if(!state.storage_ready)throw fail(400,'شغّل crm-postpurchase-delivery.sql أولًا');
 if(body.enabled)await database('crm_pp_stock_cache?'+scope+'&select=product_id&limit=0');
 await database('crm_pp_delivery_control?'+scope,{method:'PATCH',body:JSON.stringify({enabled:body.enabled,...(body.enabled?{enabled_at:new Date().toISOString()}:{}),updated_at:new Date().toISOString()})});return load({database,environment});
}
async function tick({database=sb,request=fetch,environment=process.env,review,checkStock,pageData,seal,makePayload}={}){
 const idle=reason=>({worked:false,mode:'postpurchase',sent:false,reason});if(!readiness(environment))return idle('server_disabled');
 let batch;try{batch=await rpc(database,'crm_pp_delivery_batch');}catch(e){if(missing(e))return idle('storage_missing');throw e;}
 if(batch.reason!=='reserved')return idle(batch.reason);if(!UUID.test(batch.token||''))throw fail(503,'Invalid batch lease');
 try{
  const reviewedAt=new Date().toISOString(),report=await (review||require('./postpurchase-eligibility').review)({database});
  const candidate=report.rows.find(r=>r.reason==='review_ready')||report.rows.find(r=>r.reason==='stock_check_required');if(!candidate)return idle('no_due');
  if(candidate.reason==='stock_check_required'){
   const stock=await (checkStock||require('./postpurchase-stock').checkIds)(candidate.products.filter(p=>p.stock==='unchecked').map(p=>p.id),{database,request});
   return {worked:stock.salla_requests>0,mode:'postpurchase',sent:false,reason:'checking_stock',salla_requests:stock.salla_requests,stock_reason:stock.reason};
  }
  const [order]=await database('orders?'+scope+'&external_order_id=eq.'+candidate.external_order_id+'&select=id,external_order_id,customer_id,status_slug,ordered_at,source_payload&limit=1');
  if(!UUID.test(order?.id||'')||!UUID.test(order?.customer_id||''))return idle('order_changed');
  const [customer]=await database('customers?'+scope+'&id=eq.'+order.customer_id+'&select=name,phone,normalized_phone&limit=1');
  const phone=String(customer?.normalized_phone||customer?.phone||'').replace(/\D/g,'');if(!/^[1-9]\d{7,14}$/.test(phone))return idle('phone_missing');
  const identityError=identityReason(order,phone);if(identityError)return idle(identityError);
  const page=await (pageData||require('./postpurchase-landing').data)(order,{database,requireFreshStock:true});if(!page.products.length||!page.live_stock_checked)return idle('stock_changed');
  const token=(seal||require('./postpurchase-landing').seal)(order.id,{environment,verified:true});
  const message=(makePayload||require('./postpurchase-test-send').protectionPayload)({customer_name:customer.name},{path:'/complete/'+token,model:page.model},phone);
  const claim=await rpc(database,'crm_pp_delivery_claim',{p_order_id:order.id,p_phone:phone,p_products:page.products.map(p=>p.id),p_model:page.model,p_batch_at:batch.batch_at,p_batch_token:batch.token,p_reviewed_at:reviewedAt});if(claim.reason!=='claimed')return idle(claim.reason);
  if(!UUID.test(claim.id||'')||!UUID.test(claim.token||''))throw fail(503,'Invalid send claim');
  let status='unknown',messageId=null,reason='provider_unknown';
  try{
   const [control,optouts]=await Promise.all([database('crm_pp_delivery_control?'+scope+'&enabled=eq.true&select=merchant_id&limit=1'),database('crm_whatsapp_optouts?'+scope+'&phone=eq.'+phone+'&select=phone&limit=1')]);
   if(!control.length||optouts.length){status='cancelled';reason=optouts.length?'optout':'paused';}
   else{
    const response=await request('https://business.etisalna.com/developer/api/v1/messages',{method:'POST',headers:{'Content-Type':'application/json',api_access_token:environment.ETISALNA_API_ACCESS_TOKEN,api_account_id:'12'},body:JSON.stringify(message),signal:AbortSignal.timeout(12000),redirect:'error'});
    const result=await response.json();if(response.status===201&&Number.isSafeInteger(result.message_id)&&result.message_id>0){status='accepted';messageId=String(result.message_id);reason='provider_accepted';}else if([400,401,403,422].includes(response.status)){status='rejected';reason='provider_rejected_http_'+response.status;}
   }
  }catch{/* No automatic retry after an ambiguous send. */}
  if(await rpc(database,'crm_pp_delivery_finish',{p_id:claim.id,p_token:claim.token,p_status:status,p_message_id:messageId,p_reason:reason})!==true)throw fail(503,'نتيجة الإرسال تحتاج مراجعة؛ لم نجهز إعادة تلقائية');
  return {worked:true,mode:'postpurchase',sent:status==='accepted',delivery_confirmed:false,status,message_id:messageId,reason};
 }finally{try{await rpc(database,'crm_pp_delivery_release',{p_batch_at:batch.batch_at,p_token:batch.token});}catch{/* Lease expires; claims remain durable. */}}
}
module.exports={load,configure,tick,readiness};
