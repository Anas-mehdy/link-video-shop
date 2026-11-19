const {models,components}=require('./postpurchase-auto');
const {inferPurchased}=require('./postpurchase-preview');
const {identityReason}=require('./postpurchase-identity');
const {fresh}=require('./postpurchase-stock');

const DAY=86400000;
// Verified Salla product IDs. The first Slim is the standard clear case;
// the second is MagSafe. Both qualify as Slim purchases.
const PRODUCTS={
 'iPhone 17 Pro':{slim:['1356124795','1128190372'],camera:'346332705',otherCameras:['767654530']},
 'iPhone 17 Pro Max':{slim:['508035157','2043217838'],camera:'457870329',otherCameras:['1957321005']},
 'iPhone 18 Pro':{slim:['321208074','1142994364'],camera:'1236296988',otherCameras:['2131685450','938053769']},
 'iPhone 18 Pro Max':{slim:['1724249566','474220781'],camera:'1936666261',otherCameras:['172683799','270594342']}
};
const catalogProfiles=new Map();
for(const [model,p] of Object.entries(PRODUCTS)){
 for(const id of p.slim)catalogProfiles.set(id,{model,components:['case']});
 for(const id of [p.camera,...p.otherCameras])catalogProfiles.set(id,{model,components:['camera_frame']});
}

function parse(raw,manual,catalog){
 const item={product_id:String(raw?.product?.id??raw?.product_id??''),variant_id:String(raw?.sku?.id??raw?.sku_id??''),name:raw?.name||raw?.product?.name||'',options:raw?.options||[]};
 const profile=manual.get(`${item.product_id}:${item.variant_id}`);
 const known=catalogProfiles.get(item.product_id);
 const cached=catalog.get(item.product_id);
 const inferred=inferPurchased(item,profile||known,cached);
 return {item,profile,known,inferred};
}

function trigger({item,known,inferred}){
 const p=PRODUCTS[inferred.model];
 if(!p||inferred.reason||inferred.excluded)return null;
 if(known&&known.model!==inferred.model)return null;
 if(inferred.component==='case'&&p.slim.includes(item.product_id))return {kind:'camera_flat',component:'camera_frame',ids:[p.camera]};
 if(inferred.component==='screen'||inferred.component==='camera_frame')return {kind:'slim_case',component:'case',ids:p.slim};
 return null;
}

function ownership(history,model,component){
 let needsReview=false;
 for(const items of history){
  if(!items){needsReview=true;continue;}
  for(const {item,profile,known,inferred} of items){
   if(inferred.model===model&&inferred.component===component)return 'already_owned';
   if(!inferred.reason&&inferred.excluded!=='bundle')continue;
   const devices=models(`${item.name} ${JSON.stringify(item.options)}`);
   const compatible=devices.length===0||devices.includes(model)||profile?.model===model||known?.model===model;
   if(!compatible)continue;
   const tags=profile?.components||known?.components||components(item.name);
   if(inferred.excluded==='bundle'&&devices.length===1&&devices[0]===model&&tags.includes(component))return 'already_owned';
   if(inferred.excluded==='bundle'&&profile?.model===model&&tags.includes(component))return 'already_owned';
   if(tags.length===0||tags.includes(component))needsReview=true;
  }
 }
 return needsReview?'purchase_review':null;
}

function offer(rule,model,live,stocks,now){
 const choices=rule.ids.flatMap(id=>{
  const p=live.get(id);
  if(!p||p.status!=='sale'||p.is_available!==true)return [];
  const device=models(p.name);
  if(device.length!==1||device[0]!==model)return [];
  const s=stocks.get(id);
  const stock=fresh(s,now)?s.available?'available':'unavailable'
   :s?.state==='error'&&Date.parse(s.retry_after)>now?'error':'unchecked';
  return [{id,name:p.name,stock}];
 });
 return ['available','unchecked','error','unavailable']
  .map(state=>choices.find(p=>p.stock===state)).find(Boolean)||null;
}

