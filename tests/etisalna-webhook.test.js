const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {normalize}=require('../lib/etisalna-webhook');
const now=Date.parse('2026-10-08T15:00:00Z'), secret='synthetic-test-secret';
function envelope(changes={}) {
 const raw=Buffer.from(JSON.stringify({account:{id:12},inbox:{id:40},conversation:{inbox_id:40,channel:'Channel::Whatsapp'},id:123,event:'message_created',created_at:'2026-10-08T14:59:00Z',message_type:'incoming',private:false,content_type:'text',content:'إلغاء الاشتراك',sender:{phone_number:'+966500000001'},...changes}));
 const timestamp=String(now/1000);
 return {raw_body_base64:raw.toString('base64'),headers:{'x-chatwoot-timestamp':timestamp,'x-chatwoot-signature':'sha256='+crypto.createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex')}};
}
test('WhatsApp signature authenticates exact bytes and timestamp before accepting optout',()=>{
 assert.equal(normalize(envelope(),secret,now).p_phone,'966500000001');
 for(const content of ['STOP',' unsubscribe ','الغاء الاشتراك'])assert.equal(normalize(envelope({content}),secret,now).p_phone,'966500000001');
 for(const changes of [{content:'اختبار الربط'},{content:'لا أريد إلغاء الاشتراك'},{private:true},{message_type:'outgoing'}])assert.equal(normalize(envelope(changes),secret,now).p_phone,null);
 assert.equal(normalize(envelope({content:'مساعدة'}),secret,now).p_reply_phone,'966500000001');
 for(const changes of [{private:true},{message_type:'outgoing'}])assert.equal(normalize(envelope(changes),secret,now).p_reply_phone,null);
 assert.throws(()=>normalize(envelope(),'',now),{statusCode:503});
 assert.throws(()=>normalize(envelope(),secret,now+301000),{statusCode:401});
 assert.throws(()=>normalize(envelope(),secret+'wrong',now),{statusCode:401});
 const tampered=envelope();tampered.raw_body_base64=Buffer.from(Buffer.from(tampered.raw_body_base64,'base64').toString()+' ').toString('base64');
 assert.throws(()=>normalize(tampered,secret,now),{statusCode:401});
 for(const changes of [{account:{id:13}},{inbox:{id:41}},{conversation:{inbox_id:41}},{conversation:{channel:'Channel::WebWidget'}}])assert.throws(()=>normalize(envelope(changes),secret,now),{statusCode:403});
 for(const changes of [{id:9007199254740992},{event:'contact_created'},{created_at:'invalid'},{sender:{phone_number:'bad'}}])assert.throws(()=>normalize(envelope(changes),secret,now),{statusCode:400});
 assert.throws(()=>normalize({...envelope(),raw_body_base64:'%%%bad'},secret,now),{statusCode:400});
});
test('WhatsApp SQL atomically persists optout, cancels pending carts and deduplicates; private permissions',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
  const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json','utf8'));
  for(const table of schema.reverse())await db.exec(`create table ${table.table_name}(${table.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(table.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
  await db.exec(fs.readFileSync(__dirname+'/../crm-cart-followup.sql','utf8'));
  const sql=fs.readFileSync(__dirname+'/../crm-whatsapp-events.sql','utf8');await db.exec(sql);await db.exec(sql);
  await db.exec("insert into crm_cart_followup_settings(merchant_id,enabled,started_at) values(1829345766,true,now()-interval '2 hours');insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,status,phone,checkout_url) values(1829345766,'test',now()-interval '1 hour','active','+966500000001','https://mtjr.at/test');");
  assert.equal((await db.query('select count(*)::int n from crm_cart_followups')).rows[0].n,1);
  const call=(key,phone)=>db.query('select crm_receive_whatsapp_event(1829345766,$1,\'message_created\',\'123\',now(),$2) result',[key,phone]);
  const key='a'.repeat(64);
  assert.equal((await call(key,'966500000001')).rows[0].result.cancelled,1);
  assert.equal((await db.query('select reason from crm_cart_followups')).rows[0].reason,'optout');
  assert.equal((await call(key,'966500000001')).rows[0].result.duplicate,true);
  assert.equal((await call('b'.repeat(64),null)).rows[0].result.opted_out,false);
  assert.equal((await db.query('select count(*)::int n from crm_whatsapp_optouts')).rows[0].n,1);
  assert.equal((await db.query("select has_table_privilege('anon','crm_whatsapp_webhook_receipts','SELECT') allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','crm_receive_whatsapp_event(bigint,text,text,text,timestamptz,text)','EXECUTE') allowed")).rows[0].allowed,false);
  await assert.rejects(db.query("select crm_receive_whatsapp_event(123,$1,'message_created','123',now(),null)",[key]));
  await db.exec("create function fail_optout() returns trigger language plpgsql as $$ begin raise exception 'test rollback'; end $$;create trigger fail_optout before insert on crm_whatsapp_optouts for each row execute function fail_optout();");
  await assert.rejects(call('c'.repeat(64),'966500000002'));
  assert.equal((await db.query('select count(*)::int n from crm_whatsapp_webhook_receipts')).rows[0].n,2);
 }finally{await db.close();}
});
test('WhatsApp worker route verifies signature before storage and does not require general worker token',async()=>{
 const crm=require('../lib/crm'),original=crm.sb,oldSecret=process.env.ETISALNA_WEBHOOK_SECRET;
 let calls=0;
 crm.sb=async(path,options)=>{calls++;assert.equal(path,'rpc/crm_receive_whatsapp_event_v2');assert.equal(JSON.parse(options.body).p_reply_phone,'966500000001');assert.equal(JSON.parse(options.body).p_phone,'966500000001');return {duplicate:false,opted_out:true,cancelled:1};};
 delete require.cache[require.resolve('../lib/etisalna-webhook')];
 const worker=require('../api/crm-worker');
 const response=()=>({setHeader(){},end(body){this.body=JSON.parse(body);}});
 try{
  process.env.ETISALNA_WEBHOOK_SECRET=secret;
  const current=Date.now();const env=envelope();const raw=Buffer.from(env.raw_body_base64,'base64');const timestamp=String(Math.floor(current/1000));
  env.headers={'x-chatwoot-timestamp':timestamp,'x-chatwoot-signature':'sha256='+crypto.createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex')};
  let res=response();await worker({method:'POST',headers:{},query:{action:'whatsapp-events'},body:env},res);assert.equal(res.statusCode,200);assert.equal(res.body.opted_out,true);assert.equal(calls,1);
  env.headers['x-chatwoot-signature']='sha256='+'0'.repeat(64);res=response();await worker({method:'POST',headers:{},query:{action:'whatsapp-events'},body:env},res);assert.equal(res.statusCode,401);assert.equal(calls,1);
 }finally{crm.sb=original;if(oldSecret===undefined)delete process.env.ETISALNA_WEBHOOK_SECRET;else process.env.ETISALNA_WEBHOOK_SECRET=oldSecret;delete require.cache[require.resolve('../lib/etisalna-webhook')];}
});

