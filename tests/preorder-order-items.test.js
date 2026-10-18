const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=require('../lib/preorder-order-items');
const order={external_order_id:'123',source_payload:{checkout_id:'3214748227075509432',updated_at:'2026-10-18T19:42:53Z',items:[{product:{id:900},quantity:1},{product:{id:901},quantity:2}]}};
const result={success:true,data:[{product:{id:900},quantity:1,options:[]},{product:{id:901},quantity:2,options:[{product_option_id:45,value:{name:'أبيض'}}]}],pagination:{currentPage:1,totalPages:1,total:2}};
function db(){const rows=new Map();return {rows,call:async(path,opt={})=>{
 const q=new URLSearchParams(path.split('?')[1]),key=opt.method==='POST'?JSON.parse(opt.body).snapshot_key:q.get('snapshot_key').slice(3),old=rows.get(key);
 if(opt.method==='POST'){if(old)return [];const row=JSON.parse(opt.body);rows.set(key,row);return [row];}
 if(opt.method==='PATCH'){if(q.has('retry_after')&&Date.parse(old.retry_after)>Date.parse(q.get('retry_after').slice(4)))return [];Object.assign(old,JSON.parse(opt.body));return [old];}
 return old?[old]:[];
 }};}
test('dedicated endpoint preserves order-option identity and refuses omitted options, partial pages and changed contents',()=>{
 assert.equal(api.canonicalItems(result,order)[1].options[0].product_option_id,'45');
 for(const change of [{data:[result.data[0]]},{data:result.data.map(i=>({...i,options:undefined}))},{pagination:{currentPage:1,totalPages:2,total:3}},{data:[result.data[0],{...result.data[1],quantity:3}]}])assert.throws(()=>api.canonicalItems({...result,...change},order));
});
test('only the claim winner fetches; a bound snapshot is cached and an order change requires a new lookup',async()=>{
 const d=db();let calls=0;const provider=async path=>{calls++;assert.equal(path,'orders/items?order_id=123&per_page=100');return result;};
 const options={database:d.call,provider};
 const values=await Promise.all([api.resolve(order,options),api.resolve(order,options)]);assert.equal(calls,1);assert.ok(values.some(Boolean));
 await api.resolve(order,options);assert.equal(calls,1);
 await api.resolve({...order,source_payload:{...order.source_payload,updated_at:'2026-10-18T19:50:00Z'}},options);assert.equal(calls,2);
 const rearranged={external_order_id:'123',source_payload:{items:order.source_payload.items,updated_at:order.source_payload.updated_at,checkout_id:order.source_payload.checkout_id}};
 assert.equal(api.key(order),api.key(rearranged));
});
test('outages and incomplete provider items have a cooldown and never manufacture empty options',async()=>{
 const d=db();let calls=0;const options={database:d.call,now:Date.now(),provider:async()=>{calls++;throw Error('PRIVATE_TOKEN');}};
 assert.equal(await api.resolve(order,options),null);assert.equal(await api.resolve(order,options),null);assert.equal(calls,1);
 assert.doesNotMatch(JSON.stringify([...d.rows.values()]),/PRIVATE_TOKEN/);
});
test('cache schema is private and independent of orders and consent evidence',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),pg=new PGlite();try{
 await pg.exec('create role anon;create role authenticated;create role service_role;');
 await pg.exec(fs.readFileSync(__dirname+'/../docs/preorder-order-items-cache.sql','utf8'));
 const {rows}=await pg.query("select relrowsecurity from pg_class where oid='crm_preorder_order_item_cache'::regclass");assert.equal(rows[0].relrowsecurity,true);
 const rights=await pg.query("select has_table_privilege('anon','crm_preorder_order_item_cache','SELECT') as anon,has_table_privilege('service_role','crm_preorder_order_item_cache','INSERT') as service");assert.deepEqual(rights.rows[0],{anon:false,service:true});
 }finally{await pg.close();}
});
