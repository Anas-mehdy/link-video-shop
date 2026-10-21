const {identityReason}=require('./postpurchase-identity');
const {sb,MERCHANT_ID,fail}=require('./crm');
const {loadRows,loadCatalog,inferPurchased}=require('./postpurchase-preview');
const {fresh}=require('./postpurchase-stock');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function phone(c){return String(c?.normalized_phone||c?.phone||'').replace(/\D/g,'');}
async function evaluate({orders,customers,optouts,settings,products,rules,suggestions,catalog,live,stockRows,deliveries=[]}, {now=Date.now(),pageData=require('./postpurchase-landing').data}={}){
 if(!settings||!Number.isInteger(settings.delay_days)||settings.delay_days<1||settings.delay_days>30)throw fail(503,'إعدادات موعد المتابعة غير جاهزة');
 const customerMap=new Map(customers.map(c=>[c.id,c])),stopped=new Set(optouts.map(x=>x.phone)),stocks=new Map((stockRows||[]).map(s=>[s.product_id,s]));
 const groups=new Map();for(const o of orders){const list=groups.get(o.customer_id)||[];list.push(o);groups.set(o.customer_id,list);}
 const rows=[];
 for(const o of [...orders].sort((a,b)=>Date.parse(a.ordered_at)-Date.parse(b.ordered_at)||String(a.id).localeCompare(String(b.id)))){
  const c=customerMap.get(o.customer_id),number=phone(c),items=o.source_payload?.items,scheduled=Date.parse(o.ordered_at)+settings.delay_days*86400000;
  const row={external_order_id:o.external_order_id,customer_name:c?.name||'بدون اسم',phone_hint:number?'…'+number.slice(-4):'—',purchased_name:Array.isArray(items)&&items[0]?(items[0].name||items[0].product?.name||''):'',ordered_at:o.ordered_at,scheduled_for:Number.isFinite(scheduled)?new Date(scheduled).toISOString():null,model:null,products:[],reason:null,eligible:false};
  if(!Number.isFinite(Date.parse(o.ordered_at))||Date.parse(o.ordered_at)>now||Date.parse(o.ordered_at)<now-30*86400000)row.reason='outside_window';
  else if(o.status_slug!=='delivered')row.reason='not_delivered';
  else if(!Array.isArray(items)||items.length!==1)row.reason='multiple_products';
  else if(!UUID.test(o.customer_id||'')||!c)row.reason='customer_missing';
  else if(!/^[1-9]\d{7,14}$/.test(number))row.reason='phone_missing';
  else if(identityReason(o,number))row.reason=identityReason(o,number);
  else if(stopped.has(number))row.reason='optout';
  else if(deliveries.some(d=>d.external_order_id===o.external_order_id))row.reason='already_attempted';
  else if(deliveries.some(d=>d.phone===number&&Date.parse(d.attempted_at)>now-(settings.cooldown_days||14)*86400000))row.reason='cooldown';
  else {
   const raw=items[0],item={product_id:String(raw.product?.id??raw.product_id??''),variant_id:String(raw.sku?.id??raw.sku_id??''),name:raw.name||raw.product?.name||'',options:raw.options||[]};
   const manual=products.find(p=>p.origin==='manual'&&p.product_id===item.product_id&&String(p.variant_id||'')===item.variant_id),cached=catalog.find(p=>String(p.id)===item.product_id),inferred=inferPurchased(item,manual,cached);
   if(inferred.excluded||inferred.reason){row.reason=inferred.excluded==='bundle'?'bundle_excluded':inferred.excluded==='unsupported_model'?'unsupported_model':inferred.excluded?'outside_scope':'classification_review';rows.push(row);continue;}
   const later=(groups.get(o.customer_id)||[]).filter(x=>Date.parse(x.ordered_at)>Date.parse(o.ordered_at)&&!['cancelled','canceled','refunded'].includes(x.status_slug));
   try{
    const page=await pageData(o,{stockFilter:false,prepared:{products,rules,suggestions,catalog,live,later}});
    row.model=page.model;row.owned_components=page.owned_components;
    row.products=page.products.map(p=>{const s=stocks.get(p.id);return {id:p.id,name:p.name,component:p.component,stock:fresh(s,now)?s.available?'available':'unavailable':s?.state==='error'&&Date.parse(s.retry_after)>now?'error':'unchecked'};});
    if(!row.products.length)row.reason=later.length?'no_remaining_complements':'no_complementary_offer';
    else if(scheduled>now)row.reason='delay';
    else if(row.products.some(p=>p.stock==='error'))row.reason='stock_error';
    else if(row.products.some(p=>p.stock==='unchecked')){row.reason='stock_check_required';row.eligible=true;}
    else if(row.products.every(p=>p.stock==='unavailable'))row.reason='no_stock';
    else {row.reason='review_ready';row.eligible=true;}
   }catch(e){if(e.statusCode===400)row.reason='classification_review';else if(e.statusCode===503)row.reason='later_purchase_review';else throw e;}
  }
  row._phone=number;rows.push(row);
 }
 // One prospective message per phone; prefer a due order with checked stock,
 // then the oldest due order. Waiting or excluded orders never suppress a due one.
 const chosen=new Map();
 for(const row of rows.filter(x=>x.eligible).sort((a,b)=>(a.reason==='review_ready'?0:1)-(b.reason==='review_ready'?0:1)||Date.parse(a.scheduled_for)-Date.parse(b.scheduled_for))){
  if(chosen.has(row._phone)){row.eligible=false;row.reason='duplicate_customer';row.covered_by_order=chosen.get(row._phone);}
  else chosen.set(row._phone,row.external_order_id);
 }
 rows.forEach(r=>delete r._phone);
 const counts={};for(const r of rows)counts[r.reason]=(counts[r.reason]||0)+1;
 return {mode:'eligibility_review',scanned_orders:rows.length,eligible_customers:chosen.size,stock_ready:counts.review_ready||0,needs_stock:counts.stock_check_required||0,counts,rows,salla_requests:0,messages_sent:0,production_enabled:false,reviewed_at:new Date(now).toISOString(),delay_days:settings.delay_days};
}
async function review({database=sb,now=Date.now()}={}){
 const filter=`merchant_id=eq.${MERCHANT_ID}`,from=new Date(now-30*86400000).toISOString();
 const [orders,s,products,rules,suggestions,catalog,live,optouts]=await Promise.all([
  loadRows(database,`orders?${filter}&ordered_at=gte.${encodeURIComponent(from)}&select=id,external_order_id,customer_id,status_slug,ordered_at,source_payload&order=ordered_at.asc,id.asc`),
  database(`crm_postpurchase_settings?${filter}&select=delay_days,cooldown_days&limit=1`),
  loadRows(database,`crm_postpurchase_products?${filter}&select=*&order=product_id.asc,variant_id.asc`),
  loadRows(database,`crm_postpurchase_rules?${filter}&select=*&order=id.asc`),
  loadRows(database,`crm_postpurchase_suggestions?${filter}&select=product_id,variant_id,decision&order=product_id.asc,variant_id.asc`),
  loadCatalog(database,MERCHANT_ID),
  loadRows(database,`products?${filter}&select=external_product_id,name,status,is_available,url,thumbnail_url,main_image_url,price,sale_price,currency,updated_at&order=external_product_id.asc`),
  loadRows(database,`crm_whatsapp_optouts?${filter}&select=phone&order=phone.asc`)
 ]);
 const ids=[...new Set(orders.map(o=>o.customer_id).filter(x=>UUID.test(x||'')))],customers=[];
 for(let i=0;i<ids.length;i+=100)customers.push(...await database(`customers?${filter}&id=in.(${ids.slice(i,i+100).join(',')})&select=id,name,phone,normalized_phone&limit=100`));
 let stockRows;try{stockRows=await loadRows(database,`crm_pp_stock_cache?${filter}&select=product_id,state,available,checked_at,retry_after&order=product_id.asc`);}catch(e){if(['42P01','PGRST205'].includes(e.code)||/"code"\s*:\s*"(?:42P01|PGRST205)"/.test(e.message||''))stockRows=[];else throw e;}
 const deliveryFrom=new Date(now-Math.max(30,s[0]?.cooldown_days||14)*86400000).toISOString();
 let deliveries=[];try{deliveries=await loadRows(database,'crm_pp_deliveries?'+filter+'&attempted_at=gte.'+encodeURIComponent(deliveryFrom)+'&select=external_order_id,phone,attempted_at&order=attempted_at.desc,id.desc');}catch(e){if(!(['42P01','PGRST205'].includes(e.code)||/PGRST205|42P01/.test(e.message||'')))throw e;}
 return evaluate({deliveries,orders,customers,optouts,settings:s[0],products,rules,suggestions,catalog,live,stockRows},{now});
}
module.exports={review,evaluate};
