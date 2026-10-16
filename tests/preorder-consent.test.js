const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {match,fingerprint,id}=require('../lib/preorder-consent');
const items=[{product_id:'900',quantity:1,options:[]},{product_id:'901',quantity:2,options:[{id:123,value:'عنابي'}]}];
const orderItems=[{product:{id:901},quantity:2,options:[{id:9999,product_option_id:123,value:{id:567,name:'عنابي'}}]},{product:{id:900},quantity:1,options:[]}];
const schedules=[{product_id:'900',revision:1,expected_arrival:'2026-11-03',ship_from:'2026-11-04',ship_by:'2026-11-06'}];
const record=()=>({stage:'finalized',choice:'together',affirmative:true,checkout_id:'3212565107043415786',received_at:'2026-10-16T08:00:00Z',policy_version:'test-v1',policy_text:'أوافق على انتظار جميع منتجات الطلب',schedules,items,fingerprint:fingerprint(items)});
const order=()=>({checkout_id:'3212565107043415786',ordered_at:'2026-10-16T08:03:00Z',items:orderItems,schedules});
test('only exact complete evidence matches; native cart and order option ID namespaces are separate',()=>{
 assert.equal(match(record(),order()).status,'browser_record_matched');
 assert.equal(match(null,order()).status,'unrecorded');
 assert.equal(match({...record(),stage:'intent'},order()).status,'review');
 for(const change of [
  {checkout_id:'3212565107043415787'},
  {ordered_at:'2026-10-16T07:59:59Z'},
  {ordered_at:'2026-10-18T08:00:00Z'},
  {schedules:schedules.map(s=>({...s,revision:2}))},
  {schedules:[]},
  {items:orderItems.map(x=>({...x,quantity:3}))},
  {items:orderItems.map(x=>({...x,options:undefined}))},
  {items:orderItems.map(x=>({...x,options:[]}))},
  {items:orderItems.map(x=>({...x,product:{id:999}}))},
  {items:orderItems.map(x=>({...x,notes:'changed'}))},
  {items:orderItems.map(x=>({...x,sku_id:777}))},
  {items:orderItems.map(x=>({...x,options:x.options.map(o=>({...o,product_option_id:undefined,id:123}))}))},
  {items:orderItems.map(x=>({...x,options:x.options.map(o=>({...o,value:{name:'أبيض'}}))}))}
 ])assert.equal(match(record(),{...order(),...change}).status,'review',JSON.stringify(change));
 for(const change of [{affirmative:false},{fingerprint:'0'.repeat(64)},{policy_text:''},{received_at:'invalid'}])assert.equal(match({...record(),...change},order()).status,'review');
 assert.throws(()=>id(Number('3212565107043415786')),/unsafe_id/);
 assert.equal(id('3212565107043415786'),'3212565107043415786');
});
test('storage setup is isolated, append-only for service and private to public callers; activation stays off',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create table orders(id int);insert into orders values(12);
   create table existing_tracking(enabled boolean);insert into existing_tracking values(true);`);
  const sql=fs.readFileSync(__dirname+'/../docs/preorder-consent-storage-setup.sql','utf8');
  assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/\b(?:drop|truncate|delete|create\s+(?:or\s+replace\s+)?function|trigger)\b/i);
  await db.exec(sql);
  assert.equal((await db.query('select enabled from crm_preorder_consent_control')).rows[0].enabled,false);
  assert.equal((await db.query('select enabled from existing_tracking')).rows[0].enabled,true);
  assert.equal((await db.query('select id from orders')).rows[0].id,12);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(db.query('select * from crm_preorder_consent_records'),/permission denied/);
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const c=record();
  await db.query(`insert into crm_preorder_consent_records(merchant_id,checkout_id,stage,choice,affirmative,policy_version,policy_text,items,schedules,fingerprint) values(1829345766,$1,$2,$3,true,$4,$5,$6,$7,$8)`,[c.checkout_id,c.stage,c.choice,c.policy_version,c.policy_text,JSON.stringify(c.items),JSON.stringify(c.schedules),c.fingerprint]);
  const saved=(await db.query('select checkout_id,received_at from crm_preorder_consent_records')).rows[0];
  assert.equal(saved.checkout_id,c.checkout_id);assert.ok(saved.received_at);
  await assert.rejects(db.query("update crm_preorder_consent_records set choice='together'"),/permission denied/);
  await assert.rejects(db.query('delete from crm_preorder_consent_records'),/permission denied/);
  await assert.rejects(db.query(`insert into crm_preorder_consent_records(received_at) values(now())`),/permission denied/);
  await db.exec('reset role');
  const rls=await db.query("select relrowsecurity from pg_class where relname in ('crm_preorder_consent_records','crm_preorder_consent_control')");assert.ok(rls.rows.every(x=>x.relrowsecurity));
  await db.exec(fs.readFileSync(__dirname+'/../docs/preorder-consent-enable.sql','utf8'));
  assert.equal((await db.query('select enabled from crm_preorder_consent_control')).rows[0].enabled,true);
  assert.equal((await db.query('select enabled from existing_tracking')).rows[0].enabled,true);
 }finally{await db.close();}
});
