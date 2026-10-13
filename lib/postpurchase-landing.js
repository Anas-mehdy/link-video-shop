const crypto=require('node:crypto');
const {sb,MERCHANT_ID,fail}=require('./crm');
const {buildPreview,inferPurchased,loadCatalog,loadRows}=require('./postpurchase-preview');
const {models,components}=require('./postpurchase-auto');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function key(environment){const hex=environment.CRM_ENCRYPTION_KEY;if(!/^[a-f0-9]{64}$/i.test(hex||''))throw fail(503,'مفتاح الروابط غير مهيأ');return Buffer.from(hex,'hex');}
function seal(orderId,{environment=process.env,now=Date.now()}={}){
 if(!UUID.test(orderId))throw fail(400,'طلب غير صالح');
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(environment),iv);
 cipher.setAAD(Buffer.from(`link-complete:v1:${MERCHANT_ID}`));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({id:orderId,exp:now+90*86400000})),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
function unseal(token,{environment=process.env,now=Date.now()}={}){
 try{
  if(typeof token!=='string'||!/^[-_A-Za-z0-9]{80,300}$/.test(token))throw Error();
  const bytes=Buffer.from(token,'base64url'),decipher=crypto.createDecipheriv('aes-256-gcm',key(environment),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));decipher.setAAD(Buffer.from(`link-complete:v1:${MERCHANT_ID}`));
  const claims=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
  if(!UUID.test(claims.id)||!Number.isSafeInteger(claims.exp)||claims.exp<=now)throw Error();return claims.id;
 }catch{throw fail(404,'الرابط غير متاح أو انتهت صلاحيته');}
}
function item(raw){return {product_id:String(raw.product?.id??raw.product_id??''),variant_id:String(raw.sku?.id??raw.sku_id??''),name:raw.name||raw.product?.name||'',options:raw.options||[]};}
async function data(order,{database=sb,stockFilter=true,prepared}={}){
 if(!order||!order.customer_id||order.status_slug!=='delivered'||!UUID.test(order.customer_id))throw fail(404,'هذه الصفحة غير متاحة');
 const items=order.source_payload?.items;if(!Array.isArray(items)||items.length!==1)throw fail(400,'هذه المرحلة مخصصة لشراء منتج واحد');
 const filter=`merchant_id=eq.${MERCHANT_ID}`;
 const [products,rules,suggestions,catalog,live,later]=prepared?[prepared.products,prepared.rules,prepared.suggestions,prepared.catalog,prepared.live,prepared.later]:await Promise.all([
  loadRows(database,`crm_postpurchase_products?${filter}&select=*&order=product_id.asc,variant_id.asc`),
  loadRows(database,`crm_postpurchase_rules?${filter}&select=*&order=id.asc`),
  loadRows(database,`crm_postpurchase_suggestions?${filter}&select=product_id,variant_id,decision&order=product_id.asc,variant_id.asc`),
  loadCatalog(database,MERCHANT_ID),
  loadRows(database,`products?${filter}&select=external_product_id,name,status,is_available,url,thumbnail_url,main_image_url,price,sale_price,currency,updated_at&order=external_product_id.asc`),
  database(`orders?${filter}&customer_id=eq.${order.customer_id}&ordered_at=gt.${encodeURIComponent(order.ordered_at)}&status_slug=not.in.(cancelled,canceled,refunded)&select=source_payload&order=ordered_at.desc&limit=201`)
 ]);
 const cached=new Map(catalog.map(p=>[String(p.id),p])),purchase=item(items[0]);
 const profile=products.find(p=>p.origin==='manual'&&p.product_id===purchase.product_id&&String(p.variant_id||'')===purchase.variant_id);
 const inferred=inferPurchased(purchase,profile,cached.get(purchase.product_id));
 if(!inferred.model||!inferred.component)throw fail(400,'موديل المنتج أو نوع الحماية يحتاج مراجعة قبل إنشاء الصفحة');
 if(later.length>200)throw fail(503,'تعذر مراجعة جميع المشتريات اللاحقة');
 const owned=new Set([inferred.component]);
 for(const next of later){
  if(!Array.isArray(next.source_payload?.items))throw fail(503,'تحتاج مشترياتك الأخيرة مراجعة قبل عرض اقتراحات جديدة');
  for(const raw of next.source_payload.items){
   const bought=item(raw),manual=products.find(p=>p.origin==='manual'&&p.product_id===bought.product_id&&String(p.variant_id||'')===bought.variant_id);
   const parsed=inferPurchased(bought,manual,cached.get(bought.product_id));
   if(parsed.model===inferred.model&&parsed.component)owned.add(parsed.component);
   else {
    const device=models(bought.name+' '+JSON.stringify(bought.options)),tags=components(bought.name);
    if(device.length===1&&device[0]===inferred.model&&tags.length)tags.forEach(tag=>owned.add(tag));
    else if((parsed.reason&&(!device.length||device.includes(inferred.model)))||(parsed.excluded==='bundle'&&device.includes(inferred.model)&&!tags.length))throw fail(503,'تحتاج مشترياتك الأخيرة مراجعة قبل عرض اقتراحات جديدة');
   }
  }
 }
 const context={rows:[{external_order_id:order.external_order_id,item:purchase,reason:'stock_check_required'}],scanned_orders:1,single_product_orders:1};
 const preview=buildPreview(context,products,rules,suggestions,catalog,{allOffers:true});
 const current=new Map(live.map(p=>[String(p.external_product_id),p])),seen=new Set();
 const cards=preview.rows.flatMap(r=>{
  const p=current.get(r.offer_product_id),c=cached.get(r.offer_product_id);
  if(!r.offer_product_id||owned.has(r.component)||!p||p.status!=='sale'||!p.is_available||seen.has(r.offer_product_id))return [];
  if(!(Number(p.sale_price)>0)&&p.price==null)return [];
  const price=Number(p.sale_price)>0?Number(p.sale_price):Number(p.price);if(!Number.isFinite(price)||price<0||!['SAR',undefined,null].includes(p.currency))return [];
  seen.add(r.offer_product_id);
  return [{id:r.offer_product_id,name:p.name||r.offer_name,component:r.component,url:r.product_url,image:p.main_image_url||p.thumbnail_url||null,price,currency:'SAR',has_options:!!(c?.options?.length||c?.has_skus),catalog_updated_at:p.updated_at}];
 });
 const stock=require('./postpurchase-stock'),checked=stockFilter?await stock.load(cards.map(p=>p.id),{database}):null;
 const stockMap=new Map((checked||[]).map(r=>[r.product_id,r]));
 const visible=stockFilter?cards.filter(p=>{const r=stockMap.get(p.id);return !r||(r.state==='checked'&&r.available);}):cards;
 for(const p of visible){const r=stockMap.get(p.id);if(stock.fresh(r)){const v=r.snapshot;if(v.currency==='SAR'&&v.price!==null){p.price=v.sale_price>0?v.sale_price:v.price;}p.stock_checked_at=r.checked_at;}}
 // Storefront-safe response only: no name, phone, customer or order identifiers.
 return {model:inferred.model,owned_components:[...owned],products:visible,source:'saved_catalog',live_stock_checked:visible.length>0&&visible.every(p=>stock.fresh(stockMap.get(p.id)))};
}
async function create(body,{database=sb,environment=process.env,now=Date.now()}={}){
 if(!/^\d{1,20}$/.test(body.external_order_id||''))throw fail(400,'اختر طلبًا صالحًا');
 const [order]=await database(`orders?merchant_id=eq.${MERCHANT_ID}&external_order_id=eq.${body.external_order_id}&select=id,external_order_id,customer_id,status_slug,ordered_at,source_payload&limit=1`);
 if(!order||Date.parse(order.ordered_at)<now-30*86400000)throw fail(400,'اختر طلبًا مسلّمًا من آخر 30 يومًا');
 const preview=await data(order,{database});if(!preview.products.length)throw fail(400,'لا توجد منتجات مكملة متاحة في الكتالوج المحفوظ');
 return {path:'/complete/'+seal(order.id,{environment,now}),products:preview.products.length,model:preview.model};
}
async function read(token,{database=sb,environment=process.env,now=Date.now()}={}){
 const id=unseal(token,{environment,now});
 const [order]=await database(`orders?merchant_id=eq.${MERCHANT_ID}&id=eq.${id}&select=external_order_id,customer_id,status_slug,ordered_at,source_payload&limit=1`);
 return data(order,{database});
}
module.exports={seal,unseal,create,read,data};
