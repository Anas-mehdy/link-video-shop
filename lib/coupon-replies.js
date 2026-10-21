const {sb, MERCHANT_ID, fail, json, bodyObject}=require('./crm');
const BASE='https://business.etisalna.com/api/v1/accounts/12';
const id=v=>/^[1-9]\d{0,15}$/.test(String(v||''))&&Number.isSafeInteger(Number(v));
const DEFAULT_MESSAGE='أكيد، أبشر 💜\nاختر كود الخصم المناسب لقيمة سلتك 👇\n\n🏷️ *LINK10* يخصم لك *10 ريال* إذا سلتك أكثر من *100 ريال*\n🏷️ *LINK15* يخصم لك *15 ريال* إذا سلتك *200 ريال أو أكثر*\n🏷️ *LINK20* يخصم لك *20 ريال* إذا سلتك *300 ريال أو أكثر*\n\nالأكواد تشمل جميع المنتجات، حتى البكجات والعروض والحجز المسبق ✨\nأدخل الكود في خانة «كود الخصم» عند إتمام الطلب.';
function classify(value){
 const text=String(value||'').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const coupon=/(?:كود|اكواد|كوبون|قسيمه|قسيمة|خصم|تخفيض|coupon|promo|discount)/u.test(text);
 if(!coupon)return null;
 if(/(?:ما\s*(?:اشتغل|يشتغل|اشتغلت|اشتغلو|نفع|ينفع|انحسب|يقبل|قبل|ضبط)|مو\s*(?:شغال|صحيح)|مش\s*شغال|لم\s*(?:يعمل|يقبل)|لا\s*(?:يعمل|يقبل)|مرفوض|غير\s*صالح|خط[اأ]|not\s*work|invalid|expired)/u.test(text))return 'problem';
 if(/(?:كود\s*(?:ال)?(?:خصم|تخفيض)|اكواد\s*(?:ال)?خصم|كوبون|قسيم[هة]\s*(?:ال)?خصم|(?:discount|promo)\s*code|coupon)/u.test(text))return 'request';
 if(/(?:ابي|ابغي|ابغي|ابغى|بدي|ممكن|عندكم|عندكن|عندك|عندكون|فيه|في|اريد|احتاج|عطيني|اعطيني|عطونا|اعطونا|بغيت|لو\s*سمحت).{0,30}(?:كود|خصم|تخفيض)/u.test(text))return 'request';
 return null;
}
async function fromEvent(body,record,{database=sb,request=fetch,environment=process.env,now=Date.now()}={}){
 if(body?.event!=='message_created'||body.message_type!=='incoming'||body.private!==false||body.content_type!=='text'||body.account?.id!==12||body.inbox?.id!==40||!id(body.conversation?.id)||!record.p_reply_phone||record.p_phone)return {status:'ignored'};
 const kind=classify(body.content);if(!kind)return {status:'ignored'};
 if(!environment.ETISALNA_API_ACCESS_TOKEN)return {status:'unavailable',reason:'token_missing'};
 const occurred=Date.parse(record.p_occurred_at);
 if(!Number.isFinite(occurred)||now-occurred>600000||occurred-now>60000)return {status:'skipped',reason:'stale'};
 const claim=await database('rpc/crm_claim_coupon_reply',{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID,p_message_id:record.p_message_id,p_conversation_id:String(body.conversation.id),p_phone:record.p_reply_phone,p_occurred_at:record.p_occurred_at,p_kind:kind})});
 if(claim.skip)return {status:'skipped',reason:claim.skip};
 if(!/^[0-9a-f-]{36}$/.test(claim.id||'')||typeof claim.message!=='string')throw Error('invalid_coupon_claim');
 let status='unknown',reason='unconfirmed_attempt',messageId=null;
 const api=async(path,options={})=>request(BASE+path,{...options,headers:{api_access_token:environment.ETISALNA_API_ACCESS_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),redirect:'error'});
 try{
  // Re-read the actual conversation; never choose a contact by fuzzy search.
  const check=await api('/conversations/'+body.conversation.id);
  if(!check.ok)throw Error('conversation_unavailable');
  const conv=await check.json();
  const phone=String(conv.meta?.sender?.phone_number||'').replace(/^\+/,'');
  if(conv.inbox_id!==40||String(conv.id)!==String(body.conversation.id)||phone!==record.p_reply_phone)throw Error('conversation_mismatch');
  if(conv.labels?.includes('coupon_bot_paused')){status='skipped';reason='conversation_paused';}
  else {
   const response=await api('/conversations/'+body.conversation.id+'/messages',{method:'POST',body:JSON.stringify({content:claim.message,message_type:'outgoing',private:false,content_type:'text'})});
   if(response.ok){const result=await response.json();if(id(result.id)&&result.private===false&&[1,'outgoing'].includes(result.message_type)&&result.status!=='failed'){status='accepted';reason='provider_accepted';messageId=String(result.id);}}
  }
 }catch{/* Keep ambiguous requests blocked; never retry automatically. */}
 await database(`crm_coupon_replies?id=eq.${claim.id}&merchant_id=eq.${MERCHANT_ID}&status=eq.sending`,{method:'PATCH',body:JSON.stringify({status,reason,provider_message_id:messageId})});
 return {status,reason,message_id:messageId,delivery_confirmed:false};
}
async function load(){
 const [settings,replies,conversations]=await Promise.all([
 sb(`crm_coupon_settings?merchant_id=eq.${MERCHANT_ID}&select=enabled,started_at,message&limit=1`),
 sb(`crm_coupon_replies?merchant_id=eq.${MERCHANT_ID}&select=id,conversation_id,status,reason,provider_message_id,created_at&order=created_at.desc&limit=100`),
 sb(`crm_coupon_conversations?merchant_id=eq.${MERCHANT_ID}&paused=eq.true&select=conversation_id`)]);
 return {configuration:settings[0]||{enabled:false,message:DEFAULT_MESSAGE},ready:!!process.env.ETISALNA_API_ACCESS_TOKEN,replies,conversations};
}
async function admin(req,res){
 if(req.method==='GET')return json(res,200,{ok:true,...await load()});
 const body=bodyObject(req);
 if(req.method==='PUT'){
  if(typeof body.enabled!=='boolean'||typeof body.message!=='string'||body.message.trim().length<20||body.message.length>2000)throw fail(400,'تحقق من نص الرسالة وإعداد التشغيل');
  if(body.enabled&&!process.env.ETISALNA_API_ACCESS_TOKEN)throw fail(400,'ربط واتساب غير جاهز');
  const previous=await sb(`crm_coupon_settings?merchant_id=eq.${MERCHANT_ID}&select=enabled,started_at&limit=1`);
  await sb('crm_coupon_settings?on_conflict=merchant_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({merchant_id:MERCHANT_ID,enabled:body.enabled,message:body.message.trim(),started_at:body.enabled&&!previous[0]?.enabled?new Date().toISOString():(previous[0]?.started_at||new Date().toISOString()),updated_at:new Date().toISOString()})});
 }else if(req.method==='POST'){
  if(!id(body.conversation_id)||typeof body.paused!=='boolean')throw fail(400,'رقم المحادثة غير صالح');
  await sb('crm_coupon_conversations?on_conflict=merchant_id,conversation_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({merchant_id:MERCHANT_ID,conversation_id:String(body.conversation_id),paused:body.paused})});
 }else return json(res,405,{ok:false,error:'Method not allowed'});
 return json(res,200,{ok:true,...await load()});
}
module.exports={classify,fromEvent,admin,DEFAULT_MESSAGE};
