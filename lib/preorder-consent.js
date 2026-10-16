// Conservative evidence comparison. Browser interaction is not authenticated identity.
// No customer/phone/name matching, side effects, or guessed product identifiers.
const crypto=require('node:crypto');
const ID=/^\d{1,40}$/;
function id(v){if(typeof v==='number'&&!Number.isSafeInteger(v))throw Error('unsafe_id');if(!['string','number'].includes(typeof v)||!ID.test(String(v)))throw Error('missing_id');return String(v);}
const stable=x=>JSON.stringify(x);
function options(values,source='cart'){
 if(!Array.isArray(values)||values.length>50)throw Error('options_incomplete');
 const seen=new Set();
 return values.map(o=>{
  if(!o||typeof o!=='object'||Array.isArray(o)||o.options?.length)throw Error('options_incomplete');
  // Merchant option.id identifies an order-item option; product_option_id is
  // the product option. Never equate these two native identifier namespaces.
  const key=id(source==='order'?o.product_option_id:(o.product_option_id??o.option_id??o.id));
  if(seen.has(key))throw Error('duplicate_option');seen.add(key);
  const raw=o.value;let value;
  if(typeof raw==='string'&&raw.length>0&&raw.length<=300)value=raw.normalize('NFC');
  else if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&typeof raw.name==='string'&&raw.name.length>0&&raw.name.length<=300)value=raw.name.normalize('NFC');
  else throw Error('options_incomplete');
  return {id:key,value};
 }).sort((a,b)=>a.id.localeCompare(b.id));
}
function lines(items,source='cart'){
 if(!Array.isArray(items)||items.length<1||items.length>100)throw Error('items_incomplete');
 return items.map(r=>{
  const product=id(r.product_id??r.product?.id),quantity=r.quantity;
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100000)throw Error('quantity_invalid');
  // Explicit [] is required: omission is not evidence that a product has no options.
  const selected=options(r.options,source);
  const rawSku=r.product_sku_id??r.sku_id??r.sku?.id;
  const sku=rawSku==null?'':id(rawSku);
  if(r.attachments?.length||r.notes)throw Error('customization_needs_review');
  return {product,quantity,sku,options:selected};
 }).sort((a,b)=>stable(a).localeCompare(stable(b)));
}
function fingerprint(items,source='cart'){return crypto.createHash('sha256').update(stable(lines(items,source))).digest('hex');}
function schedules(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('schedule_missing');
 const seen=new Set(),date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 return rows.map(r=>{
  const product=id(r.product_id);
  if(seen.has(product)||!Number.isSafeInteger(r.revision)||r.revision<1||![r.expected_arrival,r.ship_from,r.ship_by].every(date)||r.expected_arrival>r.ship_from||r.ship_from>r.ship_by)throw Error('schedule_invalid');
  seen.add(product);return {product_id:product,revision:r.revision,expected_arrival:r.expected_arrival,ship_from:r.ship_from,ship_by:r.ship_by};
 }).sort((a,b)=>a.product_id.localeCompare(b.product_id));
}
function match(consent,order){
 const review=reason=>({status:'review',reason});
 if(!consent)return {status:'unrecorded',reason:'no_record'};
 try{
  if(consent.stage!=='finalized'||consent.choice!=='together'||consent.affirmative!==true)return review('not_finalized');
  if(id(consent.checkout_id)!==id(order.checkout_id))return review('checkout_changed');
  // These are server receipt and trusted Salla order creation times, never a
  // browser-supplied timestamp or a later order updated_at timestamp.
  const received=Date.parse(consent.received_at),created=Date.parse(order.ordered_at);
  if(!Number.isFinite(received)||!Number.isFinite(created)||received>created||created-received>24*60*60*1000)return review('outside_receipt_window');
  if(!consent.policy_version||!consent.policy_text)return review('disclosure_missing');
  if(stable(schedules(consent.schedules))!==stable(schedules(order.schedules)))return review('schedule_changed');
  const expected=fingerprint(consent.items),actual=fingerprint(order.items,'order');
  if(consent.fingerprint!==expected)return review('record_integrity');
  if(expected!==actual)return review('items_changed');
  return {status:'browser_record_matched',reason:'exact_snapshot',received_at:consent.received_at,policy_version:consent.policy_version};
 }catch{return review('snapshot_incomplete');}
}
module.exports={id,options,lines,fingerprint,schedules,match};
