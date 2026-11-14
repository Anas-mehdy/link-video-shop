// Synthetic data only. No customer identifiers or provider credentials.
const stamp=(h,m=0)=>`2026-11-14T${String(h-3).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`;
const names=['نورة أحمد','محمد خالد','سارة عبدالله','خالد علي','ريم فهد','عبدالله حسن','هند سعد','عمر ناصر','لمى صالح','فهد إبراهيم','أمل راشد','يوسف حمد','مها سعود','علي ماجد','دانة ياسر','حسن طارق','ليان وليد','سعود منصور'];
const conversations=names.map((name,i)=>({id:String(i+1),name,pending_since:i<12?stamp(14,5+i*3):null,last_at:stamp(17,i),last_human_at:i===0?null:stamp(15,10+i),waiting_work_minutes:i<12?175-i*3:null,unverified_after:i>=8&&i<12}));
const overview={ok:true,today:{contacts:24,incoming:86,employee:63,automation:12,unverified:4,median_minutes:8},month:{contacts:312,incoming:1248,employee:1064,automation:218,unverified:37,median_minutes:11},recorded_from:'2026-11-01T11:00:00Z',today_start:stamp(3),period:{start:'2026-11-01T00:00:00+03:00',end:'2026-11-14T23:59:59+03:00'},collector_enabled:true,agent_configured:true,conversations,conversation_total:18};
const analysis={summary:'استفسرت العميلة عن توافق الحماية مع جهازها وموعد التوصيل، ثم عادت للسؤال عن التوافق قبل إتمام الطلب.',intent:'التأكد من ملاءمة الحماية لجهاز iPhone 18 Pro.',obstacle:'تكرر سؤال التوافق في الرسالتين #1 و#5؛ سبب التردد غير مؤكد من النص وحده.',strength:'قدّم الموظف توضيحًا مباشرًا عن التوصيل وسياسة الاستبدال.',improvement:'تأكيد موديل الجهاز بوضوح في أول رد قد يختصر تكرار السؤال. تُراجع الملاحظة مع الموظف.',evidence:[1,5,6]};
function journey(id){return {ok:true,conversation:id,contact:names[Number(id)-1]||'عميل تجريبي',customer:names[Number(id)-1],match:id==='3'?'ambiguous':'matched',store_unavailable:id==='4',limited:false,messages:[
 {message_id:'101',actor:'customer',body:'السلام عليكم، الحماية تركب على iPhone 18 Pro؟',occurred_at:stamp(14,5)},
 {message_id:'102',actor:'automation',body:'أهلًا بك في لنك. يسعدنا خدمتك، سيرد عليك الموظف خلال الدوام.',occurred_at:stamp(14,5)},
 {message_id:'103',actor:'employee',body:'وعليكم السلام، أهلًا فيك! التوصيل للرياض خلال يومين عمل، وتقدر تستبدل المنتج وفق سياسة المتجر.',occurred_at:stamp(14,13)},
 {message_id:'104',actor:'customer',body:'ممتاز، بس أبي أتأكد قبل أطلب.',occurred_at:stamp(14,15)},
 {message_id:'105',actor:'customer',body:'جهازي Pro مو Pro Max، هل هذا المقاس صحيح؟',occurred_at:stamp(14,18)},
 {message_id:'106',actor:'employee',body:'نعم، اختاري مقاس iPhone 18 Pro من الخيارات. هذا المقاس متوافق مع جهازك.',occurred_at:stamp(14,21)},
 {message_id:'107',actor:'customer',body:'شكرًا، طلبت الآن. متى يوصلني رقم التتبع؟',occurred_at:stamp(15,2)},
 {message_id:'108',actor:'unverified',body:'يوصلك رقم التتبع بعد تسليم الطلب لشركة الشحن.',occurred_at:stamp(15,4)},
 {message_id:'109',actor:'customer',body:null,occurred_at:stamp(17,2)}
 ],orders:id==='3'||id==='4'?[]:[{external_order_id:'demo-7821',order_reference:'7821',status:'قيد التجهيز',total_amount:149,currency:'SAR',ordered_at:stamp(15)}],carts:id==='3'||id==='4'?[]:[{external_cart_id:'C-204',status:'مستردة',total_amount:149,currency:'SAR',abandoned_at:stamp(14,30),recovered_at:stamp(15)}],order_signals:id==='3'||id==='4'?[]:[{reference:'7821',at:stamp(15),status:'قيد التجهيز',minutes:42,kind:'after'}],analysis:{enabled:true,eligible:true,fingerprint:'a'.repeat(64),state:null}};}
const sales={ok:true,days:30,employee:{name:'غفران'},metrics:{matched_orders:8,orders:12,sales:1740},platforms:[{label:'واتساب',generated:24,copies:20,orders:12,sales:1740}],recent_orders:[]};
module.exports={overview,journey,analysis,sales};
