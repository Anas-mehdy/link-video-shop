const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {classify,fromEvent,DEFAULT_MESSAGE}=require('../lib/coupon-replies');
test('Arabic intent and complaints do not confuse requests with failed coupons',()=>{
 for(const s of ['كود خصم','ابي كود','ابغى خصم','عندكم كود؟','كودخصم','كوبون','ممكن تخفيض','بدي كود','أبي كُود خَصم','discount code'])assert.equal(classify(s),'request',s);
 for(const s of ['الكود ما اشتغل','الكوبون مرفوض','الخصم ما انحسب','الكود غير صالح','كود خصم لا يعمل'])assert.equal(classify(s),'problem',s);
 for(const s of ['وصلني كود التحقق','كود المنتج 125','شو السعر','خصم','رقم طلبي 300'])assert.equal(classify(s),null,s);
 assert.match(DEFAULT_MESSAGE,/أكثر من \*100 ريال\*/);assert.match(DEFAULT_MESSAGE,/\*200 ريال أو أكثر\*/);
});
function fixture(){const now=Date.now();return {now,body:{event:'message_created',account:{id:12},inbox:{id:40},conversation:{id:321},private:false,content_type:'text',message_type:'incoming',content:'ابي كود خصم'},record:{p_reply_phone:'966500000001',p_message_id:'1001',p_occurred_at:new Date(now).toISOString()},environment:{ETISALNA_API_ACCESS_TOKEN:'test'}};}
test('signed incoming flow verifies conversation and sends once, keeps uncertainty durable',async()=>{
 let calls=[];const database=async(path,options)=>{calls.push([path,JSON.parse(options.body)]);return path.startsWith('rpc/')?{id:'11111111-1111-1111-1111-111111111111',message:DEFAULT_MESSAGE}:null;};
 let requests=[];const request=async(url,options)=>{requests.push([url,options]);return {ok:true,json:async()=>options.method==='POST'?{id:123,private:false,message_type:1,status:'sent'}:{id:321,inbox_id:40,meta:{sender:{phone_number:'+966500000001'}},labels:[]}};};
 const f=fixture();let r=await fromEvent(f.body,f.record,{...f,database,request});assert.equal(r.status,'accepted');assert.equal(requests.length,2);assert.equal(JSON.parse(requests[1][1].body).content,DEFAULT_MESSAGE);assert.equal(calls[1][1].provider_message_id,'123');
 calls=[];requests=[];r=await fromEvent(f.body,f.record,{...f,database,request:async()=>{throw Error('timeout');}});assert.equal(r.status,'unknown');assert.equal(calls[1][1].status,'unknown');
 r=await fromEvent(f.body,f.record,{...f,database:async()=>({skip:'cooldown'}),request:()=>assert.fail('must not send')});assert.equal(r.reason,'cooldown');
});
test('outgoing, updates, notes, old messages, optouts and wrong conversations cannot send',async()=>{
 const f=fixture();const database=()=>assert.fail('must not claim');
 for(const change of [{message_type:'outgoing'},{event:'message_updated'},{private:true},{content_type:'audio'},{account:{id:13}},{inbox:{id:41}},{conversation:{id:'x'}}])assert.equal((await fromEvent({...f.body,...change},f.record,{...f,database})).status,'ignored');
 assert.equal((await fromEvent(f.body,{...f.record,p_occurred_at:new Date(f.now-601000).toISOString()},{...f,database})).reason,'stale');
 assert.equal((await fromEvent(f.body,{...f.record,p_phone:f.record.p_reply_phone},{...f,database})).status,'ignored');
 let posts=0;
 const db=async p=>p.startsWith('rpc/')?{id:'11111111-1111-1111-1111-111111111111',message:'test'}:null;
 const request=async(url,o)=>{if(o.method==='POST')posts++;return {ok:true,json:async()=>({id:321,inbox_id:41,meta:{sender:{phone_number:'+966500000001'}}})};};
 assert.equal((await fromEvent(f.body,f.record,{...f,database:db,request})).status,'unknown');assert.equal(posts,0);
});
test('SQL claim deduplicates, observes cooldown, pause and optouts and is private',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create table stores(merchant_id bigint primary key); insert into stores values(1829345766); create table crm_whatsapp_optouts(merchant_id bigint,phone text);');
 const sql=fs.readFileSync('crm-coupon-replies.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.query("insert into crm_coupon_settings(merchant_id,enabled,started_at,message) values(1829345766,true,now()-interval '1 hour',$1)",[DEFAULT_MESSAGE]);
 const claim=(mid='1001',phone='966500000001',kind='request',cid='321')=>db.query('select crm_claim_coupon_reply(1829345766,$1,$2,$3,now(),$4) r',[mid,cid,phone,kind]);
 assert.ok((await claim()).rows[0].r.id);assert.equal((await claim()).rows[0].r.skip,'duplicate');assert.equal((await claim('1002')).rows[0].r.skip,'cooldown');
 await db.exec("insert into crm_coupon_conversations values(1829345766,'322',true)");assert.equal((await claim('1003','966500000002','request','322')).rows[0].r.skip,'conversation_paused');
 assert.equal((await claim('1004','966500000003','problem')).rows[0].r.skip,'needs_agent');
 await db.exec("insert into crm_whatsapp_optouts values(1829345766,'966500000004')");assert.equal((await claim('1005','966500000004')).rows[0].r.skip,'optout');
 assert.equal((await db.query("select has_table_privilege('anon','crm_coupon_replies','SELECT') a")).rows[0].a,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','crm_claim_coupon_reply(bigint,text,text,text,timestamptz,text)','EXECUTE') a")).rows[0].a,false);
 await db.exec('update crm_coupon_settings set enabled=false');assert.equal((await claim('1006')).rows[0].r.skip,'disabled');
 }finally{await db.close();}
});
test('dashboard coupon tab loads and saves the exact reply and controls a conversation',async()=>{
 const vm=require('node:vm');const {parseHTML}=require('linkedom');const {window}=parseHTML('<html><body><div id="coupon-replies"></div></body></html>');
 const calls=[];const data={configuration:{enabled:true,message:DEFAULT_MESSAGE},ready:true,replies:[{conversation_id:'321',status:'accepted',reason:'provider_accepted',created_at:new Date().toISOString(),provider_message_id:'123'}],conversations:[]};
 const api=async(resource,options)=>{calls.push([resource,options]);return data;};
 vm.runInNewContext(fs.readFileSync('public/dashboard-coupon-replies.js','utf8'),{window,document:window.document,Date});
 await window.LinkCouponReplies.bind({api,toast:()=>assert.fail('unexpected UI error')});
 assert.equal(window.document.querySelector('#coupon-message').value,DEFAULT_MESSAGE);assert.ok(window.document.querySelector('[data-pause="321"]'));
 await window.document.querySelector('[data-pause="321"]').onclick();
 assert.deepEqual(JSON.parse(calls.find(c=>c[1]?.method==='POST')[1].body),{conversation_id:'321',paused:true});
});
