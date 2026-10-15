const {test}=require('node:test'),assert=require('node:assert/strict');
const {orderPlans}=require('../lib/preorders');
const batches=[{id:'a',expected_arrival:'2026-11-03',ship_from:'2026-11-04',ship_by:'2026-11-06'},{id:'b',expected_arrival:'2026-11-13',ship_from:'2026-11-14',ship_by:'2026-11-16'}];
const row=(batch_id,state='reserved')=>({external_order_id:'123',batch_id,state,quantity:2,allocated_quantity:state==='allocated'?2:0,promised_ship_from:batches.find(b=>b.id===batch_id).ship_from,promised_ship_by:batches.find(b=>b.id===batch_id).ship_by});
test('all reservation batches determine combined dispatch and one allocated early line cannot release whole order',()=>{
 let plan=orderPlans([row('a','allocated'),row('b')],batches)['123'];assert.equal(plan.hold_full_order,true);assert.equal(plan.preorders_allocated,false);assert.equal(plan.ship_by,'2026-11-16');assert.equal(plan.shipping_groups,2);
 plan=orderPlans([row('a','allocated'),row('b','allocated')],batches)['123'];assert.equal(plan.hold_full_order,false);assert.equal(plan.preorders_allocated,true);
});
test('a delayed later batch changes current full-order date but preserves evidence of original promise',()=>{
 const r=[row('a'),row('b')],later=batches.map(b=>b.id==='b'?{...b,ship_from:'2026-11-24',ship_by:'2026-11-26'}:b);const plan=orderPlans(r,later)['123'];assert.equal(plan.ship_by,'2026-11-26');assert.equal(plan.schedule_delayed,true);assert.equal(r[1].promised_ship_by,'2026-11-16');
});
test('cancelled later lines no longer delay active order; incomplete metadata or partial dispatch never releases',()=>{
 let plan=orderPlans([row('a','allocated'),row('b','cancelled')],batches)['123'];assert.equal(plan.ship_by,'2026-11-06');assert.equal(plan.preorders_allocated,true);
 for(const plan of [orderPlans([row('a','allocated'),row('b','allocated')],batches,false)['123'],orderPlans([row('a','allocated'),row('b','allocated')],[batches[0]])['123'],orderPlans([row('a','shipped'),row('b')],batches)['123']]){assert.equal(plan.preorders_allocated,false);assert.equal(plan.hold_full_order,true);}
});
