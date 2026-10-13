const {test}=require('node:test'),assert=require('node:assert/strict');
const {add}=require('../public/complete-cart');
const items=[{id:'11',quantity:1,options:{'99':'123'}},{id:'22',quantity:2},{id:'33',quantity:1}];
function state(){const s={};return {s,getState:id=>s[id],setState:(id,v)=>{s[id]=v;}};}
test('one click adds selected quantities and exact option IDs, preserving claim before each call',async()=>{
 const x=state(),calls=[];const r=await add(items,{...x,addItem:async p=>{assert.equal(x.s[String(p.id)],'sending');calls.push(p);return {success:true};}});
 assert.equal(r.complete,true);assert.deepEqual(calls[0].options,{'99':'123'});assert.equal(calls[1].quantity,2);assert.equal(calls.length,3);
});
test('partial explicit rejection leaves successes and retry never duplicates them',async()=>{
 const x=state(),calls=[];const r=await add(items,{...x,addItem:async p=>{calls.push(p.id);return {success:p.id!==22};}});assert.equal(r.complete,false);
 calls.length=0;const retry=await add(items,{...x,addItem:async p=>{calls.push(p.id);return {success:true};}});assert.deepEqual(calls,[22]);assert.equal(retry.complete,true);
});
test('ambiguous timeout blocks retries and stops remaining additions',async()=>{
 const x=state();let calls=0;const r=await add(items,{...x,timeoutMs:5,addItem:async()=>{calls++;return new Promise(()=>{});}});assert.equal(r.results[0].status,'unknown');assert.equal(calls,1);
 await add(items,{...x,addItem:async()=>{calls++;}});assert.equal(calls,1);
});
test('invalid or unsafe identifiers and duplicates are rejected before any mutation',async()=>{
 const x=state();let calls=0;const opt={...x,addItem:async()=>{calls++;}};
 await assert.rejects(add([{id:'9007199254740993',quantity:1}],opt));await assert.rejects(add([items[0],items[0]],opt));await assert.rejects(add([{id:'11',quantity:0}],opt));assert.equal(calls,0);
});
test('missing durable storage blocks addition and uncertain malformed success remains blocked',async()=>{
 let calls=0;await assert.rejects(add(items,{getState:()=>null,setState:()=>{throw Error('storage');},addItem:async()=>{calls++;}}));assert.equal(calls,0);
 const x=state();const r=await add(items,{...x,addItem:async()=>({})});assert.equal(r.complete,false);assert.equal(x.s['11'],'unknown');
});
