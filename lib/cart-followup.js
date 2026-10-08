const {sb,MERCHANT_ID,fail}=require('./crm');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function settings(){const rows=await sb(`crm_cart_followup_settings?merchant_id=eq.${MERCHANT_ID}&select=enabled,started_at,delay_minutes&limit=1`);return rows[0]||{enabled:false,started_at:null,delay_minutes:60};}
async function refresh(){return sb('rpc/crm_cart_followup_refresh',{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID})});}
async function load(){
 try{
  const [configuration,queue,workspace]=await Promise.all([settings(),sb(`crm_cart_followups?merchant_id=eq.${MERCHANT_ID}&select=id,scheduled_for,status,reason,simulated_at,created_at,abandoned_carts(customer_name,external_cart_id,checkout_url,phone)&order=created_at.desc&limit=100`),require('./whatsapp-workspace').load()]);
  const template=workspace.configuration.templates.find(t=>t.id==='cart').body;
  return {storage_ready:true,configuration,mode:'dry_run',queue:queue.map(row=>{
   const cart=row.abandoned_carts||{};return {id:row.id,scheduled_for:row.scheduled_for,status:row.status,reason:row.reason,simulated_at:row.simulated_at,customer_name:cart.customer_name||'عميل لنك',cart_id:String(cart.external_cart_id||''),message:template.replace(/{{\s*(\w+)\s*}}/g,(_,key)=>({customer_name:cart.customer_name||'عميل لنك',cart_url:cart.checkout_url||'[رابط غير متاح]'}[key]||'[متغير غير متاح]'))};
  })};
 }catch(e){if(/PGRST205|PGRST200|42P01/.test(e.message))return {storage_ready:false,configuration:{enabled:false,started_at:null,delay_minutes:60},mode:'dry_run',queue:[]};throw e;}
}
async function save(body){
 if(typeof body.enabled!=='boolean'||!Number.isInteger(body.delay_minutes)||body.delay_minutes<1||body.delay_minutes>1440)throw fail(400,'اختر مدة بين دقيقة و1440 دقيقة');
 const old=await settings();await sb('crm_cart_followup_settings?on_conflict=merchant_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({merchant_id:MERCHANT_ID,enabled:body.enabled,delay_minutes:body.delay_minutes,started_at:old.started_at||(body.enabled?new Date().toISOString():null),updated_at:new Date().toISOString()})});
 await refresh();return load();
}
async function optout(body){
 if(!UUID.test(body.id||''))throw fail(400,'سجل متابعة غير صالح');
 const rows=await sb(`crm_cart_followups?id=eq.${body.id}&merchant_id=eq.${MERCHANT_ID}&select=abandoned_carts(phone,normalized_phone)&limit=1`);
 const cart=rows[0]?.abandoned_carts,phone=String(cart?.normalized_phone||cart?.phone||'').replace(/\D/g,'');
 if(!/^[1-9]\d{7,14}$/.test(phone))throw fail(400,'رقم العميل غير متاح');
 await sb('crm_whatsapp_optouts?on_conflict=merchant_id,phone',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({merchant_id:MERCHANT_ID,phone})});await refresh();return load();
}
module.exports={load,save,refresh,optout};
