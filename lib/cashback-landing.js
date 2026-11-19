const {MERCHANT_ID}=require('./crm');
const {models,components}=require('./postpurchase-auto');
const {loadRows}=require('./postpurchase-preview');
const origin='https://linkstore-sa.com';
const categories={
 'iPhone 18 Pro Max':'/iphone-18-pro-max/c1913975646',
 'iPhone 18 Pro':'/iphone-18-pro/c823692715',
 'iPhone 17 Pro Max':'/iphone-17-pro-max/c190706111',
 'iPhone 17 Pro':'/iphone-17-pro/c1105733505'
};
const accessories='/%D8%A7%D9%84%D8%A5%D9%83%D8%B3%D8%B3%D9%88%D8%A7%D8%B1%D8%A7%D8%AA/c1359428650';
const bundle=name=>/بكج|باكدج|باكج|باكدجات|bundle|حماية متكامل/i.test(name);
const accessoryTypes={
 chargers:/شاحن|\bcharger\b/i,cables:/كيبل|كابل|\bcable\b/i,
 mounts:/حامل|\bmount\b/i,power_banks:/باور\s*بنك|power\s*bank/i,earphones:/سماعات|سماعة|earphones|headphones/i
};
const accessory=name=>Object.keys(accessoryTypes).find(k=>accessoryTypes[k].test(name));
function storeUrl(value){
 try{const u=new URL(value);return u.origin===origin&&!u.username&&!u.password&&!u.hash&&u.pathname.startsWith('/')?u.href:null;}catch{return null;}
}
function context(order){
 const items=Array.isArray(order.source_payload?.items)?order.source_payload.items:[];
 const names=items.map(i=>String(i.name||i.product?.name||''));
 const seen=new Set(),owned=new Set(),ownedAccessories=new Set();
 let reliable=items.length>0;
 for(const [i,item] of items.entries()){
  const titleModels=models(names[i]),optionModels=models(JSON.stringify(item.options||[]));
  const picked=optionModels.length===1&&(!titleModels.length||titleModels.includes(optionModels[0]))?optionModels:titleModels.length===1&&!optionModels.length?titleModels:[];
  if(picked.length!==1)reliable=false;else seen.add(picked[0]);
  for(const c of components(names[i]))owned.add(c);
  for(const k in accessoryTypes)if(accessoryTypes[k].test(names[i]))ownedAccessories.add(k);
 }
 const isBundle=names.some(bundle),singleModel=reliable&&seen.size===1?[...seen][0]:null;
 return {model:singleModel,isBundle,owned,ownedAccessories,bought:new Set(items.map(i=>String(i.product?.id??i.product_id??'')))};
}
function cards(catalog,ctx){
 const {model,isBundle,owned,ownedAccessories,bought}=ctx;
 const pool=[];
 for(const p of catalog){
  const id=String(p.external_product_id||''),name=String(p.name||'').trim(),url=storeUrl(p.url),pm=models(name);
  const price=Number(p.sale_price)>0?Number(p.sale_price):Number(p.price);
  if(!/^\d{1,20}$/.test(id)||bought.has(id)||!name||!url||p.status!=='sale'||p.is_available!==true||!/^(?:SAR)?$/.test(p.currency||'')||!Number.isFinite(price)||!(price>0)||bundle(name)||/حجز مسبق|pre.?order|اصنع بكجك/i.test(name))continue;
  const tags=components(name),type=accessory(name);
  const compatible=!isBundle&&model&&owned.size&&pm.length===1&&pm[0]===model&&tags.length===1&&!owned.has(tags[0]);
  const general=!pm.length&&!tags.length&&type&&!ownedAccessories.has(type);
  if(!compatible&&!general)continue;
  pool.push({id,name,url,image:p.main_image_url||p.thumbnail_url||null,price,currency:'SAR',component:compatible?tags[0]:'accessories',family:compatible?tags[0]:type,priority:compatible?0:1,link_only:true});
 }
 pool.sort((a,b)=>a.priority-b.priority||a.price-b.price||a.id.localeCompare(b.id));
 const used=new Set();
 return pool.filter(p=>{if(used.has(p.family))return false;used.add(p.family);return true;}).slice(0,6).map(({family,priority,...p})=>p);
}
async function read(order,claims,{database,now,recommend}){
 const ctx=context(order);
 let personal=null;
 try{
  personal=await recommend(order,{database,requireFreshStock:true});
 }catch(e){if(![400,404,503].includes(e.statusCode))throw e;}
 for(const component of personal?.owned_components||[])ctx.owned.add(component);
 let products=personal?.products||[];
 if(!products.length)products=cards(await loadRows(database,`products?merchant_id=eq.${MERCHANT_ID}&status=eq.sale&is_available=eq.true&select=external_product_id,name,status,is_available,url,thumbnail_url,main_image_url,price,sale_price,currency&order=external_product_id.asc`),ctx);
 const model=personal?.model||ctx.model;
 const modelPath=!ctx.isBundle&&categories[model];
 return {
  model,products,owned_components:personal?.owned_components||[...ctx.owned],
  cashback:{state:claims.preview?'preview':claims.creditUntil>now?'credited':'expired',wallet_url:origin+'/account/wallet'},
  browse:{url:origin+(modelPath||accessories),kind:modelPath?'model':'accessories'}
 };
}
module.exports={read,context,cards};
