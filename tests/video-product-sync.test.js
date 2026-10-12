const {test}=require('node:test');
const assert=require('node:assert/strict');
const crmPath=require.resolve('../lib/crm');
require.cache[crmPath]={id:crmPath,filename:crmPath,loaded:true,exports:{MERCHANT_ID:1829345766,sb:()=>{throw Error('Unexpected database access');},fail:(statusCode,message)=>Object.assign(Error(message),{statusCode}),redact:x=>x}};
const sync=require('../lib/video-product-sync');
test('one list request per page, upserts existing catalog without changing video links',async()=>{
 const writes=[],reads=[];
 const result=await sync.page({page:1},{database:async(path,options)=>{writes.push([path,options]);},credentials:async()=>({access_token:'test'}),get:async path=>{reads.push(path);return {data:[{id:123,name:'منتج جديد',status:'sale',is_available:true,price:{amount:100,currency:'SAR'},sale_price:{amount:0},urls:{customer:'https://linkstore-sa.com/p123'},thumbnail:'https://cdn.salla.sa/image.png'}],pagination:{totalPages:2}};}});
 assert.deepEqual(reads,['products?page=1&per_page=60']);assert.equal(result.next_page,2);assert.equal(result.requests,1);
 assert.equal(writes.length,2);assert.match(writes[1][0],/^products\?on_conflict=/);
 const [p]=JSON.parse(writes[1][1].body);assert.equal(p.external_product_id,'123');assert.equal(p.sale_price,null);assert.equal(p.url,'https://linkstore-sa.com/p123');
});
test('empty final page stops without writes or product deletion',async()=>{
 let calls=0;
 const r=await sync.page({page:2},{database:async()=>{calls++;},credentials:async()=>({access_token:'test'}),get:async()=>({data:[],pagination:{totalPages:2}})});
 assert.equal(r.done,true);assert.equal(calls,1);
});
test('invalid pages and inaccessible destination consume no Salla calls',async()=>{
 let fetched=0;const options={database:async()=>{throw Error('destination unavailable');},credentials:async()=>({}),get:async()=>{fetched++;}};
 await assert.rejects(sync.page({page:21},options));await assert.rejects(sync.page({page:1},options));assert.equal(fetched,0);
});
test('provider error is not retried and failed page is not reported as saved',async()=>{
 let fetched=0,writes=0;
 await assert.rejects(sync.page({page:1},{database:async(path,opt)=>{if(opt)writes++;},credentials:async()=>({}),get:async()=>{fetched++;throw Error('429');}}));
 assert.equal(fetched,1);assert.equal(writes,0);
});
test('product search stays local; unauthorized POST cannot start synchronization',async()=>{
 const path=require.resolve('../lib/supabase');let allowed=true,localReads=0;
 require.cache[path]={id:path,filename:path,loaded:true,exports:{MERCHANT_ID:1829345766,cors:()=>{},requireAdmin:async()=>{if(!allowed)throw Object.assign(Error('Unauthorized'),{statusCode:401});},sb:async()=>{localReads++;return [];},json:(res,status,data)=>{res.statusCode=status;res.data=data;}}};
 const handler=require('../api/video-shop-products');const res=()=>({setHeader:()=>{}});
 const search=res();await handler({method:'GET',query:{q:'كفر'}},search);assert.equal(search.statusCode,200);assert.equal(localReads,1);
 allowed=false;const blocked=res();await handler({method:'POST',body:{page:1}},blocked);assert.equal(blocked.statusCode,401);assert.equal(localReads,1);
});
