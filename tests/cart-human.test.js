const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {payload,send}=require('../lib/cart-human');
const environment={WHATSAPP_AUTOMATION_ENABLED:'true',CRM_WORKER_TOKEN:'test',ETISALNA_API_ACCESS_TOKEN:'test'};
const record={id:'11111111-1111-4111-8111-111111111111',attempt_token:'22222222-2222-4222-8222-222222222222',phone:'966500000001',customer_name:'أحمد',template_name:'link_cart_personal_help_ar'};
test('Human sender is explicit, fixed-template, and saves ambiguous sends without retry',async()=>{
 assert.deepEqual(payload(record).message.whatsapp_template.components.slice(1).map(x=>x.parameters[0].payload),['human_model_help','human_shipping_help','unsubscribe']);
 assert.throws(()=>payload({...record,template_name:'wrong'}));
 let io=0,finish;
 await assert.rejects(send({id:record.id},{request:()=>io++,environment}));assert.equal(io,0);
 await assert.rejects(send({id:record.id,confirm_send:true},{database:async()=>({blocked:'template_not_ready'}),request:()=>io++,environment}));assert.equal(io,0);
 const database=async(path,opts)=>{if(path.endsWith('crm_claim_cart_human'))return record;finish=JSON.parse(opts.body);return true;};
 const r=await send({id:record.id,confirm_send:true},{database,environment,request:async()=>{io++;throw Error('timeout');}});
 assert.equal(io,1);assert.equal(r.status,'unknown');assert.equal(finish.p_status,'unknown');
});
test('Database routing >300, exact boundary, history, approval, replies, optouts and replay protection',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
 const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json','utf8'));
 for(const table of schema.reverse())await db.exec(`create table ${table.table_name}(${table.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(table.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
 await db.exec("alter table abandoned_carts add column crm_source_at timestamptz;create table crm_event_inbox(id uuid primary key,merchant_id bigint,event_name text,records_synced_at timestamptz);create table test_clock(t timestamptz);insert into test_clock values('2026-10-19T00:00:00Z');create function public.delivery_now() returns timestamptz language sql as $$select t from public.test_clock$$;");
 const install=async file=>db.exec(fs.readFileSync(__dirname+'/../'+file,'utf8').replaceAll('now()','public.delivery_now()'));
 for(const f of ['crm-cart-followup.sql','crm-whatsapp-test-send.sql','crm-whatsapp-delivery.sql','crm-whatsapp-events.sql','crm-cart-reminder-two.sql'])await install(f);
 await db.exec("select crm_configure_cart_second(true,8,false,'help_ar','offer_ar','LINK10','LINK15','LINK20',true);update crm_cart_delivery_settings set enabled=true;");
 let seq=0;const seed=async amount=>{seq++;const phone='96650000'+String(seq).padStart(3,'0');const c=(await db.query("insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,crm_source_at,status,phone,checkout_url,total_amount) values(1829345766,$1,public.delivery_now(),public.delivery_now(),'active',$2,'https://mtjr.at/test',$3) returning id",[String(seq),phone,amount])).rows[0].id;const f=(await db.query("insert into crm_cart_deliveries(merchant_id,cart_id,activity_at,scheduled_for,status,attempted_at,attempted_phone,completed_at)values(1829345766,$1,public.delivery_now(),public.delivery_now(),'accepted',public.delivery_now(),$2,public.delivery_now()) returning id",[c,phone])).rows[0].id;return {c,f,phone};};
 const boundary=await seed(300),big=await seed(300.01),old=await seed(450),reply=await seed(500),opt=await seed(600),bought=await seed(700),drop=await seed(800);
 await db.query("insert into crm_cart_second_deliveries(merchant_id,cart_id,first_delivery_id,scheduled_for,status,attempted_at)values(1829345766,$1,$2,public.delivery_now(),'accepted',public.delivery_now())",[old.c,old.f]);
 await install('crm-cart-human.sql');await install('crm-cart-human.sql');
 assert.equal((await db.query('select count(*)::int n from crm_cart_human_followups')).rows[0].n,5);
 assert.equal((await db.query('select count(*)::int n from crm_cart_human_followups where cart_id=$1',[boundary.c])).rows[0].n,0);
 const claim=async c=>(await db.query('select crm_claim_cart_human((select id from crm_cart_human_followups where cart_id=$1)) r',[c])).rows[0].r;
 assert.equal((await claim(big.c)).blocked,'template_not_ready');
 await db.exec('update crm_cart_human_settings set template_approved=true');assert.equal((await claim(big.c)).blocked,'delay');
 await db.exec("update test_clock set t='2026-10-19T00:59:00Z'");
 assert.equal((await claim(big.c)).blocked,'delay');
 await db.exec("update test_clock set t='2026-10-19T01:00:00Z'");
 const early=(await db.query('select crm_cart_human_list() r')).rows[0].r.queue.find(r=>r.cart_id===big.c);assert.equal(early.reason,'ready');
 assert.equal((await db.query('select crm_claim_cart_second(1829345766) r')).rows[0].r.idle,'no_due');
 await db.exec("update test_clock set t='2026-10-19T08:01:00Z'");
 await db.query('insert into crm_whatsapp_customer_replies values(1829345766,$1,public.delivery_now())',[reply.phone]);
 await db.query('insert into crm_whatsapp_optouts values(1829345766,$1,public.delivery_now())',[opt.phone]);
 await db.query("update abandoned_carts set status='recovered',recovered_at=public.delivery_now() where id=$1",[bought.c]);
 await db.query('update abandoned_carts set total_amount=299 where id=$1',[drop.c]);
 assert.equal((await claim(reply.c)).blocked,'window_open');assert.equal((await claim(opt.c)).blocked,'optout');assert.equal((await claim(bought.c)).blocked,'purchased_or_inactive');assert.equal((await claim(drop.c)).blocked,'amount_changed');
 const a=(await db.query('select crm_claim_cart_second(1829345766) r')).rows[0].r;
 assert.equal(a.discount_amount,20);assert.equal(a.phone,boundary.phone);
 await db.query("select crm_finish_cart_second($1,$2,'accepted','123')",[a.id,a.attempt_token]);
 assert.equal((await db.query('select crm_claim_cart_second(1829345766) r')).rows[0].r.idle,'no_due');
 const h=await claim(big.c);assert.equal(h.phone,big.phone);assert.equal((await claim(big.c)).blocked,'already_attempted');
 await db.query("select crm_finish_cart_human($1,$2,'unknown',null)",[h.id,h.attempt_token]);assert.equal((await claim(big.c)).blocked,'already_attempted');
 assert.equal((await db.query("select has_table_privilege('anon','crm_cart_human_followups','select') r")).rows[0].r,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','crm_claim_cart_human(uuid)','execute') r")).rows[0].r,false);
 const list=(await db.query('select crm_cart_human_list() r')).rows[0].r;assert.equal(list.previous_second.length,1);assert.equal(list.queue.length,5);
 await db.exec("update crm_cart_delivery_settings set started_at=public.delivery_now()-interval '1 day'");
 const fresh=(await db.query("insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,crm_source_at,status,phone,checkout_url,total_amount) values(1829345766,'fresh-big',public.delivery_now(),public.delivery_now(),'active','966599999991','https://mtjr.at/new',350) returning id")).rows[0].id;
 await db.query('select crm_cart_delivery_reconcile(1829345766)');
 assert.equal((await db.query('select status from crm_cart_deliveries where cart_id=$1',[fresh])).rows[0].status,'cancelled');
 assert.equal((await claim(fresh)).blocked,'delay');
 await db.exec("update test_clock set t='2026-10-19T09:01:00Z'");
 const freshRow=(await db.query('select crm_cart_human_list() r')).rows[0].r.queue.find(r=>r.cart_id===fresh);
 assert.equal(freshRow.reason,'ready');assert.equal(freshRow.first_at,null);
 const human=await claim(fresh);assert.equal(human.phone,'966599999991');
 await db.query("select crm_finish_cart_human($1,$2,'accepted','987')",[human.id,human.attempt_token]);
 assert.equal((await db.query('select crm_claim_cart_delivery(1829345766) r')).rows[0].r.idle,'no_due');
 assert.equal((await db.query('select crm_claim_cart_second(1829345766) r')).rows[0].r.idle,'no_due');
 // Cart value rising before first claim must also divert, while 300 remains automatic.
 const small=(await db.query("insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,crm_source_at,status,phone,checkout_url,total_amount) values(1829345766,'fresh-small',public.delivery_now()-interval '1 hour',public.delivery_now()-interval '1 hour','active','966599999992','https://mtjr.at/small',300) returning id")).rows[0].id;
 const first=(await db.query('select crm_claim_cart_delivery(1829345766) r')).rows[0].r;assert.equal(first.phone,'966599999992');
 await db.query("select crm_finish_cart_delivery($1,$2,'accepted','988')",[first.id,first.attempt_token]);
 const rise=(await db.query("insert into abandoned_carts(merchant_id,external_cart_id,abandoned_at,crm_source_at,status,phone,checkout_url,total_amount) values(1829345766,'rising',public.delivery_now()-interval '1 hour',public.delivery_now()-interval '1 hour','active','966599999993','https://mtjr.at/rising',299) returning id")).rows[0].id;
 await db.query('select crm_cart_delivery_reconcile(1829345766)');await db.query('update abandoned_carts set total_amount=301 where id=$1',[rise]);
 assert.equal((await db.query('select crm_claim_cart_delivery(1829345766) r')).rows[0].r.idle,'no_due');
 assert.equal((await db.query('select status from crm_cart_deliveries where cart_id=$1',[rise])).rows[0].status,'cancelled');

 }finally{await db.close();}
});
test('Dashboard lists human carts, escapes customer data and disables unapproved sends',()=>{
 const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../public/dashboard-cart-human.js','utf8'),ctx);
 const html=ctx.window.LinkCartHuman.render({storage_ready:true,server_ready:true,configuration:{template_approved:false},previous_second:[],queue:[{id:record.id,customer_name:'<script>bad</script>',amount:350,reason:'ready',items:[{name:'<img>',quantity:1}]}]});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img&gt;'));assert.match(html,/data-human-send="[^"]+" disabled/);
 const dashboard=fs.readFileSync(__dirname+'/../public/dashboard.js','utf8');assert.equal(dashboard.match(/\['carthuman','متابعة السلات الكبيرة'\]/g).length,1);
});
test('Feedback validates inputs, scopes writes, and never calls sender',async()=>{
 const {saveFeedback}=require('../lib/cart-human');let calls=[];
 const database=async(path,opts)=>{calls.push([path,opts]);return path.startsWith('crm_cart_human_followups?')?[{id:record.id}]:null;};
 for(const body of [{id:'bad',reason:'price',outcome:'discussing',note:''},{id:record.id,reason:'invented',outcome:'discussing',note:''},{id:record.id,reason:'price',outcome:'bought',note:''},{id:record.id,reason:'price',outcome:'discussing',note:'x'.repeat(1001)}])await assert.rejects(saveFeedback(body,{database}));
 assert.equal(calls.length,0);
 await assert.rejects(saveFeedback({id:record.id,reason:'price',outcome:'discussing',note:''},{database:async()=>[]}));
 await saveFeedback({id:record.id,reason:'shipping_cost',outcome:'discussing',note:'  غالي الشحن  '},{database});
 assert.match(calls[0][0],/merchant_id=eq.1829345766/);
 const saved=JSON.parse(calls[1][1].body);assert.equal(saved.note,'غالي الشحن');assert.equal(saved.followup_id,record.id);assert.equal(calls.length,2);
});
test('Feedback form escapes notes and separates conversation from purchase',()=>{
 const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../public/dashboard-cart-human.js','utf8'),ctx);
 const html=ctx.window.LinkCartHuman.render({storage_ready:true,server_ready:true,configuration:{template_approved:true},previous_second:[],queue:[{id:record.id,amount:350,reason:'accepted',feedback:{reason:'price',outcome:'discussing',note:'</textarea><script>x</script>'}}]});
 assert.ok(html.includes('&lt;/textarea&gt;'));assert.ok(html.includes('data-human-feedback'));assert.ok(html.includes('حل الاستفسار لا يعني إتمام الشراء'));assert.ok(html.includes('السعر: 1'));
});
