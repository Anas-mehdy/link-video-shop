const {test}=require('node:test'),assert=require('node:assert/strict');
const {project,summarize,journey}=require('../lib/service-monitor');
const stamp='2026-11-14T08:00:00Z';
test('service projection accepts only public messages and distinguishes employee identity from automation',()=>{
 const body={event:'message_created',private:false,message_type:'outgoing',conversation:{id:42,meta:{sender:{phone_number:'+966500000000'}}},sender:{id:66,type:'user'}};
 const record={p_message_id:'51',p_occurred_at:stamp};
 assert.equal(project(body,record,'66').actor,'employee');
 assert.equal(project(body,record,'77').actor,'unverified');
 assert.equal(project({...body,content_attributes:{template_params:{}}},record,'66').actor,'automation');
 assert.equal(project({...body,private:true},record,'66'),null);
 assert.equal(project({...body,event:'message_updated'},record,'66'),null);
});
test('today and month count independently and automation does not stop waiting for a verified reply',()=>{
 const event=(id,actor,occurred_at)=>({conversation_id:id,actor,occurred_at});
 const rows=[event('1','customer','2026-11-13T08:00:00Z'),event('2','customer',stamp),
 event('2','automation','2026-11-14T08:05:00Z'),event('1','unverified','2026-11-14T08:08:00Z'),event('2','employee','2026-11-14T08:20:00Z')];
 const s=summarize(rows,['2026-11-14T00:00:00+03:00','2026-11-01T00:00:00+03:00'],Date.parse('2026-11-14T09:00:00Z'));
 assert.equal(s.today.contacts,1);assert.equal(s.month.contacts,2);
 assert.equal(s.today.median_minutes,20);assert.equal(s.today.automation,1);
 assert.equal(s.conversations[0].pending_since,rows[0].occurred_at);
 assert.equal(s.conversations[0].unverified_after,true);
 assert.equal(s.conversations[1].pending_since,null);
});
test('journey refuses ambiguous phone matches and never returns the phone number',async()=>{
 let calls=0;
 const result=await journey('42',async path=>{
  calls++;
  if(path.startsWith('crm_service_monitor_messages?'))return [{contact_phone:'966500000000',actor:'customer',occurred_at:stamp}];
  if(path.startsWith('customers?'))return [{id:'a'},{id:'b'}];
  throw Error('Unexpected query');
 });
 assert.equal(calls,2);assert.equal(result.match,'ambiguous');
 assert.equal(result.messages[0].contact_phone,undefined);
 assert.deepEqual(result.orders,[]);
});
test('monitor storage is private and repeated delivery inserts only one message',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs');
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls');
  await db.exec(fs.readFileSync(require.resolve('../crm-service-monitor.sql'),'utf8'));
  for(const role of ['anon','authenticated']){
   const {rows:[privileges]}=await db.query("select has_table_privilege($1,'crm_service_monitor_messages','select,insert') as allowed",[role]);
   assert.equal(privileges.allowed,false);
  }
  await db.exec("set role service_role; insert into crm_service_monitor_messages(merchant_id,message_id,conversation_id,actor,occurred_at) values (1829345766,'51','42','customer',now()),(1829345766,'51','42','customer',now()) on conflict do nothing;");
  const {rows:[result]}=await db.query('select count(*)::int as total from crm_service_monitor_messages');
  assert.equal(result.total,1);
 }finally{await db.close();}
});
