const {sb,MERCHANT_ID,fail,bodyObject,json}=require('./crm');
const {payload}=require('./whatsapp-test-send');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function readiness(environment=process.env){
 const missing=['ETISALNA_API_ACCESS_TOKEN','CRM_WORKER_TOKEN'].filter(key=>!environment[key]);
 if(environment.WHATSAPP_AUTOMATION_ENABLED!=='true')missing.push('WHATSAPP_AUTOMATION_ENABLED');
 return {ready:missing.length===0,missing};
}
async function rpc(name,body,database=sb){return database('rpc/'+name,{method:'POST',body:JSON.stringify(body)});}
async function load(){
 const ready=readiness();
 try{
  await rpc('crm_cart_delivery_reconcile',{p_merchant_id:MERCHANT_ID});
  const [settings,queue,consents]=await Promise.all([
   sb(`crm_cart_delivery_settings?merchant_id=eq.${MERCHANT_ID}&select=enabled,started_at,delay_minutes,quiet_hours,last_worker_at&limit=1`),
   sb(`crm_cart_deliveries?merchant_id=eq.${MERCHANT_ID}&select=id,scheduled_for,status,reason,attempted_at,provider_message_id,abandoned_carts(customer_name,external_cart_id)&order=created_at.desc&limit=100`),
   sb(`crm_whatsapp_consents?merchant_id=eq.${MERCHANT_ID}&select=phone,consent_at,source&order=consent_at.desc&limit=100`)
  ]);
  return {storage_ready:true,...ready,configuration:settings[0],queue,consents};
 }catch(error){if(/PGRST202|PGRST205|PGRST200|42P01|42883/.test(error.message))return {storage_ready:false,...ready,queue:[],consents:[]};throw error;}
}
async function save(body){
 if(typeof body.enabled!=='boolean'||!Number.isInteger(body.delay_minutes)||body.delay_minutes<60||body.delay_minutes>120||typeof body.quiet_hours!=='boolean'||(body.enabled&&body.confirm_live!==true))throw fail(400,'اختر انتظارًا بين60 و120 دقيقة وأكّد تشغيل الإرسال');
 if(body.enabled&&!readiness().ready)throw fail(400,'أكمل إعدادات تشغيل واتساب في الخادم أولًا');
 await rpc('crm_configure_cart_delivery',{p_enabled:body.enabled,p_delay:body.delay_minutes,p_quiet:body.quiet_hours,p_confirm:body.confirm_live===true});return load();
}
async function consent(body){
 const phone=typeof body.phone==='string'?body.phone.replace(/^\+/,''):'';
 if(!/^[1-9]\d{7,14}$/.test(phone)||typeof body.source!=='string'||body.source.trim().length<3||body.source.trim().length>300||body.confirm_consent!==true)throw fail(400,'أدخل رقمًا دوليًا ومصدر موافقة العميل على رسائل واتساب');
 await rpc('crm_record_whatsapp_consent',{p_phone:phone,p_source:body.source.trim()});return load();
}
async function tick({database=sb,request=fetch,environment=process.env}={}){
 if(!readiness(environment).ready)return {mode:'paused',sent:false,reason:'server_disabled'};
 const record=await rpc('crm_claim_cart_delivery',{p_merchant_id:MERCHANT_ID},database);
 if(record.idle==='no_due')return require('./cart-reminder-two').tick({database,request,environment});
 if(record.idle)return {mode:'automatic',sent:false,reason:record.idle};
 if(!UUID.test(record.id||'')||!UUID.test(record.attempt_token||''))throw fail(503,'Invalid send claim');
 let accepted=false,messageId=null;
 try{
  const body=payload(record);
  const response=await request('https://business.etisalna.com/developer/api/v1/messages',{method:'POST',headers:{'Content-Type':'application/json',api_access_token:environment.ETISALNA_API_ACCESS_TOKEN,api_account_id:'12'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(response.status===201){const result=await response.json();if(Number.isSafeInteger(result.message_id)&&result.message_id>0){accepted=true;messageId=String(result.message_id);}}
 }catch{/* An ambiguous send is retained and never automatically retried. */}
 const saved=await rpc('crm_finish_cart_delivery',{p_id:record.id,p_token:record.attempt_token,p_status:accepted?'accepted':'unknown',p_message_id:messageId},database);
 if(saved!==true)throw fail(503,'تعذر تأكيد حفظ نتيجة الإرسال؛ راجع السجل قبل أي إعادة إرسال');
 return {mode:'automatic',sent:accepted,status:accepted?'accepted':'unknown',delivery_confirmed:false,message_id:messageId};
}
async function admin(req,res){
 try{
  if(req.method==='GET')return json(res,200,{ok:true,...await load()});
  if(req.method==='PUT')return json(res,200,{ok:true,...await save(bodyObject(req))});
  if(req.method==='POST'&&req.query?.action==='consent')return json(res,200,{ok:true,...await consent(bodyObject(req))});
  return json(res,405,{ok:false,error:'Method not allowed'});
 }catch(e){return json(res,[400,413].includes(e.statusCode)?e.statusCode:503,{ok:false,error:[400,413].includes(e.statusCode)?e.message:'تحقق من إعدادات الخادم وتشغيل crm-whatsapp-delivery.sql'});}
}
module.exports={readiness,load,save,consent,tick,admin};

