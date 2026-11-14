(() => {
'use strict';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v==null?'—':Number(v).toLocaleString('ar-SA-u-nu-latn');
const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('ar-SA-u-ca-gregory-nu-latn',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Riyadh'}):'وقت غير متاح';
const time=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleTimeString('ar-SA-u-nu-latn',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Riyadh'}):'—';
const table=(headers,rows)=>'<div class="table-wrap" tabindex="0" role="region" aria-label="تفاصيل المؤشرات"><table><thead><tr>'+headers.map(v=>'<th scope="col">'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
const state=c=>c.pending_since?(c.unverified_after?'review':'waiting'):'other';
const status=c=>({waiting:'بانتظار رد مؤكد',review:'رد غير منسوب',other:c.last_human_at?'ظهر رد بشري':'لا يوجد انتظار مسجّل'})[state(c)];
const actors={customer:'العميل',employee:'الموظف',automation:'الأتمتة',unverified:'صادر غير منسوب'};
const analysisFields=[['ملخص الرحلة','summary'],['نية العميل','intent'],['العائق الذي ظهر','obstacle'],['نقطة قوة للموظف','strength'],['نقطة للمراجعة مع الموظف','improvement']];
let cleanup=()=>{};
function caseButton(c){return '<button type="button" class="service-case" data-service-conversation="'+esc(c.id)+'" data-service-state="'+state(c)+'" data-service-last-human="'+esc(c.last_human_at||'')+'" aria-pressed="false" aria-controls="service-journey"><span class="service-case-top"><b>'+esc(c.name||'عميل #'+c.id)+'</b><span class="service-case-time">'+time(c.last_at)+'</span></span><span class="service-case-status '+state(c)+'">'+status(c)+'</span><span class="service-case-bottom">'+(c.pending_since?number(c.waiting_work_minutes)+' دقيقة دوام · منذ '+date(c.pending_since):'آخر نشاط '+date(c.last_at))+'<span aria-hidden="true">←</span></span></button>';}
function render(result){
 if(!result)return '<section class="panel"><h2>بيانات واتساب غير متاحة</h2><p class="muted" role="status">تعذّر تحميل السجل. استخدم تحديث البيانات لإعادة المحاولة.</p></section>';
 if(result.monitor_disabled)return '<section class="panel"><h2>بانتظار تسجيل المحادثات</h2><p class="muted">تسجيل المحادثات غير مفعّل بعد. ستظهر الأرقام ورحلة العميل بعد تفعيل الربط واستقبال الرسائل الجديدة.</p></section>';
 const {today={},month={},recorded_from:since,agent_configured:agent}=result;
 const metric=k=>since&&(agent||!['employee','median_minutes'].includes(k));
 const fields=[['رسائل العملاء','incoming'],['الرسائل الآلية المعروفة','automation'],['الصادر غير المنسوب','unverified']];
 const cases=result.conversations||[],counts={all:cases.length,waiting:cases.filter(c=>state(c)==='waiting').length,review:cases.filter(c=>state(c)==='review').length};
 return '<div id="service-monitor" class="service-monitor">'+
 '<section class="service-summary" aria-labelledby="service-summary-title"><div class="service-section-heading"><div><span class="service-kicker">01 / أفهم الوضع</span><h2 id="service-summary-title">اليوم في سياق الشهر</h2></div><span class="service-caption">واتساب · توقيت السعودية</span></div>'+
 '<dl class="service-metrics">'+[['محادثات العملاء','contacts','محادثة'],['ردود الموظف المؤكدة','employee','رد'],['وسيط انتظار الرد','median_minutes','دقيقة دوام']].map(([label,k,unit])=>'<div><dt>'+label+'</dt><dd><strong>'+number(metric(k)?today[k]:null)+'</strong> <span>'+unit+' اليوم</span></dd><dd class="service-month">'+number(metric(k)?month[k]:null)+' هذا الشهر</dd></div>').join('')+'</dl>'+
 '<p class="service-shift">الانتظار ضمن الدوام فقط · <bdi>14:00 – 23:00</bdi> يوميًا بتوقيت السعودية</p>'+
 (!agent?'<p class="service-warning" role="status">هوية الموظف لم تُعتمد؛ ردوده ومدة انتظار الرد غير معروفة.</p>':'')+
 (!result.collector_enabled?'<p class="service-warning">التسجيل متوقف حاليًا؛ قد لا يشمل السجل أحدث الرسائل.</p>':'')+
 (!since?'<p class="service-warning">لم يصل أي سجل بعد؛ لا يمكن تقييم الفترات السابقة.</p>':'')+
 (result.limited?'<p class="service-warning">بيانات جزئية: آخر 2,000 رسالة فقط من الشهر. المؤشرات والقائمة لا تمثلان السجل الكامل.</p>':'')+
 '<details class="service-disclosure"><summary>تفاصيل المؤشرات وحدود البيانات</summary>'+table(['المؤشر','اليوم','هذا الشهر'],fields.map(([label,k])=>'<tr><th scope="row">'+label+'</th><td>'+number(metric(k)?today[k]:null)+'</td><td>'+number(metric(k)?month[k]:null)+'</td></tr>').join(''))+
 '<p class="muted">'+(since?'أول رسالة مسجلة: '+date(since)+' · ':'')+'اليوم والشهر فترتان مختلفتان؛ أرقام الشهر تراكمية وليست متوسطًا يوميًا. الرد الآلي أو غير المنسوب لا يُحتسب ردًا بشريًا. ظهور رد لا يؤكد حل الحالة.</p></details></section>'+
 (window.LinkServiceInsights?.shell()||'')+
 '<section class="service-review" aria-labelledby="service-review-title"><div class="service-section-heading"><div><span class="service-kicker">02 / أختار محادثة</span><h2 id="service-review-title">مساحة المراجعة <span class="service-count">'+number(cases.length)+'</span></h2></div><span class="service-caption">الأقدم انتظارًا أولًا</span></div>'+
 '<div class="service-workspace"><aside class="service-queue" aria-label="قائمة المحادثات"><div class="service-supporting" hidden></div><div class="service-filters" role="group" aria-label="تصفية المحادثات">'+[['all','الكل'],['waiting','بانتظار رد'],['review','غير منسوب']].map(([key,label])=>'<button type="button" data-service-filter="'+key+'" aria-pressed="'+(key==='all')+'">'+label+' <span>'+number(counts[key])+'</span></button>').join('')+'</div>'+
 '<p class="service-queue-note">الأولوية من السجلات المتاحة، وليست حالة صندوق واتساب الكامل.</p><div class="service-case-list" tabindex="-1">'+cases.map(caseButton).join('')+
 '<div id="service-empty-filter" class="service-empty" role="status" '+(cases.length?'hidden':'')+'><b>'+(cases.length?'لا توجد حالات مطابقة':'لا توجد محادثات مسجّلة')+'</b><p>'+(cases.length?'اختر فلترًا آخر لمتابعة المراجعة.':'ستظهر المحادثات هنا عند استقبال رسائل جديدة.')+'</p></div></div>'+
 '<p class="service-list-footer" id="service-list-count" role="status">'+number(cases.length)+' محادثة'+(result.conversation_total>80?' · أول 80 فقط حسب الأولوية':'')+'</p></aside>'+
 '<section id="service-journey" class="service-journey" aria-label="رحلة العميل"><div class="service-empty service-placeholder"><span class="service-empty-symbol" aria-hidden="true">←</span><span class="service-kicker">03 / أراجع رحلة العميل</span><h3>كل محادثة، في سياقها</h3><p>اختر محادثة لمراجعة الرسائل والطلبات والسلات المرتبطة، ثم حلّل الرحلة عند الحاجة.</p><small>تظل القائمة وفلاترك في مكانها.</small></div></section></div></section></div>';
}
function analysisView(a){
 return '<div class="service-ai-result"><dl>'+analysisFields.map(([label,k])=>'<div><dt>'+label+'</dt><dd>'+esc(a[k]||'غير واضح من النص المتاح')+'</dd></div>').join('')+'</dl><div class="service-evidence"><b>الرسائل التي استند إليها التحليل</b><p>'+(a.evidence?.length?a.evidence.map(n=>'<button type="button" class="secondary" data-journey-ref="'+esc(n)+'">الرسالة #'+esc(n)+' ↗</button>').join(' '):'لم يحدد التحليل رسائل مرجعية؛ راجع النص قبل اعتماد الملاحظات.')+'</p></div></div>';
}
function savedEvidence(c,context){
 if(!c?.saved_analysis)return '';
 const saved=c.saved_analysis,items=[...new Map((c.evidence||[]).filter(e=>!context?.kind||!['topics','barriers','coaching'].includes(context.kind)||e.kind===context.kind&&e.code===context.code).map(e=>[e.message_id,e])).values()];
 return '<aside class="service-saved-evidence"><h4>دليل من تحليل محفوظ · للمراجعة</h4><p>'+esc(context?.label||'تحليل محفوظ')+' · '+date(saved.at)+'</p>'+
  (saved.legacy?'<p>تحليل نصي قديم بلا تصنيفات أو مراجع رسائل ثابتة. لا ننسب أرقام رسائله القديمة إلى السجل الحالي.</p><blockquote>'+esc(saved.obstacle||saved.summary||'لا توجد ملاحظة عن العائق')+'</blockquote>'+(saved.improvement?'<p>نقطة للمراجعة مع الموظف</p><blockquote>'+esc(saved.improvement)+'</blockquote>':''):items.map(e=>'<blockquote>'+esc(e.excerpt)+'</blockquote><button type="button" class="secondary" data-service-evidence-id="'+esc(e.message_id)+'">فتح الرسالة المرجعية ←</button>').join(''))+
  '<p>هذا مقتطف محفوظ؛ قد لا يتضمن آخر تحديث للمحادثة. الرسالة الأقدم من آخر 100 رسالة قد لا تكون متاحة هنا.</p><p class="service-evidence-status" role="status"></p></aside>';
}
function outcomeView(outcome){
 if(!outcome)return '';
 const label=window.LinkServiceInsights?.outcomes[outcome.code]?.[0]||'نتيجة غير مؤكدة';
 return '<section class="service-outcome-note"><h4>نتيجة الرحلة من سلة: '+esc(label)+'</h4><p>'+esc(outcome.reason)+'</p>'+
  (outcome.orders?.length?'<ul>'+outcome.orders.map(o=>'<li>طلب #'+esc(o.reference)+' · '+date(o.ordered_at)+' · '+esc(o.status||'الحالة غير متاحة')+(o.message_id?' <button type="button" class="service-insight-link" data-service-evidence-id="'+esc(o.message_id)+'">الرسالة الداعمة ←</button>':'')+'</li>').join('')+'</ul>':'')+'<p class="service-evidence-status" role="status"></p></section>';
}
function journey(d,support,context){
 const messages=d.messages||[],orders=d.orders||[],carts=d.carts||[];
 const entries=[
 ...messages.map((m,i)=>({at:m.occurred_at,actor:m.actor,title:actors[m.actor]||'غير معروف',body:m.body||'رسالة غير نصية · محتواها غير متاح في السجل',ref:i+1,message_id:String(m.message_id)})),
 ...orders.map(o=>({at:o.ordered_at,title:'طلب #'+(o.order_reference||o.external_order_id),body:(o.status||'الحالة غير متاحة')+' · '+number(o.total_amount)+' '+(o.currency||'العملة غير متاحة'),store:true})),
 ...carts.flatMap(c=>[{at:c.abandoned_at,title:'سلة #'+(c.external_cart_id||'—'),body:(c.status||'الحالة غير متاحة')+' · '+number(c.total_amount)+' '+(c.currency||'العملة غير متاحة'),store:true},...(c.recovered_at?[{at:c.recovered_at,title:'استرداد سلة #'+(c.external_cart_id||'—'),body:'تحولت السلة إلى طلب',store:true}]:[])])
 ].sort((a,b)=>(Date.parse(a.at)||0)-(Date.parse(b.at)||0));
 const match=d.store_unavailable?'تعذّر تحميل بيانات سلة؛ لا يمكن تأكيد الطلبات أو السلات المرتبطة.':d.match==='matched'?'مطابقة عميل سلة بالهاتف: '+(d.customer||'الاسم غير متاح'):d.match==='ambiguous'?'أكثر من عميل يطابق الهاتف؛ تعذّر تأكيد الربط بسلة.':'لا يوجد عميل سلة مطابق برقم الهاتف؛ سجل المشتريات غير معروف.';
 const ai=d.analysis||{};
 return '<div class="service-journey-body">'+outcomeView(support?.outcome||d.outcome)+savedEvidence(support,context)+'<p class="service-match '+(d.store_unavailable||d.match!=='matched'?'service-warning':'')+'">'+esc(match)+'</p>'+
 '<details class="service-disclosure"><summary>وقائع سلة · '+(d.store_unavailable||d.match!=='matched'?'البيانات غير متاحة':number(orders.length)+' طلب · '+number(carts.length)+' سلة')+'</summary><p class="muted">آخر 12 طلبًا و12 سلة عند توفرها. توقيت الطلب وحالته من بيانات سلة؛ تطابق الهاتف لا يثبت سبب الشراء.</p>'+
 ((d.order_signals||[]).length?'<ul>'+d.order_signals.map(o=>'<li>طلب #'+esc(o.reference)+' · '+date(o.at)+' · '+esc(o.status||'الحالة غير متاحة')+' · '+(o.kind==='earlier'?'قبل أول رسالة عميل مسجلة':'بعد رسالة العميل بـ '+number(o.minutes)+' دقيقة')+'</li>').join('')+'</ul>':'<p class="muted">لا توجد إشارات طلب قابلة للربط بالمحادثة ضمن البيانات المتاحة.</p>')+'</details>'+
 '<details class="service-ai" '+(ai.analysis?'open':'')+'><summary>ملاحظات الذكاء الاصطناعي <span class="service-ai-tag">للمراجعة</span></summary><p class="service-caption">قراءة لمقتطف المحادثة تساعدك على مراجعة العوائق وأسلوب الرد. ليست وقائع سلة ولا تقييمًا نهائيًا للموظف.</p>'+
 (ai.analysis?analysisView(ai.analysis):ai.unavailable?'<p role="status">التحليل غير متاح مؤقتًا. أعد فتح الرحلة للتحقق من حالته.</p>':ai.state?'<p role="status">'+(ai.state==='reserved'?'تحليل هذه النسخة محجوز أو قيد التنفيذ. أعد فتح الرحلة للتحقق من النتيجة.':'سبق طلب تحليل هذه النسخة ولم تكتمل النتيجة. لا تُعاد المحاولة تلقائيًا.')+'</p>':ai.eligible?'<button id="service-analyze" class="primary" type="button">حلّل الرحلة <span aria-hidden="true">✦</span></button>':'<p>'+(!ai.enabled?'التحليل غير مفعّل حاليًا.':'لا يتوفر نص كافٍ للتحليل.')+'</p>')+
 '<div id="service-analysis-result" role="status" aria-live="polite"></div></details>'+
 '<div class="service-timeline-heading"><h3>المحادثة ورحلة الشراء</h3><span class="service-caption">من الأقدم إلى الأحدث</span></div><p class="service-caption">'+number(messages.length)+' رسالة'+(d.limited?' · آخر 100 رسالة فقط؛ السياق السابق غير متاح':'')+' · أوقات السعودية</p>'+
 '<ol class="service-timeline">'+entries.map(e=>'<li class="service-event '+(e.store?'service-store':'service-message service-'+esc(e.actor))+'"'+(e.ref?' id="service-message-'+e.ref+'" data-service-message-id="'+esc(e.message_id)+'" tabindex="-1"':'')+'><div class="service-event-meta"><b>'+esc(e.title)+'</b><span>'+(e.ref?'#'+e.ref+' · ':'')+date(e.at)+'</span>'+(e.store?'<span class="service-source">سلة · واقعة مسجلة</span>':'')+'</div><p>'+esc(e.body)+'</p></li>').join('')+'</ol>'+
 (!entries.length?'<div class="service-empty">لا توجد أحداث متاحة لهذه الرحلة.</div>':'')+'</div>';
}
function bind({api}){
 cleanup();
 const root=document.getElementById('service-monitor');if(!root)return;
 const target=root.querySelector('#service-journey'),list=root.querySelector('.service-case-list');
 let buttons=[...root.querySelectorAll('[data-service-conversation]')],drill=null;
 const supportCases=new Map();
 const controller=new AbortController(),signal=controller.signal,cache=new Map(),inflight=new Map();
 const mobile=window.matchMedia('(max-width:760px)'),inertBefore=new Map();
 let selected=null,revision=0,filter='all',alive=true,ownsHistory=false;
 const on=(el,type,fn)=>el.addEventListener(type,fn,{signal});
 function modal(){
  inertBefore.forEach((value,el)=>{el.inert=value;});inertBefore.clear();
  const active=!!selected&&mobile.matches;
  target.setAttribute('role',active?'dialog':'region');
  if(active){
   target.setAttribute('aria-modal','true');
   for(let node=target;node.parentElement&&node!==document.body;node=node.parentElement){
    [...node.parentElement.children].filter(el=>el!==node).forEach(el=>{inertBefore.set(el,el.inert);el.inert=true;});
   }
  }else target.removeAttribute('aria-modal');
 }
 const visible=()=>buttons.filter(b=>!b.hidden);
 function selection(){
  buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.serviceConversation===selected)));
  const items=visible(),index=items.findIndex(b=>b.dataset.serviceConversation===selected);
  if(index>=0){const row=items[index].getBoundingClientRect(),bounds=list.getBoundingClientRect();if(row.top<bounds.top)list.scrollTop+=row.top-bounds.top;else if(row.bottom>bounds.bottom)list.scrollTop+=row.bottom-bounds.bottom;}
  const prev=target.querySelector('[data-service-prev]'),next=target.querySelector('[data-service-next]');
  if(prev)prev.disabled=index<=0;if(next)next.disabled=index<0||index>=items.length-1;
  const position=target.querySelector('.service-position');if(position)position.textContent=index<0?'خارج الفلتر الحالي':number(index+1)+' من '+number(items.length);
 }
 const placeholder=target.innerHTML;
 function close(){
  revision++;selected=null;modal();root.classList.remove('has-journey');document.body.classList.remove('service-journey-open');target.innerHTML=placeholder;selection();
 }
 function back(){
  const origin=buttons.find(b=>b.dataset.serviceConversation===selected);
  if(ownsHistory){ownsHistory=false;history.back();}
  close();origin?.focus({preventScroll:true});
 }
 function shell(button){
  return '<header class="service-journey-header"><div class="service-journey-title"><button type="button" class="secondary service-back" data-service-back>→ <span>العودة للقائمة</span></button><div><span class="service-kicker">03 / أراجع الرحلة</span><h3 id="service-journey-title" tabindex="-1">'+esc(button.querySelector('b').textContent)+'</h3></div></div><div class="service-journey-nav"><span class="service-position"></span><button type="button" class="secondary" data-service-prev aria-label="المحادثة السابقة">→</button><button type="button" class="secondary" data-service-next aria-label="المحادثة التالية">←</button></div></header><details class="service-disclosure service-case-meta"><summary>تفاصيل الرد المسجّل</summary><p>آخر رد بشري مؤكّد: '+(button.dataset.serviceLastHuman?date(button.dataset.serviceLastHuman):'غير متاح في السجل')+' · ظهور رد لا يؤكد حل الحالة.</p></details><div class="service-journey-content"></div>';
 }
 async function open(button){
  if(!button)return;
  const id=button.dataset.serviceConversation,run=++revision;selected=id;
  if(!ownsHistory){history.pushState({...history.state,linkServiceJourney:true},'',location.href);ownsHistory=true;}
  root.classList.add('has-journey');document.body.classList.add('service-journey-open');
  target.innerHTML=shell(button);selection();modal();target.scrollTop=0;
  target.querySelector('#service-journey-title').focus({preventScroll:true});
  const content=target.querySelector('.service-journey-content');content.setAttribute('aria-busy','true');
  content.innerHTML='<div class="service-loading" role="status"><span class="service-spinner" aria-hidden="true"></span><b>جارٍ تحميل رحلة العميل…</b><p>الرسائل والطلبات والسلات في مكان واحد</p></div>';
  try{
   const d=inflight.has(id)&&cache.has(id)?cache.get(id):await api('service-monitor&conversation='+encodeURIComponent(id));
   if(!alive||run!==revision)return;cache.set(id,d);content.innerHTML=journey(d,supportCases.get(id),drill?.context);content.setAttribute('aria-busy','false');
   if(inflight.has(id))analysisLoading(content);
  }catch{
   if(!alive||run!==revision)return;content.setAttribute('aria-busy','false');content.innerHTML='<div class="service-empty" role="alert"><h3>تعذّر تحميل الرحلة</h3><p>قائمتك وفلترك محفوظان. جرّب فتح الرحلة مجددًا.</p><button type="button" class="secondary" data-service-retry>إعادة المحاولة</button></div>';
  }
 }
 function analysisLoading(content){
  const disclosure=content.querySelector('.service-ai');if(disclosure)disclosure.open=true;
  const button=content.querySelector('#service-analyze');if(button){button.disabled=true;button.textContent='جارٍ تحليل الرحلة…';}
  const box=content.querySelector('#service-analysis-result');box?.setAttribute('aria-busy','true');if(box)box.innerHTML='<p><span class="service-spinner" aria-hidden="true"></span> نراجع مقتطف المحادثة…</p>';
 }
 function updateFilters(){
  root.querySelectorAll('[data-service-filter]').forEach(b=>{const key=b.dataset.serviceFilter;b.setAttribute('aria-pressed',String(key===filter));b.querySelector('span').textContent=number(key==='all'?buttons.length:buttons.filter(item=>item.dataset.serviceState===key).length);});
 }
 function restoreList(){
  if(!drill)return;
  const original=drill;drill=null;supportCases.clear();list.replaceChildren(...original.nodes);buttons=original.buttons;filter=original.filter;list.scrollTop=original.scroll;
  root.querySelector('.service-supporting').hidden=true;root.querySelector('.service-review .service-count').textContent=original.headingCount;root.querySelector('#service-list-count').textContent=original.footer;updateFilters();selection();list.scrollTop=original.scroll;
  if(selected&&cache.has(selected)){const content=target.querySelector('.service-journey-content');if(content){content.innerHTML=journey(cache.get(selected));if(inflight.has(selected))analysisLoading(content);}}
 }
 function showCases(context){
  if(!context.cases.length)return;
  if(!drill)drill={nodes:[...list.childNodes],buttons,filter,scroll:list.scrollTop,footer:root.querySelector('#service-list-count').textContent,headingCount:root.querySelector('.service-review .service-count').textContent};
  drill.context=context;supportCases.clear();context.cases.forEach(c=>supportCases.set(c.id,c));
  list.innerHTML=context.cases.map(caseButton).join('')+'<div id="service-empty-filter" class="service-empty" role="status" hidden>لا توجد حالات مطابقة ضمن الحالات الداعمة.</div>';
  buttons=[...list.querySelectorAll('[data-service-conversation]')];filter='all';updateFilters();selection();list.scrollTop=0;
  const banner=root.querySelector('.service-supporting');banner.hidden=false;banner.innerHTML='<b>'+esc(context.label)+'</b><p>'+number(context.cases.length)+' حالات داعمة · <bdi>'+esc(context.period?.from)+'</bdi> إلى <bdi>'+esc(context.period?.to)+'</bdi></p><button type="button" class="secondary" data-service-restore>العودة إلى القائمة الأصلية →</button>';
  root.querySelector('#service-list-count').textContent=number(context.cases.length)+' محادثة داعمة';root.querySelector('.service-review .service-count').textContent=number(context.cases.length);
  if(selected&&cache.has(selected)){const content=target.querySelector('.service-journey-content');if(content){content.innerHTML=journey(cache.get(selected),supportCases.get(selected),context);if(inflight.has(selected))analysisLoading(content);}}
  root.querySelector('#service-insights').open=false;
  root.querySelector('.service-review').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});list.focus({preventScroll:true});
 }
 window.LinkServiceInsights?.bind({root,api,onCases:showCases,onReset:restoreList,signal});
 on(root,'click',async event=>{
  if(event.target.closest('[data-service-restore]')){restoreList();return;}
  const savedRef=event.target.closest('[data-service-evidence-id]');
  if(savedRef){
   const row=[...target.querySelectorAll('[data-service-message-id]')].find(el=>el.dataset.serviceMessageId===savedRef.dataset.serviceEvidenceId);
   if(row){target.querySelectorAll('.service-evidence-selected').forEach(el=>el.classList.remove('service-evidence-selected'));row.classList.add('service-evidence-selected');row.focus({preventScroll:true});row.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
   else savedRef.closest('.service-saved-evidence,.service-outcome-note').querySelector('.service-evidence-status').textContent='هذه الرسالة غير موجودة في آخر 100 رسالة المعروضة. المقتطف المحفوظ ظاهر أعلاه؛ لا ننتقل إلى رسالة أخرى بدلًا منها.';
   return;
  }

  const filterButton=event.target.closest('[data-service-filter]');
  if(filterButton){
   filter=filterButton.dataset.serviceFilter;
   root.querySelectorAll('[data-service-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===filterButton)));
   buttons.forEach(b=>{b.hidden=filter!=='all'&&b.dataset.serviceState!==filter;});
   root.querySelector('#service-empty-filter').hidden=visible().length!==0;root.querySelector('#service-list-count').textContent=number(visible().length)+' من '+number(buttons.length)+' محادثة';selection();return;
  }
  const button=event.target.closest('[data-service-conversation]');if(button){open(button);return;}
  if(event.target.closest('[data-service-back]')){back();return;}
  if(event.target.closest('[data-service-retry]')){open(buttons.find(b=>b.dataset.serviceConversation===selected));return;}
  if(event.target.closest('[data-service-prev],[data-service-next]')){
   const items=visible(),index=items.findIndex(b=>b.dataset.serviceConversation===selected);open(items[index+(event.target.closest('[data-service-next]')?1:-1)]);return;
  }
  const ref=event.target.closest('[data-journey-ref]');
  if(ref){
   const row=target.querySelector('#service-message-'+ref.dataset.journeyRef);
   if(row){target.querySelectorAll('.service-evidence-selected').forEach(r=>r.classList.remove('service-evidence-selected'));row.classList.add('service-evidence-selected');row.focus({preventScroll:true});row.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}return;
  }
  const trigger=event.target.closest('#service-analyze');if(!trigger||trigger.disabled||inflight.has(selected))return;
  const id=selected,d=cache.get(id);if(!d)return;
  analysisLoading(target);const request=api('service-monitor&action=analyze&conversation='+encodeURIComponent(d.conversation)+'&snapshot='+encodeURIComponent(d.analysis.fingerprint),{method:'POST'});inflight.set(id,request);
  try{
   const result=await request;d.analysis={...d.analysis,analysis:result.analysis,state:'complete'};
   if(alive&&selected===id){const box=target.querySelector('#service-analysis-result');box.innerHTML=analysisView(result.analysis);box.setAttribute('aria-busy','false');target.querySelector('#service-analyze')?.remove();}
  }catch(error){
   // A failed request may have reserved this snapshot server-side. Re-read before offering another attempt.
   cache.delete(id);
   if(alive&&selected===id){const box=target.querySelector('#service-analysis-result');box.innerHTML='<p role="alert">'+esc(error.message)+'</p><button type="button" class="secondary" data-service-retry>إعادة فتح الرحلة والتحقق من الحالة</button>';box.setAttribute('aria-busy','false');target.querySelector('#service-analyze')?.remove();}
  }finally{inflight.delete(id);}
 });
 on(window,'popstate',()=>{ownsHistory=false;const origin=buttons.find(b=>b.dataset.serviceConversation===selected);close();origin?.focus({preventScroll:true});});
 on(mobile,'change',modal);
 on(root,'keydown',e=>{
  if(e.key==='Escape'&&selected){e.preventDefault();back();return;}
  if(e.key==='Tab'&&selected&&mobile.matches){
   const items=[...target.querySelectorAll('button,a[href],summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
   const first=items[0],last=items[items.length-1];
   if(e.shiftKey&&(document.activeElement===first||document.activeElement.id==='service-journey-title')){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
 });
 cleanup=()=>{alive=false;revision++;controller.abort();selected=null;modal();document.body.classList.remove('service-journey-open');if(ownsHistory){const next={...history.state};delete next.linkServiceJourney;history.replaceState(next,'',location.href);}ownsHistory=false;};
}
window.LinkServiceMonitor={render,bind,unbind:()=>cleanup()};
})();
