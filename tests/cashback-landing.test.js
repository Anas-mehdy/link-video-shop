const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom');
const {seal,read}=require('../lib/postpurchase-landing'),landing=require('../lib/cashback-landing');
const now=Date.parse('2026-11-19T12:00:00Z'),environment={CRM_ENCRYPTION_KEY:'11'.repeat(32)};
const order={id:'11111111-1111-4111-8111-111111111111',status_slug:'delivered',customer_id:null,source_payload:{items:[{product_id:1,name:'كفر دريب iPhone 18 Pro Max'}]}};
const p=(id,name,extra={})=>({external_product_id:String(id),name,status:'sale',is_available:true,url:'https://linkstore-sa.com/product/p'+id,price:70,currency:'SAR',...extra});
const products=[p(1,'كفر دريب iPhone 18 Pro Max'),p(2,'عدسات iPhone 18 Pro Max'),p(3,'حماية شاشة iPhone 18 Pro'),p(4,'شاحن جداري'),p(5,'حماية شاشة iPhone 18 Pro Max',{is_available:false}),p(6,'حامل سيارة',{url:'https://wrong.example/cart'}),p(7,'اصنع بكجك شاحن'),p(8,'كيبل شحن',{price:0})];
const database=async path=>path.startsWith('orders?')?[order]:path.startsWith('products?')?products:assert.fail(path);
test('special token selects cashback view and adapts to credit expiry without exposing wallet data',async()=>{
 const token=seal(order.id,{environment,now,cashback:{creditUntil:now+60000}});
 const plain=seal(order.id,{environment,now});
 const data=await read(token,{database,environment,now});
 assert.equal(data.cashback.state,'credited');assert.equal(data.cashback.wallet_url,'https://linkstore-sa.com/account/wallet');
 assert.deepEqual(data.products.map(x=>x.id),['2','4']);assert.ok(data.products.every(x=>x.link_only));
 assert.equal(data.browse.kind,'model');assert.equal(JSON.stringify(data).includes(order.id),false);
 assert.equal((await read(token,{database,environment,now:now+61000})).cashback.state,'expired');
 const sample=seal(order.id,{environment,now,cashback:{preview:true}});
 assert.equal((await read(sample,{database,environment,now})).cashback.state,'preview');
 // The old template still uses its existing order eligibility instead of the cashback renderer.
 await assert.rejects(read(plain,{database,environment,now}),e=>e.statusCode===404);
 await assert.rejects(read(token,{database:async()=>[{...order,status_slug:'cancelled'}],environment,now}),e=>e.statusCode===404);
});
test('full bundle and ambiguous models switch to generic accessories; previously bought accessory type is omitted',()=>{
 const bundle={source_payload:{items:[{name:'بكج الحماية المتكامل iPhone 18 Pro Max'},{name:'شاحن جداري'}]}};
 assert.deepEqual(landing.cards(products,landing.context(bundle)),[]);
 const ambiguous={source_payload:{items:[{name:'كفر iPhone 18 Pro و iPhone 18 Pro Max'}]}};
 assert.deepEqual(landing.cards(products,landing.context(ambiguous)).map(x=>x.id),['4']);
});
test('the wallet sits above recommendations, fallback opens native product, and old pages keep banner hidden',async()=>{
 for(const cashback of [false,true]){
  const {window,document}=parseHTML(fs.readFileSync(__dirname+'/../public/complete.html','utf8'));
  const token='x'.repeat(100),payload={ok:true,model:'iPhone 18 Pro Max',owned_components:['case'],products:[{id:'2',name:'عدسات',component:'lens',price:59,url:'https://linkstore-sa.com/lens/p2',link_only:cashback}],...(cashback?{cashback:{state:'credited'},browse:{url:'https://linkstore-sa.com/iphone-18-pro-max/c1913975646',kind:'model'}}:{})};
  vm.runInNewContext(fs.readFileSync(__dirname+'/../public/complete.js','utf8'),{window,parent:window,document,URL,URLSearchParams,location:{search:'',pathname:'/complete/'+token},fetch:async()=>({ok:true,json:async()=>payload})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(document.getElementById('cashback-banner').hidden,!cashback);
  assert.equal(document.getElementById('protection-hero').hidden,cashback);
  assert.equal(document.querySelector('#cashback-wallet').getAttribute('target'),'_top');
  if(cashback){assert.match(document.getElementById('cashback-title').textContent,/انضاف/);assert.equal(document.querySelector('.cashback-product-link').getAttribute('href'),payload.products[0].url);}
  else assert.equal(document.querySelector('[data-add]').dataset.add,'2');
 }
});
