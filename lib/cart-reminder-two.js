const {sb,MERCHANT_ID,fail,bodyObject,json}=require('./crm');
const basePayload=require('./whatsapp-test-send').payload;
const missing=e=>/PGRST202|PGRST205|42P01|42883/.test(e.message);
const rpc=(name,body,database=sb)=>database('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
function payload(record){
 const message=basePayload(record),template=message.message.whatsapp_template;
 if(!/^[a-z][a-z0-9_]{0,100}$/.test(record.template_name||'')||![0,10,15,20].includes(record.discount_amount))throw fail(400,'Invalid offer');
 template.name=record.template_name;
 if(record.discount_amount){
  if(!/^[A-Za-z0-9_-]{1,50}$/.test(record.coupon_code||''))throw fail(400,'Invalid coupon');
  template.components[0].parameters.push({type:'text',text:String(record.discount_amount)},{type:'text',text:record.coupon_code});
 }
 return message;
}
async function load(){
 try{const [settings,queue]=await Promise.all([
  sb(`crm_cart_second_settings?merchant_id=eq.${MERCHANT_ID}&select=*&limit=1`),
  sb(`crm_cart_second_deliveries?merchant_id=eq.${MERCHANT_ID}&select=id,scheduled_for,status,reason,discount_amount,coupon_code,provider_message_id,abandoned_carts(customer_name)&order=created_at.desc&limit=100`)
 ]);return {storage_ready:true,configuration:settings[0],queue};}
 catch(e){if(missing(e))return {storage_ready:false,queue:[]};throw e;}
}
async function save(body){
 if(typeof body.enabled!=='boolean'||typeof body.quiet_hours!=='boolean'||!Number.isInteger(body.delay_hours)||body.delay_hours<4||body.delay_hours>24)throw fail(400,'اختر انتظارًا من 4 إلى 24 ساعة');
 const fields=['template_help','template_offer','coupon_10','coupon_15','coupon_20'];
 for(const key of fields){if(typeof body[key]!=='string')throw fail(400,'أدخل أسماء القوالب والكوبونات');body[key]=body[key].trim();const pattern=key.startsWith('template')?/^[a-z][a-z0-9_]{0,100}$/:/^[A-Za-z0-9_-]{1,50}$/;if((body[key]||body.enabled)&&!pattern.test(body[key]))throw fail(400,'اسم قالب أو كوبون غير صالح');}
 if(body.enabled&&body.confirm_ready!==true)throw fail(400,'أكد اعتماد القوالب وتجربة كوبونات سلة قبل التشغيل');
 if(body.enabled&&!require('./whatsapp-delivery').readiness().ready)throw fail(400,'أكمل إعدادات تشغيل واتساب في الخادم');
 await rpc('crm_configure_cart_second',{p_enabled:body.enabled,p_delay:body.delay_hours,p_quiet:body.quiet_hours,p_help:body.template_help,p_offer:body.template_offer,p_10:body.coupon_10,p_15:body.coupon_15,p_20:body.coupon_20,p_confirm:body.confirm_ready===true});return load();
}
async function tick({database=sb,request=fetch,environment=process.env}={}){
 if(!require('./whatsapp-delivery').readiness(environment).ready)return {sent:false,reason:'server_disabled'};
 let record;try{record=await rpc('crm_claim_cart_second',{p_merchant_id:MERCHANT_ID},database);}catch(e){if(missing(e))return {mode:'automatic',sent:false,reason:'second_schema_missing'};throw e;}
 if(record.idle)return {mode:'automatic',stage:2,sent:false,reason:record.idle};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(record.id||'')||!uuid.test(record.attempt_token||''))throw fail(503,'Invalid second claim');
 let accepted=false,messageId=null;
 try{const response=await request('https://business.etisalna.com/developer/api/v1/messages',{method:'POST',headers:{'Content-Type':'application/json',api_access_token:environment.ETISALNA_API_ACCESS_TOKEN,api_account_id:'12'},body:JSON.stringify(payload(record)),signal:AbortSignal.timeout(20000),redirect:'error'});if(response.status===201){const result=await response.json();if(Number.isSafeInteger(result.message_id)&&result.message_id>0){accepted=true;messageId=String(result.message_id);}}}catch{/* Never retry an ambiguous send. */}
 if(await rpc('crm_finish_cart_second',{p_id:record.id,p_token:record.attempt_token,p_status:accepted?'accepted':'unknown',p_message_id:messageId},database)!==true)throw fail(503,'تعذر حفظ نتيجة التذكير الثاني');
 return {mode:'automatic',stage:2,sent:accepted,status:accepted?'accepted':'unknown',delivery_confirmed:false,message_id:messageId};
}
async function admin(req,res){try{if(req.method==='GET')return json(res,200,{ok:true,...await load()});if(req.method==='PUT')return json(res,200,{ok:true,...await save(bodyObject(req))});return json(res,405,{ok:false,error:'Method not allowed'});}catch(e){return json(res,e.statusCode===400?400:503,{ok:false,error:e.statusCode===400?e.message:'شغّل crm-cart-reminder-two.sql وتحقق من إعدادات الخادم'});}}
module.exports={payload,load,save,tick,admin};
