(() => {
'use strict';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null?'—':Number(v).toLocaleString('ar-SA-u-nu-latn');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const outcomes={tracked:['طلب مرتبط برمز تتبّع','رمز مطابق في رسالة موظف وسجل نسخ وطلب سلة'],phone_after:['طلب بعد المحادثة بتطابق الهاتف','خلال 72 ساعة من رسالة عميل؛ ارتباط زمني فقط'],prior_support:['دعم لطلب سابق','مرجع الطلب مذكور في رسالة العميل بعد إنشاء الطلب'],uncertain:['نتيجة غير مؤكدة','غياب الدليل لا يعني عدم الشراء']};
const areas={store:'مشكلة بالمتجر',operations:'تشغيل أو شحن',training:'تدريب الموظف'};
function shell(){const day=today();return '<details id="service-insights" class="service-insights"><summary><span>إحصائيات وتحسينات المتجر</span><small>من المحادثات إلى قرار عملي</small></summary><div class="service-insights-body"><form class="service-insights-period"><div><label for="service-insights-from">من</label><input id="service-insights-from" type="date" name="from" required max="'+day+'" value="'+day.slice(0,8)+'01"></div><div><label for="service-insights-to">إلى</label><input id="service-insights-to" type="date" name="to" required max="'+day+'" value="'+day+'"></div><button type="submit" class="secondary">عرض الفترة</button></form><p class="service-caption">الفترة بتوقيت السعودية · قراءة للسجلات المحلية والتحليلات المحفوظة فقط.</p><div id="service-insights-result" aria-live="polite"></div></div></details>';}
function bind({root,api,onCases,onReset,signal}){
 const section=root.querySelector('#service-insights');if(!section)return;
 const result=section.querySelector('#service-insights-result'),form=section.querySelector('form');
 let loaded=false,revision=0,data=null,groups=new Map();
 const on=(el,type,fn)=>el.addEventListener(type,fn,{signal});
 function button(key,label,count){return '<button type="button" class="service-insight-link" data-insight-group="'+esc(key)+'" '+(!count?'disabled':'')+'>'+esc(label)+' <span>'+fmt(count)+'</span></button>';}
 function draw(d){
  data=d;groups=new Map();
  for(const kind of ['topics','barriers','coaching','improvements','outcomes'])for(const item of d[kind]||[])groups.set(kind+':'+item.code,{...item,label:kind==='outcomes'?outcomes[item.code]?.[0]:item.action||item.label,kind:kind==='improvements'?item.key?.split(':')[0]:kind});
  const c=d.coverage||{},all=d.conversations||[];
  groups.set('coverage:analyzed',{conversation_ids:all.filter(x=>x.saved_analysis).map(x=>x.id),label:'المحادثات ذات التحليل المحفوظ'});
  groups.set('coverage:legacy',{conversation_ids:c.legacy_ids||[],label:'تحليلات قديمة بلا تصنيفات موثوقة'});
  groups.set('coverage:classified',{conversation_ids:all.filter(x=>x.evidence?.length).map(x=>x.id),label:'محادثات ذات تصنيفات مرجعية'});
  const ranked=(d.improvements||[]).map((item,i)=>'<li><span class="service-priority">'+fmt(i+1)+'</span><div class="service-improvement-copy"><b>'+esc(item.action)+'</b><small>'+esc(areas[item.area])+' · '+esc(item.label)+'</small></div><div class="service-improvement-count"><strong>'+fmt(item.count)+'</strong><small>محادثات مختلفة</small></div><div class="service-improvement-proof"><b>'+fmt(item.evidence_count)+' رسائل</b><small>'+fmt(item.current_evidence_count)+' متاحة للفتح</small></div>'+button('improvements:'+item.code,'فتح الحالات',item.count)+'</li>').join('');
  const distribution=kind=>(d[kind]||[]).length?'<ul class="service-distribution">'+d[kind].map(item=>'<li>'+button(kind+':'+item.code,item.label,item.count)+'<small>'+fmt(item.evidence_count)+' رسائل مرجعية · للمراجعة</small></li>').join('')+'</ul>':'<p class="service-caption">لا توجد تصنيفات مرجعية لهذا النوع ضمن الفترة. لا نصنّف النصوص القديمة بالتخمين.</p>';
  result.innerHTML=(d.limited?'<p class="service-warning" role="status">القراءة جزئية: حد 5,000 رسالة و200 محادثة، أو حد قراءة التحليلات. الأعداد تخص العينة المقروءة؛ نسبة تغطية الفترة الكاملة غير معروفة.</p>':'')+
   '<div class="service-coverage"><h3>تغطية التحليل</h3><p>'+fmt(c.total)+' محادثة وصلت منها رسائل عملاء في الفترة · '+(d.analyses_unavailable?'تعذّر تحميل التحليلات المحفوظة':button('coverage:analyzed','لديها تحليل محفوظ',c.analyzed)+' <b>'+(c.percent==null?'النسبة غير معروفة':'<bdi dir="ltr">'+fmt(c.percent)+'%</bdi>')+'</b>')+'</p><p>'+button('coverage:classified','ذات تصنيف مرجعي في الفترة',c.classified)+' · '+button('coverage:legacy','تحليلات قديمة غير مصنّفة',c.legacy)+'</p><p class="service-caption">التغطية تحسب كل محادثة مرة واحدة وفق آخر تحليل مكتمل محفوظ حتى الآن، وليست نسبة جودة أو رضا أو تأكيدًا لتحليل كل الرسائل الحديثة. التصنيفات تتطلب رسالة مرجعية من الفترة؛ لا تعاد التحليلات القديمة تلقائيًا.</p></div>'+
   '<div class="service-insight-heading"><h3>أولويات التحسين للمراجعة</h3><span class="service-ai-tag">ملاحظات الذكاء الاصطناعي · ليست وقائع</span></div><p class="service-caption">الأكثر تكرارًا أولًا، ثم الرسائل المتاحة للفتح والمراجع المحفوظة عند تساوي المحادثات. التكرار وقوة الدليل لا يثبتان السبب؛ افتح الأمثلة قبل اتخاذ القرار.</p>'+
   (ranked?'<ol class="service-improvements">'+ranked+'</ol>':'<div class="service-insight-empty"><b>'+(d.analyses_unavailable?'تعذّرت قراءة ملاحظات التحليل':'لا توجد تحسينات مصنّفة بدليل كافٍ بعد')+'</b><p>قد توجد تحليلات نصية قديمة؛ افتحها للمراجعة. لا نحول موضوع سؤال وحده إلى مشكلة بالمتجر.</p></div>')+
   '<details class="service-insight-details"><summary>موضوع السؤال والعائق الفعلي</summary><p class="service-caption">السؤال عن الشحن موضوع؛ ذكر تأخر شحنة عائق. قد تحمل المحادثة أكثر من تصنيف، لذلك لا تُجمع الأعداد كمجموع محادثات جديد.</p><h4>موضوع السؤال</h4>'+distribution('topics')+'<h4>العائق الذي ظهر بالفعل</h4>'+distribution('barriers')+'</details>'+
   '<details class="service-insight-details"><summary>نتائج الرحلات من سلة · منفصلة عن التحليل</summary>'+
   (d.store_unavailable?'<p class="service-warning">تعذّر تحميل بيانات سلة المحلية؛ النتائج غير مؤكدة.</p>':d.store_limited?'<p class="service-warning">قراءة سلة جزئية؛ لا يمكن تأكيد نتائج الربط.</p>':'')+
   '<ul class="service-outcomes">'+(d.outcomes||[]).map(item=>'<li><div>'+button('outcomes:'+item.code,outcomes[item.code][0],item.count)+'<small>'+outcomes[item.code][1]+'</small></div><span>'+(item.code==='uncertain'?'الطلبات غير مؤكدة':fmt(item.order_count)+' طلب فريد')+'</span></li>').join('')+'</ul><p class="service-caption">يعرض الملخص أقوى نتيجة لكل محادثة والطلبات الداعمة لها فقط. الطلب لا يُحسب مرتين. عند اشتراكه بين حالات تُقدَّم مطابقة التتبّع المثبتة، ثم أحدث رسالة مؤهلة؛ هذا تخصيص للعد فقط. الطلب الملغى أو المرتجع لا يُحتسب كنتيجة شراء. الدعم السابق يحتاج مرجعًا صريحًا؛ ترتيب الأحداث وحده لا يثبت السببية.</p></details>'+
   (d.analyses_unavailable?'':'<p class="service-caption">التحليلات القديمة: '+fmt(c.legacy)+' · تحليلات بلا تصنيف مرجعي لهذه الفترة: '+fmt(c.unclassified_ids?.length||0)+' · قد يكون السياق أقدم من السجل المعروض.</p>');
 }
 async function load(){
  const run=++revision;loaded=true;onReset?.();result.setAttribute('aria-busy','true');form.querySelector('button').disabled=true;
  result.innerHTML='<p class="service-insights-loading" role="status"><span class="service-spinner" aria-hidden="true"></span> جارٍ تجميع التحليلات ووقائع سلة المحفوظة…</p>';
  try{const d=await api('service-monitor&view=insights&'+new URLSearchParams(new FormData(form)));if(!signal.aborted&&run===revision)draw(d);}
  catch(error){if(!signal.aborted&&run===revision)result.innerHTML='<p role="alert" class="service-warning">تعذّر تحميل إحصائيات الفترة. '+esc(error.message)+'</p><button type="button" class="secondary" data-insights-retry>إعادة المحاولة</button>';}
  finally{if(!signal.aborted&&run===revision){result.setAttribute('aria-busy','false');form.querySelector('button').disabled=false;}}
 }
 on(section,'toggle',()=>{if(section.open&&!loaded)load();});
 on(form,'submit',e=>{e.preventDefault();load();});
 on(section,'click',e=>{
  if(e.target.closest('[data-insights-retry]')){load();return;}
  const trigger=e.target.closest('[data-insight-group]');if(!trigger||trigger.disabled||!data)return;
  const group=groups.get(trigger.dataset.insightGroup);if(!group)return;
  const ids=new Set(group.conversation_ids);onCases({label:group.label,kind:group.kind,code:group.code,period:data.period,cases:data.conversations.filter(c=>ids.has(c.id))});
 });
}
window.LinkServiceInsights={shell,bind,outcomes};
})();
