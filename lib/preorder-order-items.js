// Read canonical order items only for an existing finalized consent that cannot
// be compared with the thin webhook snapshot. No customer details or raw API
// payloads are stored. Cache keys bind the result to the original order version.
const crypto=require('node:crypto');
const {sb,MERCHANT_ID}=require('./crm');
const compare=require('./preorder-consent');
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
function key(order){return crypto.createHash('sha256').update(canonical({id:order.external_order_id,checkout:order.source_payload?.checkout_id,updated:order.source_payload?.updated_at,items:order.source_payload?.items})).digest('hex');}
function identity(items){
 if(!Array.isArray(items)||!items.length||items.length>100)throw Error('incomplete');
 return items.map(i=>{const quantity=i.quantity;if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('incomplete');return [compare.id(i.product_id??i.product?.id),quantity];}).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function canonicalItems(result,order){
 const items=result?.data,p=result?.pagination;
 if(result?.success!==true||!Array.isArray(items)||JSON.stringify(identity(items))!==JSON.stringify(identity(order.source_payload?.items)))throw Error('incomplete');
 if(p&&((p.currentPage??p.current_page)!==1||(p.totalPages??p.last_page??p.total_pages)!==1||p.total!=null&&p.total!==items.length))throw Error('incomplete');
 return compare.lines(items,'order').map(i=>({product_id:i.product,quantity:i.quantity,...(i.sku?{sku_id:i.sku}:{}),options:i.options.map(o=>({product_option_id:o.id,value:o.value}))}));
}
async function resolve(order,{database=sb,provider,now=Date.now()}={}){
 const id=compare.id(order.external_order_id),snapshot=key(order);
 const query=`crm_preorder_order_item_cache?merchant_id=eq.${MERCHANT_ID}&external_order_id=eq.${id}&snapshot_key=eq.${snapshot}`;
 const [existing]=await database(query+'&select=state,items,retry_after&limit=1');
 if(existing?.state==='ready')return existing.items;
 if(existing&&Date.parse(existing.retry_after)>now)return null;
 const claim={state:'pending',items:null,checked_at:new Date(now).toISOString(),retry_after:new Date(now+60000).toISOString()};
 const claimed=existing?await database(query+`&retry_after=lte.${new Date(now).toISOString()}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(claim)}):await database('crm_preorder_order_item_cache?on_conflict=merchant_id,external_order_id,snapshot_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({merchant_id:MERCHANT_ID,external_order_id:id,snapshot_key:snapshot,...claim})});
 if(!Array.isArray(claimed)||claimed.length!==1)return null;
 try{
  if(!provider){const sync=require('./salla-sync');const tokens=await sync.credentials();provider=path=>sync.get(path,tokens);}
  const items=canonicalItems(await provider(`orders/items?order_id=${id}&per_page=100`),order);
  await database(query,{method:'PATCH',body:JSON.stringify({state:'ready',items,checked_at:new Date().toISOString(),retry_after:new Date(now+86400000).toISOString()})});
  return items;
 }catch{
  await database(query,{method:'PATCH',body:JSON.stringify({state:'error',items:null,retry_after:new Date(now+900000).toISOString()})});
  return null;
 }
}
module.exports={key,identity,canonicalItems,resolve};
