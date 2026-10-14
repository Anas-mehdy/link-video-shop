const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const merchant=1829345766;
const paidPayload=()=>({currency:'SAR',amounts:{total:{amount:177.56,currency:'SAR'}},payment_actions:{remaining_action:{paid_amount:{amount:177.56,currency:'SAR'},has_remaining_amount:false,remaining_amount:null},refund_action:{refund_amount:{amount:0,currency:'SAR'},has_refund_amount:false,refunded_transactions:[],pending_refund_amount:null}}});
test('real Salla payment evidence, partial/refund uncertainty, source preservation and draft update',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table orders(id uuid primary key default gen_random_uuid(),merchant_id bigint,external_order_id text,order_reference text,ordered_at timestamptz,crm_source_at timestamptz,payment_status text,status_slug text,source_payload jsonb);');
  await db.exec(fs.readFileSync(__dirname+'/../crm-preorders.sql','utf8'));
  await db.exec(fs.readFileSync(__dirname+'/../crm-preorders-activate.sql','utf8'));
  const normalize=async(payload,status=null)=>(await db.query('select crm_preorder_payment($1,$2) p',[status,JSON.stringify(payload)])).rows[0].p;
  assert.equal(await normalize(paidPayload()),'paid');
  assert.equal(await normalize({status:{slug:'completed'},payment_method:'mada'}),'unknown');
  assert.equal(await normalize({},'paid'),'paid');
  for(const amount of [0,10,177.55,178]){const p=paidPayload();p.payment_actions.remaining_action.paid_amount.amount=amount;assert.notEqual(await normalize(p),'paid');}
  for(const change of [p=>p.is_pending_payment=true,p=>p.currency='USD',p=>p.payment_actions.remaining_action.paid_amount.currency='USD',p=>p.payment_actions.remaining_action.has_remaining_amount=true,p=>delete p.payment_actions.refund_action,p=>p.payment_actions.remaining_action.paid_amount.amount='NaN']){const p=paidPayload();change(p);assert.notEqual(await normalize(p),'paid');}
  for(const change of [p=>p.payment_actions.refund_action.refund_amount.amount=1,p=>p.payment_actions.refund_action.has_refund_amount=true,p=>p.payment_actions.refund_action.pending_refund_amount={amount:1},p=>p.payment_actions.refund_action.refunded_transactions=[{amount:1}]]){const p=paidPayload();change(p);assert.equal(await normalize(p),'partially_refunded');}
  assert.equal(await normalize(paidPayload(),'pending'),'pending');
  const patch=fs.readFileSync(__dirname+'/../crm-preorders-payment-update.sql','utf8');
  await db.exec(patch);await db.exec(patch);
  const [b]=(await db.query('select * from crm_preorder_batches')).rows;
  assert.equal(b.incoming_quantity,400);assert.equal(b.booking_limit,400);assert.equal(b.status,'draft');assert.equal(b.opened_at,null);
  assert.equal(b.expected_arrival.toISOString().slice(0,10),'2026-11-03');assert.equal(b.ship_by.toISOString().slice(0,10),'2026-11-06');
  assert.equal((await db.query('select crm_preorder_tracking_active() active')).rows[0].active,true);
  await db.query('select crm_preorder_save_batch($1,$2)',[merchant,JSON.stringify({...b,expected_arrival:'2026-11-03',ship_from:'2026-11-04',ship_by:'2026-11-06',status:'open'})]);
  const p={...paidPayload(),items:[{id:2056437958,product_id:318533359,quantity:2,sku:'LINK-PO-IP18PM-BURGUNDY'}]};
  await db.query("insert into orders(merchant_id,external_order_id,ordered_at,crm_source_at,status_slug,source_payload) values($1,'1',now()+interval '1 minute',now(),'under_review',$2)",[merchant,JSON.stringify(p)]);
  const original=(await db.query('select to_jsonb(o) v from orders o')).rows;
  await db.query('select crm_preorder_reconcile($1,20)',[merchant]);
  let [r]=(await db.query('select * from crm_preorder_reservations')).rows;
  assert.equal(r.state,'reserved');assert.equal(r.payment_status,'paid');assert.equal(r.quantity,2);
  assert.deepEqual((await db.query('select to_jsonb(o) v from orders o')).rows,original);
  p.payment_actions.refund_action.refund_amount.amount=10;
  await db.query('update orders set source_payload=$1,crm_source_at=now()',[JSON.stringify(p)]);
  await db.query('select crm_preorder_reconcile($1,20)',[merchant]);
  [r]=(await db.query('select * from crm_preorder_reservations')).rows;assert.equal(r.state,'review');assert.equal(r.review_reason,'payment_review');
  await assert.rejects(db.exec(patch),/existing_batch_is_not_a_draft/);await db.exec('rollback');
  assert.equal((await db.query("select has_function_privilege('anon','crm_preorder_payment(text,jsonb)','EXECUTE') a")).rows[0].a,false);
 }finally{await db.close();}
});
