const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluate}=require('../lib/postpurchase-eligibility');
const now=Date.parse('2026-10-13T19:00:00Z'),customer='22222222-2222-4222-8222-222222222222';
const order=(id,days=8,status='delivered',item={product_id:'1',name:'كفر iPhone 17 Pro Max'})=>({id:'11111111-1111-4111-8111-'+String(id).padStart(12,'0'),external_order_id:String(id),customer_id:customer,status_slug:status,ordered_at:new Date(now-days*86400000).toISOString(),source_payload:{customer:{mobile:'+905350215375'},items:[item]}});
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

test('live ledger blocks prior attempts and phone cooldown; test sends are not part of this ledger',async()=>{
 let r=await evaluate(context([order(1)],{deliveries:[{external_order_id:'1',phone:'905350215375',attempted_at:new Date(now).toISOString()}]}),{now});assert.equal(r.counts.already_attempted,1);assert.equal(r.eligible_customers,0);
 r=await evaluate(context([order(1)],{deliveries:[{external_order_id:'99',phone:'905350215375',attempted_at:new Date(now-5*86400000).toISOString()}]}),{now});assert.equal(r.counts.cooldown,1);
});

const day=86400000;
const stock=(product_id,available=true)=>({product_id,state:'checked',available,checked_at:new Date(now-3600000).toISOString()});
const sold=(external_product_id,name)=>({external_product_id,name,status:'sale',is_available:true});
const bought=(product_id,name)=>({product_id,name});

test('targeted offers match the exact four Salla models and treat standard and MagSafe purchases as Slim',async()=>{
 for(const [model,slim,magSafe,camera] of [
  ['iPhone 17 Pro','1356124795','1128190372','346332705'],
  ['iPhone 17 Pro Max','508035157','2043217838','457870329'],
  ['iPhone 18 Pro','321208074','1142994364','1236296988'],
  ['iPhone 18 Pro Max','1724249566','474220781','1936666261']
 ]){
  const slimName=`كفر سليم شفاف ${model}`,magSafeName=`كفر Link Slim MagSafe ${model}`,cameraName=`مسطح حماية Link ${model}`;
  const live=[sold(slim,slimName),sold(magSafe,magSafeName),sold(camera,cameraName)];
  const stockRows=[stock(slim),stock(magSafe),stock(camera)];
  for(const [item,kind,id] of [[bought(slim,slimName),'camera_flat',camera],[bought(magSafe,magSafeName),'camera_flat',camera],
   [bought(camera,cameraName),'slim_case',slim],[bought('55',`استيكر حماية ${model}`),'slim_case',slim]]){
   const r=await evaluate(context([order(1,8,'delivered',item)],{live,stockRows}),{now});
   const row=r.targeted.rows[0];
   assert.deepEqual([row.model,row.kind,row.offer.id,row.reason],[model,kind,id,'review_ready']);
  }
  const r=await evaluate(context([order(1,8,'delivered',bought(camera,cameraName))],{live,stockRows:[stock(slim,false),stock(magSafe)]}),{now});
  assert.equal(r.targeted.rows[0].offer.id,magSafe);
 }
});

test('targeted preview leaves legacy dispatch intact; hold filters the entire verified phone before choosing a legacy candidate',async()=>{
 const model='iPhone 17 Pro Max';
 const slimOrder=order(2,1,'delivered',bought('508035157',`كفر Link Slim ${model}`));
 const legacy=order(1);
 legacy.customer_id='33333333-3333-4333-8333-333333333333';
 const other=order(3);
 other.customer_id='44444444-4444-4444-8444-444444444444';
 other.source_payload.customer.mobile='+966500123457';
 const params=context([legacy,slimOrder,other]);
 params.customers.push({...params.customers[0],id:legacy.customer_id},{id:other.customer_id,normalized_phone:'966500123457'});
 let r=await evaluate(params,{now});
 assert.equal(r.targeted.mode,'preview');
 assert.equal(r.targeted.rows[0].reason,'delay');
 assert.deepEqual(r.rows.filter(x=>x.eligible).map(x=>x.external_order_id),['1','3']);
 r=await evaluate(params,{now,targetedMode:'hold'});
 assert.equal(r.targeted.mode,'hold');
 assert.equal(r.rows.find(x=>x.external_order_id==='1').reason,'targeted_customer');
 assert.deepEqual(r.rows.filter(x=>x.eligible).map(x=>x.external_order_id),['3']);
 assert.ok(!JSON.stringify(r.targeted).includes('905350215375'));
 slimOrder.source_payload.customer.mobile='+966500987654';
 r=await evaluate(params,{now,targetedMode:'hold'});
 assert.equal(r.targeted.customers,0);
 assert.equal(r.rows.find(x=>x.external_order_id==='1').eligible,true);
});

test('targeted offer checks purchases across the window, paused stock, opt-outs, and previous attempts',async()=>{
 const model='iPhone 18 Pro Max',slim='1724249566',camera='1936666261';
 const slimOrder=order(1,8,'delivered',bought(slim,`كفر سليم ${model}`));
 const cameraName=`مسطح الكاميرا ${model}`;
 const extra={live:[sold(camera,cameraName)],stockRows:[stock(camera)]};
 const bundle=order(2,15,'delivered',bought('68',`بكج حماية ${model} + مسطح كاميرا + كفر`));
 let r=await evaluate(context([slimOrder,bundle],extra),{now});
 assert.equal(r.targeted.rows[0].reason,'already_owned');
 const unrelated=order(3,2,'delivered',bought('1236296988','مسطح الكاميرا iPhone 18 Pro'));
 r=await evaluate(context([slimOrder,unrelated],extra),{now});
 assert.equal(r.targeted.rows[0].offer.id,camera);
 const unavailable={...extra,stockRows:[stock(camera,false)]};
 const legacy=order(4);
 r=await evaluate(context([slimOrder,legacy],unavailable),{now,targetedMode:'hold'});
 assert.equal(r.targeted.rows[0].reason,'no_stock');
 assert.equal(r.rows.find(x=>x.external_order_id==='4').reason,'targeted_customer');
 r=await evaluate(context([slimOrder],{...extra,optouts:[{phone:'905350215375'}]}),{now});
 assert.equal(r.targeted.rows[0].reason,'optout');
 r=await evaluate(context([slimOrder],{...extra,deliveries:[{external_order_id:'99',phone:'905350215375',attempted_at:new Date(now-day).toISOString()}]}),{now});
 assert.equal(r.targeted.rows[0].reason,'cooldown');
});
