const {sb,fail,MERCHANT_ID}=require('./crm');
const defaultTemplates=[
{id:'cart',name:'تذكير بالسلة',body:'أهلاً {{customer_name}}، منتجاتك في لنك ما زالت بانتظارك. أكمل طلبك من هنا: {{cart_url}}'},
{id:'delivered',name:'متابعة بعد الاستلام',body:'أهلاً {{customer_name}}، نتمنى أن طلبك {{order_number}} وصل كما تحب. هل تحتاج مساعدة بتركيب أو استخدام منتجاتك؟'},
{id:'review',name:'طلب تقييم',body:'أهلاً {{customer_name}}، رأيك يهمنا. شاركنا تقييم تجربتك مع لنك: {{review_url}}'}
];
function defaults(){return {provider:'',phone:'',display_name:'Link Store',cart_delay:60,post_sale_delay:1440,review_delay:4320,tags:['عميل جديد','متابعة سلة','ما بعد البيع','دعم فني','عميل مميز'],templates:defaultTemplates.map(t=>({...t}))};}
function validate(body){
 const d=defaults();
 if(!['','cloud_api','bsp','evolution'].includes(body.provider))throw fail(400,'اختر طريقة ربط صالحة');
 if(typeof body.phone!=='string'||(body.phone&&!/^\+[1-9]\d{7,14}$/.test(body.phone)))throw fail(400,'اكتب الرقم بصيغة دولية، مثال +9665XXXXXXXX');
 if(typeof body.display_name!=='string'||!body.display_name.trim()||body.display_name.length>80)throw fail(400,'اسم العرض غير صالح');
 for(const key of ['cart_delay','post_sale_delay','review_delay'])if(!Number.isInteger(body[key])||body[key]<1||body[key]>43200)throw fail(400,'مدة الانتظار من دقيقة إلى 30 يوماً');
 if(!Array.isArray(body.tags)||body.tags.length>20||body.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>40)||new Set(body.tags.map(t=>t.trim())).size!==body.tags.length)throw fail(400,'أدخل حتى 20 تصنيفاً مختلفاً، كل تصنيف حتى 40 حرفاً');
 if(!Array.isArray(body.templates)||body.templates.length!==3)throw fail(400,'مسودات الرسائل غير صالحة');
 const templates=defaultTemplates.map(t=>{const incoming=body.templates.find(x=>x?.id===t.id);if(!incoming||typeof incoming.body!=='string'||!incoming.body.trim()||incoming.body.length>1024)throw fail(400,'نص المسودة مطلوب وحتى 1024 حرفاً');
 for(const match of incoming.body.matchAll(/{{\s*([^{}]+)\s*}}/g))if(!['customer_name','cart_url','order_number','review_url'].includes(match[1].trim()))throw fail(400,'استخدم متغيرات الرسائل المعروضة فقط');
 return {...t,body:incoming.body.trim()};});
 return {...d,provider:body.provider,phone:body.phone,display_name:body.display_name.trim(),cart_delay:body.cart_delay,post_sale_delay:body.post_sale_delay,review_delay:body.review_delay,tags:body.tags.map(t=>t.trim()),templates};
}
async function load(){
 let rows;try{rows=await sb(`crm_whatsapp_workspace?merchant_id=eq.${MERCHANT_ID}&select=configuration,updated_at&limit=1`);}catch(e){if(/PGRST205|42P01/.test(e.message))return {configuration:defaults(),storage_ready:false,mode:'draft',connection_status:'not_connected'};throw e;}
 return {configuration:rows?.[0]?validate(rows[0].configuration):defaults(),updated_at:rows?.[0]?.updated_at||null,storage_ready:true,mode:'draft',connection_status:'not_connected'};
}
async function save(body){const configuration=validate(body);await sb('crm_whatsapp_workspace?on_conflict=merchant_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({merchant_id:MERCHANT_ID,configuration,mode:'draft',updated_at:new Date().toISOString()})});return {configuration,mode:'draft'};}
module.exports={load,save,validate,defaults};
