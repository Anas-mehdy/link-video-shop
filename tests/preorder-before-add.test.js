const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const api=require('../public/preorder-before-add');
const P=api.PRODUCT,R='999',row=id=>({product_id:id,quantity:2}),response=items=>({data:{items}});
const fixture={id:P,name:'إطار برغندي',color:'برغندي',status:'open',expected_arrival:'2099-11-03',ship_from:'2099-11-04',ship_by:'2099-11-06',revision:1};
const inspect=x=>api.inspect(x,api.catalogOf([fixture]));
const gate=()=>{const g=api.gate(),update=g.update;g.update=r=>update(r,api.catalogOf([fixture]));return g;};
test('both directions mix; empty and homogeneous carts do not',()=>{
 for(const [ids,id,mixes] of [[[],P,false],[[P],P,false],[[R],R,false],[[R],P,true],[[P],R,true],[[P,R],R,true]])assert.equal(api.decide(inspect(response(ids.map(row))),id).mixes,mixes);
});
test('approval is one-use and bound to product and full cart quantities/options',()=>{
 const g=gate();g.update(response([row(R)]));assert.equal(g.validate(P).allowed,false);g.grant(P);assert.equal(g.validate(P).allowed,true);assert.equal(g.validate(P).allowed,false);
 g.grant(P);g.update(response([{...row(R),options:[{id:1,value:'red'}]}]));assert.equal(g.validate(P).allowed,false);
 g.grant(P);g.invalidate();assert.equal(g.validate(P).reason,'loading');
});
test('malformed cart never passes; cart URLs preserve store prefix',()=>{
 for(const x of [{},{data:{items:[{id:123,quantity:1}]}},{success:false,data:{items:[]}}])assert.throws(()=>api.inspect(x));
 assert.equal(api.cartURL({href:'https://salla.sa/linkstore122/foo/p123'}),'https://salla.sa/linkstore122/cart');assert.equal(api.cartURL({href:'https://salla.sa/other/p123'}),null);assert.equal(api.cartURL({href:'https://linkstore-sa.com/foo/p123'}),'https://linkstore-sa.com/cart');
});
async function harness(ids=[],path='/frame/p318533359',{delayCart=false,delayFeed=false,failFeed=false,failCart=false,products=[{...fixture}]}={}){
 const {document:d,window:dom}=parseHTML('<html><head></head><body><button id="native">أضف</button></body></html>');
 const s=d.createElement('script');s.src='https://link-video-shop.vercel.app/preorder-before-add.js';s.dataset.beforeAdd='1';Object.defineProperty(d,'currentScript',{value:s});
 let rows=ids.map(row),reads=0,notice='',mutations=0,native=0,releaseCart,releaseFeed;const cartWait=new Promise(r=>releaseCart=r),feedWait=new Promise(r=>releaseFeed=r);const events={},timers=new Map();let serial=0;
 const w={document:d,location:{pathname:path,href:'https://salla.sa/linkstore122'+path},addEventListener:dom.addEventListener.bind(dom),setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),fetch:async()=>{if(delayFeed)await feedWait;if(failFeed)throw Error('offline');return {ok:true,json:async()=>({ok:true,catalog:true,complete:true,products})};}};
 w.salla={onReady:fn=>fn(),notify:{success:x=>notice=x},cart:{details:async()=>{reads++;if(delayCart)await cartWait;if(failCart)throw Error('offline');return response(rows);},addItem:()=>mutations++,deleteItem:()=>mutations++,event:{onItemAdded:fn=>events.add=fn,onItemUpdated:fn=>events.update=fn}}};
 const settle=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
 api.start(w);await settle();
 const validate=(id,isValid=true)=>{let button=d.querySelector('salla-add-product-button');if(!button){button=d.createElement('salla-add-product-button');d.body.appendChild(button);button.addEventListener('click',e=>setImmediate(()=>{if(!e.defaultPrevented)native++;}));}button.setAttribute('product-id',id);const e=new dom.Event('click',{bubbles:true,cancelable:true});if(!isValid)e.preventDefault();button.dispatchEvent(e);return {isValid:!e.defaultPrevented};};
 const click=async selector=>{d.querySelector(selector).dispatchEvent(new dom.Event('click',{bubbles:true}));await settle();};
 const approve=async()=>{const box=d.querySelector('[data-po-together]');box.checked=true;box.dispatchEvent(new dom.Event('change',{bubbles:true}));await click('[data-po-approve]');};
 return {w,d,validate,approve,click,settle,events,releaseCart,releaseFeed,native:()=>native,setProducts:v=>products=v,setRows:ids=>rows=ids.map(row),reads:()=>reads,notice:()=>notice,mutations:()=>mutations,hook:()=>w.LinkPreorderBeforeAddStatus?.ready};
}
test('native product-only carts never show shipping choices',async()=>{
 for(const [ids,id,path] of [[[],P,'/p318533359'],[[P],P,'/p318533359'],[[R],R,'/p999']]){const h=await harness(ids,path);assert.equal(h.validate(id).isValid,true);assert.equal(h.d.querySelector('#po-before-add'),null);assert.equal(h.mutations(),0);}
});
test('both native button orders block synchronously without relying on component hooks; approval needs a new native press and never mutates cart',async()=>{
 for(const [ids,id,path] of [[[R],P,'/p318533359'],[[P],R,'/p999']]){const h=await harness(ids,path);assert.equal(h.validate(id).isValid,false);assert.ok(h.d.querySelector('[data-po-together]'));const link=h.d.querySelector('.po-link');assert.equal(link.getAttribute('href'),'https://salla.sa/linkstore122/cart');assert.equal(link.getAttribute('target'),'_blank');await h.approve();assert.match(h.notice(),/زر الإضافة الأصلي/);assert.equal(h.mutations(),0);assert.equal(h.validate(id).isValid,true);assert.equal(h.validate(id).isValid,false);}
});
test('cancel and changed cart discard consent; native validation failures stay failed',async()=>{
 const h=await harness([R]);assert.equal(h.validate(P,false).isValid,false);assert.equal(h.d.querySelector('#po-before-add'),null);
 h.validate(P);await h.click('[data-po-close]');assert.equal(h.validate(P).isValid,false);
 h.setRows([R,R]);await h.approve();assert.match(h.d.querySelector('.po-error').textContent,/تغيّرت/);assert.equal(h.mutations(),0);
});
test('SDK events recalculate the reverse direction and already mixed carts explain manual review',async()=>{
 const h=await harness([R],'/p999');assert.equal(h.validate(R).isValid,true);h.setRows([P]);h.events.add();await h.settle();assert.equal(h.validate(R).isValid,false);
 h.setRows([R,P]);h.events.update();await h.settle();assert.match(h.d.querySelector('#po-before-add').textContent,/بمواعيد مختلفة بالفعل/);assert.equal(h.mutations(),0);
});
test('native cart and checkout routes do zero IO and register no hook',async()=>{
 for(const path of ['/cart','/linkstore122/cart','/checkout/step']){const h=await harness([P,R],path);assert.equal(h.reads(),0);assert.equal(h.hook(),undefined);assert.equal(h.d.querySelector('#po-before-add'),null);}
});
test('runtime contains no cart mutation, storage or checkout interception',()=>{
 const source=fs.readFileSync(require.resolve('../public/preorder-before-add'),'utf8');assert.doesNotMatch(source,/\.addItem\(|\.deleteItem\(|localStorage|addEventListener\(['"]submit/);
});

test('empty and preorder-only carts never show shipping choices while catalog loads or fails',async()=>{
 for(const ids of [[],[P]]){
  const h=await harness(ids,'/p318533359',{delayFeed:true});assert.equal(h.validate(P).isValid,false);assert.equal(h.d.querySelector('#po-before-add'),null);h.releaseFeed();await h.settle();assert.equal(h.native(),1);assert.equal(h.d.querySelector('#po-before-add'),null);
  const failed=await harness(ids,'/p318533359',{failFeed:true});assert.equal(failed.validate(P).isValid,false);await failed.settle();assert.equal(failed.d.querySelector('#po-before-add'),null);assert.ok(failed.d.querySelector('#po-cart-read-error'));
 }
});
test('early gesture waits silently for unknown empty cart and resumes native add exactly once',async()=>{
 const h=await harness([],'/p318533359',{delayCart:true});assert.equal(h.validate(P).isValid,false);h.validate(P);assert.equal(h.d.querySelector('#po-before-add'),null);await h.settle();assert.equal(h.native(),0);h.releaseCart();await h.settle();assert.equal(h.native(),1);assert.equal(h.mutations(),0);assert.equal(h.d.querySelector('#po-before-add'),null);
});
test('early gestures in either mixed direction show choices only after confirmed read and never resume add',async()=>{
 for(const [ids,id,path] of [[[R],P,'/p318533359'],[[P],R,'/p999']]){const h=await harness(ids,path,{delayCart:true});h.validate(id);assert.equal(h.d.querySelector('#po-before-add'),null);h.releaseCart();await h.settle();assert.ok(h.d.querySelector('[data-po-together]'));assert.equal(h.native(),0);}
});
test('cart becoming homogeneous closes shipping choices rather than displaying a pointless message',async()=>{
 const h=await harness([R]);h.validate(P);assert.ok(h.d.querySelector('#po-before-add').hasAttribute('open'));h.setRows([]);h.events.update();await h.settle();assert.equal(h.d.querySelector('#po-before-add').hasAttribute('open'),false);assert.equal(h.validate(P).isValid,true);
});
test('failed unknown cart read gives an inline error without shipping options or resuming add',async()=>{
 const h=await harness([],'/p318533359',{failCart:true});h.validate(P);await h.settle();assert.equal(h.d.querySelector('#po-before-add'),null);assert.ok(h.d.querySelector('#po-cart-read-error'));assert.equal(h.native(),0);
});

test('repeat presses during deferred initial gesture never add twice after cart snapshot arrives',async()=>{
 const h=await harness([],'/p318533359',{delayCart:true,delayFeed:true});h.validate(P);h.releaseCart();await h.settle();h.validate(P);await h.settle();assert.equal(h.native(),0);h.releaseFeed();await h.settle();assert.equal(h.native(),1);assert.equal(h.d.querySelector('#po-before-add'),null);
});
test('bulk preflight leaves homogeneous selections alone and asks before either mixed direction',async()=>{
 const homogeneous=await harness([]);assert.equal(await homogeneous.w.LinkPreorderCheckItems([{id:P}]),true);assert.equal(homogeneous.d.querySelector('#po-before-add'),null);
 for(const [ids,incoming] of [[[R],[P]],[[P],[R]],[[],[P,R]]]){
  const h=await harness(ids);const pending=h.w.LinkPreorderCheckItems(incoming.map(id=>({id})));await h.settle();assert.ok(h.d.querySelector('[data-po-together]'));await h.approve();assert.equal(await pending,true);assert.equal(h.mutations(),0);assert.equal(h.d.querySelector('#po-before-add').hasAttribute('open'),false);
 }
});
test('cancelling an accessory group resolves false without adding and permits a fresh attempt',async()=>{
 const h=await harness([P]);const first=h.w.LinkPreorderCheckItems([{id:R}]);await h.settle();await h.click('[data-po-close]');assert.equal(await first,false);const second=h.w.LinkPreorderCheckItems([{id:R}]);await h.settle();await h.approve();assert.equal(await second,true);assert.equal(h.mutations(),0);
});
test('separate-purchase link cancels bulk preflight without clearing native cart',async()=>{
 const h=await harness([P]);const pending=h.w.LinkPreorderCheckItems([{id:R}]);await h.settle();await h.click('a.po-link');assert.equal(await pending,false);assert.equal(h.mutations(),0);assert.equal(h.native(),0);
});
test('bulk approval resets after cart changes and cancellation still resolves pending caller',async()=>{
 const h=await harness([P]);const pending=h.w.LinkPreorderCheckItems([{id:R}]);await h.settle();h.setRows([P,P]);await h.approve();assert.match(h.d.querySelector('.po-error').textContent,/تغيّرت/);await h.click('[data-po-close]');assert.equal(await pending,false);
});
test('quick purchase is restricted only for preorder context and normal checkout is untouched',async()=>{
 const ready=await harness([R],'/p999');assert.equal(ready.d.documentElement.hasAttribute('data-link-po-cart-flow'),false);
 const po=await harness([P],'/p999');assert.equal(po.d.documentElement.hasAttribute('data-link-po-cart-flow'),true);
 const quick=po.d.createElement('salla-quick-buy');po.d.body.appendChild(quick);const e=new po.w.document.defaultView.Event('click',{bubbles:true,cancelable:true});quick.dispatchEvent(e);assert.equal(e.defaultPrevented,true);assert.equal(po.d.querySelector('#po-before-add'),null);
 po.setRows([R]);po.events.update();await po.settle();assert.equal(po.d.documentElement.hasAttribute('data-link-po-cart-flow'),false);
 const page=await harness([],'/p318533359');assert.equal(page.d.documentElement.hasAttribute('data-link-po-cart-flow'),true);
 const checkout=await harness([P],'/checkout');assert.equal(checkout.d.querySelector('#po-shortcuts-style'),null);
});
test('video form cancels before SDK and does not submit twice while waiting for mixed approval',async()=>{
 const code=fs.readFileSync(__dirname+'/../docs/preorder-video-submit.js','utf8');const form={dataset:{}};let sdk=0,tracked=0,finish;
 const wait=new Promise(r=>finish=r);const w={LinkPreorderCheckItems:()=>wait,lvsTrack:()=>tracked++};
 vm.runInNewContext(code,{form,pr:{id:R},window:w,document:{getElementById:()=>({dataset:{videoid:1}})},salla:{form:{onSubmit:async()=>sdk++}}});
 let prevented=0;const e={preventDefault:()=>prevented++};const p=form.onsubmit(e);await form.onsubmit(e);assert.equal(sdk,0);finish(false);await p;assert.equal(sdk,0);assert.equal(tracked,0);
 w.LinkPreorderCheckItems=async()=>true;await form.onsubmit(e);assert.equal(sdk,1);assert.equal(tracked,1);assert.equal(form.dataset.linkPoSubmitting,undefined);
});
const P2='777',P3='888',later={...fixture,id:P2,name:'حجز دفعة أبعد',expected_arrival:'2099-11-13',ship_from:'2099-11-14',ship_by:'2099-11-16'};
test('catalog dates drive grouping in both orders; same window stays together, distinct dates require choice',()=>{
 const catalog=api.catalogOf([fixture,later,{...fixture,id:P3}]);
 for(const [ids,id,mixes] of [[[P],P2,true],[[P2],P,true],[[P],P3,false],[[P2],P2,false],[[P,P2],R,true]]){
  const decision=api.decide(api.inspect(response(ids.map(row)),catalog),id);assert.equal(decision.mixes,mixes);if(mixes){assert.equal(decision.combined.ship_by,later.ship_by);assert.equal(decision.differentDates,true);}
 }
 const overlapping=api.catalogOf([{...fixture,ship_by:'2099-12-01'},later]);const combined=api.decide(api.inspect(response([row(P)]),overlapping),P2).combined;assert.equal(combined.ship_from,later.ship_from);assert.equal(combined.ship_by,'2099-12-01');
});
test('malformed or duplicate schedule data is refused instead of classifying preorder as ready',()=>{
 for(const products of [[{...fixture,ship_by:'2099-02-30'}],[{...fixture,expected_arrival:'2099-12-01'}],[fixture,fixture],[{...fixture,status:'draft'}],[{...fixture,revision:null}]])assert.throws(()=>api.catalogOf(products));
});
test('different preorder dates display all dates and latest dispatch; same-window products do not prompt',async()=>{
 const products=[fixture,later,{...fixture,id:P3}];
 for(const [ids,id,path] of [[[P],P2,'/p777'],[[P2],P,'/p318533359']]){
  const h=await harness(ids,path,{products});assert.equal(h.validate(id).isValid,false);const text=h.d.querySelector('#po-before-add').textContent;assert.match(text,/مواعيد وصول مختلفة/);assert.match(text,/حجز دفعة أبعد/);assert.match(h.d.querySelector('[data-po-combined]').textContent,/16 نوفمبر/);await h.approve();assert.equal(h.validate(id).isValid,true);
 }
 const same=await harness([P],'/p888',{products});assert.equal(same.validate(P3).isValid,true);assert.equal(same.d.querySelector('#po-before-add'),null);
 const empty=await harness([],'/p777',{products});assert.equal(empty.validate(P2).isValid,true);assert.equal(empty.d.querySelector('#po-before-add'),null);assert.equal(empty.d.documentElement.hasAttribute('data-link-po-cart-flow'),true);
});
test('a batch date/revision change during approval resets consent; a new approval uses updated latest dates',async()=>{
 const h=await harness([P],'/p777',{products:[fixture,later]});h.validate(P2);h.setProducts([fixture,{...later,ship_from:'2099-12-01',ship_by:'2099-12-03',revision:2}]);await h.approve();assert.match(h.d.querySelector('.po-error').textContent,/مواعيد الدفعات/);assert.match(h.d.querySelector('[data-po-combined]').textContent,/3 ديسمبر/);assert.equal(h.d.querySelector('[data-po-together]').checked,undefined);await h.approve();assert.equal(h.validate(P2).isValid,true);
});
test('bulk selection of two preorder windows is confirmed once, without cart mutations',async()=>{
 const h=await harness([],'/p777',{products:[fixture,later]});const pending=h.w.LinkPreorderCheckItems([{id:P},{id:P2}]);await h.settle();assert.match(h.d.querySelector('#po-before-add').textContent,/مواعيد وصول مختلفة/);await h.approve();assert.equal(await pending,true);assert.equal(h.mutations(),0);
});
