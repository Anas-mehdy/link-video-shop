const {sb,MERCHANT_ID,fail,json,bodyObject}=require('./crm');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMPLATE='link_cart_personal_help_ar';
const rpc=(name,body={},database=sb)=>database('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
const reasons={template_not_ready:'القالب لم يُعتمد بعد',paused:'الإرسال موقوف',projection_pending:'انتظر تحديث بيانات الطلبات',already_attempted:'سبق التعامل مع هذه المتابعة',window_open:'نافذة الرد مفتوحة؛ تابع من اتصلنا مباشرة',customer_replied:'العميل رد سابقًا؛ راجع المحادثة',recent_contact:'يوجد تواصل آخر خلال آخر 24 ساعة',delay:'لم يحن موعد المتابعة',purchased_or_inactive:'العميل اشترى أو السلة غير نشطة',optout:'العميل ألغى الاشتراك',amount_changed:'قيمة السلة أصبحت 300 ريال أو أقل',phone_changed:'رقم العميل تغير',expired:'مر أكثر من 48 ساعة على التذكير الأول'};
function payload(r){
 if(!UUID.test(r.id||'')||!UUID.test(r.attempt_token||'')||!/^[1-9]\d{7,14}$/.test(r.phone||'')||r.template_name!==TEMPLATE)throw fail(400,'بيانات إرسال غير صالحة');
 const name=String(r.customer_name||'عميل لنك').replace(/[\r\n\t]+/g,' ').trim().slice(0,100)||'عميل لنك';
 return {inbox_id:40,type:'whatsapp_template',contact:{name,phone_number:'+'+r.phone},message:{whatsapp_template:{name:TEMPLATE,language:{code:'ar'},components:[{type:'body',parameters:[{type:'text',text:name}]},...['human_model_help','human_shipping_help','unsubscribe'].map((value,index)=>({type:'button',sub_type:'quick_reply',index:String(index),parameters:[{type:'payload',payload:value}]}))]}}};
}
async function load({database=sb}={}){
 try{return {storage_ready:true,...await rpc('crm_cart_human_list',{},database),server_ready:require('./whatsapp-delivery').readiness().ready};}
 catch(e){if(/PGRST202|PGRST205|42P01|42883/.test(e.message))return {storage_ready:false,queue:[],previous_second:[]};throw e;}
}
async function send(body,{database=sb,request=fetch,environment=process.env}={}){
 if(!UUID.test(body.id||'')||body.confirm_send!==true)throw fail(400,'اختر السلة وأكّد الإرسال اليدوي');
 if(!require('./whatsapp-delivery').readiness(environment).ready)throw fail(503,'إرسال واتساب غير جاهز في الخادم');
 const r=await rpc('crm_claim_cart_human',{p_id:body.id},database);
 if(r.blocked)throw fail(409,reasons[r.blocked]||'المتابعة غير مؤهلة للإرسال');
 // Validate before provider IO. Once claimed, every outcome is durable and never retried.
 let accepted=false,messageId=null;
 try{
  const response=await request('https://business.etisalna.com/developer/api/v1/messages',{method:'POST',headers:{'Content-Type':'application/json',api_access_token:environment.ETISALNA_API_ACCESS_TOKEN,api_account_id:'12'},body:JSON.stringify(payload(r)),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(response.status===201){const result=await response.json();if(Number.isSafeInteger(result.message_id)&&result.message_id>0){accepted=true;messageId=String(result.message_id);}}
 }catch{/* An ambiguous attempt must never be sent again. */}
 if(await rpc('crm_finish_cart_human',{p_id:r.id,p_token:r.attempt_token,p_status:accepted?'accepted':'unknown',p_message_id:messageId},database)!==true)throw fail(503,'تعذر حفظ النتيجة؛ راجع المحادثة قبل أي إجراء آخر');
 return {sent:accepted,status:accepted?'accepted':'unknown',delivery_confirmed:false};
}
async function admin(req,res){
 try{
  if(req.method==='GET')return json(res,200,{ok:true,...await load()});
  const body=bodyObject(req);
  if(req.method==='PUT'){
   if(body.confirm_template_approved!==true||body.template_name!==TEMPLATE)throw fail(400,'أكد اعتماد القالب العربي والأزرار الثلاثة في اتصلنا');
   await sb(`crm_cart_human_settings?merchant_id=eq.${MERCHANT_ID}`,{method:'PATCH',body:JSON.stringify({template_approved:true,updated_at:new Date().toISOString()})});
   return json(res,200,{ok:true,...await load()});
  }
  if(req.method==='POST'&&req.query?.action==='send')return json(res,200,{ok:true,...await send(body)});
  return json(res,405,{ok:false,error:'Method not allowed'});
 }catch(e){return json(res,[400,409].includes(e.statusCode)?e.statusCode:503,{ok:false,error:[400,409].includes(e.statusCode)?e.message:'تعذر تحميل المتابعة البشرية؛ تحقق من إعدادات الخادم وقاعدة البيانات'});}
}
module.exports={payload,load,send,admin};
