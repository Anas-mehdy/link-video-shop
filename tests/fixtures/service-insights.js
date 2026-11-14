// Deliberately mixed evidence: new classifications, legacy text, missing analysis and shared orders.
const base=require('./service-monitor'),{aggregate,periodFor}=require('../../lib/service-insights');
const stamp=(h,m=0)=>`2026-11-14T${String(h-3).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`;
const phone=id=>'966500000'+String(id).padStart(3,'0');
function journey(id){
 const d=structuredClone(base.journey(String(id)));
 d.messages=d.messages.map(m=>({...m,message_id:id+'-'+m.message_id}));
 if(['1','2','5'].includes(String(id))){d.messages[0].body='مقاس الجهاز غير واضح في صفحة المنتج، ما قدرت أحدد الحماية المناسبة.';}
 if(['6','7'].includes(String(id))){d.messages[0].body='طلبي رقم 7007 تأخر عن موعد التوصيل، ممكن تراجعون الشحنة؟';}
 if(String(id)==='1')d.messages[5].body+=' تفضلي الرابط https://linkstore-sa.com/p/fit?utm_source=instagram&utm_medium=customer_service&utm_campaign=assisted_sales&utm_content=ghofran&utm_term=cs_ghofran_demo1';
 if(String(id)==='9')d.messages[0].body='كم سعر الحماية؟';
 if(String(id)==='10')d.messages[0].body='متى التوصيل للرياض؟';
 d.analysis={...d.analysis,analysis:null,state:null};
 return d;
}
function dataset(){
 const messages=[],customers=[],analyses=[],orders=[],copied=[];
 for(let n=1;n<=18;n++){
  const id=String(n),d=journey(id),contactPhone=phone(n===13?1:n);
  messages.push(...d.messages.map(m=>({...m,conversation_id:id,contact_phone:contactPhone,contact_name:d.contact})));
  if(n!==13&&n!==4)customers.push({id:'customer-'+id,normalized_phone:contactPhone});
  if(n===3)customers.push({id:'duplicate-3',normalized_phone:contactPhone});
  const result=structuredClone(base.analysis);
  if([1,2,5,6,7,8,9,10].includes(n)){
   const evidence=(code,index)=>({code,message_id:d.messages[index].message_id,at:d.messages[index].occurred_at,actor:d.messages[index].actor,excerpt:d.messages[index].body.slice(0,180)});
   result.classification={version:1,topics:[evidence(n<=5?'fit':n===9?'price':n===10?'shipping':'order',0)],barriers:[1,2,5].includes(n)?[evidence('fit_unclear',0)]:[6,7].includes(n)?[evidence('shipping_delayed',0)]:[],coaching:n===8?[evidence('incomplete',2)]:[]};
   analyses.push({conversation_id:id,created_at:stamp(18),fingerprint:'a'.repeat(63)+String(n%10),state:'complete',result});
  }else if(n===11||n===12){result.obstacle='العميل سأل عن السعر والتوصيل، والسياق لا يكفي لتحديد السبب.';analyses.push({conversation_id:id,created_at:stamp(18),fingerprint:'b'.repeat(64),state:'complete',result});}
 }
 for(const n of [1,2,5,6,7,8])orders.push({id:'order-'+n,external_order_id:'order-'+n,order_reference:String(n===7?7007:7000+n),customer_id:'customer-'+n,status:n===8?'ملغي':'قيد التجهيز',status_slug:n===8?'cancelled':'processing',ordered_at:stamp(n===7?13:15),source_payload:n===1?{source_details:{utm_source:'instagram',utm_medium:'customer_service',utm_campaign:'assisted_sales',utm_content:'ghofran',utm_term:'cs_ghofran_demo1'}}:{}});
 orders.push({...orders[0]}); // The same order must never inflate totals.
 copied.push({occurred_at:stamp(14,20),payload:{data:{tracking_code:'demo1'}}});
 return {messages,customers,analyses,orders,copied};
}
function report(query={}){const period=periodFor(query,new Date('2026-11-14T20:00:00Z'));return {ok:true,...aggregate({period,...dataset()},new Date('2026-11-14T20:00:00Z'))};}
module.exports={dataset,report,journey,stamp,phone};
