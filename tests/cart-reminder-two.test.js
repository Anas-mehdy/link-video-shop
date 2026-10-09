const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {payload,tick}=require('../lib/cart-reminder-two');
test('Offer payload preserves both buttons; ambiguous sends finish once without retry',async()=>{
 const record={id:'11111111-1111-4111-8111-111111111111',attempt_token:'22222222-2222-4222-8222-222222222222',phone:'966500000001',customer_name:'Test',checkout_url:'https://mtjr.at/cart',template_name:'offer_ar',discount_amount:15,coupon_code:'LINK15'};
 const p=payload(record).message.whatsapp_template;assert.deepEqual(p.components[0].parameters.map(x=>x.text),['Test','15','LINK15']);assert.equal(p.components[1].parameters[0].payload,'unsubscribe');assert.equal(p.components[2].parameters[0].text,'cart');
 assert.equal(payload({...record,discount_amount:0,coupon_code:null}).message.whatsapp_template.components[0].parameters.length,1);
 assert.throws(()=>payload({...record,coupon_code:'unsafe code'}));
 let calls=0,finish;const environment={WHATSAPP_AUTOMATION_ENABLED:'true',CRM_WORKER_TOKEN:'test',ETISALNA_API_ACCESS_TOKEN:'test'};
 const database=async(path,opts)=>{if(path.endsWith('crm_claim_cart_second'))return record;finish=JSON.parse(opts.body);return true;};
 const r=await tick({database,environment,request:async()=>{calls++;throw Error('timeout');}});assert.equal(r.status,'unknown');assert.equal(calls,1);assert.equal(finish.p_status,'unknown');
 const parent=require('../lib/whatsapp-delivery');let claims=[];
 await parent.tick({environment,database:async path=>{claims.push(path);return {idle:path.endsWith('crm_claim_cart_delivery')?'no_due':'second_disabled'};},request:async()=>assert.fail('no send')});assert.equal(claims.length,2);
 claims=[];await parent.tick({environment,database:async path=>{claims.push(path);return {idle:'projection_pending'};}});assert.equal(claims.length,1);
});
test('Second-stage SQL: exact tiers, eight-hour delay, cancellations, no replay and private tables',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
 const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json','utf8'));
 for(const table of schema.reverse())await db.exec(`create table ${table.table_name}(${table.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(table.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
 await db.exec("alter table abandoned_carts add column crm_source_at timestamptz;create table crm_event_inbox(id uuid primary key,merchant_id bigint,event_name text,records_synced_at timestamptz);create table test_clock(t timestamptz);insert into test_clock values('2026-10-09T00:00:00Z');create function public.delivery_now() returns timestamptz language sql as $$ select t from public.test_clock $$;");
 for(const file of ['crm-cart-followup.sql','crm-whatsapp-test-send.sql','crm-whatsapp-delivery.sql','crm-whatsapp-events.sql','crm-cart-reminder-two.sql'])await db.exec(fs.readFileSync(__dirname+'/../'+file,'utf8').replaceAll('now()','public.delivery_now()'));
 await db.exec(fs.readFileSync(__dirname+'/../crm-cart-reminder-two.sql','utf8').replaceAll('now()','public.delivery_now()'));
 const claim=async()=>(await db.query('select crm_claim_cart_second(1829345766) r')).rows[0].r;
 assert.equal((await claim()).idle,'second_disabled');await assert.rejects(db.exec("select crm_configure_cart_second(true,8,false,'help_ar','offer_ar','LINK10','LINK15','LINK20',false)"));
 await db.exec("select crm_configure_cart_second(true,8,false,'help_ar','offer_ar','LINK10','LINK15','LINK20',true);update crm_cart_delivery_settings set enabled=true;");
 let seq=0;const seed=async(amount,age='0 hours',status='accepted')=>{seq++;const phone='96650000'+String(seq).padStart(3,'0');const c=(await db.query("insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,crm_source_at,status,phone,checkout_url,total_amount) values(1829345766,$1,public.delivery_now(),public.delivery_now(),'active',$2,'https://mtjr.at/test',$3) returning id",[String(seq),'+'+phone,amount])).rows[0].id;await db.query("insert into crm_cart_deliveries(merchant_id,cart_id,activity_at,scheduled_for,status,reason,attempted_at,attempted_phone,completed_at) values(1829345766,$1,public.delivery_now(),public.delivery_now(),$2,'provider_accepted',public.delivery_now()-$3::interval,$4,public.delivery_now()-$3::interval)",[c,status,age,phone]);return {id:c,phone};};
 const tiers=[];for(const value of [100.99,101,199.99,200,299.99,300])tiers.push(await seed(value));
 const opted=await seed(150),replied=await seed(150),bought=await seed(150);await seed(150,'1 hour');await seed(150,'0 hours','unknown');
 await db.query('insert into crm_whatsapp_optouts values(1829345766,$1,public.delivery_now())',[opted.phone]);
 await db.query("select crm_receive_whatsapp_event_v2(1829345766,$1,'message_created','123',public.delivery_now(),null,$2)",['a'.repeat(64),replied.phone]);
 await db.query("update abandoned_carts set status='recovered' where id=$1",[bought.id]);assert.equal((await claim()).idle,'no_due');
 await db.exec("update test_clock set t='2026-10-09T07:59:00Z'");assert.equal((await claim()).idle,'no_due');
 await db.exec("update test_clock set t='2026-10-09T08:00:00Z';insert into crm_event_inbox values(gen_random_uuid(),1829345766,'order.created',null);");assert.equal((await claim()).idle,'projection_pending');await db.exec('update crm_event_inbox set records_synced_at=public.delivery_now()');
 const discounts=[];for(let i=0;i<6;i++){const r=await claim();discounts.push(r.discount_amount);assert.equal(r.template_name,r.discount_amount?'offer_ar':'help_ar');assert.equal(r.coupon_code,r.discount_amount?'LINK'+r.discount_amount:null);assert.equal((await db.query("select crm_finish_cart_second($1,$2,'accepted','123') r",[r.id,r.attempt_token])).rows[0].r,true);}
 assert.deepEqual(discounts.sort((a,b)=>a-b),[0,10,10,15,15,20]);assert.equal((await claim()).idle,'no_due');
 const reasons=(await db.query("select reason from crm_cart_second_deliveries where status='cancelled'")).rows.map(x=>x.reason);for(const reason of ['optout','customer_replied','purchased_or_inactive'])assert.ok(reasons.includes(reason));
 const dynamic=await seed(150);await db.query('update abandoned_carts set total_amount=350 where id=$1',[dynamic.id]);
 await db.exec("update test_clock set t='2026-10-09T16:00:00Z'");const changed=await claim();assert.equal(changed.discount_amount,20);
 await db.exec("update test_clock set t='2026-10-09T16:03:00Z'");assert.equal((await claim()).idle,'no_due');assert.equal((await db.query("select status from crm_cart_second_deliveries where id=$1",[changed.id])).rows[0].status,'unknown');
 assert.equal((await db.query("select has_table_privilege('anon','crm_whatsapp_customer_replies','SELECT') r")).rows[0].r,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','crm_claim_cart_second(bigint)','EXECUTE') r")).rows[0].r,false);
 await db.exec('update crm_cart_delivery_settings set enabled=false');assert.equal((await claim()).idle,'paused');
 await db.exec(fs.readFileSync(__dirname+'/../crm-cart-reminder-two-activate.sql','utf8').replaceAll('now()','public.delivery_now()'));
 const settings=(await db.query('select * from crm_cart_second_settings')).rows[0];assert.equal(settings.enabled,true);assert.equal(settings.delay_hours,8);assert.equal(settings.quiet_hours,false);assert.equal(settings.template_help,'link_cart_second_help_ar');assert.equal(settings.template_offer,'link_cart_second_offer_ar');assert.equal(settings.coupon_15,'LINK15');
 const started=settings.started_at.toISOString();await db.exec(fs.readFileSync(__dirname+'/../crm-cart-reminder-two-activate.sql','utf8').replaceAll('now()','public.delivery_now()'));assert.equal((await db.query('select started_at from crm_cart_second_settings')).rows[0].started_at.toISOString(),started);

 }finally{await db.close();}
});
