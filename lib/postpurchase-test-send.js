const {sb,MERCHANT_ID,fail}=require('./crm');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ID=/^\d{1,20}$/;
const clean=v=>String(v||'').replace(/[\r\n\t]+/g,' ').trim().slice(0,150);
function imageUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.href.length<=2000?u.href:null;}catch{return null;}}
function payload(row,image,phone,{landingPath}={}){
 if(!/^[1-9]\d{7,14}$/.test(phone))throw fail(503,'رقم الاختبار المحفوظ غير صالح');
 const url=new URL(row.product_url);
 if(url.origin!=='https://linkstore-sa.com'||url.hash||url.username||url.password||url.href.length>1000)throw fail(400,'رابط العرض لا يطابق رابط زر القالب');
 let buttonPath=url.href.slice('https://linkstore-sa.com/'.length);
 if(landingPath!==undefined){
  if(typeof landingPath!=='string'||!/^\/complete\/[-_A-Za-z0-9]{80,300}$/.test(landingPath))throw fail(400,'رابط الصفحة الشخصية غير صالح');
  buttonPath='#link-complete='+landingPath.split('/').pop();
 }
 const picture=imageUrl(image);if(!picture)throw fail(400,'صورة العرض غير محفوظة؛ زامن المنتجات من فيديو شوب أولًا');
 const name=clean(row.customer_name)||'عميل لنك',bought=clean(row.purchased_name),offer=clean(row.offer_name);
 if(!bought||!offer)throw fail(400,'بيانات العرض غير مكتملة');
 return {inbox_id:40,type:'whatsapp_template',contact:{name,phone_number:'+'+phone},message:{content:`هلا ${name} 💜 عساك متهني بطلبك من لنك! بما إنك اخترت ${bought}، رشحنا لك ${offer}؛ يناسب نفس موديل جوالك ويكمل حمايته. 👌`,whatsapp_template:{name:'link_postpurchase_complement_ar',language:{code:'ar'},components:[
 {type:'header',parameters:[{type:'image',image:{link:picture}}]},
 {type:'body',parameters:[name,bought,offer].map(text=>({type:'text',text}))},
 {type:'button',sub_type:'quick_reply',index:'0',parameters:[{type:'payload',payload:'unsubscribe'}]},
 {type:'button',sub_type:'url',index:'1',parameters:[{type:'text',text:buttonPath}]}
 ]}}};
}
function protectionPayload(row,landing,phone){
 if(!/^[1-9]\d{7,14}$/.test(phone||''))throw fail(503,'رقم الاختبار المحفوظ غير صالح');
 if(!/^\/complete\/[-_A-Za-z0-9]{80,300}$/.test(landing?.path||''))throw fail(400,'رابط الصفحة الشخصية غير صالح');
 const name=clean(row.customer_name)||'عميل لنك',model=clean(landing.model);
 if(!model)throw fail(400,'موديل الجهاز غير مكتمل');
 return {inbox_id:40,type:'whatsapp_template',contact:{name,phone_number:'+'+phone},message:{
 content:`هلا ${name} 💜 عساك متهنّي بطلبك من لنك! جمعنا لك اختيارات تناسب ${model} وتكمّل اللي عندك، من غير ما تحتار بين الموديلات 👌 شوفها واختر اللي يناسبك، وتقدر تجمع أكثر من قطعة بسلة وحدة.`,
 whatsapp_template:{name:'link_complete_protection_ar',language:{code:'ar'},components:[
 {type:'header',parameters:[{type:'image',image:{link:'https://link-video-shop.vercel.app/assets/link-complete-header.jpg'}}]},
 {type:'body',parameters:[name,model].map(text=>({type:'text',text}))},
 {type:'button',sub_type:'quick_reply',index:'0',parameters:[{type:'payload',payload:'unsubscribe'}]},
 {type:'button',sub_type:'url',index:'1',parameters:[{type:'text',text:landing.path.split('/').pop()}]}
 ]}}};
}
async function send(body,{database=sb,request=fetch,environment=process.env}={}){
 if(body.confirm_test!==true||!UUID.test(body.request_id||'')||!ID.test(body.external_order_id||'')||!ID.test(body.offer_product_id||''))throw fail(400,'اختر عرضًا وأكّد إرسال تجربة إلى رقم الاختبار');
 const phone=environment.WHATSAPP_TEST_PHONE,token=environment.ETISALNA_API_ACCESS_TOKEN;
 if(!/^[1-9]\d{7,14}$/.test(phone||'')||!token)throw fail(503,'رقم الاختبار أو مفتاح اتصالنا غير مهيأ');
 const {buildPreview,loadCatalog,loadRows}=require('./postpurchase-preview');
 const filter=`merchant_id=eq.${MERCHANT_ID}`;
 const [context,products,rules,suggestions,catalog]=await Promise.all([
 database('rpc/crm_postpurchase_single_context',{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID})}),
 loadRows(database,`crm_postpurchase_products?${filter}&select=*&order=product_id.asc,variant_id.asc`),
 loadRows(database,`crm_postpurchase_rules?${filter}&select=*&order=id.asc`),
 loadRows(database,`crm_postpurchase_suggestions?${filter}&select=product_id,variant_id,decision&order=product_id.asc,variant_id.asc`),
 loadCatalog(database,MERCHANT_ID)
 ]);
 const row=buildPreview(context,products,rules,suggestions,catalog).rows.find(x=>String(x.external_order_id)===body.external_order_id&&x.offer_product_id===body.offer_product_id&&['stock_check_required','delay'].includes(x.reason));
 if(!row)throw fail(400,'العرض لم يعد ضمن المطابقات المؤهلة؛ حدّث المعاينة');
 let landingPath,message;
 if(body.destination==='personal_page'){
  const landing=await require('./postpurchase-landing').create({external_order_id:body.external_order_id},{database,environment});
  landingPath=landing.path;message=protectionPayload(row,landing,phone);
 }else if(body.destination===undefined||body.destination==='product'){
  const [product]=await database(`products?${filter}&external_product_id=eq.${body.offer_product_id}&select=thumbnail_url,main_image_url&limit=1`);
  message=payload(row,product?.main_image_url||product?.thumbnail_url,phone);
 }else throw fail(400,'وجهة الرسالة غير صالحة');
 try{await database('crm_postpurchase_test_sends',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id:body.request_id,merchant_id:MERCHANT_ID,external_order_id:body.external_order_id,offer_product_id:body.offer_product_id,test_phone:phone,status:'sending'})});}
 catch(e){if(e.statusCode===409)return {mode:'test',sent:false,status:'duplicate',reason:'تمت محاولة هذه التجربة بالفعل؛ لا توجد إعادة تلقائية'};throw fail(503,'جهّز سجل الاختبار بتشغيل crm-postpurchase-test-send.sql أولًا؛ لم تُرسل رسالة');}
 let status='unknown',messageId=null,providerCode=null;
 try{
  const response=await request('https://business.etisalna.com/developer/api/v1/messages',{method:'POST',headers:{'Content-Type':'application/json',api_access_token:token,api_account_id:'12'},body:JSON.stringify(message),signal:AbortSignal.timeout(20000),redirect:'error'});
  const result=await response.json();
  if(response.status===201&&Number.isSafeInteger(result.message_id)&&result.message_id>0){status='accepted';messageId=String(result.message_id);}
  else if([400,401,403,422].includes(response.status)){status='rejected';providerCode=Number.isSafeInteger(result.code)?result.code:response.status;}
 }catch{/* An ambiguous attempt is recorded and never automatically repeated. */}
 let recorded=true;
 try{await database(`crm_postpurchase_test_sends?id=eq.${body.request_id}&merchant_id=eq.${MERCHANT_ID}&status=eq.sending`,{method:'PATCH',body:JSON.stringify({status,provider_message_id:messageId,updated_at:new Date().toISOString()})});}catch{recorded=false;}
 return {mode:'test',sent:status==='accepted',delivery_confirmed:false,status,message_id:messageId,provider_code:providerCode,recorded,destination:landingPath?'personal_page':'product',salla_requests:0};
}
module.exports={send,payload,protectionPayload};
