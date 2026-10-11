const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {inferPurchased,buildPreview,loadRows}=require('../lib/postpurchase-preview');
const item={product_id:'111',variant_id:'',name:'كفر دريب لنك آيفون 17'};
const profile=(id,model,component,origin='auto')=>({product_id:id,variant_id:'',name:`${component} ${model}`,model,components:[component],product_url:'https://linkstore-sa.com/p'+id,origin});
const products=[profile('201','iPhone 17','screen'),profile('202','iPhone 17','lens'),profile('203','iPhone 17 Pro','screen'),profile('204','iPhone 17','screen')];
const catalog=products.map(p=>({id:p.product_id,status:'sale',is_available:p.product_id!=='204',quantity:5}));
const suggestions=products.map(p=>({product_id:p.product_id,decision:'auto'}));
const order=(n,item,reason='delay')=>({id:'o'+n,external_order_id:String(n),customer_name:'Test',item,reason,scheduled_for:'2026-10-17T08:00Z'});
test('Saved names classify plain purchases without IDs in the current catalog; bundles and general accessories stay excluded',()=>{
 assert.deepEqual(inferPurchased(item).model,'iPhone 17');assert.equal(inferPurchased({...item,name:'كفر سليم شفاف آيفون 18 برو ماكس'}).model,'iPhone 18 Pro Max');
 for(const name of ['باكج الحماية المتكاملة لآيفون 18 – كفر دريب لنك + حماية شاشة + حماية كاميرات','باكج Link سامسونج S25 Ultra — كفر ستيل + عدسات حماية الكاميرا','بكج حماية آيفون 17','باكج آيفون 17 كفر','باقة iPhone 17','Bundle iPhone 17','حماية متكاملة آيفون 17'])assert.equal(inferPurchased({...item,name}).excluded,'bundle',name);
 for(const name of ['ستاند وشاحن لاسلكي للسيارة – Link','وصلة شحن Link تايب سي × آيفون | 2 م','تغليف لنك آيفون 17'])assert.equal(inferPurchased({...item,name}).excluded,'outside_scope',name);
 for(const name of ['كفر آيفون 17 وآيفون 18','كفر آيفون 17 برو/ماكس'])assert.equal(inferPurchased({...item,name}).reason,'model_ambiguous');
 assert.equal(inferPurchased({...item,options:[{name:'الموديل',value:'iPhone 17 Pro'}]}).reason,'model_conflict');
 assert.equal(inferPurchased(item,null,{options:[{name:'اختر الموديل',values:[{name:'iPhone 17'},{name:'iPhone 17 Pro'}]}]}).reason,'model_selection_unknown');
 assert.equal(inferPurchased({...item,options:[{name:'الموديل',value:'iPhone 17'}]},null,{options:[{name:'موديل'}]}).model,'iPhone 17');
});
test('One purchase gets multiple same-model complements and retains all delivery, optout and later-purchase eligibility',()=>{
 const rows=['delay','optout','later_purchase','delivery_date_unknown','stock_check_required'].map((reason,i)=>order(i,item,reason));
 rows.push(order(20,{...item,name:'باكج آيفون 17 كفر + عدسات'}),order(21,{...item,name:'شاحن السيارة'}),order(22,{...item,name:'كفر مجهول'}));
 const r=buildPreview({scanned_orders:10,single_product_orders:8,rows},products,[],suggestions,catalog);
 assert.equal(r.messages_sent,0);assert.equal(r.salla_requests,0);assert.equal(r.matched_orders,5);assert.equal(r.excluded_bundle_orders,1);assert.equal(r.excluded_other_orders,1);assert.equal(r.unclassified_orders,1);assert.equal(r.target_orders,6);
 for(let n=0;n<5;n++){const found=r.rows.filter(x=>x.external_order_id===String(n));assert.equal(found.length,2);assert.ok(found.every(x=>x.model==='iPhone 17'&&x.reason===rows[n].reason));}
 assert.ok(!r.rows.some(x=>['203','204'].includes(x.offer_product_id)));
 assert.equal(buildPreview({scanned_orders:1,single_product_orders:1,rows:[order(1,{...item,name:'عدسات Link آيفون 17'})]},products,[],suggestions,catalog).rows[0].offer_product_id,'201');
});
test('Paused or manual rules cannot be bypassed by title-based recommendations',()=>{
 const context={scanned_orders:1,single_product_orders:1,rows:[order(1,item)]};
 let rules=[{trigger_product_id:'111',trigger_variant_id:'',offer_product_id:'202',offer_variant_id:'',active:false,paused_by_user:true,origin:'auto'}];
 assert.deepEqual(buildPreview(context,products,rules,suggestions,catalog).rows.map(x=>x.offer_product_id),['201']);
 rules.push({trigger_product_id:'111',trigger_variant_id:'',offer_product_id:'201',offer_variant_id:'',active:false,origin:'manual'});
 const r=buildPreview(context,products,rules,suggestions,catalog);assert.equal(r.matched_orders,0);assert.equal(r.rows[0].reason,'offers_paused');
 const manual=profile('111','iPhone 17 Pro','case','manual');assert.equal(inferPurchased(item,manual).reason,'model_conflict');
 const rejected=suggestions.map(x=>({...x,decision:'review'}));assert.equal(buildPreview(context,products,[],rejected,catalog).matched_orders,0);
});
test('All 149 stored delivered orders can be represented locally without a per-product external request',()=>{
 const rows=Array.from({length:91},(_,i)=>order(i,i<30?{...item,name:'بكج آيفون 17'}:i<35?{...item,name:'شاحن للسيارة'}:item));
 const r=buildPreview({scanned_orders:149,single_product_orders:91,rows},products,[],suggestions,catalog);
 assert.equal(r.excluded_bundle_orders,30);assert.equal(r.excluded_other_orders,5);assert.equal(r.target_orders,56);assert.equal(r.matched_orders,56);assert.equal(r.rows.length,112);assert.equal(r.salla_requests,0);
});
test('Local pages do not lose paused rules beyond the first 500 records',async()=>{
 let calls=0;const rows=await loadRows(async path=>{calls++;return path.endsWith('offset=0')?Array.from({length:500},(_,i)=>({id:i})):Array.from({length:4},(_,i)=>({id:500+i}));},'rules?order=id.asc');assert.equal(rows.length,504);assert.equal(calls,2);
});
test('SQL context returns only this merchant and last month, applies eligibility locally and stays service-only',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);create table webhook_events(id uuid primary key);');
 const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json'));
 for(const t of schema.filter(x=>['customers','orders'].includes(x.table_name)))await db.exec(`create table ${t.table_name}(${t.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(t.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
 await db.exec("alter table orders add column crm_source_at timestamptz;create table crm_whatsapp_optouts(merchant_id bigint,phone text);create table test_clock(t timestamptz);insert into test_clock values('2026-10-10T09:00Z');create function pp_now() returns timestamptz language sql as $$ select t from public.test_clock $$;");
 await db.exec(fs.readFileSync(__dirname+'/../crm-postpurchase.sql','utf8').replaceAll('now()','public.pp_now()'));
 const migration=fs.readFileSync(__dirname+'/../crm-postpurchase-title-matching.sql','utf8').replaceAll('now()','public.pp_now()');await db.exec(migration);await db.exec(migration);
 const merchant=1829345766;
 const c=(await db.query("insert into customers(merchant_id,external_customer_id,name,phone,normalized_phone) values($1,'1','Test','+966500000001','966500000001') returning id",[merchant])).rows[0].id;
 const insert=async(ext,items,m=merchant,date='2026-10-10T08:00Z')=>(await db.query("insert into orders(merchant_id,external_order_id,customer_id,status_slug,ordered_at,crm_source_at,source_payload) values($1,$2,$3,'delivered',$4,$4,$5) returning id",[m,ext,c,date,JSON.stringify({items,private_secret:'should_not_be_returned'})])).rows[0].id;
 const first=await insert('1',[{product_id:111,name:item.name,options:[{name:'اللون',value:'أسود'}]}]);await insert('2',[{product_id:111,name:item.name},{product_id:222}]);await insert('old',[{product_id:111} ],merchant,'2026-09-01T00:00Z');await insert('other',[{product_id:111}],99);
 const get=async()=>(await db.query('select crm_postpurchase_single_context($1) r',[merchant])).rows[0].r;
 let r=await get();assert.equal(r.scanned_orders,2);assert.equal(r.single_product_orders,1);assert.equal(r.rows[0].reason,'delivery_date_unknown');assert.equal(r.rows[0].item.product_id,'111');assert.ok(!JSON.stringify(r).includes('private_secret'));
 await db.query("insert into crm_postpurchase_delivered(merchant_id,order_id,delivered_at) values($1,$2,'2026-10-10T08:00Z')",[merchant,first]);assert.equal((await get()).rows[0].reason,'delay');
 await db.exec("insert into crm_whatsapp_optouts values(1829345766,'966500000001')");assert.equal((await get()).rows[0].reason,'optout');await db.exec('delete from crm_whatsapp_optouts');
 await insert('later',[{product_id:111}],merchant,'2026-10-10T08:30Z');assert.equal((await get()).rows.find(x=>x.external_order_id==='1').reason,'later_purchase');
 for(const role of ['anon','authenticated'])assert.equal((await db.query('select has_function_privilege($1,$2,$3) r',[role,'crm_postpurchase_single_context(bigint)','EXECUTE'])).rows[0].r,false);
 }finally{await db.close();}
});
test('Admin GET builds title matches from local RPC and handles a pending SQL update explicitly',async()=>{
 const vm=require('node:vm');let missing=false,calls=[];
 const contextData={scanned_orders:1,single_product_orders:1,rows:[order(1,item,'delay')]};
 const sb=async path=>{calls.push(path);
  if(path.includes('single_context')){if(missing)throw Error('Supabase 404: {"code":"PGRST202"}');return contextData;}
  if(path.includes('rpc/crm_postpurchase_preview'))return {scope:'single_product',rows:[],scanned_orders:1,matched_orders:0};
  if(path.startsWith('crm_postpurchase_settings?'))return [{delay_days:7,batch_hours:[11,17,20]}];
  if(path.startsWith('crm_postpurchase_products?'))return products;
  if(path.startsWith('crm_postpurchase_rules?'))return [];
  if(path.startsWith('rpc/crm_postpurchase_catalog'))return [];
  if(path.startsWith('crm_postpurchase_catalog_cache?'))return catalog.map(product=>({product}));
  assert.fail('Unexpected database endpoint '+path);
 };
 const crm={MERCHANT_ID:1829345766,sb,json:(res,status,data)=>Object.assign(res,{status,data}),bodyObject:req=>req.body,fail:()=>Error('Invalid')};
 const sandbox={module:{exports:{}},URL,require:path=>path==='./crm'?crm:path==='./postpurchase-preview'?require('../lib/postpurchase-preview'):path==='./postpurchase-auto'?{load:async()=>({ready:true,suggestions})}:assert.fail(path)};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../lib/postpurchase.js','utf8'),sandbox);let res={};await sandbox.module.exports.admin({method:'GET'},res);
 assert.equal(res.status,200);assert.equal(res.data.preview.matched_orders,1);assert.equal(res.data.preview.rows.length,2);assert.equal(res.data.preview.matching,'order_title');assert.ok(calls.every(x=>!x.startsWith('http')));
 missing=true;calls=[];res={};await sandbox.module.exports.admin({method:'GET'},res);assert.equal(res.data.ready,true);assert.equal(res.data.preview.requires_title_update,true);
});
test('Fold 8 is explicitly out of scope, including Arabic digits, manual profiles and selected options',()=>{
 for(const name of ['كفر لنك كاربون فاير Samsung Galaxy Z Fold 8 – MagSafe','كفر سامسونج فولد 8','كفر فولد ٨ الترا','كفر Galaxy Fold8 Ultra'])assert.equal(inferPurchased({...item,name}).excluded,'unsupported_model',name);
 assert.equal(inferPurchased(item,profile('111','Samsung Z Fold 8','case','manual')).excluded,'unsupported_model');
 assert.equal(inferPurchased({...item,options:[{name:'الموديل',value:'فولد ٨'}]}).excluded,'unsupported_model');
 assert.notEqual(inferPurchased({...item,name:'كفر Fold 80'}).excluded,'unsupported_model');
 const rows=[order(1,{...item,name:'كفر Galaxy Z Fold 8'}),order(2,item)];
 const r=buildPreview({scanned_orders:2,single_product_orders:2,rows},products,[],suggestions,catalog);
 assert.equal(r.excluded_model_orders,1);assert.equal(r.target_orders,1);assert.equal(r.matched_orders,1);assert.equal(r.unclassified_orders,0);assert.ok(r.rows.every(x=>x.external_order_id==='2'));
});
test('Unknown purchases are grouped by exact name, selected model and cause, without customer or order data',()=>{
 const unknown={...item,name:'كفر غير واضح'};
 const rows=[order(1,unknown),order(2,unknown),order(3,{...item,options:[{name:'الموديل',value:'iPhone 17 Pro'}]})];
 const r=buildPreview({scanned_orders:3,single_product_orders:3,rows},products,[],suggestions,catalog);
 assert.equal(r.unclassified_orders,3);assert.equal(r.unmatched_products.length,2);assert.equal(r.unmatched_products[0].orders,2);assert.equal(r.unmatched_products[0].reason,'model_missing');assert.equal(r.unmatched_products[1].reason,'model_conflict');
 assert.deepEqual(r.unmatched_products[1].title_models,['iPhone 17']);assert.deepEqual(r.unmatched_products[1].selected_models,['iPhone 17 Pro']);
 for(const group of r.unmatched_products)assert.deepEqual(Object.keys(group).sort(),['name','orders','product_id','reason','selected_models','title_models','variant_id'].sort());
});
test('Unmatched-products UI copies product-only diagnostics and safely renders names',async()=>{
 const vm=require('node:vm'),nodes=new Map();let copied='',toastText='';
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{handlers:{},addEventListener(event,fn){this.handlers[event]=fn;},querySelectorAll:()=>[]});return nodes.get(id);},querySelectorAll:()=>[]};
 const window={};vm.runInNewContext(fs.readFileSync(__dirname+'/../public/dashboard-postpurchase.js','utf8'),{window,document,URL,Date,navigator:{clipboard:{writeText:async text=>{copied=text;}}}});
 const preview=buildPreview({scanned_orders:1,single_product_orders:1,rows:[order(1,{...item,name:'كفر مجهول <img src=x onerror=alert(1)>'})]},products,[],suggestions,catalog);
 const d={ready:true,automatic:{ready:true,suggestions:[],requests:9,budget:20},products:[],rules:[],catalog:[],settings:{batch_hours:[11,17,20]},preview};
 const html=window.LinkPostPurchase.render(d);assert.match(html,/المنتجات غير المطابقة وأسبابها/);assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
 window.LinkPostPurchase.bind({api:async()=>assert.fail('No network for copying'),navigate:async()=>assert.fail('No navigation'),toast:s=>{toastText=s;}});
 await nodes.get('pp-copy-unmatched').handlers.click();assert.deepEqual(JSON.parse(copied),preview.unmatched_products);assert.ok(!copied.includes('customer_name'));assert.ok(!copied.includes('external_order_id'));assert.match(toastText,/تم نسخ/);
});
test('Reported purchase names: ten orders resolve, fourteen are excluded, one keeps ambiguous model',()=>{
 const names=[
 ['تكلفة الشحن',3,'outside_scope'],
 ['كفر دريب لنك – 17 برو ماكس | MagSafe',3,'iPhone 17 Pro Max'],
 ['قطعة ماج سيف جلد أسود',2,'outside_scope'],
 ['كفر دريب لنك + إطار لنك ايفون 17 برو , 17 برو ماكس',2,'bundle'],
 ['كفر ستيل خشبي جالكسي اس 25 الترا',2,'Samsung S25 ULTRA'],
 ['كفر ستيل سامسونج اس 24 الترا - link',2,'Samsung S24 ULTRA'],
 ['مسكة لنك المغناطيسية الفاخرة',2,'outside_scope'],
 ['باور بنك Link 10000mAh +  مسطح الكاميرا + حامي العدسات - لأجهزة الايفون 17 برو , 17 برو ماكس',1,'bundle'],
 ['قطعة ماج سيف جلد أسود',1,'outside_scope'],
 ['كفر دريب + مسطح كاميرا + وصلة تايب سي link  لهواتف ايفون 17 برو ,برو ماكس',1,'bundle'],
 ['كفر دريب لنك – 17 برو | MagSafe',1,'iPhone 17 Pro'],
 ['كفر دريب لنك – 18 برو | MagSafe',1,'iPhone 18 Pro'],
 ['كفر ستيل خشبي جالكسي اس 23 الترا',1,'Samsung S23 ULTRA'],
 ['مسطح LV لهواتف الايفون 17 برو , برو ماكس',1,'model_ambiguous'],
 ['مسطح كاميرا + خلفية LV – iPhone 17 Pro',1,'bundle'],
 ['مسكة لنك المغناطيسية الفاخرة',1,'outside_scope']];
 let matched=0,excluded=0,ambiguous=0;
 for(const [name,count,expected]of names){const r=inferPurchased({name,product_id:'',variant_id:''});assert.equal(r.model||r.excluded||r.reason,expected,name);if(r.model)matched+=count;else if(r.excluded)excluded+=count;else ambiguous+=count;}
 assert.equal(matched,10);assert.equal(excluded,14);assert.equal(ambiguous,1);
 const rows=names.flatMap(([name,count],n)=>Array.from({length:count},(_,i)=>order(n+'-'+i,{name,product_id:'',variant_id:''})));
 const p=profile('801','iPhone 17 Pro Max','lens');const c={id:'801',status:'sale',is_available:true,quantity:20};
 const preview=buildPreview({scanned_orders:25,single_product_orders:25,rows},[p],[],[{product_id:'801',decision:'auto'}],[c]);
 assert.equal(preview.target_orders,11);assert.equal(preview.excluded_bundle_orders,5);assert.equal(preview.excluded_other_orders,9);assert.equal(preview.unclassified_orders,1);assert.equal(preview.matched_orders,3);assert.equal(preview.no_offer_orders,7);
});
test('Abbreviated DriB titles stay bounded to their case family and retain exact model variants',()=>{
 assert.equal(inferPurchased({name:'كفر دريب لنك – ١٧ برو ماكس | MagSafe'}).model,'iPhone 17 Pro Max');
 assert.notEqual(inferPurchased({name:'عدسات حماية 17 برو ماكس'}).model,'iPhone 17 Pro Max');
 assert.notEqual(inferPurchased({name:'كفر عام 17 برو'}).model,'iPhone 17 Pro');
 assert.notEqual(inferPurchased({name:'شاحن 17 واط'}).model,'iPhone 17');
 assert.equal(inferPurchased({name:'كفر دريب 17 برو / 18 برو'}).reason,'model_ambiguous');
 assert.equal(inferPurchased({name:'كفر دريب لنك – 17 برو',options:[{value:'iPhone 17 Pro Max'}]}).reason,'model_conflict');
});
