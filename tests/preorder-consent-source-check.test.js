const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');
test('consent preflight reads only, scopes merchant, preserves long IDs and exposes aggregate shapes only',async()=>{
 const db=new PGlite();try{
  await db.exec(`create table orders(id int,merchant_id bigint,external_order_id text,source_payload jsonb,crm_source_at timestamptz);
   create table abandoned_carts(id int,merchant_id bigint,external_cart_id text,source_payload jsonb,crm_source_at timestamptz);`);
  const payload={checkout_id:'3212565107043415786',customer:{name:'PRIVATE_NAME'},items:[{product:{id:123},quantity:2,sku_id:456,options:[{id:789,value:'PRIVATE_COLOR',custom_private_key:'PRIVATE_TEXT'}]}]};
  for(const [id,merchant,p] of [[1,1829345766,payload],[2,1829345766,{checkout_id:'3212565107043415787',items:{invalid:true}}],[3,99,payload]])await db.query('insert into orders values($1,$2,$3,$4,now())',[id,merchant,String(id),JSON.stringify(p)]);
  for(const [id,merchant,cart,p] of [[1,1829345766,payload.checkout_id,{order_id:'1'}],[2,1829345766,'3212565107043415788',{order:{id:'2'}}],[3,99,payload.checkout_id,{order_id:'1'}]])await db.query('insert into abandoned_carts values($1,$2,$3,$4,now())',[id,merchant,cart,JSON.stringify(p)]);
  const sql=fs.readFileSync(__dirname+'/../docs/preorder-consent-source-check.sql','utf8');
  assert.match(sql,/begin transaction read only/i);assert.doesNotMatch(sql,/\b(?:insert|update|delete|alter|drop|create|truncate)\b/i);
  const results=await db.exec(sql),report=results.flatMap(x=>x.rows).find(x=>x.diagnostics).diagnostics;
  assert.equal(report.orders_sampled,2);assert.equal(report.carts_sampled,2);assert.equal(report.orders_with_full_items,1);
  assert.equal(report.native_link_checks.explicit_cart_order_links,2);assert.equal(report.native_link_checks.checkout_matches_cart_id,1);assert.equal(report.native_link_checks.checkout_differs_from_cart_id,1);
  assert.equal(report.items.with_sku_id,1);assert.deepEqual(report.items.recognized_option_fields.sort(),['id','value']);
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_|321256510704341578|custom_private_key/);
 }finally{await db.close();}
});
test('dashboard never treats mixed order contents or allocation as shipping consent',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(__dirname+'/../public/dashboard-preorders.js','utf8'),{window,Intl,URLSearchParams});
 const html=window.LinkPreorders.render({ready:true,batches:[{id:'a',status:'open',name:'Batch',product_name:'Frame'}],summary:[],queue:[],notices:[],page:1,reservations:[{batch_id:'a',external_order_id:'123',mixed_order:true,state:'allocated',quantity:1,allocated_quantity:1}],order_plans:{123:{preorders_allocated:true,ship_from:'2026-11-04',ship_by:'2026-11-06'}}});
 assert.match(html,/موافقة تجميع الشحن غير موثقة/);assert.match(html,/إذا اعتمد العميل التجميع/);
 assert.doesNotMatch(html,/الطلب الذي يجمع الجاهز والحجز يُجهّز ويُشحن كاملاً/);
});
test('dashboard separates recorded but unmatched consent from an absent consent and escapes its disclosure',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(__dirname+'/../public/dashboard-preorders.js','utf8'),{window,Intl,URLSearchParams});
 const data={ready:true,batches:[],summary:[],queue:[],notices:[],page:1,reservations:[{external_order_id:'123',mixed_order:true,state:'reserved'}],shipping_consents:{123:{status:'review',reason:'snapshot_incomplete',recorded:true,received_at:'2026-10-18T11:38:31Z',policy_text:'<script>test</script>',schedules:[{ship_from:'2026-11-14',ship_by:'2026-11-16'}]}}};
 const html=window.LinkPreorders.render(data);assert.match(html,/موافقة الشحنة الواحدة محفوظة/);assert.match(html,/badge amber/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.doesNotMatch(html,/موافقة تجميع الشحن غير موثقة/);
});