const priority={review_ready:0,stock_check_required:1,delay:2,stock_error:3,no_stock:4,already_owned:5,purchase_review:6,already_attempted:7,cooldown:8,optout:9};

function plan({orders,customers,optouts,settings,products,catalog,live,stocks,deliveries,now,mode}){
 const manual=new Map(products.filter(p=>p.origin==='manual').map(p=>[`${p.product_id}:${p.variant_id||''}`,p]));
 const cached=new Map(catalog.map(p=>[String(p.id),p]));
 const active=new Map(live.map(p=>[String(p.external_product_id),p]));
 const attempts=new Set(deliveries.map(d=>String(d.external_order_id)));
 const recent=new Set(deliveries.filter(d=>Date.parse(d.attempted_at)>now-(settings.cooldown_days||14)*DAY).map(d=>d.phone));
 const historyByPhone=new Map(),historyByCustomer=new Map(),inputs=[];
 for(const order of orders){
  const date=Date.parse(order.ordered_at);
  if(!Number.isFinite(date)||date>now||date<now-30*DAY)continue;
  if(['cancelled','canceled','refunded','restored','returned','failed','payment_pending'].includes(order.status_slug))continue;
  const customer=customers.get(order.customer_id);
  if(!customer)continue;
  const phone=String(customer.normalized_phone||customer.phone||'').replace(/\D/g,'');
  const verified=/^[1-9]\d{7,14}$/.test(phone)&&!identityReason(order,phone);
  const raw=order.source_payload?.items;
  const items=Array.isArray(raw)&&raw.length?raw.map(x=>parse(x,manual,cached)):null;
  const record={order,date,items};
  if(!historyByCustomer.has(order.customer_id))historyByCustomer.set(order.customer_id,[]);
  historyByCustomer.get(order.customer_id).push(record);
  if(!verified)continue;
  if(!historyByPhone.has(phone))historyByPhone.set(phone,[]);
  historyByPhone.get(phone).push(record);
  if(order.status_slug==='delivered'&&items?.length===1){
   const rule=trigger(items[0]);
   if(rule)inputs.push({record,phone,rule});
  }
 }
 const chosen=new Map();
 for(const {record,phone,rule} of inputs){
  const {order,date,items}=record,{item,inferred}=items[0];
  const history=[...new Set([...historyByPhone.get(phone),...historyByCustomer.get(order.customer_id)])]
   .filter(x=>x!==record).map(x=>x.items);
  const scheduled=date+settings.delay_days*DAY;
  const row={external_order_id:order.external_order_id,model:inferred.model,purchased_name:inferred.name||item.name,kind:rule.kind,offer:null,scheduled_for:new Date(scheduled).toISOString()};
  if(optouts.has(phone))row.reason='optout';
  else if(attempts.has(String(order.external_order_id)))row.reason='already_attempted';
  else if(recent.has(phone))row.reason='cooldown';
  else {
   row.reason=ownership(history,inferred.model,rule.component);
   if(!row.reason){
    row.offer=offer(rule,inferred.model,active,stocks,now);
    row.reason=scheduled>now?'delay':!row.offer||row.offer.stock==='unavailable'?'no_stock'
     :{available:'review_ready',unchecked:'stock_check_required',error:'stock_error'}[row.offer.stock];
   }
  }
  const previous=chosen.get(phone);
  if(!previous||priority[row.reason]<priority[previous.reason]||
   (priority[row.reason]===priority[previous.reason]&&row.scheduled_for>previous.scheduled_for))chosen.set(phone,row);
 }
 // An addressed customer stays in the targeted journey while the offer is held.
 // Keep numbers internal so the review endpoint only returns order and offer data.
 const rows=[...chosen.values()].sort((a,b)=>priority[a.reason]-priority[b.reason]||a.scheduled_for.localeCompare(b.scheduled_for));
 return {phones:new Set(chosen.keys()),preview:{mode,customers:chosen.size,rows}};
}

module.exports={plan};
