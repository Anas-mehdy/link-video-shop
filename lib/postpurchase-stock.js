const {sb,MERCHANT_ID,fail,decryptCredentials}=require('./crm');
const {losslessJSON}=require('./salla-sync');
const ID=/^\d{1,20}$/;
const safeFail=message=>Object.assign(fail(503,message),{stockSafe:true});
function id(v){if(typeof v==='number'&&!Number.isSafeInteger(v))throw Error('unsafe id');const s=String(v??'');if(!ID.test(s))throw Error('invalid id');return s;}
function quantity(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;}
function money(v){return quantity(v?.amount??v);}
function snapshot(p,expected){
 if(!p||id(p.id)!==expected||typeof p.is_available!=='boolean'||typeof p.status!=='string')throw Error('invalid product');
 if(p.managed_by_branches===true)throw Error('branch stock needs review');
 const skus=(Array.isArray(p.skus)?p.skus:[]).map(s=>({id:id(s.id),quantity:quantity(s.stock_quantity),unlimited:s.unlimited_quantity===true,option_values:(s.related_option_values||[]).map(id)}));
 const q=quantity(p.quantity),positive=skus.length?skus.some(s=>s.unlimited||s.quantity>0):p.unlimited_quantity===true||q>0;
 return {id:expected,status:p.status,available:p.status==='sale'&&p.is_available&&positive,quantity:q,unlimited:p.unlimited_quantity===true,skus,price:money(p.price),sale_price:money(p.sale_price),currency:p.price?.currency||null};
}
function missing(e){return ['42P01','PGRST205'].includes(e.code)||/"code"\s*:\s*"(?:42P01|PGRST205)"/.test(e.message||'');}
async function load(ids,{database=sb}={}){
 const unique=[...new Set(ids.map(id))];if(!unique.length)return [];
 try{return await database(`crm_pp_stock_cache?merchant_id=eq.${MERCHANT_ID}&product_id=in.(${unique.join(',')})&select=product_id,state,available,snapshot,checked_at,retry_after,lease_until`);}catch(e){if(missing(e))return null;throw e;}
}
function fresh(row,now=Date.now()){return row?.state==='checked'&&Date.parse(row.checked_at)>now-4*3600000;}
async function tokens(database){const [c]=await database(`crm_connections?merchant_id=eq.${MERCHANT_ID}&provider=eq.salla&select=status,credentials_encrypted,token_expires_at`);if(c?.status!=='connected'||!c.credentials_encrypted||c.token_expires_at&&Date.parse(c.token_expires_at)<=Date.now())throw safeFail('تفويض سلة غير جاهز أو منتهي');const t=decryptCredentials(c.credentials_encrypted);if(!t.access_token)throw safeFail('تفويض سلة غير صالح');return t;}
async function checkIds(ids,{database=sb,request=fetch,getTokens=tokens,now=Date.now()}={}){
 const unique=[...new Set(ids.map(id))];if(unique.length>60)throw fail(400,'الفحص محدود إلى 60 منتجًا مكملًا');
 const rows=await load(unique,{database});if(rows===null)throw safeFail('شغّل crm-postpurchase-stock.sql مرة واحدة قبل الفحص؛ لم نطلب سلة');
 const cache=new Map(rows.map(r=>[r.product_id,r]));let requests=0,used=null,budget=null,reason=null,credentials=null;
 for(const productId of unique){
  const old=cache.get(productId);if(fresh(old,now))continue;
  if(Date.parse(old?.retry_after)>now){reason='retry_later';continue;}
  if(Date.parse(old?.lease_until)>now){reason='busy';continue;}
  if(requests>=2)break;
  credentials??=await getTokens(database);
  const claim=await database('rpc/crm_pp_stock_reserve',{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID,p_product_id:productId})});used=claim.requests;budget=claim.budget;
  if(claim.reason!=='reserved'){reason=claim.reason;if(['budget_limit','not_configured'].includes(reason))break;continue;}
  requests++;let data=null,error=false;
  try{
   const r=await request(`https://api.salla.dev/admin/v2/products/${productId}`,{headers:{Authorization:`Bearer ${credentials.access_token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!r.ok)throw Error('provider');const result=losslessJSON(await r.text());if(result.success!==true)throw Error('response');data=snapshot(result.data,productId);
  }catch{error=true;reason='provider_error';}
  const saved=await database('rpc/crm_pp_stock_finish',{method:'POST',body:JSON.stringify({p_merchant_id:MERCHANT_ID,p_product_id:productId,p_token:claim.token,p_snapshot:data||{},p_error:error})});
  if(saved!==true)throw safeFail('تعذر تأكيد حفظ الفحص؛ توقفنا دون إعادة طلب سلة');
  if(error)break;
 }
 if(used===null){const month=new Date(now+3*3600000).toISOString().slice(0,7)+'-01';const [usage]=await database(`crm_pp_stock_usage?merchant_id=eq.${MERCHANT_ID}&month=eq.${month}&select=requests&limit=1`);used=usage?.requests??0;}
 const current=await load(unique,{database});if(current===null)throw safeFail('تعذر قراءة سجل الفحص');const currentMap=new Map(current.map(r=>[r.product_id,r]));
 const results=unique.map(productId=>{const r=currentMap.get(productId);return {product_id:productId,status:fresh(r,now)?r.available?'available':'unavailable':r?.state==='error'?'error':Date.parse(r?.lease_until)>now?'busy':'pending',checked_at:r?.checked_at||null};});
 const pending=results.some(r=>r.status==='pending');
 return {mode:'stock_check',results,salla_requests:requests,monthly_requests:used,budget,reason,has_more:pending&&!['budget_limit','not_configured','provider_error','busy','retry_later'].includes(reason),messages_sent:0};
}
async function check(body,options={}){
 if(!ID.test(body.external_order_id||''))throw fail(400,'اختر طلبًا للفحص');
 const database=options.database||sb;
 const [order]=await database(`orders?merchant_id=eq.${MERCHANT_ID}&external_order_id=eq.${body.external_order_id}&select=external_order_id,customer_id,status_slug,ordered_at,source_payload&limit=1`);
 if(!order||Date.parse(order.ordered_at)<Date.now()-30*86400000)throw fail(400,'اختر طلبًا مسلّمًا من آخر 30 يومًا');
 const page=await require('./postpurchase-landing').data(order,{database,stockFilter:false});
 const ids=page.products.map(p=>p.id);const result=await checkIds(ids,options);
 return {...result,model:page.model,results:result.results.map(r=>({...r,name:page.products.find(p=>p.id===r.product_id)?.name||r.product_id}))};
}
module.exports={snapshot,load,fresh,checkIds,check};
