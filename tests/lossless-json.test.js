const {test}=require('node:test'),assert=require('node:assert/strict');
const parse=require('../lib/lossless-json');
test('Unsafe integer tokens retain exact digits while strings, decimals, and safe integers stay intact',()=>{
 const v=parse('{"id":3194693797752685754,"nested":{"checkout_id":3194693797752685754},"safe":1135272158,"amount":154.76,"decimal":0.123456789012345678,"text":"3194693797752685754"}');
 assert.equal(v.id,'3194693797752685754');assert.equal(v.nested.checkout_id,v.id);assert.equal(v.safe,1135272158);assert.equal(v.amount,154.76);assert.equal(v.decimal,0.123456789012345678);assert.equal(v.text,v.id);
});
test('Salla raw webhook ingestion preserves purchased-cart IDs and existing token authentication',async()=>{
 const env={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,secret:process.env.SALLA_WEBHOOK_SECRET};
 const original=global.fetch;process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.SALLA_WEBHOOK_SECRET='test-secret';
 // Reload the isolated DB module after setting this test's environment.
 for(const p of ['../lib/supabase','../lib/crm','../lib/salla-sync','../api/salla-webhook'])delete require.cache[require.resolve(p)];
 const handler=require('../api/salla-webhook');let stored;
 global.fetch=async(url,options)=>{if(url.includes('/rpc/crm_ingest_event')){stored=JSON.parse(options.body);return new Response(JSON.stringify({duplicate:false,event_id:'11111111-1111-4111-8111-111111111111'}));}if(url.includes('/crm_event_inbox?'))return new Response('[]');assert.fail(url);};
 const raw=Buffer.from('{"merchant":1829345766,"event":"abandoned.cart.purchased","created_at":"2026-10-11T15:22:55Z","data":{"id":3194693797752685754,"status":"purchased"}}');
 const req={method:'POST',headers:{authorization:'test-secret'},body:raw};const res={setHeader(){},end(v){this.body=JSON.parse(v);}};
 try {await handler(req,res);assert.equal(res.statusCode,200);assert.equal(stored.p_payload.data.id,'3194693797752685754');}
 finally{global.fetch=original;for(const [k,v] of [['SUPABASE_URL',env.url],['SUPABASE_SERVICE_ROLE_KEY',env.key],['SALLA_WEBHOOK_SECRET',env.secret]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('Lossless database reads preserve JSONB checkout IDs without changing default parsing',async()=>{
 const original=global.fetch;global.fetch=async()=>new Response('[{"source_payload":{"checkout_id":3194693797752685754}}]');
 try{const {sb}=require('../lib/supabase');const rows=await sb('orders',{preserveLargeIntegers:true});assert.equal(rows[0].source_payload.checkout_id,'3194693797752685754');}finally{global.fetch=original;}
});
