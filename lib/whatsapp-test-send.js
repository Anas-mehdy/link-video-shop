const { sb, MERCHANT_ID, fail } = require('./crm');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function payload(record) {
 if (!/^[1-9]\d{7,14}$/.test(record.phone || '') || !/^https:\/\/mtjr\.at\/[A-Za-z0-9_-]+$/.test(record.checkout_url || '')) throw fail(400,'Invalid test cart');
 const name=String(record.customer_name||'عميل لنك').replace(/[\r\n\t]+/g,' ').trim().slice(0,100)||'عميل لنك';
 return { inbox_id:40,type:'whatsapp_template',contact:{name,phone_number:'+'+record.phone},message:{whatsapp_template:{name:'link_abandoned_cart_ar',language:{code:'ar'},components:[
  {type:'body',parameters:[{type:'text',text:name}]},
  {type:'button',sub_type:'quick_reply',index:'0',parameters:[{type:'payload',payload:'unsubscribe'}]},
  {type:'button',sub_type:'url',index:'1',parameters:[{type:'text',text:record.checkout_url.slice('https://mtjr.at/'.length)}]}
 ]}}};
}
async function send(body,{database=sb,request=fetch,environment=process.env}={}) {
 if(!UUID.test(body.cart_id||'') || body.confirm_test !== true)throw fail(400,'أدخل معرّف سلتك وأكّد تجربة الإرسال');
 const phone=environment.WHATSAPP_TEST_PHONE||'',token=environment.ETISALNA_API_ACCESS_TOKEN;
 if(!/^[1-9]\d{7,14}$/.test(phone)||!token)throw fail(503,'جهّز WHATSAPP_TEST_PHONE وETISALNA_API_ACCESS_TOKEN');
 const record=await database('rpc/crm_claim_whatsapp_test',{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID,p_cart_id:body.cart_id,p_test_phone:phone})});
 if(record.blocked)return {mode:'test',sent:false,blocked:record.blocked};
 let accepted=false,messageId=null;
 try {
  const message=payload(record);
  // The DB result must also match the server allowlist before any provider IO.
  if(record.phone!==phone||!UUID.test(record.id||''))throw new Error('Invalid claim');
  const response=await request('https://business.etisalna.com/developer/api/v1/messages',{method:'POST',headers:{'Content-Type':'application/json',api_access_token:token,api_account_id:'12'},body:JSON.stringify(message),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(response.status===201){const result=await response.json();if(Number.isSafeInteger(result.message_id)&&result.message_id>0){accepted=true;messageId=String(result.message_id);}}
 } catch { /* Timeout or malformed result is ambiguous: never retry automatically. */ }
 await database(`crm_whatsapp_test_sends?id=eq.${record.id}&merchant_id=eq.${MERCHANT_ID}&status=eq.sending`,{method:'PATCH',body:JSON.stringify({status:accepted?'accepted':'unknown',provider_message_id:messageId,updated_at:new Date().toISOString()})});
 return {mode:'test',sent:accepted,delivery_confirmed:false,status:accepted?'accepted':'unknown',message_id:messageId};
}
module.exports={payload,send};
