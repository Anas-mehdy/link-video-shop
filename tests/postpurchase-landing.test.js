const {test}=require('node:test'),assert=require('node:assert/strict');
const service=require('../lib/postpurchase-landing');
const environment={CRM_ENCRYPTION_KEY:'a'.repeat(64)},now=Date.parse('2026-10-13T10:00:00Z');
const order={id:'11111111-1111-4111-8111-111111111111',external_order_id:'111',customer_id:'22222222-2222-4222-8222-222222222222',status_slug:'delivered',ordered_at:'2026-10-06T12:00:00Z',source_payload:{items:[{product_id:1,name:'كفر iPhone 18 Pro Max'}]}};
const p=(id,name,component,model='iPhone 18 Pro Max')=>({product_id:String(id),name,components:[component],model,origin:'manual',product_url:'https://linkstore-sa.com/p'+id});
const profiles=[p(1,'كفر iPhone 18 Pro Max','case'),p(2,'حماية شاشة iPhone 18 Pro Max','screen'),p(3,'استيكر خصوصية iPhone 18 Pro Max','screen'),p(4,'عدسات iPhone 18 Pro Max','lens'),p(5,'مسطح كاميرا iPhone 18 Pro Max','camera_frame'),p(6,'عدسات iPhone 18 Pro','lens','iPhone 18 Pro')];
const catalog=profiles.map(p=>({id:p.product_id,name:p.name,status:'sale',is_available:true,quantity:20,options:[]}));
const live=profiles.map(p=>({external_product_id:p.product_id,name:p.name,status:'sale',is_available:true,price:80,sale_price:null,currency:'SAR',main_image_url:'https://cdn.salla.sa/'+p.product_id+'.jpg'}));
function database({later=[],rules=[],overrides={},stockRows=[]}={}){const paths=[];const fn=async path=>{paths.push(path);if(path.startsWith('crm_pp_stock_cache?'))return stockRows;if(path.startsWith('orders?'))return path.includes('ordered_at=gt.')?later:[order];if(path.startsWith('crm_postpurchase_products?'))return profiles;if(path.startsWith('crm_postpurchase_rules?'))return rules;if(path.startsWith('crm_postpurchase_suggestions?'))return [];if(path.startsWith('crm_postpurchase_catalog_cache?'))return catalog.map(product=>({product}));if(path.startsWith('products?'))return live.map(p=>({...p,...overrides[p.external_product_id]}));throw Error('Unexpected '+path);};return {fn,paths};}
test('opaque links authenticate, expire and use fresh random nonces',()=>{
 const a=service.seal(order.id,{environment,now}),b=service.seal(order.id,{environment,now});assert.notEqual(a,b);assert.ok(!a.includes(order.id));assert.equal(service.unseal(a,{environment,now}),order.id);
 assert.throws(()=>service.unseal(a,{environment:{CRM_ENCRYPTION_KEY:'b'.repeat(64)},now}));assert.throws(()=>service.unseal(a,{environment,now:now+91*86400000}));assert.throws(()=>service.unseal('123',{environment,now}));
});
test('same exact model, all alternatives, purchased category removed and response has no customer identifiers',async()=>{
 const db=database(),result=await service.data(order,{database:db.fn});assert.deepEqual(result.products.map(x=>x.id),['2','3','4','5']);assert.equal(result.model,'iPhone 18 Pro Max');
 const text=JSON.stringify(result);assert.ok(!text.includes(order.customer_id));assert.ok(!text.includes('external_order_id'));assert.ok(!text.includes('customer_name'));assert.ok(db.paths.every(p=>!p.includes('api.salla')));
});
test('later purchased categories and locally unavailable products are removed on every read',async()=>{
 const db=database({later:[{source_payload:{items:[{product_id:4,name:'عدسات iPhone 18 Pro Max'}]}}],overrides:{'3':{is_available:false}}});
 const result=await service.data(order,{database:db.fn});assert.deepEqual(result.products.map(x=>x.id),['2','5']);assert.deepEqual(result.owned_components,['case','lens']);
});
test('paused offers stay excluded and unreadable subsequent purchases fail closed',async()=>{
 const db=database({rules:[{trigger_product_id:'1',trigger_variant_id:'',offer_product_id:'2',offer_variant_id:'',active:false}]});assert.ok(!(await service.data(order,{database:db.fn})).products.some(p=>p.id==='2'));
 await assert.rejects(service.data(order,{database:database({later:[{source_payload:{}}]}).fn}));
});
test('cancelled orders and wrong customer identifiers cannot produce a public page',async()=>{
 await assert.rejects(service.data({...order,status_slug:'cancelled'},{database:database().fn}));await assert.rejects(service.data({...order,customer_id:'x'},{database:database().fn}));
 const created=await service.create({external_order_id:'111'},{database:database().fn,environment,now});assert.match(created.path,/^\/complete\//);assert.equal(created.products,4);
 await assert.rejects(service.create({external_order_id:'111'},{database:database().fn,environment,now:now+40*86400000}));
});
test('public landing requests use the existing feed function and reject invalid links without reading data',async()=>{
 const handler=require('../api/video-shop-feed');const headers={},res={setHeader:(k,v)=>{headers[k]=v;},end:text=>{res.body=JSON.parse(text);}};
 await handler({method:'GET',query:{resource:'postpurchase',token:'invalid'}},res);
 assert.equal(res.statusCode,404);assert.equal(headers['Cache-Control'],'no-store');assert.equal(headers['Referrer-Policy'],'no-referrer');assert.equal(headers['X-Robots-Tag'],'noindex, nofollow');assert.ok(!res.body.products);
});

test('stock cache hides unavailable products and refreshes visible prices without Salla requests',async()=>{
 const db=database({stockRows:[{product_id:'2',state:'checked',available:false,checked_at:new Date().toISOString()},{product_id:'4',state:'checked',available:true,checked_at:new Date().toISOString(),snapshot:{currency:'SAR',price:90,sale_price:69}}]});
 const result=await service.data(order,{database:db.fn});assert.ok(!result.products.some(p=>p.id==='2'));assert.equal(result.products.find(p=>p.id==='4').price,69);
 const candidates=await service.data(order,{database:db.fn,stockFilter:false});assert.ok(candidates.products.some(p=>p.id==='2'));
});

test('production verified links only show checked products, and send gating demands fresh stock',async()=>{
 const db=database({stockRows:[{product_id:'2',state:'checked',available:true,checked_at:new Date(Date.now()-5*3600000).toISOString(),snapshot:{}}]});
 const token=service.seal(order.id,{environment,now,verified:true});
 const page=await service.read(token,{database:db.fn,environment,now});assert.deepEqual(page.products.map(p=>p.id),['2']);
 const sendPage=await service.data(order,{database:db.fn,requireFreshStock:true});assert.equal(sendPage.products.length,0);
});
