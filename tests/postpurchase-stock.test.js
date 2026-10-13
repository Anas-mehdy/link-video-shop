const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const crm=path.resolve(__dirname,'../lib/crm.js'),sync=path.resolve(__dirname,'../lib/salla-sync.js');
require.cache[crm]={id:crm,filename:crm,loaded:true,exports:{MERCHANT_ID:1829345766,fail:(statusCode,message)=>Object.assign(Error(message),{statusCode})}};
require.cache[sync]={id:sync,filename:sync,loaded:true,exports:{losslessJSON:JSON.parse}};
const stock=require('../lib/postpurchase-stock');
const product={id:123,status:'sale',is_available:true,quantity:5,price:{amount:80,currency:'SAR'},skus:[]};
test('variant stock overrides product totals and never assumes a zero stock color available',()=>{
 assert.equal(stock.snapshot(product,'123').available,true);
 assert.equal(stock.snapshot({...product,skus:[{id:11,stock_quantity:0,related_option_values:[1]}]},'123').available,false);
 const p=stock.snapshot({...product,skus:[{id:11,stock_quantity:0,related_option_values:[1]},{id:12,stock_quantity:2,related_option_values:[2]}]},'123');assert.equal(p.available,true);assert.equal(p.skus[0].quantity,0);
 assert.equal(stock.snapshot({...product,status:'hidden'},'123').available,false);
 assert.throws(()=>stock.snapshot({...product,managed_by_branches:true},'123'));
 assert.throws(()=>stock.snapshot({...product,id:9007199254740992},'123'));
});
function mock(){const rows=new Map();let used=0,calls=[];return {rows,calls,database:async(p,o)=>{calls.push(p);if(p.startsWith('crm_pp_stock_cache?'))return [...rows.values()];if(p.startsWith('crm_pp_stock_usage?'))return [{requests:used}];const b=JSON.parse(o.body);if(p.endsWith('reserve')){used++;rows.set(b.p_product_id,{product_id:b.p_product_id,state:'checking'});return {reason:'reserved',token:'11111111-1111-4111-8111-111111111111',requests:used,budget:700};}if(p.endsWith('finish')){rows.set(b.p_product_id,{product_id:b.p_product_id,state:b.p_error?'error':'checked',available:b.p_snapshot.available,checked_at:b.p_error?null:new Date().toISOString(),retry_after:b.p_error?new Date(Date.now()+900000).toISOString():null,snapshot:b.p_snapshot});return true;}}};}
test('two calls maximum, deduplication, reserve before IO and fresh cache reuse',async()=>{
 const m=mock();let calls=0;const options={database:m.database,getTokens:async()=>({access_token:'test'}),request:async url=>{assert.equal(m.calls.at(-1),'rpc/crm_pp_stock_reserve');calls++;const id=url.split('/').pop();return {ok:true,text:async()=>JSON.stringify({success:true,data:{...product,id}})};}};
 const r=await stock.checkIds(['123','123','124','125'],options);assert.equal(calls,2);assert.equal(r.has_more,true);
 const again=await stock.checkIds(['123','124'],options);assert.equal(again.salla_requests,0);assert.equal(calls,2);
});
test('budget exhaustion prevents provider call; missing SQL prevents credential access',async()=>{
 let calls=0;const database=async(p)=>p.startsWith('crm_pp_stock_cache?')?[]:{reason:'budget_limit',requests:700,budget:700};
 const r=await stock.checkIds(['123'],{database,getTokens:async()=>({access_token:'test'}),request:async()=>calls++});assert.equal(calls,0);assert.equal(r.has_more,false);
 await assert.rejects(stock.checkIds(['123'],{database:async()=>{throw Object.assign(Error('missing'),{code:'42P01'})},getTokens:async()=>{throw Error('must not read secrets')}}),/crm-postpurchase-stock.sql/);
});
test('provider failure stops remaining products and records cooldown without retry',async()=>{
 const m=mock();let calls=0;const options={database:m.database,getTokens:async()=>({access_token:'test'}),request:async()=>{calls++;throw Error('timeout')}};
 const r=await stock.checkIds(['123','124'],options);assert.equal(calls,1);assert.equal(r.has_more,false);assert.equal(r.results[0].status,'error');
 await stock.checkIds(['123'],options);assert.equal(calls,1);
});
test('rerunnable SQL: budget and lease are enforced by the database, private grants',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;create table crm_postpurchase_settings(merchant_id bigint primary key,stock_api_budget int);insert into crm_postpurchase_settings values(1829345766,1)');const sql=fs.readFileSync(path.join(__dirname,'../crm-postpurchase-stock.sql'),'utf8');await db.exec(sql);await db.exec(sql);
 let r=await db.query("select crm_pp_stock_reserve(1829345766,'123') v");assert.equal(r.rows[0].v.reason,'reserved');const token=r.rows[0].v.token;
 r=await db.query("select crm_pp_stock_reserve(1829345766,'123') v");assert.equal(r.rows[0].v.reason,'busy');
 r=await db.query("select crm_pp_stock_reserve(1829345766,'124') v");assert.equal(r.rows[0].v.reason,'budget_limit');
 r=await db.query("select crm_pp_stock_finish(1829345766,'123',$1,$2::jsonb,false) v",[token,JSON.stringify({id:'123',available:true})]);assert.equal(r.rows[0].v,true);
 r=await db.query("select crm_pp_stock_reserve(1829345766,'123') v");assert.equal(r.rows[0].v.reason,'cached');assert.equal(r.rows[0].v.requests,1);
 r=await db.query("select has_table_privilege('anon','crm_pp_stock_cache','SELECT') v");assert.equal(r.rows[0].v,false);await db.close();
});
