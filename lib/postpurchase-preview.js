// Read-only recommendations from saved order snapshots and the cached catalog.
// This module never calls a sender or an external API.
const {models,components}=require('./postpurchase-auto');
const protection=new Set(['case','screen','lens','camera_frame']);
const norm=v=>String(v||'').replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[إأآ]/g,'ا').toLowerCase();
const bundle=v=>/با?كج|باقة|حماية\s*متكاملة|\b(?:bundle|pack(?:age|s)?)\b/.test(norm(v));
function selectedModels(options){return models(JSON.stringify(options||[]));}
function inferPurchased(item,manual,cached){
 const name=String(item.name||manual?.name||cached?.name||'').slice(0,150),titleModels=models(name),tags=components(name),optionsModels=selectedModels(item.options);
 if(bundle(name)||tags.length>1||manual?.components?.length>1)return {excluded:'bundle'};
 if(/تغليف|اشتراك|تركيب|خدمة|\bservice\b/.test(norm(name)))return {excluded:'outside_scope'};
 if(/pro\b.*(?:و|\/|او|&|and).*max|برو.*(?:و|\/|او|&).*ماكس/.test(norm(name)))return {reason:'model_ambiguous'};
 if(titleModels.length>1||optionsModels.length>1)return {reason:'model_ambiguous'};
 if(titleModels.length&&optionsModels.length&&titleModels[0]!==optionsModels[0])return {reason:'model_conflict'};
 const hasModelOptions=cached?.has_skus||(cached?.options||[]).some(x=>/موديل|model|مقاس|size|هاتف|phone|نوع.*(?:جهاز|جوال)/.test(norm(x.name))||(x.values||[]).some(v=>models(v.name).length));
 if(hasModelOptions&&optionsModels.length!==1&&!manual)return {reason:'model_selection_unknown'};
 if(manual){
  if(!manual.model||manual.components?.length!==1||!protection.has(manual.components[0]))return {excluded:'outside_scope'};
  if([...titleModels,...optionsModels].some(m=>m!==manual.model))return {reason:'model_conflict'};
  return {name,model:manual.model,component:manual.components[0],source:'manual'};
 }
 if(tags.length===0)return /حامل|شاحن|كيبل|وصلة|باور|charger|cable|mount|power\s*bank/.test(norm(name))?{excluded:'outside_scope'}:{reason:'product_unclassified'};
 const model=titleModels[0]||optionsModels[0];
 if(!model)return {reason:'model_ambiguous'};
 return {name,model,component:tags[0],source:'order_title'};
}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&['linkstore-sa.com','www.linkstore-sa.com','mtjr.at'].includes(u.hostname)&&!u.username&&!u.password&&!u.port&&!u.hash&&u.href.length<=1000?u.href:null;}catch{return null;}}
function buildPreview(context,products,rules,suggestions,catalog){
 const cached=new Map(catalog.map(x=>[String(x.id),x])),approved=new Set(suggestions.filter(x=>x.decision==='auto').map(x=>`${x.product_id}:${x.variant_id||''}`));
 const offers=products.filter(p=>p.components?.length===1&&protection.has(p.components[0])&&!bundle(p.name)&&components(p.name).length<=1&&safeUrl(p.product_url)&&(p.origin==='manual'||approved.has(`${p.product_id}:${p.variant_id||''}`))&&cached.get(p.product_id)?.status==='sale'&&cached.get(p.product_id)?.is_available===true)
 .sort((a,b)=>(Number(cached.get(b.product_id)?.quantity)||0)-(Number(cached.get(a.product_id)?.quantity)||0)||String(a.product_id).localeCompare(String(b.product_id))||String(a.variant_id||'').localeCompare(String(b.variant_id||'')));
 const rows=[],counts={bundle:0,outside_scope:0,unclassified:0,no_offer:0,paused:0,matched:0};
 for(const order of context.rows||[]){
  const item=order.item||{},variant=String(item.variant_id||''),id=String(item.product_id||'');
  const manual=products.find(p=>p.product_id===id&&String(p.variant_id||'')===variant&&p.origin==='manual');
  const inferred=inferPurchased(item,manual,cached.get(id));
  if(inferred.excluded){counts[inferred.excluded]++;continue;}
  const base={external_order_id:order.external_order_id,customer_name:order.customer_name,purchased_name:item.name||manual?.name||'منتج غير مصنف',scheduled_for:order.scheduled_for,offer_name:'',rule_name:'',reason:inferred.reason||order.reason};
  if(inferred.reason){counts.unclassified++;rows.push(base);continue;}
  const matchingRules=rules.filter(r=>r.trigger_product_id===id&&(String(r.trigger_variant_id||'')===variant||r.trigger_variant_id===''));
  const explicit=matchingRules.filter(r=>r.origin==='manual');
  const targets=offers.filter(p=>p.model===inferred.model&&p.components[0]!==inferred.component&&p.product_id!==id
   &&!matchingRules.some(r=>r.offer_product_id===p.product_id&&String(r.offer_variant_id||'')===String(p.variant_id||'')&&(!r.active||r.paused_by_user))
   &&(!explicit.length||explicit.some(r=>r.active&&r.offer_product_id===p.product_id&&String(r.offer_variant_id||'')===String(p.variant_id||''))));
  const chosen=[],seen=new Set();for(const p of targets){if(!seen.has(p.components[0])){seen.add(p.components[0]);chosen.push(p);}}
  if(!chosen.length){const paused=matchingRules.some(r=>!r.active||r.paused_by_user);counts[paused?'paused':'no_offer']++;rows.push({...base,reason:paused?'offers_paused':'no_complementary_offer'});continue;}
  counts.matched++;
  for(const p of chosen)rows.push({...base,purchased_name:inferred.name,offer_name:p.name,offer_product_id:p.product_id,offer_variant_id:p.variant_id||'',product_url:safeUrl(p.product_url),model:inferred.model,classification_source:inferred.source,rule_name:'منتج مكمل لنفس الموديل',reason:order.reason});
 }
 return {mode:'preview',scope:'single_product',matching:'order_title',messages_sent:0,salla_requests:0,scanned_orders:context.scanned_orders,single_product_orders:context.single_product_orders,multiple_product_orders:context.scanned_orders-context.single_product_orders,excluded_bundle_orders:counts.bundle,excluded_other_orders:counts.outside_scope,target_orders:context.single_product_orders-counts.bundle-counts.outside_scope,unclassified_orders:counts.unclassified,no_offer_orders:counts.no_offer,paused_orders:counts.paused,matched_orders:counts.matched,rows};
}
async function loadCatalog(database,merchant){let products=[];for(let offset=0;offset<1500;offset+=500){const rows=await database(`crm_postpurchase_catalog_cache?merchant_id=eq.${merchant}&select=product&order=product_id.asc&limit=500&offset=${offset}`);products.push(...rows.map(x=>x.product));if(rows.length<500)break;}return products;}
async function loadRows(database,path){let result=[];for(let offset=0;offset<6000;offset+=500){const rows=await database(`${path}&limit=500&offset=${offset}`);result.push(...rows);if(rows.length<500)return result;}throw new Error('Postpurchase local data limit exceeded');}
module.exports={inferPurchased,buildPreview,loadCatalog,loadRows};
