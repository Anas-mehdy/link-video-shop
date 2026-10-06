const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('foundation SQL: setup, privileges, transactional ingestion, lifecycle and simulation',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const sql=fs.readFileSync(path.join(__dirname,'../crm-foundation.sql'),'utf8');
    await db.exec(sql);
    assert.equal((await db.query('select count(*)::int n from crm_automation_rules')).rows[0].n,3);
    assert.equal((await db.query("select has_table_privilege('anon','crm_connections','select') allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_function_privilege('authenticated','crm_process_events(bigint,integer)','execute') allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_function_privilege('service_role','crm_process_events(bigint,integer)','execute') allowed")).rows[0].allowed,true);
    assert.equal((await db.query("select count(*)::int n from pg_class where relname like 'crm_%' and relkind='r' and relrowsecurity")).rows[0].n,4);
    async function ingest(key,name,time,credentials=null,expiry=null){
      return (await db.query('select crm_ingest_event($1,$2,$3,$4,$5,$6,$7) result',[1829345766,key.repeat(64),name,time,JSON.stringify({data:{id:1}}),credentials,expiry])).rows[0].result;
    }
    const a=await ingest('a','app.store.authorize','2026-10-06T10:00:00Z','v1.encrypted','2026-10-20T10:00:00Z');
    assert.equal(a.duplicate,false);
    assert.equal((await ingest('a','app.store.authorize','2026-10-06T10:00:00Z','v1.encrypted','2026-10-20T10:00:00Z')).duplicate,true);
    assert.equal((await db.query('select count(*)::int n from crm_event_inbox')).rows[0].n,1);
    await ingest('b','app.uninstalled','2026-10-06T11:00:00Z');
    await ingest('c','app.store.authorize','2026-10-06T10:30:00Z','v1.old','2026-10-20T10:00:00Z');
    const state=(await db.query("select * from crm_connections where provider='salla'")).rows[0];
    assert.equal(state.status,'revoked');assert.equal(state.credentials_encrypted,null);
    // Deliberately fail the connection write: inbox insertion must roll back with it.
    await db.exec("create function public.reject_connection() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end; $$; create trigger reject_connection before update on crm_connections for each row execute function public.reject_connection();");
    await assert.rejects(ingest('d','app.store.authorize','2026-10-06T12:00:00Z','v1.new','2026-10-20T10:00:00Z'));
    assert.equal((await db.query('select count(*)::int n from crm_event_inbox')).rows[0].n,3);
    await db.exec('drop trigger reject_connection on crm_connections;');
    await db.query("select crm_process_events(1829345766,20)");
    assert.equal((await db.query('select count(*)::int n from crm_automation_runs')).rows[0].n,0);
    await db.exec("update crm_automation_rules set enabled=true where event_name='order.created';");
    await ingest('e','order.created','2026-10-06T12:00:00Z');
    assert.equal((await db.query('select crm_process_events(1829345766,20) n')).rows[0].n,1);
    assert.equal((await db.query('select crm_process_events(1829345766,20) n')).rows[0].n,0);
    const run=(await db.query('select * from crm_automation_runs')).rows[0];assert.equal(run.status,'simulated');assert.equal(run.summary.message_sent,false);
    await assert.rejects(db.exec("update crm_automation_rules set mode='live';"));
    await db.exec(sql);
    assert.equal((await db.query('select count(*)::int n from crm_automation_runs')).rows[0].n,1);
    assert.equal((await db.query("select enabled from crm_automation_rules where event_name='order.created'")).rows[0].enabled,true);
  }finally{await db.close();}
});
