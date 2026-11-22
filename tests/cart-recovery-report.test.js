const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('Shows exact checkout matches and unconfirmed later orders separately, with one latest reminder per order',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table abandoned_carts(id uuid,merchant_id bigint,external_cart_id text,customer_id uuid,customer_name text);
   create table orders(id uuid,merchant_id bigint,external_order_id text,order_reference text,customer_id uuid,
    ordered_at timestamptz,status_slug text,total_amount numeric,currency text,source_payload jsonb);
   create table crm_event_inbox(merchant_id bigint,event_name text,records_synced_at timestamptz,occurred_at timestamptz,received_at timestamptz,payload jsonb);
   create table crm_cart_deliveries(merchant_id bigint,cart_id uuid,status text,attempted_at timestamptz);
   create table crm_cart_second_deliveries(merchant_id bigint,cart_id uuid,status text,attempted_at timestamptz,coupon_code text,discount_amount integer);
   insert into abandoned_carts values
    ('00000000-0000-0000-0000-000000000001',1829345766,'3265812932266305173',null,'first'),
    ('00000000-0000-0000-0000-000000000002',1829345766,'102','00000000-0000-0000-0000-000000000010','second'),
    ('00000000-0000-0000-0000-000000000003',99,'102','00000000-0000-0000-0000-000000000010','other');
   insert into crm_cart_deliveries select merchant_id,id,'accepted',now()-interval '12 hours' from abandoned_carts;
   insert into crm_cart_second_deliveries select merchant_id,id,'accepted',now()-interval '4 hours','LINK20',20 from abandoned_carts where customer_name='first';
   insert into orders values
    (gen_random_uuid(),1829345766,'41',null,null,now()-interval '2 hours','completed',320,'SAR','{}'),
    (gen_random_uuid(),1829345766,'42',null,'00000000-0000-0000-0000-000000000010',now()-interval '2 hours','delivered',99,'SAR','{}'),
    (gen_random_uuid(),1829345766,'43',null,'00000000-0000-0000-0000-000000000010',now()-interval '3 hours','restored',500,'SAR','{}'),
    (gen_random_uuid(),1829345766,'44',null,'00000000-0000-0000-0000-000000000010',now()-interval '13 hours','completed',500,'SAR','{}'),
    (gen_random_uuid(),1829345766,'45',null,'00000000-0000-0000-0000-000000000010',now()-interval '1 hour','completed',500,'SAR','{}'),
    (gen_random_uuid(),99,'46',null,null,now()-interval '2 hours','completed',200,'SAR','{"checkout_id":102}');
   insert into crm_event_inbox values (1829345766,'order.created',now(),now()-interval '2 hours',now(),'{"data":{"id":41,"checkout_id":3265812932266305173}}');`);
  await db.exec(fs.readFileSync(__dirname+'/../crm-cart-recovery-report.sql','utf8'));
  const report=async(page)=>(await db.query('select crm_cart_recovery_report($1) r',[page])).rows[0].r;
  const d=await report(1);
  assert.deepEqual(d.metrics,{total:2,exact_count:1,exact_second:1,exact_first:0,exact_sar:320,after_count:1,accepted_first:2,accepted_second:1});
  assert.deepEqual(d.rows.map(x=>[x.external_order_id,x.match_kind,x.stage,x.coupon_code]),[['41','exact',2,'LINK20'],['42','after_message',1,null]]);
  assert.equal(d.rows[0].external_cart_id,'3265812932266305173');
  assert.deepEqual((await report(2)).rows,[]);
  const {rows}=await db.query("select has_function_privilege('authenticated','crm_cart_recovery_report(integer)','EXECUTE') allowed");
  assert.equal(rows[0].allowed,false);
 }finally{await db.close();}
});

test('Dashboard shows both match labels and escapes order data from the report',async()=>{
 const {parseHTML}=require('linkedom'),vm=require('node:vm');
 const {document}=parseHTML('<body><main></main></body>'),window={};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../public/dashboard-cart-followup.js','utf8'),{window,document});
 document.querySelector('main').innerHTML=window.LinkCartFollowup.shell();
 const api=async resource=>{
  if(!resource.startsWith('cart-recovery-report&'))throw Error('unavailable');
  return {metrics:{total:2,accepted_first:7,accepted_second:4,exact_count:1,exact_sar:320,exact_first:0,exact_second:1,after_count:1},
   rows:[{order_reference:'100',stage:2,match_kind:'exact',coupon_code:'LINK20',customer_name:'<img src=x>'},
    {order_reference:'101',stage:1,match_kind:'after_message'}]};
 };
 await window.LinkCartFollowup.bind({api,toast(){}});
 const root=document.querySelector('#cart-recovery-report');
 assert.equal(root.querySelectorAll('.cart-recovery-card').length,5);
 assert.deepEqual([...root.querySelectorAll('tbody .badge')].map(x=>x.textContent),['نفس رقم السلة','شراء بعد الرسالة']);
 assert.equal(root.querySelector('img'),null);
 assert.match(root.textContent,/LINK20/);
});
