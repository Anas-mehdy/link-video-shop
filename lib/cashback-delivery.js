const {sb,fail,MERCHANT_ID,json,bodyObject}=require('./crm');
const {identityReason}=require('./postpurchase-identity');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE=/^[1-9][0-9]{7,14}$/;
const TEMPLATE='link_cashback_delivered_ar';
const scope='merchant_id=eq.'+MERCHANT_ID;
const missing=e=>/PGRST20[25]|42P01|42883/.test(String(e.code||'')+' '+e.message);
const ready=env=>!!(env.ETISALNA_API_ACCESS_TOKEN&&env.CRM_ENCRYPTION_KEY&&env.WHATSAPP_AUTOMATION_ENABLED==='true');
const rpc=(db,name,body)=>db('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
const nameOf=v=>String(v||'عميل لنك').replace(/\s+/g,' ').trim().slice(0,80)||'عميل لنك';
function destination(order,{environment=process.env,preview=false,expiresAt}={}){
 const token=require('./postpurchase-landing').seal(order.id,{environment,cashback:{preview,creditUntil:Date.parse(expiresAt)}});
 return {kind:'cashback',suffix:'#link-complete='+token};
}
function payload(customer,phone,target){
 const name=nameOf(customer);
 return {inbox_id:40,type:'whatsapp_template',contact:{name,phone_number:'+'+phone},message:{
  content:`السلام عليكم ${name}، معك أنس من لنك 💜 عساك متهنّي بطلبك! حبيت أبشّرك إن الكاش باك حق طلبك انضاف لمحفظتك، وتقدر تستخدم رصيدك في طلبك الجاي. شكرًا لثقتكم فينا!`,
  whatsapp_template:{name:TEMPLATE,language:{code:'ar'},components:[
   {type:'body',parameters:[{type:'text',text:name}]},
   {type:'button',sub_type:'quick_reply',index:'0',parameters:[{type:'payload',payload:'unsubscribe'}]},
   {type:'button',sub_type:'url',index:'1',parameters:[{type:'text',text:target.suffix}]}
  ]}
 }};
}
async function load({database=sb,environment=process.env}={}){
 try{
  const [control,candidates,rows]=await Promise.all([
   database('crm_cashback_control?'+scope+'&select=enabled'),
   database('crm_cashback_candidates?'+scope+'&select=order_id,external_order_id,order_reference,customer_name,delivered_at&order=delivered_at.desc&limit=70'),
   database('crm_cashback_deliveries?'+scope+'&select=order_id,external_order_id,status,approved_at,attempted_at,provider_message_id,destination,reason,expires_at&order=approved_at.desc&limit=100')
  ]);
  return {storage_ready:!!control[0],server_ready:ready(environment),enabled:control[0]?.enabled===true,candidates,rows};
 }catch(e){if(missing(e))return {storage_ready:false,enabled:false,candidates:[],rows:[]};throw e;}
}
async function identity(id,database){
 const [order]=await database('orders?'+scope+'&id=eq.'+id+'&select=id,customer_id,status_slug,ordered_at,source_payload&limit=1');
 if(order?.status_slug!=='delivered'||!UUID.test(order.customer_id||''))return {reason:'order_not_delivered'};
 const [c]=await database('customers?'+scope+'&id=eq.'+order.customer_id+'&select=name,normalized_phone,phone&limit=1');
 const phone=String(c?.normalized_phone||c?.phone||'').replace(/\D/g,'');
 if(!PHONE.test(phone)||identityReason(order,phone))return {reason:'phone_mismatch'};
 return {order,c,phone};
}
async function checks(phone,database){
 const [consent,optout]=await Promise.all([
  database('crm_whatsapp_consents?'+scope+'&phone=eq.'+phone+'&select=phone&limit=1'),
  database('crm_whatsapp_optouts?'+scope+'&phone=eq.'+phone+'&select=phone&limit=1')
 ]);
 return optout.length?'optout':!consent.length?'consent_missing':null;
}
async function approve(body,{database=sb}={}){
 const id=body.order_id, evidence=String(body.evidence_ref||'').trim(),expires=Date.parse(body.expires_at);
 if(!UUID.test(id||'')||body.confirm_deposit!==true||!/^[0-9]{1,32}$/.test(evidence)||!Number.isFinite(expires)||expires<=Date.now())throw fail(400,'أكّد حركة الإيداع، وأدخل معرّف الحركة وتاريخ انتهاء صالحًا');
 const [candidate]=await database('crm_cashback_candidates?'+scope+'&order_id=eq.'+id+'&select=event_id,external_order_id&limit=1');
 if(!candidate)throw fail(400,'لا يوجد حدث توصيل حديث صالح لهذا الطلب');
 const who=await identity(id,database);
 if(who.reason)throw fail(400,'حالة الطلب أو رقم العميل لا يطابق السجل');
 const problem=await checks(who.phone,database);
 if(problem)throw fail(400,problem==='optout'?'العميل ألغى الاشتراك':'لا توجد موافقة واتساب مسجّلة لهذا العميل');
 try{await database('crm_cashback_deliveries',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({merchant_id:MERCHANT_ID,order_id:id,external_order_id:candidate.external_order_id,event_id:candidate.event_id,evidence_ref:evidence,phone:who.phone,expires_at:new Date(expires).toISOString()})});}
 catch(e){if(e.statusCode===409)throw fail(400,'الطلب أو حركة الكاش باك مسجّلة بالفعل');throw e;}
}
async function tick({database=sb,environment=process.env,request=fetch,pick=destination}={}){
 const idle=reason=>({worked:false,reason});
 if(!ready(environment))return idle('server_disabled');
 let control;
 try{[control]=await database('crm_cashback_control?'+scope+'&select=enabled');}
 catch(e){if(missing(e))return idle('storage_missing');throw e;}
 if(!control?.enabled)return idle('paused');
 const queued=await database('crm_cashback_deliveries?'+scope+'&status=eq.queued&select=order_id,phone,expires_at&order=approved_at.asc,order_id.asc&limit=5');
 for(const job of queued){
  const q='crm_cashback_deliveries?'+scope+'&order_id=eq.'+job.order_id;
  const [candidate]=await database('crm_cashback_candidates?'+scope+'&order_id=eq.'+job.order_id+'&select=order_id&limit=1');
  const who=await identity(job.order_id,database);
  const stop=(Date.parse(job.expires_at)<=Date.now()?'credit_expired':null)||(!candidate?'delivery_not_recent':null)||who.reason||
   (who.phone!==job.phone?'phone_mismatch':null)||await checks(job.phone,database);
  const prior=stop?[]:await database('crm_pp_deliveries?'+scope+'&order_id=eq.'+job.order_id+'&status=in.(sending,accepted,unknown)&select=id&limit=1');
  if(stop||prior.length){
   await database(q+'&status=eq.queued',{method:'PATCH',body:JSON.stringify({status:'cancelled',reason:stop||'already_contacted',finished_at:new Date().toISOString()})});
   continue;
  }
  const target=await pick(who.order,{environment,expiresAt:job.expires_at});
  const token=await rpc(database,'crm_cashback_claim',{p_order_id:job.order_id,p_phone:job.phone,p_destination:target.kind});
  if(!UUID.test(token||''))continue;
  let status='unknown',reason='provider_unknown',messageId=null;
  try{
   const [active]=await database('crm_cashback_control?'+scope+'&select=enabled');
   const blocked=await checks(job.phone,database);
   if(!active?.enabled||blocked){status='cancelled';reason=blocked||'paused';}
   else{
    const response=await request('https://business.etisalna.com/developer/api/v1/messages',{method:'POST',headers:{'Content-Type':'application/json',api_access_token:environment.ETISALNA_API_ACCESS_TOKEN,api_account_id:'12'},body:JSON.stringify(payload(who.c.name,job.phone,target)),signal:AbortSignal.timeout(12000),redirect:'error'});
    if(response.status===201){
     const data=await response.json();
     if(Number.isSafeInteger(data.message_id)&&data.message_id>0){status='accepted';reason='provider_accepted';messageId=String(data.message_id);}
    }else if([400,401,403,422].includes(response.status)){status='rejected';reason='provider_rejected_http_'+response.status;}
   }
  }catch{/* Ambiguous attempts remain non-retriable. */}
  await database(q+'&status=eq.sending&attempt_token=eq.'+token,{method:'PATCH',body:JSON.stringify({status,reason,provider_message_id:messageId,finished_at:new Date().toISOString()})});
  return {worked:true,mode:'cashback',sent:status==='accepted',delivery_confirmed:false,status,reason};
 }
 return idle('no_due');
}
async function admin(req,res){
 if(req.method==='GET')return json(res,200,{ok:true,...await load()});
 const b=bodyObject(req);
 if(req.method==='POST'&&b.action==='preview'){
  if(!UUID.test(b.order_id||''))throw fail(400,'اختر طلبًا صالحًا');
  const [candidate]=await sb('crm_cashback_candidates?'+scope+'&order_id=eq.'+b.order_id+'&select=order_id&limit=1');
  if(!candidate)throw fail(400,'الطلب غير متاح للمعاينة');
  const who=await identity(b.order_id,sb);
  if(who.reason)throw fail(400,'تعذر مطابقة بيانات الطلب والعميل');
  const target=destination(who.order,{preview:true});
  return json(res,200,{ok:true,kind:target.kind,url:'https://linkstore-sa.com/'+target.suffix});
 }
 if(req.method==='POST'&&b.action==='approve'){await approve(b);return json(res,200,{ok:true});}
 if(req.method==='PUT'&&b.action==='configure'){
  if(typeof b.enabled!=='boolean'||(b.enabled&&(b.confirm_live!==true||!ready(process.env))))throw fail(400,'أكّد تفعيل الإرسال وتحقّق من إعدادات واتساب');
  await sb('crm_cashback_control?'+scope,{method:'PATCH',body:JSON.stringify({enabled:b.enabled})});
  return json(res,200,{ok:true});
 }
 return json(res,405,{ok:false,error:'Method not allowed'});
}
module.exports={admin,load,approve,tick,payload,destination,missing};
