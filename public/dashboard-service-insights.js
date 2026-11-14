(() => {
'use strict';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null?'—':Number(v).toLocaleString('ar-SA-u-nu-latn');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const outcomes={tracked:['طلب مرتبط برمز تتبّع','رمز مطابق في رسالة موظف وسجل نسخ وطلب سلة'],phone_after:['طلب بعد المحادثة بتطابق الهاتف','خلال 72 ساعة من رسالة عميل؛ ارتباط زمني فقط'],prior_support:['دعم لطلب سابق','مرجع الطلب مذكور في رسالة العميل بعد إنشاء الطلب'],uncertain:['ما قدرنا نربطها بطلب','غياب الدليل لا يعني عدم الشراء']};
const areas={store:'مشكلة بالمتجر',operations:'تشغيل أو شحن',training:'تدريب الموظف'};
function shell(){const day=today();return '<details id="service-insights" class="service-insights"><summary><span>إحصائيات وتحسينات المتجر</span><small>من المحادثات إلى قرار عملي</small></summary><div class="service-insights-body"><div id="service-insights-intro" aria-live="polite"></div><form class="service-insights-period"><div><label for="service-insights-from">من</label><input id="service-insights-from" type="date" name="from" required max="'+day+'" value="'+day.slice(0,8)+'01"></div><div><label for="service-insights-to">إلى</label><input id="service-insights-to" type="date" name="to" required max="'+day+'" value="'+day+'"></div><button type="submit" class="secondary">عرض الفترة</button></form><div id="service-insights-result"></div></div></details>';}
function bind({root,api,onCases,onReset,signal}){
 const section=root.querySelector('#service-insights');if(!section)return;
 const intro=section.querySelector('#service-insights-intro'),result=section.querySelector('#service-insights-result'),form=section.querySelector('form');
 let loaded=false,revision=0,data=null,groups=new Map();
 const on=(el,type,fn)=>el.addEventListener(type,fn,{signal});
 function button(key,label,count,primary=false){return '<button type="button" class="'+(primary?'primary service-insights-next':'service-insight-link')+'" data-insight-group="'+esc(key)+'" '+(!count?'disabled':'')+'>'+esc(label)+(primary?'':' <span>'+fmt(count)+'</span>')+'</button>';}
 function draw(d){
  data=d;groups=new Map();
  for(const kind of ['topics','barriers','coaching','improvements','outcomes'])for(const item of d[kind]||[])groups.set(kind+':'+item.code,{...item,label:kind==='outcomes'?outcomes[item.code]?.[0]:item.action||item.label,kind:kind==='improvements'?item.key?.split(':')[0]:kind});
  const c=d.coverage||{},all=d.conversations||[],improvements=d.improvements||[],manual=all.filter(x=>!x.saved_analysis);
  groups.set('coverage:analyzed',{conversation_ids:all.filter(x=>x.saved_analysis).map(x=>x.id),label:'المحادثات المحلّلة'});
  groups.set('coverage:legacy',{conversation_ids:c.legacy_ids||[],label:'تحليلات قديمة غير مصنّفة'});
  groups.set('coverage:classified',{conversation_ids:all.filter(x=>x.evidence?.length).map(x=>x.id),label:'محادثات ذات تصنيفات مرجعية'});
  groups.set('coverage:manual',{kind:'manual',conversation_ids:manual.map(x=>x.id),label:'محادثات غير محلّلة · للتحليل اليدوي'});
  let happened,now,action;
  if(d.analyses_unavailable){
   happened='تعذّر تحميل التحليلات لهذه الفترة.';now='أعد عرض الفترة لمعرفة ما يحتاج مراجعتك.';action='<button type="button" class="secondary" data-insights-retry>إعادة المحاولة</button>';
  }else if(!c.total){
   happened='لا توجد محادثات مسجّلة خلال هذه الفترة.';now='اختر فترة أخرى لعرض المحادثات.';action='<button type="button" class="secondary" data-insights-change-period>تغيير الفترة</button>';
  }else{
   happened=(d.limited?'في السجلات المتاحة: ':'')+fmt(c.analyzed)+(c.analyzed===1?' محادثة محلّلة':' محادثات محلّلة')+' من أصل '+fmt(c.total)+(improvements.length?'، وظهرت تحسينات تحتاج مراجعتك.':(d.topics||[]).length||c.classified?'، ولا توجد توصيات للتحسين بعد.':'، ولم تظهر أنماط قابلة للمراجعة بعد.');
   if(improvements.length){now='ابدأ بـ «'+improvements[0].action+'»، وراجع أمثلتها.';action=button('improvements:'+improvements[0].code,'راجع الحالات الداعمة',improvements[0].count,true);}
   else if(manual.length){now='افتح محادثة غير محلّلة وراجع رحلتها يدويًا.';action=button('coverage:manual','اختيار محادثة للتحليل اليدوي',manual.length,true);}
   else{now='راجع المحادثات المحلّلة، وتابع المحادثات الجديدة عند وصولها.';action=button('coverage:analyzed','فتح المحادثات المحلّلة',c.analyzed,true);}
  }
  intro.innerHTML='<div class="service-coverage service-insights-overview"><p><span class="service-overview-label">خلال الفترة</span><strong>'+esc(happened)+'</strong></p><p><span class="service-overview-label">الآن</span><span>'+esc(now)+'</span></p>'+action+'</div>';
  const ranked=improvements.map((item,i)=>'<li><span class="service-priority">'+fmt(i+1)+'</span><div class="service-improvement-copy"><b>'+esc(item.action)+'</b><small>'+esc(areas[item.area])+' · '+esc(item.label)+'</small></div><div class="service-improvement-count"><strong>'+fmt(item.count)+'</strong><small>محادثات مختلفة</small></div><div class="service-improvement-proof"><b>'+fmt(item.evidence_count)+' رسائل داعمة</b></div>'+button('improvements:'+item.code,'فتح الحالات',item.count)+'</li>').join('');
  const distribution=kind=>(d[kind]||[]).length?'<ul class="service-distribution">'+d[kind].map(item=>'<li>'+button(kind+':'+item.code,item.label,item.count)+'</li>').join('')+'</ul>':'<p class="service-caption">لم تظهر نتائج لهذا النوع بعد.</p>';
  result.innerHTML=(ranked?'<div class="service-insight-heading"><h3>تحسينات مقترحة</h3><span class="service-ai-tag">ملاحظات للمراجعة</span></div><ol class="service-improvements">'+ranked+'</ol>':'')+
   '<section class="service-order-results" aria-labelledby="service-order-results-title"><h3 id="service-order-results-title">ربط المحادثات بالطلبات</h3>'+
   '<div class="service-outcome-head" aria-hidden="true"><span>نتيجة الرحلة</span><span>المحادثات</span><span>الطلبات</span></div><ul class="service-outcomes service-outcome-summary">'+(d.outcomes||[]).map(item=>{
    const orderCount=item.code==='uncertain'?'غير معروف':fmt(item.order_count);
    return '<li><button type="button" class="service-outcome-row" data-insight-group="outcomes:'+esc(item.code)+'" aria-label="'+esc(outcomes[item.code][0]+' · '+fmt(item.count)+' محادثات · الطلبات: '+orderCount+' · فتح الحالات')+'" '+(!item.count?'disabled':'')+'><span class="service-outcome-name">'+esc(outcomes[item.code][0])+'</span><span class="service-outcome-conversations" aria-label="عدد المحادثات">'+fmt(item.count)+'</span><span class="service-outcome-orders" aria-label="عدد الطلبات">'+orderCount+'</span></button></li>';
   }).join('')+'</ul></section>'+
   ((d.topics||[]).length||(d.barriers||[]).length?'<details class="service-insight-details service-insights-topics"><summary>أسئلة العملاء والعوائق</summary><h4>موضوع السؤال</h4>'+distribution('topics')+'<h4>العائق الذي ظهر بالفعل</h4>'+distribution('barriers')+'</details>':'')+
   '<details id="service-insights-method" class="service-insight-details service-insights-method"><summary>كيف انحسبت النتائج؟</summary>'+
   (d.limited?'<p class="service-warning">القراءة جزئية: حد 5,000 رسالة و200 محادثة، أو حد قراءة التحليلات. الأعداد تخص العينة المقروءة؛ نسبة تغطية الفترة الكاملة غير معروفة.</p>':'')+
   '<h4>تغطية التحليل</h4><p>'+(d.analyses_unavailable?'تعذّر تحميل التحليلات المحفوظة.':fmt(c.analyzed)+' من '+fmt(c.total)+' محادثة · '+(c.percent==null?'النسبة غير معروفة':'<bdi dir="ltr">'+fmt(c.percent)+'%</bdi>'))+'</p><p>'+button('coverage:analyzed','المحادثات المحلّلة',c.analyzed)+' · '+button('coverage:legacy','تحليلات قديمة غير مصنّفة',c.legacy)+' · '+button('coverage:classified','ذات تصنيف مرجعي في الفترة',c.classified)+'</p>'+
   '<p>نحسب كل محادثة مرة واحدة وفق آخر تحليل مكتمل محفوظ حتى الآن. النسبة لا تقيس الجودة أو الرضا، ولا تؤكد تحليل كل الرسائل الحديثة. التصنيفات تتطلب رسالة مرجعية من الفترة.</p><p>التحليلات القديمة غير المصنّفة لا تُوزّع بالتخمين ولا تُعاد تلقائيًا. زر التحليل اليدوي يفتح المحادثات غير المحلّلة؛ أداة «حلّل الرحلة» تظهر في التفاصيل عند توفر نص كافٍ وتفعيل التحليل.</p>'+
   '<h4>التحسينات والتصنيفات</h4><p>نرتب التحسينات حسب عدد المحادثات المختلفة، ثم الرسائل المتاحة للفتح والمراجع المحفوظة عند التعادل. هي ملاحظات ذكاء اصطناعي للمراجعة، وليست وقائع سلة. السؤال عن الشحن موضوع؛ ذكر تأخر شحنة عائق. قد تحمل المحادثة أكثر من تصنيف، لذلك لا تُجمع أعداد التصنيفات كمجموع محادثات جديد.</p>'+
   '<h4>المحادثات والطلبات</h4><ul>'+Object.values(outcomes).map(([label,explanation])=>'<li><b>'+label+':</b> '+explanation+'</li>').join('')+'</ul><p>عدد المحادثات مستقل عن عدد الطلبات الفريدة. «غير معروف» لا تعني عدم الشراء. يعرض الملخص أقوى نتيجة لكل محادثة والطلبات الداعمة لها فقط. لا يُحسب الطلب مرتين؛ عند اشتراكه بين حالات تُقدّم مطابقة التتبّع المثبتة، ثم أحدث رسالة مؤهلة. هذا تخصيص للعد فقط ولا يثبت سبب الشراء. الطلب الملغى أو المرتجع لا يُحتسب كنتيجة شراء.</p>'+
   (d.store_unavailable?'<p class="service-warning">تعذّر تحميل بيانات سلة المحلية؛ لا يمكن تأكيد الربط بالطلبات.</p>':d.store_limited?'<p class="service-warning">قراءة سلة جزئية؛ لا يمكن تأكيد نتائج الربط.</p>':'')+
   '<p>الفترة بتوقيت السعودية. نقرأ السجلات المحلية والتحليلات المحفوظة عند الطلب فقط. قد يكون السياق أقدم من السجل المعروض.</p></details>';
 }
 async function load(){
  const run=++revision;loaded=true;onReset?.();section.setAttribute('aria-busy','true');form.querySelector('button').disabled=true;
  intro.innerHTML='<p class="service-insights-loading" role="status"><span class="service-spinner" aria-hidden="true"></span> جارٍ عرض نتائج الفترة…</p>';result.innerHTML='';
  try{const d=await api('service-monitor&view=insights&'+new URLSearchParams(new FormData(form)));if(!signal.aborted&&run===revision)draw(d);}
  catch(error){if(!signal.aborted&&run===revision){intro.innerHTML='<div class="service-coverage"><p role="alert">تعذّر عرض نتائج الفترة. تحقق من التواريخ وحاول مجددًا.</p><button type="button" class="secondary" data-insights-retry>إعادة المحاولة</button></div>';result.innerHTML='<details id="service-insights-method" class="service-insight-details"><summary>كيف انحسبت النتائج؟</summary><p>'+esc(error.message)+'</p></details>';}}
  finally{if(!signal.aborted&&run===revision){section.setAttribute('aria-busy','false');form.querySelector('button').disabled=false;}}
 }
 on(section,'toggle',()=>{if(section.open&&!loaded)load();});
 on(form,'submit',e=>{e.preventDefault();load();});
 on(section,'click',e=>{
  if(e.target.closest('[data-insights-retry]')){load();return;}
  if(e.target.closest('[data-insights-change-period]')){form.elements.from.focus();return;}
  const trigger=e.target.closest('[data-insight-group]');if(!trigger||trigger.disabled||!data)return;
  const group=groups.get(trigger.dataset.insightGroup);if(!group)return;
  const ids=new Set(group.conversation_ids);onCases({label:group.label,kind:group.kind,code:group.code,period:data.period,cases:data.conversations.filter(c=>ids.has(c.id))});
 });
}
window.LinkServiceInsights={shell,bind,outcomes};
})();
