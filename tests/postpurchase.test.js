const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {product,settings}=require('../lib/postpurchase');
test('mapping validation rejects unknown URLs and live mode',()=>{
 const p={product_id:'100',name:'case',model:'iPhone 17',components:['case'],product_url:'https://linkstore-sa.com/p100'};
 assert.equal(product(p).variant_id,'');for(const change of [{components:[]},{product_url:'https://evil.example/p100'},{product_id:'100)&x=1'}])assert.throws(()=>product({...p,...change}));
 const s={delay_days:7,batch_limit:10,cooldown_days:14,stock_api_budget:300,batch_hours:[20,11,17]};assert.deepEqual(settings(s).batch_hours,[11,17,20]);for(const change of [{enabled:true},{batch_limit:11},{batch_hours:[24]}])assert.throws(()=>settings({...s,...change}));
});
test('SQL preview tests delivery dates, bundle exclusions, optouts, purchases, variants, private grants and idempotence',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);create table webhook_events(id uuid primary key);');
 const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json'));
 for(const table of schema.filter(x=>['customers','orders'].includes(x.table_name)))await db.exec(`create table ${table.table_name}(${table.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(table.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
 await db.exec("alter table orders add column crm_source_at timestamptz;create table crm_whatsapp_optouts(merchant_id bigint,phone text);create table test_clock(t timestamptz);insert into test_clock values('2026-10-10T09:00Z');create function public.pp_now() returns timestamptz language sql as $$ select t from public.test_clock $$;");
 const sql=fs.readFileSync(__dirname+'/../crm-postpurchase.sql','utf8').replaceAll('now()','public.pp_now()');await db.exec(sql);await db.exec(sql);await db.exec("alter table crm_postpurchase_products add column origin text default 'manual'");const targeting=fs.readFileSync(__dirname+'/../crm-postpurchase-single-product.sql','utf8').replaceAll('now()','public.pp_now()');await db.exec(targeting);await db.exec(targeting);
 const merchant=1829345766;
 const profile=async(id,components,variant='',model='iPhone 17')=>db.query("insert into crm_postpurchase_products(merchant_id,product_id,variant_id,name,model,components,product_url) values($1,$2,$3,$2,$4,$5,'https://linkstore-sa.com/product')",[merchant,id,variant,model,components]);
 await profile('100',['case']);await profile('200',['screen']);await profile('201',['lens']);await profile('300',['case','screen']);await profile('400',['screen'],'1','iPhone 17 Pro');
 for(const [t,f,v]of [['100','200',''],['100','201',''],['300','200',''],['100','400','1']])await db.query("insert into crm_postpurchase_rules(merchant_id,name,trigger_product_id,offer_product_id,offer_variant_id) values($1,$2,$3,$4,$5)",[merchant,t+' to '+f,t,f,v]);
 let n=0;const order=async(items,status='under_review',customerId=null)=>{n++;let c=customerId;if(!c)c=(await db.query("insert into customers(merchant_id,external_customer_id,name,phone,normalized_phone) values($1,$2,'Customer',$3,$4) returning id",[merchant,String(n),'+96650000'+String(n).padStart(3,'0'),'96650000'+String(n).padStart(3,'0')])).rows[0].id;const row=(await db.query("insert into orders(merchant_id,external_order_id,customer_id,status_slug,ordered_at,crm_source_at,source_payload) values($1,$2,$3,$4,public.pp_now(),public.pp_now(),$5) returning id,customer_id",[merchant,String(n),c,'under_review',JSON.stringify({items})])).rows[0];if(status==='delivered')await db.query("update orders set status_slug='delivered' where id=$1",[row.id]);return row;};
 const old=await order([{product:{id:100,name:'Case'}}],'delivered');await db.query('delete from crm_postpurchase_delivered where order_id=$1',[old.id]);
 const fresh=await order([{product:{id:100,name:'Case'}}]);await db.query("update orders set status_slug='delivered' where id=$1",[fresh.id]);
 const bundle=await order([{product_id:300,name:'Bundle'}],'delivered');const multi=await order([{product_id:100},{product_id:999}],'delivered');const unknown=await order([{product_id:999,name:'Unknown'}],'delivered');
 const opted=await order([{product_id:100}],'delivered');await db.query('insert into crm_whatsapp_optouts select $1,normalized_phone from customers where id=$2',[merchant,opted.customer_id]);
 const purchased=await order([{product_id:100}],'delivered');
 const preview=async()=>(await db.query('select crm_postpurchase_preview($1) r',[merchant])).rows[0].r;
 let r=await preview();assert.equal(r.scope,'single_product');assert.equal(r.multiple_product_orders,1);assert.equal(r.excluded_bundle_orders,1);assert.equal(r.unclassified_orders,1);assert.equal(r.rows.filter(x=>x.external_order_id==='2').length,2);assert.ok(!r.rows.some(x=>x.offer_name==='400'));assert.ok(!r.rows.some(x=>x.external_order_id===String(3)||x.external_order_id===String(4)));assert.ok(r.rows.some(x=>x.reason==='product_unclassified'));assert.equal(r.salla_requests,0);assert.equal(r.messages_sent,0);for(const reason of ['delivery_date_unknown','delay','optout'])assert.ok(r.rows.some(x=>x.reason===reason),reason);
 await db.exec("update test_clock set t='2026-10-18T09:00Z'");await order([{product_id:200}],'under_review',purchased.customer_id);
 r=await preview();for(const reason of ['later_purchase','stock_check_required'])assert.ok(r.rows.some(x=>x.reason===reason),reason);
 const before=(await db.query('select delivered_at from crm_postpurchase_delivered where order_id=$1',[fresh.id])).rows[0].delivered_at;
 await db.query("update orders set status_slug='delivered',crm_source_at=public.pp_now() where id=$1",[fresh.id]);assert.equal((await db.query('select delivered_at from crm_postpurchase_delivered where order_id=$1',[fresh.id])).rows[0].delivered_at.toISOString(),before.toISOString());
 const catalog=(await db.query('select crm_postpurchase_catalog($1) r',[merchant])).rows[0].r;for(const id of ['100','300','999'])assert.ok(catalog.some(x=>x.product_id===id),id);
 for(const t of ['crm_postpurchase_settings','crm_postpurchase_products','crm_postpurchase_rules','crm_postpurchase_delivered'])assert.equal((await db.query('select has_table_privilege($1,$2,$3) r',['anon',t,'SELECT'])).rows[0].r,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','crm_postpurchase_preview(bigint)','EXECUTE') r")).rows[0].r,false);
 }finally{await db.close();}
});
test('Admin setup state stays available before SQL and GET never calls Salla or sends',async()=>{
 const vm=require('node:vm');let calls=[];const context={module:{exports:{}},require:path=>path==='./postpurchase-preview'?{loadCatalog:async()=>[],loadRows:async(db,p)=>db(p)}:path==='./postpurchase-auto'?{load:async()=>({suggestions:[]})}:({MERCHANT_ID:1829345766,sb:async path=>{calls.push(path);throw new Error('Supabase 404: {"code":"PGRST205"}');},json:(res,status,data)=>{res.status=status;res.data=data;},bodyObject:req=>req.body,fail:(statusCode,message)=>Object.assign(new Error(message),{statusCode})}),URL};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../lib/postpurchase.js','utf8'),context);const res={};await context.module.exports.admin({method:'GET'},res);assert.equal(res.status,200);assert.equal(res.data.ready,false);assert.equal(calls.length,5);assert.ok(calls.every(x=>x.startsWith('crm_postpurchase_')||x.startsWith('rpc/crm_postpurchase_')));
});
