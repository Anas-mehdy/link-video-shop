const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');const boot=require('../public/preorder-bootstrap');
function setup(href='https://linkstore-sa.com/category'){
 const {document:d,window:dom}=parseHTML('<html><head></head><body><salla-add-product-button product-id="318533359"></salla-add-product-button></body></html>');
 const timers=new Map();let n=0,calls=0;const w={document:d,location:{href},setTimeout:f=>{timers.set(++n,f);return n;},clearTimeout:i=>timers.delete(i)};
 const complete=()=>{w.LinkPreorderCheckItems=async()=>{calls++;return true;};w.LinkPreorderBeforeAddStatus={ready:true};d.dispatchEvent(new dom.Event('link:preorders-ready'));};
 const click=()=>{const e=new dom.Event('click',{bubbles:true,cancelable:true});d.querySelector('salla-add-product-button').dispatchEvent(e);return e.defaultPrevented;};
 return {w,d,dom,timers,complete,click,calls:()=>calls};
}
test('live bootstrap is store scoped, excludes checkout/cart and installs once',()=>{
 for(const href of ['https://example.com/','https://salla.sa/other/','https://linkstore-sa.com/cart','https://linkstore-sa.com/checkout/123','https://salla.sa/linkstore122/cart']){const h=setup(href);boot(h.w);assert.equal(h.d.querySelector('script'),null);assert.equal(h.click(),false);}
 const h=setup();boot(h.w);boot(h.w);assert.equal(h.d.querySelectorAll('script').length,1);assert.equal(h.d.querySelector('script').dataset.beforeAdd,'1');assert.match(h.d.querySelector('script').src,/preorder-before-add/);
});
test('loading blocks early native clicks and queues explicit integrations until the real guard is ready',async()=>{
 const h=setup();boot(h.w);assert.equal(h.click(),true);const stub=h.w.LinkPreorderCheckItems;const pending=stub([{id:318533359}]);assert.equal(h.calls(),0);h.complete();assert.equal(await pending,true);assert.equal(h.calls(),1);assert.equal(h.click(),false);assert.equal(h.w.__linkPreorderBootstrap.ready,true);assert.equal(h.timers.size,0);
});
test('failed asset never silently permits native or custom additions',async()=>{
 const h=setup();boot(h.w);const pending=h.w.LinkPreorderCheckItems([{id:318533359}]);h.d.querySelector('script').dispatchEvent(new h.dom.Event('error'));await assert.rejects(pending,/preorder_guard_unavailable/);assert.equal(h.click(),true);assert.equal(h.w.__linkPreorderBootstrap.error,true);
});
test('already initialized guard is reused, and sidebar embeds the exact bootstrap without changing navigation source',()=>{
 const h=setup();h.complete();boot(h.w);assert.equal(h.d.querySelector('script'),null);assert.equal(h.click(),false);
 const sidebar=fs.readFileSync(__dirname+'/../public/link-sidebar.js','utf8'),bootstrap=fs.readFileSync(__dirname+'/../public/preorder-bootstrap.js','utf8');assert.ok(sidebar.startsWith('/* LINK_PREORDER_BOOTSTRAP_START */\n'+bootstrap+'/* LINK_PREORDER_BOOTSTRAP_END */\n'));
});
