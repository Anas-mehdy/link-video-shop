const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluate}=require('../lib/postpurchase-eligibility');
const now=Date.parse('2026-10-13T19:00:00Z'),customer='22222222-2222-4222-8222-222222222222';
const order=(id,days=8,status='delivered',item={product_id:'1',name:'كفر iPhone 17 Pro Max'})=>({id:'11111111-1111-4111-8111-'+String(id).padStart(12,'0'),external_order_id:String(id),customer_id:customer,status_slug:status,ordered_at:new Date(now-days*86400000).toISOString(),source_payload:{items:[item]}});
const products=[{product_id:'1',variant_id:'',origin:'manual',name:'كفر iPhone 17 Pro Max',model:'iPhone 17 Pro Max',components:['case'],product_url:'https://linkstore-sa.com/p1'},{product_id:'2',variant_id:'',origin:'manual',name:'عدسات iPhone 17 Pro Max',model:'iPhone 17 Pro Max',components:['lens'],product_url:'https://linkstore-sa.com/p2'},{product_id:'3',variant_id:'',origin:'manual',name:'حماية شاشة iPhone 17 Pro Max',model:'iPhone 17 Pro Max',components:['screen'],product_url:'https://linkstore-sa.com/p3'}];
function context(orders,extra={}){return {orders,customers:[{id:customer,name:'أنس',normalized_phone:'905350215375'}],optouts:[],settings:{delay_days:7},products,rules:[],suggestions:[],catalog:products.map(p=>({id:p.product_id,name:p.name,status:'sale',is_available:true,quantity:5,options:[]})),live:products.map(p=>({external_product_id:p.product_id,name:p.name,status:'sale',is_available:true,price:60,currency:'SAR'})),stockRows:[],...extra};}
test('old delivered purchases are due now; new, undelivered, optout, bundles and multi-product purchases stay excluded',async()=>{
 let r=await evaluate(context([order(1)]),{now});assert.equal(r.eligible_customers,1);assert.equal(r.rows[0].reason,'stock_check_required');assert.equal(r.salla_requests,0);assert.equal(r.messages_sent,0);
 r=await evaluate(context([order(2,6),order(3,8,'under_review'),order(4,8,'delivered',{name:'بكج كفر وعدسات iPhone 17 Pro Max'})]),{now});assert.equal(r.eligible_customers,0);assert.equal(r.counts.delay,1);assert.equal(r.counts.not_delivered,1);assert.equal(r.counts.bundle_excluded,1);
 r=await evaluate(context([order(1)],{optouts:[{phone:'905350215375'}]}),{now});assert.equal(r.rows[0].reason,'optout');
 const multi=order(1);multi.source_payload.items.push({name:'عدسات'});r=await evaluate(context([multi]),{now});assert.equal(r.rows[0].reason,'multiple_products');
});
test('later same-model lenses are removed, screen remains; unrelated devices and cancelled purchases do not suppress the offer',async()=>{
 const later=order(2,1,'under_review',{product_id:'2',name:'عدسات iPhone 17 Pro Max'});
 let r=await evaluate(context([order(1),later]),{now});assert.deepEqual(r.rows.find(x=>x.external_order_id==='1').products.map(x=>x.id),['3']);
 for(const next of [order(3,1,'cancelled',{name:'عدسات iPhone 17 Pro Max'}),order(3,1,'delivered',{name:'عدسات iPhone 18 Pro Max'})]){
 r=await evaluate(context([order(1),next]),{now});assert.deepEqual(r.rows.find(x=>x.external_order_id==='1').products.map(x=>x.id),['2','3']);}
});
test('one due candidate per phone, fresh stock required, cancelled current orders excluded',async()=>{
 let r=await evaluate(context([order(1,9),order(2,8),order(3,1)]),{now});assert.equal(r.eligible_customers,1);assert.equal(r.counts.duplicate_customer,1);assert.equal(r.counts.delay,1);
 const rows=['2','3'].map(product_id=>({product_id,state:'checked',available:true,checked_at:new Date(now-3600000).toISOString()}));
 r=await evaluate(context([order(1)],{stockRows:rows}),{now});assert.equal(r.stock_ready,1);
 r=await evaluate(context([order(1)],{stockRows:rows.map(x=>({...x,available:false}))}),{now});assert.equal(r.eligible_customers,0);assert.equal(r.counts.no_stock,1);
 r=await evaluate(context([order(1)],{stockRows:rows.map(x=>({...x,checked_at:new Date(now-5*3600000).toISOString()}))}),{now});assert.equal(r.needs_stock,1);
});
test('missing phone and unreadable relevant later purchases fail closed; no private phone in review response',async()=>{
 let r=await evaluate(context([order(1)],{customers:[{id:customer,name:'أنس'}]}),{now});assert.equal(r.counts.phone_missing,1);
 const later=order(2,1,'delivered',{name:'قطعة حماية مخصصة'});r=await evaluate(context([order(1),later]),{now});assert.equal(r.rows.find(x=>x.external_order_id==='1').reason,'later_purchase_review');assert.ok(!JSON.stringify(r).includes('905350215375'));
});
