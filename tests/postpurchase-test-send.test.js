const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const crm=path.resolve(__dirname,'../lib/crm.js'),preview=path.resolve(__dirname,'../lib/postpurchase-preview.js');
require.cache[crm]={id:crm,filename:crm,loaded:true,exports:{MERCHANT_ID:1829345766,fail:(statusCode,message)=>Object.assign(Error(message),{statusCode})}};
const row={external_order_id:'111',offer_product_id:'222',customer_name:'أنس',purchased_name:'كفر ايفون 17 برو',offer_name:'حماية عدسات ايفون 17 برو',product_url:'https://linkstore-sa.com/lenses/p222',reason:'stock_check_required'};
require.cache[preview]={id:preview,filename:preview,loaded:true,exports:{loadRows:async()=>[],loadCatalog:async()=>[],buildPreview:()=>({rows:[row]})}};
const sender=require('../lib/postpurchase-test-send');
const body={confirm_test:true,request_id:'11111111-1111-4111-8111-111111111111',external_order_id:'111',offer_product_id:'222'};
const environment={WHATSAPP_TEST_PHONE:'905350215375',ETISALNA_API_ACCESS_TOKEN:'test'};
test('image, three positional variables and correctly indexed buttons',()=>{
 const m=sender.payload(row,'https://cdn.salla.sa/image.png',environment.WHATSAPP_TEST_PHONE);
 assert.equal(m.contact.phone_number,'+905350215375');const c=m.message.whatsapp_template.components;
 assert.equal(c[0].parameters[0].image.link,'https://cdn.salla.sa/image.png');assert.equal(c[1].parameters.length,3);
 assert.equal(c[2].index,'0');assert.equal(c[3].index,'1');assert.equal(c[3].parameters[0].text,'lenses/p222');
 assert.throws(()=>sender.payload({...row,product_url:'https://evil.com/p222'},'https://cdn.salla.sa/image.png',environment.WHATSAPP_TEST_PHONE));
});
test('durable claim precedes one provider send; recipient comes only from server allowlist',async()=>{
 const calls=[];let captured;
 const database=async(p,o)=>{calls.push(p);if(p.startsWith('products?'))return [{main_image_url:'https://cdn.salla.sa/image.png'}];return [];};
 const result=await sender.send({...body,phone:'966555555555'},{database,environment,request:async(url,opt)=>{assert.equal(calls.at(-1),'crm_postpurchase_test_sends');captured=JSON.parse(opt.body);return {status:201,json:async()=>({message_id:999})};}});
 assert.equal(captured.contact.phone_number,'+905350215375');assert.equal(result.sent,true);assert.equal(result.salla_requests,0);assert.equal(result.delivery_confirmed,false);
});
test('duplicate claims and missing confirmation never contact provider',async()=>{
 let sends=0;const database=async p=>{if(p.startsWith('products?'))return [{thumbnail_url:'https://cdn.salla.sa/a.jpg'}];if(p==='crm_postpurchase_test_sends')throw Object.assign(Error('duplicate'),{statusCode:409});return [];};
 const options={database,environment,request:async()=>{sends++;}};
 assert.equal((await sender.send(body,options)).status,'duplicate');await assert.rejects(sender.send({...body,confirm_test:false},options));assert.equal(sends,0);
});
test('timeout records unknown and does not retry',async()=>{
 let sends=0,patch;
 const database=async(p,o)=>{if(p.startsWith('products?'))return [{thumbnail_url:'https://cdn.salla.sa/a.jpg'}];if(o?.method==='PATCH')patch=JSON.parse(o.body);return [];};
 const r=await sender.send(body,{database,environment,request:async()=>{sends++;throw Error('timeout');}});
 assert.equal(sends,1);assert.equal(r.status,'unknown');assert.equal(patch.status,'unknown');
});
test('SQL is rerunnable and test log is private',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role;');
 const sql=fs.readFileSync(path.join(__dirname,'../crm-postpurchase-test-send.sql'),'utf8');await db.exec(sql);await db.exec(sql);
 const r=await db.query("select relrowsecurity from pg_class where relname='crm_postpurchase_test_sends'");assert.equal(r.rows[0].relrowsecurity,true);
 const grants=await db.query("select has_table_privilege('anon','public.crm_postpurchase_test_sends','SELECT') a,has_table_privilege('authenticated','public.crm_postpurchase_test_sends','INSERT') b");assert.equal(grants.rows[0].a,false);assert.equal(grants.rows[0].b,false);await db.close();
});
