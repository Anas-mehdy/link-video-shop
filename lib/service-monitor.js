const {workingMinutes}=require('./service-shift');
const {sb, MERCHANT_ID, currentMonthPeriod, json, fail}=require('./crm');
const id=v=>typeof v==='number'&&!Number.isSafeInteger(v)?null:/^[1-9]\d{0,19}$/.test(String(v??''))?String(v):null;
const phone=v=>/^\+?[1-9]\d{7,14}$/.test(v||'')?v.replace(/^\+/,''):null;
const limit=500;
function project(body, record, employee=process.env.ETISALNA_SERVICE_AGENT_ID){
 if(body.event!=='message_created'||body.private!==false||!['incoming','outgoing'].includes(body.message_type))return null;
 const conversation=id(body.conversation?.id);if(!conversation)return null;
 const incoming=body.message_type==='incoming',sender=body.sender||{};
 const contact=incoming?sender:body.conversation?.meta?.sender||{};
 const actor=incoming?'customer':body.content_attributes?.template_params||['agentbot','bot'].includes(String(sender.type||'').toLowerCase())?'automation':
  id(employee)&&id(sender.id)===id(employee)&&String(sender.type||'').toLowerCase()==='user'?'employee':'unverified';
 const bodyText=typeof body.content==='string'?body.content.replace(/\b\d{13,19}\b/g,'[رقم مخفي]').slice(0,1200):null;
 return {merchant_id:MERCHANT_ID,message_id:record.p_message_id,conversation_id:conversation,contact_phone:phone(contact.phone_number),
  contact_name:typeof contact.name==='string'?contact.name.slice(0,120):null,actor,body:bodyText,occurred_at:record.p_occurred_at};
}
async function capture(body, record, db=sb){
 if(process.env.CRM_SERVICE_MONITOR_ENABLED!=='true')return;
 const row=project(body,record);if(!row)return;
 await db('crm_service_monitor_messages?on_conflict=merchant_id,message_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row)});
}
const startToday=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)+'T00:00:00+03:00';
function summarize(rows, starts, now){
 const data=starts.map(start=>({contacts:0,incoming:0,employee:0,automation:0,unverified:0,median_minutes:null}));
 const samples=starts.map(()=>[]),seen=starts.map(()=>new Set()),conversations=new Map();
 for(const row of rows){
  const at=Date.parse(row.occurred_at),key=row.conversation_id;
  if(!Number.isFinite(at)||at>now||!Object.hasOwn(data[0],row.actor==='customer'?'incoming':row.actor))continue;
  const conv=conversations.get(key)||{id:key,name:null,pending_since:null,last_at:null,last_human_at:null,unverified_after:false};
  conv.name=row.contact_name||conv.name;conv.last_at=row.occurred_at;
  if(row.actor==='customer'&&!conv.pending_since){conv.pending_since=row.occurred_at;conv.unverified_after=false;}
  if(row.actor==='unverified'&&conv.pending_since)conv.unverified_after=true;
  if(row.actor==='employee')conv.last_human_at=row.occurred_at;
  for(let i=0;i<starts.length;i++)if(at>=Date.parse(starts[i])){
   data[i][row.actor==='customer'?'incoming':row.actor]++;
   if(row.actor==='customer')seen[i].add(key);
   if(row.actor==='employee'&&conv.pending_since&&Date.parse(conv.pending_since)>=Date.parse(starts[i]))samples[i].push(workingMinutes(Date.parse(conv.pending_since),at));
  }
  if(row.actor==='employee'){conv.pending_since=null;conv.unverified_after=false;}
  conversations.set(key,conv);
 }
 for(let i=0;i<data.length;i++){
  const v=samples[i].sort((a,b)=>a-b),m=Math.floor(v.length/2);data[i].contacts=seen[i].size;
  if(v.length)data[i].median_minutes=Math.round(v.length%2?v[m]:(v[m-1]+v[m])/2);
 }
 const list=[...conversations.values()].map(c=>({...c,waiting_work_minutes:c.pending_since?Math.floor(workingMinutes(Date.parse(c.pending_since),now)):null})).sort((a,b)=>{
  if(a.pending_since&&!b.pending_since)return -1;
  if(b.pending_since&&!a.pending_since)return 1;
  return a.pending_since?Date.parse(a.pending_since)-Date.parse(b.pending_since):Date.parse(b.last_at)-Date.parse(a.last_at);
 });
 return {today:data[0],month:data[1],conversations:list};
}
function path(table, params){return table+'?'+new URLSearchParams({merchant_id:'eq.'+MERCHANT_ID,...params});}
async function overview(db=sb, now=new Date()){
 const period=currentMonthPeriod(now),today=startToday(now),fields='message_id,conversation_id,contact_name,actor,occurred_at';
 const rows=[];
 for(let offset=0;offset<limit*4;offset+=limit){
  const batch=await db(path('crm_service_monitor_messages',{select:fields,and:'(occurred_at.gte.'+period.start+',occurred_at.lte.'+period.end+')',order:'occurred_at.desc,message_id.desc',limit,offset}));
  if(!Array.isArray(batch))throw Error('Unexpected monitor data');
  rows.push(...batch);
  if(batch.length<limit)break;
 }
 const earliest=await db(path('crm_service_monitor_messages',{select:'occurred_at',order:'occurred_at.asc',limit:1}));
 const summary=summarize(rows.reverse(),[today,period.start],now.getTime());
 return {...summary,conversations:summary.conversations.slice(0,80),conversation_total:summary.conversations.length,period,today_start:today,recorded_from:earliest[0]?.occurred_at??null,
  limited:rows.length===limit*4,collector_enabled:process.env.CRM_SERVICE_MONITOR_ENABLED==='true',agent_configured:!!id(process.env.ETISALNA_SERVICE_AGENT_ID)};
}
async function journey(conversation, db=sb){
 if(!id(conversation))throw fail(400,'رقم المحادثة غير صالح');
 const rows=await db(path('crm_service_monitor_messages',{conversation_id:'eq.'+conversation,select:'message_id,contact_phone,contact_name,actor,body,occurred_at',order:'occurred_at.desc,message_id.desc',limit:101}));
 if(!rows.length)throw fail(400,'المحادثة غير متاحة');
 const phones=[...new Set(rows.map(r=>r.contact_phone).filter(Boolean))];let customer=null,orders=[],carts=[],match='unlinked',storeUnavailable=false;
 if(phones.length===1&&phone(phones[0])){
  try{
   const people=await db(path('customers',{normalized_phone:'eq.'+phones[0],select:'id,name',limit:2}));
   if(people.length>1)match='ambiguous';
   if(people.length===1){
    customer=people[0];match='matched';
    [orders,carts]=await Promise.all([
     db(path('orders',{customer_id:'eq.'+customer.id,select:'id,external_order_id,customer_id,order_reference,status,status_slug,total_amount,currency,ordered_at,source_payload',order:'ordered_at.desc.nullslast',limit:12})),
     db(path('abandoned_carts',{customer_id:'eq.'+customer.id,select:'external_cart_id,status,total_amount,currency,abandoned_at,recovered_at',order:'abandoned_at.desc.nullslast',limit:12}))
    ]);
   }
  }catch{storeUnavailable=true;}
 }else if(phones.length>1)match='ambiguous';
 let copied=[];
 const codes=[...new Set(orders.map(o=>require('./staff-sales').attributionFromPayload(o.source_payload)?.tracking_code).filter(code=>/^[a-z0-9_-]{1,80}$/.test(code)))];
 if(codes.length){try{copied=await db(path('crm_event_inbox',{event_name:'eq.staff.link.copied','payload->data->>tracking_code':'in.('+codes.join(',')+')',select:'payload,occurred_at',order:'occurred_at.desc',limit:500}));}catch{/* An unreadable tracking log cannot establish a tracked outcome. */}}
 const outcome=require('./service-insights').outcomes([{id:conversation}],rows.map(r=>({...r,conversation_id:conversation})),customer?[{...customer,normalized_phone:phones[0]}]:[],orders,copied,{storeUnavailable}).evidence.get(conversation);
 if(outcome)outcome.reason+=' · إشارة لهذه الرحلة؛ إزالة تكرار الطلب بين المحادثات تتم في إحصائيات الفترة.';
 return {conversation,outcome,contact:rows.find(r=>r.contact_name)?.contact_name||null,messages:rows.slice(0,100).reverse().map(({contact_phone,contact_name,...rest})=>rest),
  limited:rows.length>100,match,store_unavailable:storeUnavailable,customer:customer?.name||null,orders:orders.map(({source_payload,customer_id,id,...o})=>o),carts};
}
async function admin(req,res){
 const ai=require('./service-journey-analysis');
 if(req.method==='POST'&&req.query?.action==='analyze'){
  if(process.env.CRM_SERVICE_MONITOR_ENABLED!=='true'||!ai.enabled())return json(res,503,{ok:false,error:'تحليل الرحلة غير مفعّل.'});
  if(!/^[a-f0-9]{64}$/.test(req.query?.snapshot||''))return json(res,400,{ok:false,error:'أعد فتح الرحلة قبل التحليل.'});
  try{return json(res,200,{ok:true,...await ai.analyze(await journey(req.query.conversation),{expected:req.query.snapshot})});}
  catch(e){const status=[400,409,429,503].includes(e.statusCode)?e.statusCode:503;return json(res,status,{ok:false,error:e.statusCode&&status===e.statusCode?e.message:'تعذّر الوصول إلى تحليل الرحلة.'});}
 }
 if(req.method!=='GET')return json(res,405,{ok:false,error:'Method not allowed'});
 if(process.env.CRM_SERVICE_MONITOR_ENABLED!=='true')return json(res,200,{ok:true,monitor_disabled:true});
 if(req.query?.view==='insights')return json(res,200,{ok:true,...await require('./service-insights').load(req.query)});
 if(!req.query?.conversation)return json(res,200,{ok:true,...await overview()});
 const data=await journey(req.query.conversation);
 let analysis={enabled:ai.enabled(),eligible:false};
 if(analysis.enabled){try{analysis={...analysis,...await ai.saved(data)};}catch{analysis.unavailable=true;}}
 return json(res,200,{ok:true,...data,analysis,order_signals:ai.orderSignals(data)});
}
module.exports={project,capture,summarize,overview,journey,admin};
