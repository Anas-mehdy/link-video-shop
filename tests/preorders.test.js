const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const po=require('../lib/preorders');
const merchant=1829345766;
const config={name:'Burgundy shipment',product_id:'900',variant_id:'',product_name:'iPhone frame',color:'Burgundy',incoming_quantity:5,booking_limit:4,expected_arrival:'2026-11-03',ship_from:'2026-11-04',ship_by:'2026-11-06',status:'open'};
test('batch input validates quantities, real dates and server-controlled identity',()=>{
 assert.equal(po.batch(config).booking_limit,4);
 for(const changes of [{product_id:'900&x=1'},{ship_by:'2026-02-30'},{ship_from:'2026-11-02'},{booking_limit:6},{incoming_quantity:1.5},{id:'wrong'},{status:'received'}])assert.throws(()=>po.batch({...config,...changes}));
});
test('actual SQL: paid reservations, FIFO receipts, stale projection, cancellation, dates, scope and permissions',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);insert into stores values(1829345766);create table webhook_events(id uuid primary key);');
  const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json'));
  for(const t of schema.filter(x=>['customers','orders','abandoned_carts'].includes(x.table_name)))await db.exec(`create table ${t.table_name}(${t.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(t.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
  await db.exec(fs.readFileSync(__dirname+'/../crm-foundation.sql','utf8'));
  await db.exec(fs.readFileSync(__dirname+'/../crm-salla-sync.sql','utf8'));
  await db.exec("create table test_clock(t timestamptz);insert into test_clock values('2026-10-14T17:00Z');create function public.po_now() returns timestamptz language sql as $$select t from public.test_clock$$;");
  const sql=fs.readFileSync(__dirname+'/../crm-preorders.sql','utf8').replaceAll('now()','public.po_now()');
  await db.exec(sql);await db.exec(sql);
  await db.exec(fs.readFileSync(__dirname+'/../crm-preorders-activate.sql','utf8'));
  const save=async(data=config)=>(await db.query('select crm_preorder_save_batch($1,$2) id',[merchant,JSON.stringify(data)])).rows[0].id;
  const bid=await save();
  await assert.rejects(save({...config,product_id:'900',variant_id:'2'}),/overlapping_batch/);
  const apply=async(num,items,payment='paid',status='in_progress',time='2026-10-14T18:00Z',m=merchant)=>{
   if(m===merchant)return (await db.query('select crm_apply_salla_records($1,$2,null) n',['orders',JSON.stringify([{external_order_id:String(num),ordered_at:'2026-10-14T17:30Z',crm_source_at:time,payment_status:payment,status_slug:status,source_payload:{items}}])])).rows[0].n;
   return db.query('insert into orders(merchant_id,external_order_id,ordered_at,crm_source_at,payment_status,status_slug,source_payload) values($1,$2,$3,$3,$4,$5,$6)',[m,String(num),'2026-10-14T18:00Z',payment,status,JSON.stringify({items})]);
  };
  const line=(qty=1,id=10,product=900)=>({id,product:{id:product},quantity:qty});
  const sync=async()=>(await db.query('select crm_preorder_reconcile($1,20) result',[merchant])).rows[0].result;
  const rows=async()=>(await db.query('select r.*,o.external_order_id from crm_preorder_reservations r join orders o on o.id=r.order_id order by o.external_order_id')).rows;
  // Pending payment is not confirmed. Unrelated and other-store orders are untouched.
  await apply(1,[line(2)],'pending');await apply(100,[line(1,10,901)]);await apply(200,[line()], 'paid','in_progress','2026-10-14T18:00Z',99);
  assert.equal((await sync()).processed,1);assert.equal((await rows())[0].state,'payment_pending');
  await apply(1,[line(2)],'paid','in_progress','2026-10-14T18:01Z');await sync();
  await apply(2,[line(1,11),line(1,12,901)],'paid','in_progress','2026-10-14T18:02Z');await sync();
  await apply(3,[line(1,13)],'paid','in_progress','2026-10-14T18:03Z');await sync();
  await apply(4,[line(1,14)],'paid','in_progress','2026-10-14T18:04Z');await sync();
  let r=await rows();assert.equal(r.length,4);assert.equal(r[0].state,'reserved');assert.equal(r[1].mixed_order,true);assert.equal(r[3].review_reason,'booking_capacity_exceeded');
  assert.equal((await db.query("select count(*)::int n from crm_preorder_notices where kind='confirmation'")).rows[0].n,3);
  // Replayed source snapshot and worker retry cannot create duplicate reservations/notices.
  await apply(1,[line(2)],'paid','in_progress','2026-10-14T18:01Z');await sync();await sync();
  assert.equal((await rows()).length,4);assert.equal((await db.query("select count(*)::int n from crm_preorder_notices where kind='confirmation'")).rows[0].n,3);
  // Changing a batch's current schedule keeps each reservation's original promise.
  await save({...config,id:bid,ship_from:'2026-11-05',ship_by:'2026-11-07'});
  r=await rows();assert.equal(r[0].promised_ship_by.toISOString().slice(0,10),'2026-11-06');
  assert.equal((await db.query("select count(*)::int n from crm_preorder_notices where kind='schedule_change'")).rows[0].n,3);
  await assert.rejects(save({...config,id:bid,color:'Black'}),/batch_identity_locked/);
  await assert.rejects(save({...config,id:bid,booking_limit:1}),/limit_below_reservations/);
  await assert.rejects(save({...config,id:bid,status:'closed'}),/unfulfilled_reservations/);
  const receipt=async(n)=>(await db.query('select crm_preorder_receive($1,$2,$3) result',[merchant,bid,n])).rows[0].result;
  // One piece cannot satisfy first paid order's two pieces: no queue-jumping.
  assert.equal((await receipt(1)).allocated,0);r=await rows();assert.equal(r[1].allocated_quantity,0);
  assert.equal((await receipt(3)).allocated,2);r=await rows();assert.equal(r[0].allocated_quantity,2);assert.equal(r[1].allocated_quantity,1);assert.equal(r[2].allocated_quantity,0);
  assert.equal((await receipt(3)).duplicate,true);await assert.rejects(receipt(2),/receipt_cannot_decrease/);
  // Cancellation frees unshipped allocated stock to the next confirmed paid reservation.
  await apply(1,[line(2)],'paid','cancelled','2026-10-14T19:00Z');await sync();
  r=await rows();assert.equal(r[0].state,'cancelled');assert.equal(r[0].allocated_quantity,0);assert.equal(r[2].allocated_quantity,1);
  // Older event cannot undo cancellation because existing Salla projection rejects stale writes.
  await apply(1,[line(2)],'paid','in_progress','2026-10-14T18:00Z');await sync();assert.equal((await rows())[0].state,'cancelled');
  // Late updates remain enrolled even once the order falls outside the dashboard's 30-day window.
  await db.exec("update test_clock set t='2026-11-20T17:00Z'");
  await apply(2,[line(1,11),line(1,12,901)],'paid','shipped','2026-11-20T17:00Z');await sync();assert.equal((await rows())[1].state,'shipped');
  await apply(2,[line(1,11),line(1,12,901)],'refunded','refunded','2026-11-20T18:00Z');await sync();r=await rows();assert.equal(r[1].state,'review');assert.equal(r[1].allocated_quantity,1);assert.equal(r[1].review_reason,'return_stock_unverified');
  // A refund event with unchanged aggregate payment cannot be assumed to refund this line fully.
  await db.exec("update orders set source_payload=source_payload||'{\"_crm_preorder_refund_observed\":true}'::jsonb where external_order_id='3'");await sync();
  r=await rows();assert.equal(r[2].review_reason,'refund_needs_review');assert.equal(r[2].allocated_quantity,1);
  // Receipt cannot create surplus sellable inventory or send any notification.
  const allocated=(await db.query('select sum(allocated_quantity)::int n from crm_preorder_reservations')).rows[0].n;assert.ok(allocated<=3);
  assert.equal((await db.query("select count(*)::int n from crm_preorder_notices where details->>'message_sent'<>'false'")).rows[0].n,0);
  // Deletion keeps the original reservation and allocated stock under review.
  // Reimport must reattach it, not create a second booking/confirmation.
  const previous=(await rows()).find(x=>x.external_order_id==='3');
  await db.exec("delete from orders where external_order_id='3'");
  let detached=(await db.query('select * from crm_preorder_reservations where id=$1',[previous.id])).rows[0];
  assert.equal(detached.order_id,null);assert.equal(detached.review_reason,'order_deleted');assert.equal(detached.allocated_quantity,1);
  await apply(3,[line(1,13)],'paid','in_progress','2026-11-20T19:00Z');await sync();
  const reattached=(await rows()).find(x=>x.external_order_id==='3');assert.equal(reattached.id,previous.id);assert.ok(reattached.order_id);assert.equal(reattached.state,'review');assert.equal((await rows()).length,4);
  for(const t of ['crm_preorder_batches','crm_preorder_reservations','crm_preorder_order_queue','crm_preorder_notices','crm_preorder_audit']){
   assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',['anon',t,'SELECT'])).rows[0].allowed,false);
   assert.equal((await db.query('select relrowsecurity from pg_class where relname=$1',[t])).rows[0].relrowsecurity,true);
  }
  assert.equal((await db.query("select has_function_privilege('authenticated','crm_preorder_receive(bigint,uuid,integer)','EXECUTE') allowed")).rows[0].allowed,false);
  // Setup can be rerun without losing business records.
  await db.exec(sql);assert.equal((await rows()).length,4);
 }finally{await db.close();}
});
test('preorder API validates inspection, isolates merchant and requires admin before storage',async()=>{
 const vm=require('node:vm');let calls=[];
 const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
 const context={module:{exports:{}},URLSearchParams,require:()=>({MERCHANT_ID:merchant,fail,bodyObject:r=>r.body,json:(r,status,data)=>{r.status=status;r.data=data;},sb:async(path,options)=>{calls.push({path,body:options?.body?JSON.parse(options.body):null});return {allocated:1};}})};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../lib/preorders.js','utf8'),context);
 const admin=context.module.exports.admin;
 await assert.rejects(admin({method:'POST',body:{action:'receive',id:'11111111-1111-4111-8111-111111111111',quantity:1}},{}));assert.equal(calls.length,0);
 const res={};await admin({method:'POST',body:{action:'receive',id:'11111111-1111-4111-8111-111111111111',quantity:1,confirm_inspected:true,p_merchant_id:99}},res);
 assert.equal(res.status,200);assert.equal(calls[0].body.p_merchant_id,merchant);assert.equal(calls[0].path,'rpc/crm_preorder_receive');
 let touched=false;
 const route={module:{exports:{}},require:p=>p==='../lib/crm'?{noCache:()=>{},requireAdmin:async()=>{throw fail(401,'Unauthorized');},errorResponse:(r,e)=>{r.status=e.statusCode;}}:p==='../lib/crm-records'?{resources:{}}:p==='../lib/preorders'?{admin:async()=>{touched=true;}}:{}};
 vm.createContext(route);vm.runInContext(fs.readFileSync(__dirname+'/../api/crm-admin.js','utf8'),route);const denied={};await route.module.exports({method:'POST',query:{resource:'preorders'},body:{action:'sync'}},denied);assert.equal(denied.status,401);assert.equal(touched,false);
});
test('dashboard renders stages and escapes customer-controlled content without inventing live sending',()=>{
 const vm=require('node:vm'),window={};const context={window,Intl,Date,URLSearchParams};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../public/dashboard-preorders.js','utf8'),context);
 const view=window.LinkPreorders.render({ready:true,batches:[{...config,id:'11111111-1111-4111-8111-111111111111',name:'<script>bad()</script>',received_quantity:0}],summary:[{id:'11111111-1111-4111-8111-111111111111',paid_quantity:1,ready_orders:0,review_count:0}],queue:[],notices:[],reservations:[],page:1,has_more:false});
 assert.ok(view.includes('&lt;script&gt;'));assert.ok(!view.includes('<script>bad'));assert.ok(view.includes('الإرسال التلقائي غير مفعّل بعد'));assert.ok(view.includes('الحجز المسبق'));
 const pending=window.LinkPreorders.render({ready:false,batches:[],summary:[],queue:[],notices:[],reservations:[],page:1,has_more:false});assert.ok(pending.includes('لم يكتمل تجهيز قاعدة بيانات الحجز المسبق'));
});
test('old enrolled orders fail closed on database outage, but an uninstalled module preserves archive scope',async()=>{
 const vm=require('node:vm');let response=[{id:'reservation'}],error;
 const context={module:{exports:{}},URLSearchParams,require:()=>({MERCHANT_ID:merchant,sb:async()=>{if(error)throw error;return response;},fail:(statusCode,message)=>Object.assign(new Error(message),{statusCode})})};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../lib/preorders.js','utf8'),context);
 const enrolled=context.module.exports.enrolled;
 assert.equal(await enrolled('100'),true);response=[];assert.equal(await enrolled('100'),false);
 error=new Error('Supabase 503');await assert.rejects(enrolled('100'));
 error=new Error('Supabase 404: PGRST205');assert.equal(await enrolled('100'),false);
});
test('malformed order details stay queued and receipt is blocked; draft is inert',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table orders(id uuid primary key default gen_random_uuid(),merchant_id bigint,external_order_id text,ordered_at timestamptz,crm_source_at timestamptz,payment_status text,status_slug text,source_payload jsonb);');
 await db.exec(fs.readFileSync(__dirname+'/../crm-preorders.sql','utf8'));
 await db.exec(fs.readFileSync(__dirname+'/../crm-preorders-activate.sql','utf8'));
 let b=(await db.query('select crm_preorder_save_batch($1,$2) id',[merchant,JSON.stringify({...config,status:'draft'})])).rows[0].id;
 await db.query("insert into orders(merchant_id,external_order_id,ordered_at,crm_source_at,payment_status,status_slug,source_payload) values($1,'1',now()+interval '1 minute',now(),'paid','in_progress',$2)",[merchant,JSON.stringify({items:[{product_id:900,quantity:1}]})]);
 assert.equal((await db.query('select count(*)::int n from crm_preorder_order_queue')).rows[0].n,0);
 await db.query('select crm_preorder_save_batch($1,$2)',[merchant,JSON.stringify({...config,id:b})]);
 await db.exec("update orders set source_payload=source_payload;");
 const result=(await db.query('select crm_preorder_reconcile($1,20) r',[merchant])).rows[0].r;assert.equal(result.errors,1);
 assert.equal((await db.query('select last_error from crm_preorder_order_queue')).rows[0].last_error,'item_identifier_missing');
 assert.equal((await db.query('select count(*)::int n from crm_preorder_reservations')).rows[0].n,0);
 await assert.rejects(db.query('select crm_preorder_receive($1,$2,1)',[merchant,b]),/pending_order_sync/);
 }finally{await db.close();}
});
