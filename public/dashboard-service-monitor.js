(() => {
'use strict';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v==null?'—':Number(v).toLocaleString('ar-SA-u-nu-latn');
const date=v=>v?new Date(v).toLocaleString('ar-SA-u-ca-gregory-nu-latn',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Riyadh'}):'—';
const table=(headers,rows)=>'<div class="table-wrap" tabindex="0" role="region" aria-label="جدول قابل للتمرير أفقيًا"><table><thead><tr>'+headers.map(v=>'<th scope="col">'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
function render(result){
 if(!result)return '<section class="panel"><h2>مراقبة واتساب</h2><p class="notice warn">بيانات واتساب غير متاحة الآن. جرّب تحديث الصفحة.</p></section>';
 if(result.monitor_disabled)return '<section class="panel"><h2>مراقبة واتساب</h2><p class="muted">تسجيل المحادثات غير مفعّل بعد. ستظهر الأرقام ورحلة العميل بعد تفعيل الربط واستقبال الرسائل الجديدة.</p></section>';
 const {today,month,recorded_from:since,collector_enabled:enabled,agent_configured:agent}=result;
 const fields=[['محادثات وصلت منها رسائل','contacts'],['رسائل العملاء','incoming'],['ردود الموظف المؤكدة','employee'],['رسائل آلية معروفة','automation'],['رسائل صادرة غير منسوبة','unverified'],['وسيط انتظار الرد المؤكد بالدقائق','median_minutes']];
 const metrics=table(['المؤشر','اليوم','هذا الشهر'],fields.map(([label,k])=>'<tr><th scope="row">'+esc(label)+'</th><td>'+number(since&&(agent||!['employee','median_minutes'].includes(k))?today[k]:null)+'</td><td>'+number(since&&(agent||!['employee','median_minutes'].includes(k))?month[k]:null)+'</td></tr>').join(''));
 const comments=[
 !enabled?'تسجيل المحادثات غير مفعّل.':null,
 !since?'لم يصل أي سجل بعد؛ لا يمكن تقييم الفترات السابقة.':'أول رسالة مسجّلة: '+date(since),
 !agent?'هوية الموظف لم تُعتمد بعد؛ لا يمكن احتساب ردوده.':null,
 result.limited?'النتائج جزئية: تعرض آخر 2,000 رسالة فقط من الشهر.':null
 ].filter(Boolean).join(' · ');
 const cases=result.conversations||[];
 const oldest=cases.find(c=>c.pending_since&&!c.unverified_after);
 const tips=since&&agent?[
 oldest?'راجع أقدم حالة لم يظهر لها رد بشري مؤكّد: '+(oldest.name||'#'+oldest.id)+' منذ '+date(oldest.pending_since)+'.':null,
 cases.some(c=>c.unverified_after)?'تحقق من هوية الردود غير المنسوبة قبل اعتبار الحالات متأخرة.':null
 ].filter(Boolean):[];
 const queue=cases.map(c=>'<tr data-service-state="'+(c.pending_since?(c.unverified_after?'review':'waiting'):'other')+'"><td>'+esc(c.name||'#'+c.id)+'</td><td>'+(!c.pending_since?'—':c.unverified_after?'رد غير منسوب · راجع':'لا يوجد رد بشري مؤكّد')+'</td><td>'+date(c.pending_since)+'</td><td>'+date(c.last_human_at)+'</td><td>'+date(c.last_at)+'</td><td><button type="button" class="secondary" data-service-conversation="'+esc(c.id)+'">عرض الرحلة</button></td></tr>').join('');
 return '<section class="panel"><h2>تقييم خدمة واتساب</h2><p class="muted">'+esc(comments)+' · توقيت السعودية</p>'+metrics+'<p class="muted">مدة الانتظار تشمل خارج الدوام. الرد الآلي أو الصادر غير المنسوب لا يُحتسب ردًا بشريًا.</p></section>'+
 '<section class="panel"><h2>نقاط للمراجعة مع الموظف</h2>'+(tips.length?'<ul>'+tips.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':'<p class="muted">لا توجد ملاحظات مؤكدة من السجلات المتاحة.</p>')+'</section>'+
 '<section class="panel"><h2>محادثات للمراجعة</h2><p class="muted">الأولوية للأقدم دون رد بشري مؤكد من السجلات المتاحة. راجع سياق الحالة قبل تنبيه الموظف.</p>'+
 (queue?'<label for="service-case-filter">تصفية السجل</label> <select id="service-case-filter"><option value="all">كل الحالات المعروضة</option><option value="waiting">بانتظار رد مؤكد</option><option value="review">رد غير منسوب</option></select><p id="service-empty-filter" class="muted" role="status" hidden>ما في حالات مطابقة ضمن القائمة المعروضة.</p>'+table(['العميل','حالة الرد المسجلة','بداية الانتظار','آخر رد بشري','آخر نشاط','التفاصيل'],queue):'<p>لا توجد محادثات مسجّلة في الفترة.</p>')+
 (result.conversation_total>80?'<p class="muted">تظهر أول 80 محادثة حسب الأولوية.</p>':'')+'</section>'+
 '<section id="service-journey" class="panel" tabindex="-1" aria-label="رحلة العميل" hidden></section>';
}
const actors={customer:'العميل',employee:'الموظف',automation:'الأتمتة',unverified:'صادر غير منسوب'};
function journey(d){
 const entries=[
 ...d.messages.map(m=>[m.occurred_at,actors[m.actor],m.body||'رسالة غير نصية']),
 ...d.orders.map(o=>[o.ordered_at,'طلب',`#${o.order_reference||o.external_order_id} · ${o.status||'—'} · ${number(o.total_amount)} ${o.currency||'SAR'}`]),
 ...d.carts.flatMap(c=>[[c.abandoned_at,'سلة متروكة',`${c.status||'—'} · ${number(c.total_amount)} ${c.currency||'SAR'}`],...(c.recovered_at?[[c.recovered_at,'استرداد سلة','تحولت السلة إلى طلب']]:[])])
 ].filter(e=>e[0]).sort((a,b)=>Date.parse(b[0])-Date.parse(a[0]));
 const match=d.store_unavailable?'تعذر تحميل سجل سلة.':d.match==='matched'?'مطابقة عميل سلة بالهاتف: '+d.customer:d.match==='ambiguous'?'تعذرت المطابقة: يوجد أكثر من تطابق.':'لا يوجد عميل سلة مطابق برقم الهاتف.';
 return '<h2>رحلة '+esc(d.contact||'العميل')+'</h2><p class="muted">'+esc(match)+' · آخر 12 طلبًا و12 سلة عند توفرها.</p>'+
 (d.limited?'<p class="muted">يعرض آخر 100 رسالة مسجلة.</p>':'')+
 table(['الوقت','الحدث','التفاصيل'],entries.map(e=>'<tr><td>'+date(e[0])+'</td><td>'+esc(e[1])+'</td><td style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(e[2])+'</td></tr>').join(''));
}
function bind({api}){
 const target=document.getElementById('service-journey');if(!target)return;
 const filter=document.getElementById('service-case-filter');
 filter?.addEventListener('change',()=>{
  let visible=0;
  document.querySelectorAll('[data-service-state]').forEach(row=>{
   row.hidden=filter.value!=='all'&&row.dataset.serviceState!==filter.value;
   if(!row.hidden)visible++;
  });
  document.getElementById('service-empty-filter').hidden=visible!==0;
 });
 let revision=0;
 document.querySelectorAll('[data-service-conversation]').forEach(button=>button.addEventListener('click',async()=>{
  const run=++revision;button.disabled=true;target.hidden=false;target.innerHTML='<p role="status">جارٍ تحميل رحلة العميل…</p>';target.focus();
  try{const d=await api('service-monitor&conversation='+encodeURIComponent(button.dataset.serviceConversation));
   if(run===revision)target.innerHTML=journey(d);
  }catch{if(run===revision)target.innerHTML='<p role="alert">تعذّر تحميل الرحلة. جرّب فتحها مرة أخرى.</p>';}
  finally{button.disabled=false;}
 }));
}
window.LinkServiceMonitor={render,bind};
})();
