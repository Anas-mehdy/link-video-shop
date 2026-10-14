const {sb,MERCHANT_ID,fail,json,bodyObject}=require('./crm');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID=/^\d{1,40}$/;
const fields=['name','product_id','variant_id','product_name','color','incoming_quantity','booking_limit','expected_arrival','ship_from','ship_by','status'];
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function batch(body){
 const data=Object.fromEntries(fields.map(k=>[k,body[k]]));
 if(body.id!==undefined){if(!UUID.test(body.id))throw fail(400,'معرّف الدفعة غير صالح');data.id=body.id;}
 for(const k of ['name','product_name','color']){if(typeof data[k]!=='string'||!data[k].trim()||data[k].length>(k==='color'?80:150))throw fail(400,'اسم الدفعة والمنتج واللون مطلوبة');data[k]=data[k].trim();}
 if(typeof data.product_id!=='string'||!ID.test(data.product_id))throw fail(400,'أدخل معرّف منتج الحجز المستقل في سلة');
 data.variant_id=data.variant_id??'';
 if(typeof data.variant_id!=='string'||data.variant_id!==''&&!ID.test(data.variant_id))throw fail(400,'معرّف خيار المنتج غير صالح');
 if(!['incoming_quantity','booking_limit'].every(k=>Number.isInteger(data[k])&&data[k]>=1&&data[k]<=100000)||data.booking_limit>data.incoming_quantity)throw fail(400,'حد الحجز يجب ألا يتجاوز الكمية المؤكدة القادمة');
 if(!['expected_arrival','ship_from','ship_by'].every(k=>validDate(data[k]))||data.expected_arrival>data.ship_from||data.ship_from>data.ship_by)throw fail(400,'راجع موعد الوصول وفترة الشحن');
 if(!['draft','open','paused','closed'].includes(data.status))throw fail(400,'حالة الدفعة غير صالحة');
 return data;
}
const errors={overlapping_batch:'هذا المنتج أو الخيار مرتبط بدفعة أخرى مفتوحة أو متوقفة',batch_identity_locked:'بعد فتح الدفعة لا يمكن تغيير المنتج أو اللون أو إعادتها لمسودة',received_batch_locked:'الدفعة المستلمة مقفلة؛ أضف وصولاً جزئياً من اعتماد الاستلام',limit_below_reservations:'لا يمكن تخفيض حد الحجز تحت الكميات المدفوعة القائمة',invalid_receipt:'راجع حالة الدفعة والكمية السليمة المستلمة',receipt_cannot_decrease:'أدخل إجمالي الكمية المستلمة؛ لا يمكن تخفيضه بعد الاعتماد',pending_order_sync:'هناك طلبات بانتظار المطابقة؛ حدّث الحجوزات وعالج التنبيهات قبل اعتماد الاستلام'};
async function rpc(name,body){
 try{return await sb(`rpc/${name}`,{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID,...body})});}
 catch(e){for(const [code,message]of Object.entries(errors))if(e.message?.includes(code))throw fail(400,message);throw fail(503,'تعذر تحميل الحجوزات؛ تحقق من إعداد قسم الحجز المسبق في قاعدة بيانات لنك');}
}
async function tick(){return rpc('crm_preorder_reconcile',{p_limit:20});}
async function enrolled(externalId){
 if(!ID.test(String(externalId)))return false;
 try{
  const rows=await sb(`crm_preorder_reservations?merchant_id=eq.${MERCHANT_ID}&select=id,orders!inner(external_order_id)&orders.external_order_id=eq.${externalId}&limit=1`);
  if(!Array.isArray(rows))throw fail(503,'تعذرت مطابقة حجز الطلب القديم');
  return rows.length>0;
 }catch(e){
  // Uninstalled schema retains the existing archive policy. An outage must leave
  // an enrolled old order's inbox event pending, rather than silently skip it.
  if(/PGRST205|42P01/.test(e.message||''))return false;
  throw fail(503,'تعذرت مطابقة حجز الطلب القديم؛ سيبقى الحدث بانتظار المعالجة');
 }
}
async function load(query={}){
 const page=String(query.page??'1'),batchId=query.batch_id??'';
 if(!/^\d{1,4}$/.test(page)||Number(page)<1||Number(page)>1000||batchId&&!UUID.test(batchId))throw fail(400,'معايير العرض غير صالحة');
 const p=new URLSearchParams({merchant_id:`eq.${MERCHANT_ID}`,select:'id,batch_id,item_key,quantity,allocated_quantity,state,review_reason,paid_at,payment_status,promised_ship_from,promised_ship_by,promise_evidence,mixed_order,created_at,orders!inner(external_order_id,order_reference,status_slug,customers(name))',order:'created_at.desc,id.desc',limit:'26',offset:String((Number(page)-1)*25)});
 if(batchId)p.set('batch_id',`eq.${batchId}`);
 try{
 const [batches,reservations,queue,notices,summary]=await Promise.all([
  sb(`crm_preorder_batches?merchant_id=eq.${MERCHANT_ID}&select=*&order=created_at.desc&limit=200`),
  sb(`crm_preorder_reservations?${p}`),
  sb(`crm_preorder_order_queue?merchant_id=eq.${MERCHANT_ID}&select=order_id,last_error,queued_at,orders!inner(external_order_id,order_reference)&order=queued_at.asc&limit=50`),
  sb(`crm_preorder_notices?merchant_id=eq.${MERCHANT_ID}&status=eq.review&select=id,kind,revision,details,created_at&order=created_at.desc&limit=50`),
  rpc('crm_preorder_summary',{}),
 ]);
 return {ready:true,batches,reservations:reservations.slice(0,25),queue,notices,summary,page:Number(page),has_more:reservations.length>25,messages_sent:0,mode:'internal',batch_limit:200};
 }catch{return {ready:false,batches:[],reservations:[],queue:[],notices:[],summary:[],page:1,has_more:false,messages_sent:0,mode:'internal'};}
}
async function admin(req,res){
 if(req.method==='GET')return json(res,200,{ok:true,...await load(req.query)});
 if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed'});
 const body=bodyObject(req);
 if(body.action==='save')return json(res,200,{ok:true,id:await rpc('crm_preorder_save_batch',{p_data:batch(body)})});
 if(body.action==='sync')return json(res,200,{ok:true,...await tick()});
 if(body.action==='receive'){
  if(!UUID.test(body.id)||!Number.isInteger(body.quantity)||body.quantity<0||body.quantity>100000||body.confirm_inspected!==true)throw fail(400,'أكّد فحص البضاعة وأدخل إجمالي الكمية السليمة المستلمة');
  return json(res,200,{ok:true,...await rpc('crm_preorder_receive',{p_batch_id:body.id,p_quantity:body.quantity})});
 }
 throw fail(400,'إجراء الحجز غير صالح');
}
errors.unfulfilled_reservations='لا يمكن إغلاق دفعة فيها حجوزات معلقة؛ استخدم إيقاف مؤقت لوقف الحجوزات الجديدة';
module.exports={admin,load,tick,enrolled,batch,validDate};
