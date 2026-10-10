const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {infer,models,importPage}=require('../lib/postpurchase-auto');const {PGlite}=require('@electric-sql/pglite');
const base={id:100,name:'كفر آيفون 17 برو ماكس',description:'كفر نحيف',source:'salla_catalog',product_url:'https://linkstore-sa.com/p100',status:'sale',is_available:true,options:[],has_skus:false};
test('Arabic/English model parsing and conservative inference distinguish bundles and options',()=>{
 assert.deepEqual(models('كفر آيفون ١٧ برو ماكس'),['iPhone 17 Pro Max']);assert.equal(infer(base).decision,'auto');assert.deepEqual(infer(base).profile.components,['case']);
 for(const [change,reason]of [[{name:'بكج آيفون 17 برو ماكس',description:'كفر + عدسات + استيكر شاشة'},'bundle_contents_review'],[{name:'كفر ايفون 17 برو وايفون 17 برو ماكس'},'multiple_models'],[{options:[{name:'اختر الموديل',values:[{name:'iPhone 17 Pro'}]}]},'variants_review'],[{description:'متوافق مع iPhone 16 Pro'},'model_conflict'],[{source:'local_orders'},'catalog_required']]){const r=infer({...base,...change});assert.equal(r.decision,'review');assert.ok(r.reasons.includes(reason));}
 assert.equal(infer({...base,name:'تغليف آيفون 17'}).decision,'excluded');assert.equal(infer({...base,status:'hidden'}).decision,'excluded');
 assert.equal(infer({...base,name:'حماية شاشة iPhone 17 Pro',options:[{name:'اللون',values:[{name:'شفاف'}]}]}).decision,'auto');
 assert.deepEqual(infer({...base,name:'إطار كاميرا ايفون 17 برو'}).profile.components,['camera_frame']);
});
test('Side frames use body protection and explicit negative compatibility does not become a conflict',()=>{
 const side=infer({...base,name:'إطار Link المعدني – iPhone 14 Pro',description:'حماية الجوانب والزوايا بدون تغطية الظهر'});
 assert.equal(side.decision,'auto');assert.deepEqual(side.profile.components,['case']);
 for(const name of ['إطارLink المعدني – iPhone 14 Pro','إطارلنك المعدني – iPhone 14 Pro','إطار Linkالمعدني – iPhone 14 Pro'])assert.equal(infer({...base,name,description:'حماية الجوانب'}).decision,'auto');
 assert.deepEqual(infer({...base,name:'إطار Link المعدني للكاميرا iPhone 14 Pro'}).profile.components,['camera_frame']);
 assert.equal(infer({...base,name:'إطار iPhone 14 Pro'}).decision,'review');
 for(const description of ['مخصص لـ iPhone 17 Pro Max.<p>لا يناسب iPhone 17 Pro</p>','Not compatible with iPhone 16 Pro. Fits iPhone 17 Pro Max.','تنبيه: لا يتوافق مع iPhone 16 Pro'])assert.equal(infer({...base,description}).decision,'auto');
 for(const description of ['متوافق مع iPhone 16 Pro','لا يناسب iPhone 16 Pro لكن يناسب iPhone 15 Pro','لا يناسب iPhone 16 Pro ويناسب iPhone 15 Pro','يناسب iPhone 17 Pro Max ولا يناسب iPhone 16 Pro'])assert.ok(infer({...base,description}).reasons.includes('model_conflict'));
 assert.equal(infer({...base,name:'إطار Link المعدني – iPhone 14 Pro',options:[{name:'الموديل',values:[{name:'iPhone 14 Pro'},{name:'iPhone 14 Pro Max'}]}]}).decision,'review');
});
test('Importer has no retries, uses one reserved GET, honors cache/budget, and counts failures',async()=>{
 let network=0,finish;const db=async(path,opts)=>{if(path.endsWith('reserve_import'))return {page:2,token:'test',requests:2};finish=JSON.parse(opts.body);return true;};const creds=async()=>({access_token:'test'});
 const r=await importPage({database:db,credentials:creds,request:async url=>{network++;assert.ok(url.endsWith('products?page=2&per_page=60'));return {ok:true,text:async()=>JSON.stringify({success:true,data:[{...base,urls:{customer:base.product_url}}],pagination:{totalPages:2}})};}});assert.equal(network,1);assert.equal(r.done,true);assert.equal(finish.p_products[0].id,'100');
 network=0;assert.equal((await importPage({database:async()=>({idle:'budget_limit'}),credentials:creds,request:async()=>network++})).reason,'budget_limit');assert.equal(network,0);
 await assert.rejects(importPage({database:db,credentials:creds,request:async()=>{network++;throw Error('timeout');}}));assert.equal(network,1);assert.equal(finish.p_error,'connection_or_response_error');
});
test('SQL enforces concurrent lease, monthly budget, private grants and idempotent auto rules preserving manual profiles',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table stores(merchant_id bigint primary key);create table webhook_events(id uuid primary key);');
 const schema=JSON.parse(fs.readFileSync(__dirname+'/fixtures/crm-schema.json'));for(const t of schema.filter(x=>['customers','orders'].includes(x.table_name)))await db.exec(`create table ${t.table_name}(${t.columns.map(c=>`${c.column} ${c.type}${c.nullable==='NO'?' not null':''}${c.default?' default '+c.default:''}`).concat(t.constraints.filter(c=>!c.startsWith('FOREIGN KEY'))).join(',')});`);
 await db.exec('alter table orders add column crm_source_at timestamptz;create table crm_whatsapp_optouts(merchant_id bigint,phone text);');await db.exec(fs.readFileSync(__dirname+'/../crm-postpurchase.sql','utf8'));const sql=fs.readFileSync(__dirname+'/../crm-postpurchase-auto.sql','utf8');await db.exec(sql);await db.exec(sql);
 const merchant=1829345766,reserve=async refresh=>(await db.query('select crm_pp_reserve_import($1,$2) r',[merchant,!!refresh])).rows[0].r;
 const claim=await reserve();assert.equal(claim.requests,1);assert.equal((await reserve()).idle,'busy');
 const finish=async(c,products,done,error=null)=>(await db.query('select crm_pp_finish_import($1,$2,$3,$4,$5,$6) r',[merchant,c.token,c.page,JSON.stringify(products),done,error])).rows[0].r;
 const screen={...base,id:200,name:'حماية شاشة آيفون 17 برو ماكس',product_url:'https://linkstore-sa.com/p200'};assert.equal(await finish(claim,[{...base,id:'100'},{...screen,id:'200'}],true),true);assert.equal((await reserve(true)).idle,'cached');assert.equal((await db.query('select requests from crm_postpurchase_api_usage')).rows[0].requests,1);
 const apply=async arr=>(await db.query('select crm_pp_apply_suggestions($1,$2) r',[merchant,JSON.stringify(arr.map(infer))])).rows[0].r;
 await apply([base,screen]);let rules=(await db.query('select * from crm_postpurchase_rules')).rows;assert.equal(rules.length,1);assert.equal(rules[0].offer_product_id,'200');await db.query('update crm_postpurchase_rules set active=false,paused_by_user=true');await apply([base,screen]);assert.equal((await db.query('select active from crm_postpurchase_rules')).rows[0].active,false);
 await db.query("update crm_postpurchase_products set origin='manual',name='Reviewed case' where product_id='100'");await apply([{...base,description:'متوافق مع iPhone 16'},screen]);assert.equal((await db.query("select name from crm_postpurchase_products where product_id='100'")).rows[0].name,'Reviewed case');
 await db.query('update crm_postpurchase_rules set active=true');await apply([{...base,status:'hidden'},screen]);assert.equal((await db.query('select active from crm_postpurchase_rules')).rows[0].active,false);
 await db.exec("update crm_postpurchase_import set completed_at=now()-interval '2 days'");for(let i=0;i<19;i++){const c=await reserve(true);assert.ok(c.token);await finish(c,[],false,'timeout');}assert.equal((await reserve()).idle,'budget_limit');assert.equal((await db.query('select requests from crm_postpurchase_api_usage')).rows[0].requests,20);
 assert.equal((await db.query("select has_function_privilege('anon','crm_pp_reserve_import(bigint,boolean)','EXECUTE') r")).rows[0].r,false);
 assert.equal((await db.query("select has_table_privilege('authenticated','crm_postpurchase_catalog_cache','SELECT') r")).rows[0].r,false);
 }finally{await db.close();}
});
test('Local analysis pauses on an incomplete catalog without external or write calls',async()=>{let calls=0;const r=await require('../lib/postpurchase-auto').analyze(async path=>{calls++;assert.ok(path.startsWith('crm_postpurchase_import?'));return [{completed:false}];});assert.equal(r.deferred,true);assert.equal(calls,1);assert.equal(r.salla_requests,0);});
test('Analysis button shows progress and keeps the returned result after rendering',async()=>{
 const nodes=new Map(),document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{isConnected:true,textContent:'',disabled:false,handlers:{},addEventListener(event,fn){this.handlers[event]=fn;},querySelectorAll:()=>[]});return nodes.get(id);},querySelectorAll:()=>[]};
 const window={};require('node:vm').runInNewContext(fs.readFileSync(__dirname+'/../public/dashboard-postpurchase.js','utf8'),{window,document,URL,Date});
 const d={ready:true,automatic:{ready:true,suggestions:[],requests:9,budget:20,import:{completed:true}},products:[],rules:[],catalog:[],settings:{batch_hours:[11,17,20]},preview:{rows:[],scanned_orders:0,matched_orders:0}};
 window.LinkPostPurchase.render(d);let rendered='';
 window.LinkPostPurchase.bind({api:async(resource,opts)=>{assert.equal(resource,'postpurchase');assert.equal(JSON.parse(opts.body).action,'analyze');assert.match(nodes.get('pp-auto-progress').textContent,/جارٍ/);return {auto:250,review:134,excluded:114};},navigate:async()=>{rendered=window.LinkPostPurchase.render(d);},toast:()=>{}});
 await nodes.get('pp-auto-analyze').handlers.click({currentTarget:nodes.get('pp-auto-analyze')});
 assert.match(rendered,/اكتمل التحليل المحلي · 250 واضحًا · 134 للمراجعة · 114 مستبعدًا · 0 طلبات سلة/);
});
