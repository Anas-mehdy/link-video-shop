const {sb,MERCHANT_ID,fail,redact,decryptCredentials}=require('./crm');
const paths={customers:'customers',orders:'orders',carts:'carts/abandoned'};
const eventNames=['customer.created','customer.updated','order.created','order.updated','order.status.updated','order.cancelled','order.refunded','abandoned.cart','abandoned.cart.created','abandoned.cart.update','abandoned.cart.updated','abandoned.cart.status.changed','abandoned.cart.purchased'];
const safeFail=(message)=>Object.assign(fail(503,message),{sallaSafe:true});
function id(value){
  if(typeof value==='number'&&!Number.isSafeInteger(value))throw safeFail('معرّف سلة تجاوز دقة الأرقام؛ لم تُحفظ بيانات غير دقيقة');
  const result=String(value??'');if(!/^\d{1,40}$/.test(result))throw safeFail('بيانات سلة لا تحتوي معرّفًا صالحًا');return result;
}
function date(value){
  if(!value)return undefined;
  const raw=typeof value==='object'?value.date:value;
  if(typeof raw!=='string')return undefined;
  let input=raw;
  if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)){
    const zone=value.timezone;
    if(zone&&zone!=='Asia/Riyadh'&&zone!=='UTC')throw safeFail('منطقة زمنية غير مدعومة في بيانات سلة');
    input=raw.replace(' ','T')+(zone==='UTC'?'Z':'+03:00');
  }
  const time=new Date(input);return Number.isFinite(time.getTime())?time.toISOString():undefined;
}
const clean=value=>Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined));
function phone(data){
  if(data.mobile==null)return undefined;
  let number=String(data.mobile).replace(/[^\d+]/g,'');
  const prefix=String(data.mobile_code??'').replace(/\D/g,'');
  if(!number.startsWith('+')&&prefix)number='+'+prefix+number.replace(/^0/,'');
  if(!number.startsWith('+')&&/^966\d{9}$/.test(number))number='+'+number;
  return number||null;
}
function amount(value){if(value==null)return undefined;const n=Number(value?.amount??value);if(!Number.isFinite(n))throw safeFail('مبلغ غير صالح من سلة');return n;}
function customer(data,fallback){
  return clean({external_customer_id:id(data.id),name:data.name??data.full_name??([data.first_name,data.last_name].filter(Boolean).join(' ')||undefined),first_name:data.first_name,last_name:data.last_name,phone:phone(data),normalized_phone:phone(data)?.replace(/\D/g,''),email:data.email,city:data.city,country_code:data.country_code,source_payload:redact(data),crm_source_at:date(data.updated_at)||fallback});
}
function record(resource,data,fallback,event){
  const common={source_payload:redact(data),crm_source_at:date(data.updated_at)||fallback};
  if(resource==='customers')return customer(data,fallback);
  const externalCustomer=data.customer?.id!=null?id(data.customer.id):undefined;
  if(resource==='orders'){
    const a=data.amounts||{};
    return clean({...common,external_order_id:id(data.id),_customer_external_id:externalCustomer,order_reference:data.reference_id==null?undefined:String(data.reference_id),status:typeof data.status==='object'?data.status?.name:data.status,status_slug:data.status?.slug,payment_method:data.payment_method,payment_status:data.payment_status,currency:data.total?.currency??data.currency,subtotal:amount(a.sub_total??a.subtotal),discount_amount:amount(a.total_discount),shipping_amount:amount(a.shipping_cost),tax_amount:amount(a.tax?.amount),total_amount:amount(data.total??a.total),ordered_at:date(data.date??data.created_at),source_updated_at:date(data.updated_at),source:data.source});
  }
  const status=event==='abandoned.cart.purchased'?'recovered':({purchased:'recovered',active:'active',recovered:'recovered',expired:'expired',cancelled:'cancelled',canceled:'cancelled'}[typeof data.status==='object'?data.status?.slug:data.status]);
  const who=data.customer||{};
  return clean({...common,external_cart_id:id(data.id??data.cart_id),_customer_external_id:externalCustomer,customer_name:who.name??who.full_name,phone:phone(who),normalized_phone:phone(who)?.replace(/\D/g,''),email:who.email,currency:data.total?.currency,subtotal:amount(data.subtotal),total_amount:amount(data.total),items_count:Array.isArray(data.items)?data.items.reduce((sum,x)=>sum+Math.max(0,Number(x.quantity)||0),0):undefined,checkout_url:data.checkout_url,status:status??(event==='abandoned.cart.status.changed'?undefined:'active'),abandoned_at:date(data.created_at),recovered_at:event==='abandoned.cart.purchased'?fallback:undefined});
}
// Preserve large JSON integer identifiers from API responses without changing strings.
function losslessJSON(text){
  return JSON.parse(text.replace(/("(?:\\.|[^"\\])*")|(-?\d{16,})(?=\s*[,}\]])/g,(match,string,number)=>string|| (Number.isSafeInteger(Number(number))?number:JSON.stringify(number))));
}
async function credentials(){
  const [connection]=await sb(`crm_connections?merchant_id=eq.${MERCHANT_ID}&provider=eq.salla&select=status,credentials_encrypted,token_expires_at`);
  if(connection?.status!=='connected'||!connection.credentials_encrypted)throw safeFail('لم يصل تفويض سلة بعد');
  if(connection.token_expires_at&&Date.parse(connection.token_expires_at)<=Date.now())throw safeFail('انتهت صلاحية تفويض سلة؛ يلزم تجديد التفويض');
  const tokens=decryptCredentials(connection.credentials_encrypted);
  if(!tokens.access_token)throw safeFail('تفويض سلة المحفوظ غير صالح');
  return tokens;
}
async function get(path,tokens){
  const response=await fetch(`https://api.salla.dev/admin/v2/${path}`,{headers:{Authorization:`Bearer ${tokens.access_token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok){
    if(response.status===401)throw safeFail('سلة رفضت التفويض؛ تحقق من صلاحية الاتصال');
    if(response.status===403)throw safeFail('صلاحيات التطبيق لا تسمح بقراءة هذه البيانات');
    if(response.status===429)throw safeFail('وصلنا لحد طلبات سلة مؤقتًا؛ أعد المحاولة لاحقًا');
    throw safeFail('تعذر جلب البيانات من سلة؛ أعد المحاولة لاحقًا');
  }
  const result=losslessJSON(await response.text());
  if(result.success===false||!result.data)throw safeFail('استجابة سلة غير مكتملة');return result;
}
async function apply(resource,records,eventId=null){
  return sb('rpc/crm_apply_salla_records',{method:'POST',body:JSON.stringify({p_resource:resource,p_records:records,p_event_id:eventId})});
}
async function save(resource,data,fallback,event,eventId=null){
  const records=data.map(d=>record(resource,d,fallback,event));
  if(resource!=='customers'){
    const customers=new Map();for(const d of data)if(d.customer?.id!=null)customers.set(id(d.customer.id),customer(d.customer,fallback));
    if(customers.size)await apply('customers',[...customers.values()]);
  }
  return apply(resource,records,eventId);
}
function nextPage(pagination,page,length){
  if(pagination?.totalPages!=null&&Number.isInteger(Number(pagination.totalPages)))return page<Number(pagination.totalPages)?page+1:null;
  if(pagination&&Object.hasOwn(pagination,'next'))return pagination.next?page+1:null;
  // A final empty page is safe when Salla omits pagination metadata.
  return length?page+1:null;
}
async function page(body){
  const resource=body.resource,number=body.page??1;
  if(!Object.hasOwn(paths,resource)||!Number.isInteger(number)||number<1||number>10000)throw fail(400,'طلب مزامنة غير صالح');
  const fallback=new Date().toISOString(),tokens=await credentials();
  const params=new URLSearchParams({page:String(number),per_page:'30'});
  const result=await get(`${paths[resource]}?${params}`,tokens);
  if(!Array.isArray(result.data))throw safeFail('سلة لم ترجع قائمة سجلات');
  const saved=await save(resource,result.data,fallback);
  return {resource,page:number,read:result.data.length,saved,next_page:nextPage(result.pagination,number,result.data.length)};
}
async function processEvents(eventId){
  const started=Date.now();
  const query=new URLSearchParams({merchant_id:`eq.${MERCHANT_ID}`,records_synced_at:'is.null',event_name:`in.(${eventNames.join(',')})`,select:'id,event_name,payload,occurred_at',order:'occurred_at.asc,received_at.asc',limit:eventId?'1':'10'});
  if(eventId)query.set('id',`eq.${eventId}`);
  const events=await sb(`crm_event_inbox?${query}`);let processed=0;
  for(const e of events){
    const resource=e.event_name.startsWith('order.')?'orders':e.event_name.startsWith('customer.')?'customers':'carts';
    const data=e.payload.data;
    // Current full order details also support status-only notifications.
    const current=resource==='orders'?(await get(`orders/${id(data.id??data.order_id)}`,await credentials())).data:data;
    await save(resource,[current],e.occurred_at,e.event_name,e.id);processed++;
    if(Date.now()-started>20000)break;
  }
  return {processed,has_more:!eventId&&(processed<events.length||events.length===10)};
}
async function stats(){return sb('rpc/crm_salla_sync_stats',{method:'POST',body:'{}'});}
module.exports={page,processEvents,stats,record,customer,date,phone,losslessJSON,nextPage,supports:event=>eventNames.includes(event)};
