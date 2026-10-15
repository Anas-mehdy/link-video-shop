const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const product={id:'318533359',name:'إطار Link',color:'بورغندي',status:'open',expected_arrival:'2026-11-03',ship_from:'2026-11-04',ship_by:'2026-11-06',revision:1};
const code=fs.readFileSync(__dirname+'/../public/preorder-widget.js','utf8');
async function harness({path='/p318533359',mode='',beforeAdd=false,items=[],fail=false,products=[{...product}]}={}){
 const {window}=parseHTML('<html><head></head><body><main><form class="product-form"><button type="submit">إضافة</button></form><div class="cart-summary"><a href="/checkout">متابعة</a><form action="/coupon"><button type="submit">كوبون</button></form></div></main></body></html>');
 const document=window.document,script=document.createElement('script');script.src='https://link-video-shop.vercel.app/preorder-widget.js';if(mode)script.dataset.mode=mode;if(beforeAdd)script.dataset.beforeAdd='1';
 delete window.__linkPreorderWidget;
 Object.defineProperty(document,'currentScript',{value:script});
 const timers=new Map(),events={},observers=[];let serial=0,calls=0,currentItems=items,data={ok:true,products};
 window.salla={onReady:fn=>fn(),cart:{details:async()=>({data:{items:currentItems}}),event:{onItemAdded:fn=>events.add=fn,onItemRemoved:fn=>events.remove=fn}}};
 window.HTMLElement.prototype.scrollIntoView=function(){};
 const context={window,document,location:{pathname:path,href:'https://linkstore-sa.com'+path},URL,Intl,Date,matchMedia:()=>({matches:true}),fetch:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>data};},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),MutationObserver:class{constructor(fn){observers.push(fn)}observe(){}disconnect(){}}};
 vm.createContext(context);vm.runInContext(code,context);
 const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};await settle();
 const flush=async()=>{const fns=[...timers.values()];timers.clear();fns.forEach(fn=>fn());await settle();};
 return {document,window,events,observers,flush,settle,calls:()=>calls,setItems:v=>currentItems=v,setData:v=>data=v,runAgain:()=>vm.runInContext(code,context)};
}
test('preorder disclosure is scoped, precedes add form, escapes content, guards acknowledgement and expiry',async()=>{
 const other=await harness({path:'/p999'});assert.equal(other.calls(),0);assert.equal(other.document.querySelector('.link-preorder'),null);
 const bridge=await harness({path:'/p981596666',mode:'preview'});assert.ok(bridge.document.querySelector('.link-preorder').textContent.includes('للون البورغندي فقط'));assert.equal(bridge.document.querySelector('.link-preorder input'),null);const bridgeClick=new bridge.window.Event('click',{bubbles:true,cancelable:true});bridge.document.querySelector('.product-form button').dispatchEvent(bridgeClick);assert.equal(bridgeClick.defaultPrevented,false);
 const h=await harness();const root=h.document.querySelector('.link-preorder');assert.ok(root.textContent.includes('وصول الدفعة المتوقع'));assert.ok(root.textContent.includes('شحن طلبك المتوقع'));assert.ok(root.textContent.includes('3 نوفمبر'));assert.ok(root.textContent.includes('4–6 نوفمبر'));assert.equal(root.nextElementSibling.className,'product-form');
 const button=h.document.querySelector('.product-form button');let click=new h.window.Event('click',{bubbles:true,cancelable:true});button.dispatchEvent(click);assert.equal(click.defaultPrevented,true);
 const check=root.querySelector('input');check.checked=true;check.dispatchEvent(new h.window.Event('change',{bubbles:true}));click=new h.window.Event('click',{bubbles:true,cancelable:true});button.dispatchEvent(click);assert.equal(click.defaultPrevented,false);
 const escaped=await harness({products:[{...product,name:'<img src=x onerror=bad()>'}]});assert.equal(escaped.document.querySelector('.link-preorder img'),null);assert.ok(escaped.document.querySelector('.link-preorder').textContent.includes('<img'));
 const expired=await harness({products:[{...product,ship_from:'2020-01-01',ship_by:'2020-01-02'}]});const expiredCheck=expired.document.querySelector('input');expiredCheck.checked=true;expiredCheck.dispatchEvent(new expired.window.Event('change',{bubbles:true}));const expiredClick=new expired.window.Event('click',{bubbles:true,cancelable:true});expired.document.querySelector('.product-form button').dispatchEvent(expiredClick);assert.equal(expiredClick.defaultPrevented,true);
 // A preview stays blocked even after checking the box.
 const paused=await harness({mode:'preview'});const c=paused.document.querySelector('input');c.checked=true;c.dispatchEvent(new paused.window.Event('change',{bubbles:true}));const e=new paused.window.Event('click',{bubbles:true,cancelable:true});paused.document.querySelector('.product-form button').dispatchEvent(e);assert.equal(e.defaultPrevented,true);
 h.runAgain();assert.equal(h.document.querySelectorAll('.link-preorder').length,1);
});
test('mixed cart updates on removal, does not guard coupons, never uses cart-line id as product id, and ready carts make no feed calls',async()=>{
 const ready=await harness({path:'/cart',items:[{id:318533359,product_id:981596666}],fail:true});assert.equal(ready.calls(),0);assert.equal(ready.document.querySelector('.link-preorder'),null);
 const h=await harness({path:'/cart',items:[{product_id:318533359},{product:{id:981596666}}]});let root=h.document.querySelector('.link-preorder');assert.ok(root.textContent.includes('يُشحن الطلب كاملاً'));assert.ok(root.textContent.includes('منتجات جاهزة وحجزاً'));
 const coupon=new h.window.Event('submit',{bubbles:true,cancelable:true});h.document.querySelector('form[action="/coupon"]').dispatchEvent(coupon);assert.equal(coupon.defaultPrevented,false);
 const checkout=new h.window.Event('click',{bubbles:true,cancelable:true});h.document.querySelector('a[href="/checkout"]').dispatchEvent(checkout);assert.equal(checkout.defaultPrevented,true);
 root.remove();h.observers[0]([{target:h.document.querySelector('main')}]);await h.flush();root=h.document.querySelector('.link-preorder');assert.ok(root.textContent.includes('شحن طلبك المتوقع'));
 h.setItems([{product_id:981596666}]);h.events.remove();await h.flush();assert.equal(h.document.querySelector('.link-preorder'),null);assert.equal(h.calls(),1);
});
test('public feed allows only sanitized schedule fields, hides drafts by default, rejects query injection',async()=>{
 const queries=[];let response;
 const context={module:{exports:{}},AbortSignal,Set,require:()=>({MERCHANT_ID:1829345766,sb:async p=>{queries.push(p);return [{product_id:'318533359',product_name:'إطار',color:'بورغندي',status:'draft',ship_from:'2026-11-04',ship_by:'2026-11-06',revision:1,customer_phone:'PRIVATE',incoming_quantity:400}];},json:(_r,status,data,headers)=>response={status,data,headers}})};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../lib/preorder-storefront.js','utf8'),context);
 const feed=context.module.exports.feed;
 await feed({query:{ids:'318533359&select=*'}},{});assert.equal(response.status,400);assert.equal(queries.length,0);
 await feed({query:{ids:'318533359'}},{});assert.equal(response.data.products.length,0);
 await feed({query:{ids:'318533359',preview:'1'}},{});assert.equal(response.data.products.length,1);assert.ok(queries.every(q=>q.includes('merchant_id=eq.1829345766')));assert.ok(!JSON.stringify(response.data).includes('PRIVATE'));assert.ok(!Object.hasOwn(response.data.products[0],'incoming_quantity'));assert.equal(response.headers['Cache-Control'],'no-store');
});

test('delegated before-add mode keeps date card without a second checkbox or DOM guard',async()=>{const h=await harness({beforeAdd:true});assert.ok(h.document.querySelector('.link-preorder').textContent.includes('شحن طلبك المتوقع'));assert.equal(h.document.querySelector('[data-po-ack]'),null);const e=new h.window.Event('click',{bubbles:true,cancelable:true});h.document.querySelector('.product-form button').dispatchEvent(e);assert.equal(e.defaultPrevented,false);});
