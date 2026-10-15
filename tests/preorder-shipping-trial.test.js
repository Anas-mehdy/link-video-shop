const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {PRODUCT, snapshot, fingerprint, controller} = require('../public/preorder-shipping-trial');
const copy = x => JSON.parse(JSON.stringify(x));
const digest = async text => createHash('sha256').update(text).digest('hex');
const po = (quantity=3) => ({id:'po-line', product_id:PRODUCT, quantity, options:[]});
const ready = () => ({id:'ready-line', product_id:'981596666', quantity:2, options:[{id:17,value:'burgundy'}], attachments:[{id:'keep-in-cart'}]});
function setup(initial=[ready(),po()], initialSaved=null) {
  let rows=copy(initial), journal=copy(initialSaved), calls=[], locked=false;
  const storage={get:()=>copy(journal),set:v=>journal=copy(v)};
  const cart={
    read:async()=>({data:{items:copy(rows)}}),
    remove:async id=>{calls.push(['remove',id]); rows=rows.filter(r=>r.id!==id);return {success:true};},
    add:async payload=>{calls.push(['add',payload]);const existing=rows.find(r=>String(r.product_id)===String(payload.id)); if(existing)existing.quantity+=payload.quantity;else rows.push(po(payload.quantity));return {success:true};}
  };
  const lock=async fn=>{if(locked)throw Object.assign(Error(),{code:'busy'});locked=true;try{return await fn();}finally{locked=false;}};
  const make=()=>controller({cart,storage,lock,digest,now:()=>1792010000000});
  return {ctl:make(),make,cart,storage,calls,rows:()=>copy(rows),setRows:v=>rows=copy(v),saved:()=>copy(journal),basis:()=>fingerprint(snapshot({items:rows}).items)};
}
test('split persists before deletion; ready options/files/quantities stay intact; arbitrary preorder quantity is preserved',async()=>{
  const h=setup();const originalReady=h.rows()[0],remove=h.cart.remove;
  h.cart.remove=async id=>{assert.equal(h.saved().quantity,3);assert.equal(h.saved().stage,'separating');return remove(id);};
  const result=await h.ctl.split(h.basis());
  assert.equal(result.saved.stage,'ready');assert.deepEqual(h.rows(),[originalReady]);assert.deepEqual(h.calls,[['remove','po-line']]);
  const raw=JSON.stringify(h.saved());assert.ok(!raw.includes('burgundy'));assert.ok(!raw.includes('keep-in-cart'));
  await assert.rejects(h.ctl.restore(),{code:'cart_not_empty'});
  h.setRows([]);await assert.rejects(h.ctl.restore(),{code:'confirm_first_order'});
  await h.ctl.restore({confirmedFirstOrder:true});assert.equal(h.rows()[0].quantity,3);assert.equal(h.saved(),null);
  await assert.rejects(h.ctl.restore({confirmedFirstOrder:true}),{code:'nothing_saved'});assert.equal(h.calls.filter(c=>c[0]==='add').length,1);
});
test('quantity and option changes before split invalidate the displayed cart; no deletion',async()=>{
  const h=setup();const basis=h.basis();h.setRows([ready(),po(4)]);
  await assert.rejects(h.ctl.split(basis),{code:'cart_changed'});assert.deepEqual(h.calls,[]);assert.equal(h.saved(),null);
  const basis2=h.basis();const changed=ready();changed.options[0].value='white';h.setRows([changed,po(4)]);
  await assert.rejects(h.ctl.split(basis2),{code:'cart_changed'});assert.deepEqual(h.calls,[]);
});
test('unavailable or non-durable browser storage prevents every deletion',async()=>{
  for(const behavior of ['throws','drops']){
    const h=setup();h.storage.set=()=>{if(behavior==='throws')throw Error('quota');};
    await assert.rejects(h.ctl.split(h.basis()),{code:'storage_unavailable'});assert.equal(h.calls.length,0);assert.equal(h.rows().length,2);
  }
});
test('unsupported preorder options/attachments and unknown product IDs are never stripped or reconstructed',async()=>{
  for(const extra of [{options:[{id:1,value:'x'}]},{attachments:[{id:1}]},{custom_fields:{imei:'x'}},{product:{is_variable:true}}]){
    const h=setup([ready(),{...po(),...extra}]);await assert.rejects(h.ctl.split(h.basis()),{code:'unsupported_preorder'});assert.equal(h.calls.length,0);
  }
  assert.throws(()=>snapshot({items:[{id:PRODUCT,quantity:1}]}),{code:'unsupported_cart'});
  assert.throws(()=>snapshot({items:[{id:'x',product_id:PRODUCT,quantity:0}]}),{code:'unsupported_cart'});
  assert.throws(()=>snapshot({data:{total:100}}),{code:'cart_unavailable'});
});
test('delete timeout is resolved with a fresh read; uncertain delete never leads to checkout',async()=>{
  const h=setup(),remove=h.cart.remove;h.cart.remove=async id=>{await remove(id);throw Error('timeout');};
  assert.equal((await h.ctl.split(h.basis())).saved.stage,'ready');
  const broken=setup();broken.cart.remove=async()=>{broken.setRows([{...ready(),quantity:9}]);throw Error('timeout');};
  await assert.rejects(broken.ctl.split(broken.basis()),{code:'uncertain'});assert.equal(broken.saved().stage,'uncertain');
  await assert.rejects(broken.ctl.restore({cancel:true}),{code:'uncertain'});
});
test('failed deletion with unchanged cart cleans journal and does not lose products',async()=>{
  const h=setup();h.cart.remove=async()=>({success:false});
  await assert.rejects(h.ctl.split(h.basis()),{code:'remove_failed'});assert.equal(h.saved(),null);assert.equal(h.rows().length,2);
});
test('cancel split restores only preorder once; a changed ready cart requires review',async()=>{
  const h=setup();await h.ctl.split(h.basis());await h.ctl.restore({cancel:true});assert.deepEqual(h.rows(),[ready(),po()]);assert.equal(h.saved(),null);
  const changed=setup();await changed.ctl.split(changed.basis());changed.setRows([{...ready(),quantity:5}]);
  await assert.rejects(changed.ctl.restore({cancel:true}),{code:'cart_not_empty'});assert.equal(changed.calls.length,1);
});
test('add timeout does not retry or double quantity, including after reload',async()=>{
  const h=setup();await h.ctl.split(h.basis());h.setRows([]);
  const add=h.cart.add;h.cart.add=async p=>{await add(p);throw Error('timeout');};
  await h.ctl.restore({confirmedFirstOrder:true});assert.equal(h.saved(),null);assert.equal(h.rows()[0].quantity,3);
  // An ambiguous add + unreadable cart retains its write-ahead journal.
  const j=setup();await j.ctl.split(j.basis());j.setRows([]);const realAdd=j.cart.add,realRead=j.cart.read;
  j.cart.add=async p=>{await realAdd(p);j.cart.read=async()=>{throw Error('offline');};throw Error('timeout');};
  await assert.rejects(j.ctl.restore({confirmedFirstOrder:true}),{code:'uncertain'});assert.equal(j.saved().stage,'restoring');
  j.cart.read=realRead;const afterReload=j.make();await afterReload.recover();assert.equal(j.saved(),null);assert.equal(j.rows()[0].quantity,3);assert.equal(j.calls.filter(c=>c[0]==='add').length,1);
});
test('resume after browser closes during removal uses saved quantity, without another delete',async()=>{
  const h=setup();await h.ctl.split(h.basis());h.storage.set({...h.saved(),stage:'separating'});
  assert.equal((await h.make().recover()).saved.stage,'ready');assert.equal(h.calls.length,1);
});
test('existing preorder, partial add, stock failure or nonempty cart never trigger blind restore retry',async()=>{
  const h=setup();await h.ctl.split(h.basis());h.setRows([po(1)]);
  await assert.rejects(h.ctl.restore({confirmedFirstOrder:true}),{code:'preorder_already_present'});assert.equal(h.calls.length,1);
  for(const partial of [0,1]){
    const j=setup();await j.ctl.split(j.basis());j.setRows([]);j.cart.add=async()=>{if(partial)j.setRows([po(partial)]);return {success:false};};
    await assert.rejects(j.ctl.restore({confirmedFirstOrder:true}),{code:'uncertain'});assert.equal(j.saved().stage,'uncertain');
    await assert.rejects(j.ctl.restore({confirmedFirstOrder:true}),{code:'uncertain'});
  }
});
test('concurrent tabs cannot split the same cart; malformed journal is retained for review',async()=>{
  const h=setup();let release;h.cart.remove=()=>new Promise(r=>release=r);
  const first=h.ctl.split(h.basis());while(!release)await new Promise(r=>setImmediate(r));
  await assert.rejects(h.make().split(h.basis()),{code:'busy'});
  h.setRows([ready()]);release({success:true});await first;
  const bad=setup(undefined,{v:1,product:'other',quantity:3,stage:'ready',readyHash:'a'.repeat(64),createdAt:1});
  await assert.rejects(bad.ctl.inspect(),{code:'saved_invalid'});assert.equal(bad.calls.length,0);assert.equal(bad.saved().product,'other');
});
