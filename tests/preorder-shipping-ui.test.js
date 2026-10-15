const {test} = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const {webcrypto} = require('node:crypto'), {parseHTML} = require('linkedom');
const source = fs.readFileSync(__dirname+'/../public/preorder-shipping-trial.js','utf8');
const product = {id:'318533359',status:'open',ship_from:'2026-11-04',ship_by:'2026-11-06'};
const items = ()=>[{id:'ready',product_id:'999',quantity:2,options:[{id:2,value:'white'}]},{id:'po',product_id:'318533359',quantity:4,options:[]}];
async function harness({rows=items(),optIn=true,summary=true,demo=true,path='/cart',readiness='callback',delayedSDK=false}={}) {
  const {window:dom,document:d}=parseHTML(`<html><head></head><body><main>${summary?'<div class="cart-summary">':''}<button data-cart-submit>إتمام الطلب</button><form action="/coupon"><button>كوبون</button></form>${summary?'</div>':''}</main></body></html>`);
  // A plain window facade keeps the DOM library's global proxy from replacing Node timers.
  const w={document:d,Event:dom.Event,addEventListener:dom.addEventListener.bind(dom),location:{pathname:path}};
  delete w.__linkShippingTrial;delete w.__linkPreorderWidget;
  const script=d.createElement('script');script.src='https://link-video-shop.vercel.app/preorder-shipping-trial.js';if(optIn)script.dataset.shippingTrial='1';if(demo)script.dataset.demo='1';Object.defineProperty(d,'currentScript',{value:script});
  let saved=null,native=0,removes=0,adds=0,feed=0,reads=0,currentProduct={...product},serial=0,locked=false;
  const events={},timers=new Map(),observers=[];
  w.__poDemoStorage={get:()=>saved==null?null:JSON.parse(JSON.stringify(saved)),set:v=>saved=v};
  w.localStorage={getItem:()=>saved==null?null:JSON.stringify(saved),setItem:(_k,v)=>saved=JSON.parse(v),removeItem:()=>saved=null};
  Object.defineProperty(w,'crypto',{value:webcrypto,configurable:true});
  Object.defineProperty(w,'navigator',{value:{locks:{request:async(_name,_options,fn)=>{if(locked)return fn(null);locked=true;try{return await fn({});}finally{locked=false;}}}},configurable:true});
  w.MutationObserver=class{constructor(fn){observers.push(fn)}observe(){}disconnect(){}};
  w.setTimeout=fn=>{timers.set(++serial,fn);return serial;};w.clearTimeout=id=>timers.delete(id);
  w.fetch=async()=>{feed++;return {ok:true,json:async()=>({ok:true,products:[currentProduct]})};};
  w.salla={onReady:fn=>fn(),cart:{details:async()=>{reads++;return {data:{items:JSON.parse(JSON.stringify(rows))}};},deleteItem:async id=>{removes++;rows=rows.filter(i=>i.id!==id);return {success:true};},addItem:async p=>{adds++;rows.push({id:'restored',product_id:String(p.id),quantity:p.quantity});return {success:true};},event:{onItemAdded:fn=>events.add=fn,onItemDeleted:fn=>events.remove=fn,onItemUpdated:fn=>events.update=fn}}};
  if(readiness==='missed')w.salla.onReady=()=>undefined;
  if(readiness==='promise')w.salla.onReady=()=>Promise.resolve();
  const sdk=w.salla;if(delayedSDK)delete w.salla;
  // linkedom has no capture phase; count the simulated default action after propagation.
  d.querySelector('[data-cart-submit]').addEventListener('click',e=>setImmediate(()=>{if(!e.defaultPrevented)native++;}));
  const context={window:w,document:d,URL,Intl,Date,TextEncoder,console};vm.createContext(context);vm.runInContext(source,context);
  const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));for(let i=0;i<100&&d.querySelector('.po-busy')?.textContent;i++)await new Promise(r=>setTimeout(r,2));};
  const flush=async()=>{const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());await settle();};
  const click=async el=>{el.dispatchEvent(new w.Event('click',{bubbles:true,cancelable:true}));await settle();};
  const change=async(el,value)=>{if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));await settle();};
  await settle();return {w,d,events,flush,settle,click,change,observers,setRows:r=>rows=r,getRows:()=>rows,native:()=>native,removes:()=>removes,adds:()=>adds,saved:()=>saved,feed:()=>feed,reads:()=>reads,setProduct:p=>currentProduct=p,mountSDK:()=>w.salla=sdk};
}
test('asset requires explicit opt-in and normal ready carts request no schedule',async()=>{
  const no=await harness({optIn:false});assert.equal(no.d.querySelector('#link-po-shipping'),null);assert.equal(no.feed(),0);
  const ready=await harness({rows:[items()[0]]});assert.equal(ready.d.querySelector('#link-po-shipping'),null);assert.equal(ready.feed(),0);await ready.click(ready.d.querySelector('[data-cart-submit]'));assert.equal(ready.native(),1);
});
test('cart fallback mounts without guessed theme summary; mixed checkout requires choice and explicit acknowledgement',async()=>{
  const h=await harness({summary:false});assert.ok(h.d.querySelector('main>#link-po-shipping'));
  assert.equal(h.d.querySelectorAll('input[checked]').length,0);
  await h.click(h.d.querySelector('[data-cart-submit]'));assert.equal(h.native(),0);assert.match(h.d.querySelector('.po-error').textContent,/اختر/);
  await h.change(h.d.querySelector('input[value="together"]'),'together');
  await h.click(h.d.querySelector('[data-cart-submit]'));assert.equal(h.native(),0);
  await h.change(h.d.querySelector('[data-ack]'),true);await h.click(h.d.querySelector('[data-cart-submit]'));assert.equal(h.native(),1);assert.equal(h.removes(),0);
});
test('UI split -> ready checkout -> empty cart -> explicit restore; quantities remain four and no automatic order is assumed',async()=>{
  const h=await harness();await h.change(h.d.querySelector('input[value="separate"]'),'separate');
  await h.click(h.d.querySelector('[data-action="split"]'));assert.equal(h.removes(),1,h.d.querySelector('#link-po-shipping').textContent);assert.equal(h.getRows().length,1);assert.equal(h.native(),0);assert.equal(h.saved().quantity,4);
  await h.click(h.d.querySelector('[data-action="checkout"]'));assert.equal(h.native(),1);
  // Returning from checkout without finishing keeps the first cart; restoration cannot mix it.
  assert.equal(h.d.querySelector('[data-action="restore"]'),null);assert.ok(h.d.querySelector('[data-action="cancel"]'));
  h.setRows([]);h.events.remove();await h.flush();
  await h.click(h.d.querySelector('[data-action="restore"]'));assert.equal(h.adds(),0);
  await h.change(h.d.querySelector('[data-first-done]'),true);await h.click(h.d.querySelector('[data-action="restore"]'));
  assert.equal(h.adds(),1);assert.equal(h.getRows()[0].quantity,4);assert.equal(h.saved(),null);assert.ok(h.d.querySelector('[data-ack]'));
});
test('quantity changes after choosing combined invalidate acknowledgement before native checkout',async()=>{
  const h=await harness();await h.change(h.d.querySelector('input[value="together"]'),'together');await h.change(h.d.querySelector('[data-ack]'),true);
  h.setRows([{...items()[0],quantity:6},items()[1]]);await h.click(h.d.querySelector('[data-cart-submit]'));assert.equal(h.native(),0);assert.match(h.d.querySelector('.po-error').textContent,/تغيّرت/);
  assert.equal(h.d.querySelector('[data-ack]'),null);
});
test('coupon forms are never intercepted and deleting preorder removes choice UI',async()=>{
  const h=await harness();const e=new h.w.Event('submit',{bubbles:true,cancelable:true});h.d.querySelector('form').dispatchEvent(e);await h.settle();assert.equal(e.defaultPrevented,false);
  h.setRows([items()[0]]);h.events.remove();await h.flush();assert.equal(h.d.querySelector('#link-po-shipping'),null);
});
test('preorder-only acknowledgement gates checkout without any extra fee or split',async()=>{
  const h=await harness({rows:[items()[1]]});assert.equal(h.d.querySelector('input[type="radio"]'),null);
  await h.click(h.d.querySelector('[data-cart-submit]'));assert.equal(h.native(),0);
  await h.change(h.d.querySelector('[data-ack]'),true);await h.click(h.d.querySelector('[data-cart-submit]'));assert.equal(h.native(),1);assert.equal(h.removes(),0);assert.equal(h.adds(),0);
});
test('cancel restores preorder beside existing ready options and reopens choice without a default',async()=>{
  const h=await harness();await h.change(h.d.querySelector('input[value="separate"]'),'separate');await h.click(h.d.querySelector('[data-action="split"]'));
  await h.click(h.d.querySelector('[data-action="cancel"]'));assert.equal(h.getRows().length,2);assert.equal(h.getRows()[0].options[0].value,'white');assert.equal(h.d.querySelectorAll('input[checked]').length,0);
});
test('standalone demo scripts execute and all native cart mutations use local fixtures',async()=>{
  const html=fs.readFileSync(__dirname+'/../public/preorder-shipping-preview.html','utf8'),{window:w,document:d}=parseHTML(html);
  const inline=d.querySelector('script:not([src])').textContent;
  const context={window:w,document:d};vm.createContext(context);vm.runInContext(inline,context);
  const before=await w.salla.cart.details();assert.equal(before.data.items.length,2);assert.equal(before.data.items[1].quantity,3);
  assert.match(d.querySelector('#demo-items').textContent,/البرغندي/);
  await w.salla.cart.deleteItem(before.data.items[1].id);assert.equal((await w.salla.cart.details()).data.items.length,1);
  await w.salla.cart.addItem({id:318533359,quantity:3});assert.equal((await w.salla.cart.details()).data.items[1].quantity,3);
  assert.ok(!(await w.fetch()).json.toString().includes('http'));
});
test('native cart redraws remount cached UI without a cart-read request loop',async()=>{
  const h=await harness(),reads=h.reads();
  for(let i=0;i<5;i++){h.observers[0]([{target:h.d.querySelector('main')}]);await h.flush();}
  assert.equal(h.reads(),reads);
  h.d.querySelector('#link-po-shipping').remove();h.observers[0]([{target:h.d.querySelector('main')}]);await h.flush();
  assert.ok(h.d.querySelector('#link-po-shipping'));assert.equal(h.reads(),reads);
});
test('native preview store-prefixed cart route initializes, including Promise-only readiness',async()=>{
  const h=await harness({demo:false,path:'/Zpqzp/ar/cart',readiness:'promise'});
  assert.match(h.d.querySelector('#link-po-shipping').textContent,/كيف تحب/);assert.equal(h.reads(),1);
});
test('a missed SDK ready callback uses a bounded fallback rather than silently doing nothing',async()=>{
  const h=await harness({readiness:'missed'});assert.match(h.d.querySelector('#link-po-shipping').textContent,/جارٍ/);assert.equal(h.reads(),0);
  await h.flush();assert.match(h.d.querySelector('#link-po-shipping').textContent,/كيف تحب/);assert.equal(h.reads(),1);
});
test('late SDK displays loading, initializes once, and never polls the cart API',async()=>{
  const h=await harness({delayedSDK:true});assert.match(h.d.querySelector('#link-po-shipping').textContent,/جارٍ/);assert.equal(h.reads(),0);
  await h.flush();assert.equal(h.reads(),0);h.mountSDK();await h.flush();assert.equal(h.reads(),1);assert.match(h.d.querySelector('#link-po-shipping').textContent,/كيف تحب/);
  await h.flush();assert.equal(h.reads(),1);
});
test('native preorder link with unmatched API product IDs produces a visible read-only diagnostic',async()=>{
  const h=await harness({rows:[items()[0]],demo:false});const a=h.d.createElement('a');a.href='/p318533359';h.d.querySelector('main').appendChild(a);
  h.events.update();await h.flush();assert.match(h.d.querySelector('.po-error').textContent,/PO-MAP/);assert.equal(h.removes(),0);assert.equal(h.adds(),0);
});
