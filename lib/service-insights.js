const {sb,MERCHANT_ID,fail}=require('./crm');
const {summarize}=require('./service-monitor');
const taxonomy=require('./service-taxonomy');
const staff=require('./staff-sales');
const DAY=86400000,WINDOW=3*DAY,MAX=5000,SIZE=500;
const validId=x=>/^[1-9]\d{0,19}$/.test(String(x??''));
const validPhone=x=>/^[1-9]\d{7,14}$/.test(x||'');
const path=(table,params)=>table+'?'+new URLSearchParams({merchant_id:'eq.'+MERCHANT_ID,...params});
const localDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
function periodFor(query={},now=new Date()){
 const today=localDay(now),from=query.from||today.slice(0,8)+'01',to=query.to||today;
 const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid(from)||!valid(to)||from>to||to>today||Date.parse(to)-Date.parse(from)>=93*DAY)throw fail(400,'اختر فترة صحيحة لا تتجاوز 93 يومًا وتنتهي اليوم أو قبله.');
 return {from,to,start:new Date(from+'T00:00:00+03:00').toISOString(),end:new Date(Math.min(Date.parse(to+'T00:00:00+03:00')+DAY-1,now.getTime())).toISOString()};
}
async function read(db,table,params,max=MAX){
 const rows=[];let limited=false;
 for(let offset=0;offset<max;offset+=SIZE){
  const batch=await db(path(table,{...params,limit:Math.min(SIZE,max-offset),offset}));
  if(!Array.isArray(batch))throw Error('Unexpected insight data');
  rows.push(...batch);if(batch.length<Math.min(SIZE,max-offset))return {rows,limited:false};
 }
 limited=true;return {rows,limited};
}
async function chunks(values,fn){const results=[];for(let i=0;i<values.length;i+=50)results.push(await fn(values.slice(i,i+50)));return {rows:results.flatMap(x=>x.rows),limited:results.some(x=>x.limited)};}
const inValues=values=>'in.('+values.map(x=>'"'+String(x).replace(/["\\]/g,'')+'"').join(',')+')';
function trackingLinks(messages){
 return messages.flatMap(m=>{
  if(m.actor!=='employee'||typeof m.body!=='string')return [];
  return (m.body.match(/https:\/\/[^\s<>]+/g)||[]).flatMap(raw=>{
   try{const url=new URL(raw),attr=staff.attributionFromPayload(Object.fromEntries(url.searchParams));return url.hostname.replace(/^www\./,'')==='linkstore-sa.com'&&attr?.tracking_code?[{code:attr.tracking_code,at:Date.parse(m.occurred_at),message_id:String(m.message_id)}]:[];}catch{return [];}
  });
 });
}
function referencesOrder(message,order){
 if(message.actor!=='customer'||typeof message.body!=='string')return false;
 return [order.order_reference,order.external_order_id].filter(Boolean).some(value=>{
  const escaped=String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?:طلب(?:ي|كم)?\\s*(?:رقم\\s*)?#?\\s*|#\\s*)'+escaped+'(?![\\p{L}\\p{N}])','iu').test(message.body);
 });
}
function outcomes(conversations,messages,customers,orders,copied,{storeUnavailable=false,limited=false}={}){
 const groups=new Map(conversations.map(c=>[c.id,messages.filter(m=>m.conversation_id===c.id)]));
 const matched=new Map(),reasons=new Map(),evidence=new Map(),assigned=new Map();
 for(const c of conversations){
  const rows=groups.get(c.id),phones=[...new Set(rows.map(m=>m.contact_phone).filter(Boolean))];
  const people=phones.length===1&&validPhone(phones[0])?customers.filter(p=>p.normalized_phone===phones[0]):[];
  if(!storeUnavailable&&phones.length===1&&people.length===1&&!limited)matched.set(c.id,String(people[0].id));
  else reasons.set(c.id,storeUnavailable?'سجل سلة المحلي غير متاح':limited?'قراءة سلة جزئية؛ لا يمكن تأكيد المطابقة':phones.length!==1?'الهاتف مفقود أو متعدد':people.length>1?'أكثر من عميل يطابق الهاتف':'لا توجد مطابقة عميل مؤكدة');
 }
 const uniqueOrders=new Map();
 for(const order of orders){const key=String(order.external_order_id||order.id||'');if(key&&!uniqueOrders.has(key))uniqueOrders.set(key,order);}
 const copies=new Map();for(const copy of copied){const data=copy.payload?.data||copy.payload||{},code=String(data.tracking_code||'');if(code){const times=copies.get(code)||[];times.push(Date.parse(copy.occurred_at));copies.set(code,times);}}
 for(const [key,order] of uniqueOrders){
  const at=Date.parse(order.ordered_at);if(!Number.isFinite(at))continue;
  const candidates=[];
  for(const c of conversations){
   if(matched.get(c.id)!==String(order.customer_id))continue;
   const rows=groups.get(c.id),incoming=rows.filter(m=>m.actor==='customer');
   const previous=incoming.filter(m=>Date.parse(m.occurred_at)<=at).sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at))[0];
   const attr=staff.attributionFromPayload(order.source_payload),link=trackingLinks(rows).sort((a,b)=>b.at-a.at).find(l=>l.code===attr?.tracking_code&&l.at<=at&&at-l.at<=WINDOW&&(copies.get(l.code)||[]).some(t=>t<=l.at));
   if(staff.isValidOrder(order)&&link)candidates.push({id:c.id,kind:'tracked',rank:3,at:link.at,message_id:link.message_id});
   else if(staff.isValidOrder(order)&&previous&&at-Date.parse(previous.occurred_at)<=WINDOW)candidates.push({id:c.id,kind:'phone_after',rank:2,at:Date.parse(previous.occurred_at),message_id:String(previous.message_id)});
   else{
    const support=incoming.filter(m=>Date.parse(m.occurred_at)>at&&referencesOrder(m,order)).sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at))[0];
    if(support)candidates.push({id:c.id,kind:'prior_support',rank:1,at:Date.parse(support.occurred_at),message_id:String(support.message_id)});
   }
  }
  // Reused tracking codes across cases do not prove a particular conversation.
  const tracking=candidates.filter(c=>c.kind==='tracked');
  if(tracking.length>1)for(const c of tracking){c.kind='phone_after';c.rank=2;}
  candidates.sort((a,b)=>b.rank-a.rank||b.at-a.at||a.id.localeCompare(b.id));
  const owner=candidates[0];if(!owner)continue;
  const item={...owner,order_id:key,reference:order.order_reference||key,ordered_at:order.ordered_at,status:order.status||order.status_slug||null};
  const own=assigned.get(owner.id)||[];own.push(item);assigned.set(owner.id,own);
  for(const candidate of candidates.slice(1))reasons.set(candidate.id,'الطلب المشترك احتُسب مرة واحدة مع حالة أخرى حسب قوة الربط ثم أحدث رسالة مؤهلة؛ لا تثبت هذه القاعدة السببية');
 }
 const buckets=Object.fromEntries(['tracked','phone_after','prior_support','uncertain'].map(kind=>[kind,{code:kind,conversation_ids:[],order_ids:[],count:0,order_count:0}]));
 for(const c of conversations){
  const items=(assigned.get(c.id)||[]).sort((a,b)=>b.rank-a.rank),kind=items[0]?.kind||'uncertain',primary=items.filter(x=>x.kind===kind);
  const bucket=buckets[kind];bucket.conversation_ids.push(c.id);bucket.order_ids.push(...primary.map(x=>x.order_id));
  evidence.set(c.id,{code:kind,orders:primary,reason:kind==='uncertain'?(reasons.get(c.id)||'لا يوجد طلب قابل للربط بدليل كافٍ في السجل المحلي؛ لا يعني ذلك عدم الشراء'):'التصنيف يصف الربط المسجّل ولا يثبت أن المحادثة سببت الشراء'});
 }
 for(const bucket of Object.values(buckets)){bucket.count=bucket.conversation_ids.length;bucket.order_ids=[...new Set(bucket.order_ids)];bucket.order_count=bucket.order_ids.length;}
 return {rows:Object.values(buckets),evidence};
}
function aggregate({period,messages,analyses,customers=[],orders=[],copied=[],limited=false,analysesUnavailable=false,storeUnavailable=false,storeLimited=false},now=new Date()){
 const scoped=messages.filter(m=>validId(m.conversation_id)&&Number.isFinite(Date.parse(m.occurred_at))&&Date.parse(m.occurred_at)>=Date.parse(period.start)&&Date.parse(m.occurred_at)<=Date.parse(period.end)).sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||String(a.message_id).localeCompare(String(b.message_id)));
 const cohort=new Set(scoped.filter(m=>m.actor==='customer').map(m=>m.conversation_id));
 const conversations=summarize(scoped.filter(m=>cohort.has(m.conversation_id)),[period.start,period.start],now.getTime()).conversations;
 const latest=new Map();
 for(const row of analyses.filter(a=>a.state==='complete'&&a.result&&cohort.has(a.conversation_id)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||String(b.fingerprint).localeCompare(String(a.fingerprint))))if(!latest.has(row.conversation_id))latest.set(row.conversation_id,row);
 const groups={topics:new Map(),barriers:new Map(),coaching:new Map()},legacy=[],classified=new Set(),unclassified=[];
 const supporting=new Map(conversations.map(c=>[c.id,{...c,evidence:[]}]));
 for(const [id,analysis] of latest){
  supporting.get(id).saved_analysis={at:analysis.created_at,summary:analysis.result.summary||null,obstacle:analysis.result.obstacle||null,improvement:analysis.result.improvement||null,legacy:analysis.result.classification?.version!==1};
  const cls=analysis.result.classification;
  if(cls?.version!==1){legacy.push(id);continue;}
  let any=false;
  for(const kind of Object.keys(groups)){
   const definitions=taxonomy[kind];
   for(const item of Array.isArray(cls[kind])?cls[kind]:[]){
    if(!item||!Object.hasOwn(definitions,item.code)||typeof item.message_id!=='string'||!item.message_id||typeof item.excerpt!=='string'||!item.excerpt||!Number.isFinite(Date.parse(item.at))||Date.parse(item.at)<Date.parse(period.start)||Date.parse(item.at)>Date.parse(period.end)||item.actor!==(kind==='coaching'?'employee':'customer'))continue;
    const code=item.code,group=groups[kind].get(code)||{code,label:typeof definitions[code]==='string'?definitions[code]:definitions[code].label,conversation_ids:new Set(),message_ids:new Set(),current_ids:new Set(),...typeof definitions[code]==='object'?definitions[code]:{}};
    group.conversation_ids.add(id);group.message_ids.add(item.message_id);if(scoped.some(m=>m.conversation_id===id&&String(m.message_id)===item.message_id&&m.actor===item.actor))group.current_ids.add(item.message_id);groups[kind].set(code,group);any=true;
    supporting.get(id).evidence.push({...item,kind,code,fingerprint:analysis.fingerprint,analysis_at:analysis.created_at});
   }
  }
  if(any)classified.add(id);else unclassified.push(id);
 }
 const resultGroups=Object.fromEntries(Object.entries(groups).map(([kind,map])=>[kind,[...map.values()].map(g=>({...g,conversation_ids:[...g.conversation_ids],count:g.conversation_ids.size,evidence_count:g.message_ids.size,current_evidence_count:g.current_ids.size,message_ids:undefined,current_ids:undefined})).sort((a,b)=>b.count-a.count||b.current_evidence_count-a.current_evidence_count||b.evidence_count-a.evidence_count||a.code.localeCompare(b.code))]));
 const improvements=[...resultGroups.barriers.map(g=>({...g,key:'barriers:'+g.code})),...resultGroups.coaching.map(g=>({...g,key:'coaching:'+g.code}))].sort((a,b)=>b.count-a.count||b.current_evidence_count-a.current_evidence_count||b.evidence_count-a.evidence_count||a.code.localeCompare(b.code));
 const facts=outcomes(conversations,scoped,customers,orders,copied,{storeUnavailable,limited:storeLimited||limited});
 for(const c of conversations)supporting.get(c.id).outcome=facts.evidence.get(c.id);
 return {period,limited,analyses_unavailable:analysesUnavailable,store_unavailable:storeUnavailable,store_limited:storeLimited,
  coverage:{total:conversations.length,analyzed:analysesUnavailable?null:latest.size,percent:limited||analysesUnavailable||!conversations.length?null:Math.round(latest.size/conversations.length*100),classified:analysesUnavailable?null:classified.size,legacy:analysesUnavailable?null:legacy.length,legacy_ids:legacy,unclassified_ids:unclassified},
  ...resultGroups,improvements,outcomes:facts.rows,conversations:[...supporting.values()]};
}
async function load(query={},db=sb,now=new Date()){
 const period=periodFor(query,now),originalDb=db;let requests=0;
 db=async(...args)=>{if(++requests>32)throw Error('Local read budget exceeded');return originalDb(...args);};
 const messages=await read(db,'crm_service_monitor_messages',{select:'message_id,conversation_id,contact_phone,contact_name,actor,body,occurred_at',and:'(occurred_at.gte.'+period.start+',occurred_at.lte.'+period.end+')',order:'occurred_at.desc,message_id.desc'});
 const allIds=[...new Set(messages.rows.filter(m=>m.actor==='customer'&&validId(m.conversation_id)).map(m=>m.conversation_id))],ids=allIds.slice(0,200);
 messages.limited ||= allIds.length>200;messages.rows=messages.rows.filter(m=>ids.includes(m.conversation_id));
 let analyses={rows:[],limited:false},customers={rows:[],limited:false},orders={rows:[],limited:false},copied={rows:[],limited:false},analysesUnavailable=false,storeUnavailable=false;
 if(ids.length){try{analyses=await chunks(ids,batch=>read(db,'crm_service_journey_analyses',{conversation_id:inValues(batch),state:'eq.complete',select:'conversation_id,fingerprint,state,result,created_at',order:'created_at.desc,fingerprint.desc'}));}catch{analysesUnavailable=true;}}
 const phones=[...new Set(messages.rows.map(m=>m.contact_phone).filter(validPhone))];
 if(phones.length){try{
  customers=await chunks(phones,batch=>read(db,'customers',{normalized_phone:inValues(batch),select:'id,normalized_phone',order:'id.asc'},1000));
  const customerIds=[...new Set(customers.rows.map(c=>c.id))];
  if(customerIds.length)orders=await chunks(customerIds,batch=>read(db,'orders',{customer_id:inValues(batch),ordered_at:'lte.'+new Date(Math.min(now.getTime(),Date.parse(period.end)+WINDOW)).toISOString(),select:'id,external_order_id,customer_id,order_reference,status,status_slug,ordered_at,source_payload',order:'ordered_at.desc.nullslast,id.desc'},1000));
  const codes=[...new Set(orders.rows.map(o=>staff.attributionFromPayload(o.source_payload)?.tracking_code).filter(code=>/^[a-z0-9_-]{1,80}$/.test(code)))];
  if(codes.length>200)copied.limited=true;
  if(codes.length&&codes.length<=200&&!orders.limited&&!customers.limited)copied=await chunks(codes,batch=>read(db,'crm_event_inbox',{event_name:'eq.staff.link.copied','payload->data->>tracking_code':inValues(batch),select:'payload,occurred_at',order:'occurred_at.desc,id.desc'}));
 }catch{storeUnavailable=true;}}
 return aggregate({period,messages:messages.rows,analyses:analyses.rows,customers:customers.rows,orders:orders.rows,copied:copied.rows,limited:messages.limited||analyses.limited,analysesUnavailable,storeUnavailable,storeLimited:customers.limited||orders.limited||copied.limited},now);
}
module.exports={periodFor,aggregate,outcomes,load};
