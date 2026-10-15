const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const api=require('../public/preorder-before-add');
const P=api.PRODUCT,R='999',row=id=>({product_id:id,quantity:2}),response=items=>({data:{items}});
test('both directions mix; empty and homogeneous carts do not',()=>{
 for(const [ids,id,mixes] of [[[],P,false],[[P],P,false],[[R],R,false],[[R],P,true],[[P],R,true],[[P,R],R,true]])assert.equal(api.decide(api.inspect(response(ids.map(row))),id).mixes,mixes);
});
test('approval is one-use and bound to product and full cart quantities/options',()=>{
 const g=api.gate();g.update(response([row(R)]));assert.equal(g.validate(P).allowed,false);g.grant(P);assert.equal(g.validate(P).allowed,true);assert.equal(g.validate(P).allowed,false);
 g.grant(P);g.update(response([{...row(R),options:[{id:1,value:'red'}]}]));assert.equal(g.validate(P).allowed,false);
 g.grant(P);g.invalidate();assert.equal(g.validate(P).reason,'loading');
});
test('malformed cart never passes; cart URLs preserve store prefix',()=>{
 for(const x of [{},{data:{items:[{id:123,quantity:1}]}},{success:false,data:{items:[]}}])assert.throws(()=>api.inspect(x));
 assert.equal(api.cartURL({href:'https://salla.sa/linkstore122/foo/p123'}),'https://salla.sa/linkstore122/cart');assert.equal(api.cartURL({href:'https://salla.sa/other/p123'}),null);assert.equal(api.cartURL({href:'https://linkstore-sa.com/foo/p123'}),'https://linkstore-sa.com/cart');
});
async function harness(ids=[],path='/frame/p318533359'){
 const {document:d,window:dom}=parseHTML('<html><head></head><body><button id="native">أضف</button></body></html>');
 const s=d.createElement('script');s.src='https://link-video-shop.vercel.app/preorder-before-add.js';s.dataset.beforeAdd='1';Object.defineProperty(d,'currentScript',{value:s});
 let rows=ids.map(row),reads=0,notice='',mutations=0;const events={},timers=new Map();let serial=0;
 const w={document:d,location:{pathname:path,href:'https://salla.sa/linkstore122'+path},addEventListener:dom.addEventListener.bind(dom),setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),fetch:async()=>({ok:true,json:async()=>({ok:true,products:[{id:P,status:'open',ship_from:'2099-11-04',ship_by:'2099-11-06'}]})})};
 w.salla={onReady:fn=>fn(),notify:{success:x=>notice=x},cart:{details:async()=>{reads++;return response(rows);},addItem:()=>mutations++,deleteItem:()=>mutations++,event:{onItemAdded:fn=>events.add=fn,onItemUpdated:fn=>events.update=fn}}};
 const settle=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
 api.start(w);await settle();
 const validate=(id,isValid=true)=>{let button=d.querySelector('salla-add-product-button');if(!button){button=d.createElement('salla-add-product-button');d.body.appendChild(button);}button.setAttribute('product-id',id);const e=new dom.Event('click',{bubbles:true,cancelable:true});if(!isValid)e.preventDefault();button.dispatchEvent(e);return {isValid:!e.defaultPrevented};};
 const click=async selector=>{d.querySelector(selector).dispatchEvent(new dom.Event('click',{bubbles:true}));await settle();};
 const approve=async()=>{const box=d.querySelector('[data-po-together]');box.checked=true;box.dispatchEvent(new dom.Event('change',{bubbles:true}));await click('[data-po-approve]');};
 return {w,d,validate,approve,click,settle,events,setRows:ids=>rows=ids.map(row),reads:()=>reads,notice:()=>notice,mutations:()=>mutations,hook:()=>w.LinkPreorderBeforeAddStatus?.ready};
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
 h.setRows([R,P]);h.events.update();await h.settle();assert.match(h.d.querySelector('#po-before-add').textContent,/تجمع النوعين بالفعل/);assert.equal(h.mutations(),0);
});
test('native cart and checkout routes do zero IO and register no hook',async()=>{
 for(const path of ['/cart','/linkstore122/cart','/checkout/step']){const h=await harness([P,R],path);assert.equal(h.reads(),0);assert.equal(h.hook(),undefined);assert.equal(h.d.querySelector('#po-before-add'),null);}
});
test('runtime contains no cart mutation, storage, click replay or checkout interception',()=>{
 const source=fs.readFileSync(require.resolve('../public/preorder-before-add'),'utf8');assert.doesNotMatch(source,/\.addItem\(|\.deleteItem\(|localStorage|\.click\(|addEventListener\(['"]submit/);
});
