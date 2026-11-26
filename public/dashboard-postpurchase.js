(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tags={case:'كفر / إطار جانبي',screen:'حماية شاشة',lens:'حماية عدسات',camera_frame:'إطار كاميرا',charger:'شاحن',cable:'كيبل',other:'أخرى'};
const reasons={model_missing:'لم نتعرف على الموديل في اسم المنتج أو الخيار المشترى',model_ambiguous:'موديل المنتج غير واضح أو متعدد',model_conflict:'موديل الاسم يختلف عن الخيار المحدد',model_selection_unknown:'المنتج له خيارات موديل؛ الخيار المشترى غير واضح',offers_paused:'العروض موقوفة من الإعدادات',product_unclassified:'منتج واحد؛ يلزم تأكيد موديله ونوعه',no_complementary_offer:'لا يوجد عرض مكمل فعّال لنفس الموديل',customer_missing:'الطلب غير مرتبط بعميل؛ يلزم إصلاح الربط',delivery_date_unknown:'ننتظر تسجيل تاريخ تسليم مؤكّد',phone_missing:'هاتف غير صالح',optout:'ألغى الاشتراك',later_purchase:'اشترى مجددًا بعد هذا الطلب',model_mismatch:'موديل الجهاز مختلف',unmapped_items:'عرّف باقي منتجات الطلب ومحتويات البكج',already_owned:'يمتلك أحد مكونات العرض بالفعل',offer_url_missing:'أضف رابط المنتج المقترح',delay:'بانتظار موعد المتابعة',stock_check_required:'موعده حان؛ فحص المخزون والقالب مطلوب قبل الإرسال'};
const date=v=>v?new Date(v).toLocaleString('ar-SA-u-nu-latn',{timeZone:'Asia/Riyadh',dateStyle:'short',timeStyle:'short'}):'—';
const reviewReasons={catalog_required:'يلزم جلب بيانات الكتالوج',multiple_models:'أكثر من موديل',model_unknown:'الموديل غير واضح',model_conflict:'تعارض بين العنوان والوصف',variants_review:'خيارات موديل أو نسخ تحتاج مراجعة',type_unknown:'نوع الحماية غير واضح',bundle_contents_review:'تأكيد محتويات البكج',url_missing:'رابط المنتج ناقص',name_missing:'اسم المنتج ناقص'};
let state,analysisStatus='';
function automatic(d){const a=d.automatic;if(!a?.ready)return '<section class="panel"><h3>التجهيز التلقائي</h3><p>شغّل تحديث الربط التلقائي مرة واحدة في SQL Editor، ثم حدّث الصفحة.</p><a class="secondary" href="https://github.com/Anas-mehdy/link-video-shop/blob/main/crm-postpurchase-auto.sql" target="_blank" rel="noopener">فتح تحديث SQL</a></section>';
const reviews=a.suggestions.filter(x=>x.decision==='review'&&!d.products.some(p=>p.product_id===x.product_id&&p.variant_id===x.variant_id&&p.origin==='manual'));
return `<section class="panel"><h3>تجهيز المنتجات والعروض تلقائيًا</h3><p class="muted">يجلب الكتالوج الحالي ويحفظه محليًا، ثم يقترح منتجات مكملة لنفس الموديل. نستهدف الآن الطلبات ذات المنتج الواحد فقط؛ البكجات والطلبات متعددة المنتجات خارج هذه المرحلة. تجهيز الكتالوج وحده لا يرسل رسائل.</p><div class="form-row"><button class="primary" id="pp-auto-import">${a.import?.completed?'تحديث الكتالوج والربط':'تجهيز الكتالوج والربط تلقائيًا'}</button><button class="secondary" id="pp-auto-analyze">إعادة التحليل المحلي · 0 طلبات سلة</button></div><p class="muted">جلب الكتالوج: <span dir="ltr">${a.requests} / ${a.budget}</span> طلبًا هذا الشهر. الحفظ حديث لمدة 24 ساعة؛ الحد 10 صفحات في التشغيل الواحد. يشمل العداد الطلبات الفاشلة، ويخص هذه الميزة فقط.</p><div id="pp-auto-progress" role="status">${esc(analysisStatus)}</div><p>${a.suggestions.filter(x=>x.decision==='auto').length} منتجًا واضحًا · ${reviews.length} للمراجعة · ${a.suggestions.filter(x=>x.decision==='excluded').length} مستبعدًا.</p>${a.import&&!a.import.completed?'<div class="notice">الكتالوج غير مكتمل بعد؛ استكمل الجلب قبل اعتماد العروض. الصفحة التالية: '+a.import.next_page+'</div>':''}
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">${reviews.slice(0,100).map(x=>`<article class="notice" style="margin:0"><b>${esc(x.name)}</b><p class="muted">${x.reasons.map(r=>esc(reviewReasons[r]||r)).join('، ')}</p><button class="secondary" data-pp-review="${esc(x.product_id)}">مراجعة الاستثناء</button></article>`).join('')||'<p class="muted">لا توجد استثناءات مسجلة. ابدأ التجهيز التلقائي.</p>'}</div></section>`;
}
function unmatchedProducts(preview){
 const groups=preview.unmatched_products||[];if(!groups.length)return '';
 return `<section class="panel"><h3>المنتجات غير المطابقة وأسبابها</h3><p class="muted">${preview.unclassified_orders} طلبًا موزّعة على ${groups.length} حالات. نعالج الأسماء والخيارات الواضحة تلقائيًا؛ لا تحتاج تعريف كل طلب يدويًا.</p><button class="secondary" id="pp-copy-unmatched">نسخ قائمة المنتجات غير المطابقة</button><div class="table-wrap" tabindex="0" role="region" aria-label="جدول بيانات قابل للتمرير أفقيًا"><table><thead><tr><th>المنتج</th><th>عدد الطلبات</th><th>سبب عدم المطابقة</th><th>الموديل في الاسم / الخيار</th></tr></thead><tbody>${groups.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.orders)}</td><td>${esc(reasons[x.reason]||x.reason)}</td><td>${esc(x.title_models.join('، ')||'—')} / ${esc(x.selected_models.join('، ')||'—')}</td></tr>`).join('')}</tbody></table></div><textarea id="pp-unmatched-copy" hidden readonly aria-label="قائمة المنتجات غير المطابقة" style="width:100%;min-height:160px" dir="ltr"></textarea></section>`;
}
function eligibilityReport(r){
 const labels={already_attempted:'سبق إرسال أو محاولة هذا الطلب',cooldown:'ضمن فترة منع تكرار عروض ما بعد البيع',stock_error:'فحص التوفر متعذر؛ ننتظر إعادة الفحص',review_ready:'مستحق · التوفر مفحوص',stock_check_required:'مستحق · يحتاج فحص التوفر',no_stock:'المكملات نافدة',not_delivered:'لم يُسلّم الطلب',multiple_products:'طلب متعدد المنتجات أو بيانات ناقصة',customer_missing:'ربط العميل ناقص',phone_missing:'رقم غير صالح',optout:'ألغى الاشتراك',delay:'لم يحن الموعد',duplicate_customer:'يغطيه طلب آخر لنفس الرقم',no_remaining_complements:'لا توجد مكملات ناقصة بعد مشترياته اللاحقة',no_complementary_offer:'لا توجد مكملات مطابقة',classification_review:'موديل أو نوع المنتج يحتاج مراجعة',later_purchase_review:'مشترياته اللاحقة تحتاج مراجعة',outside_window:'خارج آخر 30 يومًا',bundle_excluded:'بكج مستبعد',unsupported_model:'Fold 8 خارج الاستهداف',outside_scope:'منتج خارج الاستهداف'};
 return `<p><b>${r.eligible_customers}</b> عميلًا مستحقًا مبدئيًا · <b>${r.stock_ready}</b> بتوفر مفحوص · <b>${r.needs_stock}</b> يحتاجون فحص التوفر</p><p class="muted">راجعنا ${r.scanned_orders} طلبًا من آخر 30 يومًا · الموعد بعد ${r.delay_days} أيام من الشراء · 0 طلبات سلة · 0 رسائل. مراجعة المستحقين لا تُفعّل الإرسال؛ راجع حالة التشغيل أعلاه. سجل الإرسال يطبق منع التكرار وفترة الانتظار بين عرضين.</p><details><summary>أعداد أسباب الاستبعاد والانتظار</summary><p>${Object.entries(r.counts).map(([k,n])=>esc(labels[k]||k)+': '+n).join(' · ')}</p></details><div class="table-wrap" tabindex="0" role="region" aria-label="جدول بيانات قابل للتمرير أفقيًا"><table><thead><tr><th>العميل / الطلب</th><th>اشترى / الموديل</th><th>الموعد بتوقيت السعودية</th><th>المكملات المتبقية</th><th>النتيجة</th></tr></thead><tbody>${[...r.rows].sort((a,b)=>Number(b.eligible)-Number(a.eligible)).slice(0,200).map(x=>`<tr><td>${esc(x.customer_name)}<br>${esc(x.external_order_id)}<br><small dir="ltr">${esc(x.phone_hint)}</small></td><td>${esc(x.purchased_name)}<br>${esc(x.model||'—')}</td><td>${esc(date(x.scheduled_for))}</td><td>${x.products.map(p=>esc(p.name)+(p.stock==='unavailable'?' · نافد':'')).join('<br>')||'—'}</td><td>${esc(labels[x.reason]||x.reason)}${x.covered_by_order?'<br>الطلب '+esc(x.covered_by_order):''}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد طلبات ضمن آخر 30 يومًا.</td></tr>'}</tbody></table></div>${r.rows.length>200?'<p class="muted">عرض أول 200 طلب، مع المستحقين أولًا. الأعداد تشمل جميع الطلبات المفحوصة.</p>':''}`;
}
function deliveryReport(r){
 if(!r.storage_ready)return '<p>شغّل <a href="https://github.com/Anas-mehdy/link-video-shop/blob/main/crm-postpurchase-delivery.sql" target="_blank" rel="noopener">SQL سجل إرسال ما بعد البيع</a> مرة واحدة. التشغيل يبقى موقوفًا افتراضيًا.</p>';
 const statuses={accepted:'قبله المزود · التسليم غير مؤكد',unknown:'نتيجة غير مؤكدة · لا إعادة تلقائية',sending:'محاولة محفوظة · لا إعادة تلقائية',rejected:'رفضه المزود',cancelled:'ألغيت قبل الإرسال'};
 const lux=r.lux_ready?`<div class="notice"><strong>عرض حامل لنك LUX · ${r.lux_enabled?(r.enabled?'مفعّل':'متوقف مع الإرسال العام'):'موقوف'}</strong><p>للطلبات المتوافقة مع MagSafe بعد 7 أيام من التسليم على الأقل. الدفعات يوميًا الساعة 11 صباحًا و8 مساءً بتوقيت السعودية، بحد 20 محاولة باليوم. نخضع لتوفر الحامل وفترة التهدئة.</p><p>طلبات تطابق الشروط حاليًا: ${esc(r.lux_due??'—')}</p><button type="button" class="${r.lux_enabled?'secondary':'primary'}" id="pp-lux-toggle" ${(!r.server_ready||!r.enabled)&&!r.lux_enabled?'disabled':''}>${r.lux_enabled?'إيقاف عرض LUX':'تفعيل عرض LUX'}</button></div>`:'';
 return `<p><b>${r.enabled?'الإرسال التلقائي مفعّل':'الإرسال التلقائي موقوف'}</b>${r.server_ready?'':' · إعدادات الخادم تحتاج مراجعة'}</p><button class="${r.enabled?'secondary':'primary'}" type="button" id="pp-delivery-toggle" ${!r.server_ready&&!r.enabled?'disabled':''}>${r.enabled?'إيقاف إرسال ما بعد البيع':'تفعيل الإرسال للزبائن'}</button>${lux}<details class="delivery-log"><summary>سجل محاولات الإرسال (${r.queue.length}) · ${r.queue.filter(x=>x.status==='unknown').length} نتيجة غير مؤكدة</summary><div class="table-wrap" tabindex="0" role="region" aria-label="جدول بيانات قابل للتمرير أفقيًا"><table><thead><tr><th>الطلب</th><th>الموديل</th><th>آخر محاولة</th><th>النتيجة</th><th>معرّف الرسالة</th></tr></thead><tbody>${r.queue.map(x=>`<tr><td>${esc(x.external_order_id)}</td><td>${esc(x.model)}</td><td>${esc(date(x.attempted_at))}</td><td>${esc(statuses[x.status]||x.status)}</td><td>${esc(x.provider_message_id||'—')}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد محاولات إرسال للزبائن بعد.</td></tr>'}</tbody></table></div></details>`;
}
const redboxPanel='<section class="panel" aria-labelledby="pp-redbox-title"><h3 id="pp-redbox-title">متابعة ريد بوكس والكاش باك</h3><p class="muted">متابعة فقط: هذا القسم لا يغيّر حالة الطلب ولا يرسل واتساب.</p><button class="secondary" id="pp-redbox-refresh" type="button">تحديث المتابعة</button><div id="pp-redbox-status" aria-live="polite">جارٍ تحميل متابعة ريد بوكس…</div></section>';
const redboxPhases={
 salla_review:'راجع حالة الطلب في سلة',
 tracking_review:'راجع أرقام تتبع الطلب',
 waiting_all_parcels:'بانتظار تسليم كل الطرود',
 waiting_salla_delivered:'تم التسليم في ريد بوكس — حدّث الطلب إلى «تم التوصيل» في سلة',
 wallet_ambiguous:'أكثر من إيداع محتمل — راجع المحفظة',
 wallet_unconfirmed:'لم نجد إيداع كاش باك مطابقًا',
 waiting_two_hours:'بانتظار مرور ساعتين من تسليم آخر طرد',
 simulation_ready:'مؤهل مبدئيًا في المحاكاة'
};
const redboxMatches={matched:'مرتبط بطلب',unmatched:'لم نجد طلبًا مطابقًا',ambiguous:'أكثر من طلب محتمل'};
const redboxStatuses={201:'قيد المعالجة',601:'تم التسليم',901:'لم يُسلّم'};
const redboxDate=new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',calendar:'gregory',dateStyle:'short',timeStyle:'short'});
const redboxAmount=new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'});
function formatRedboxDate(v){const dt=Date.parse(v);return Number.isFinite(dt)?redboxDate.format(dt):'—';}
function redboxReport({orders,events}){
 if(!events.length&&!orders.length)return '<p class="muted">لم يصل أي تحديث من ريد بوكس خلال آخر 7 أيام. عند وصول أول تحديث سيظهر هنا.</p>';
 const bdi=v=>'<bdi>'+esc(v??'—')+'</bdi>';
 const orderRows=orders.map(r=>`<tr><th scope="row">${bdi(r.external_order_id)}</th><td>${bdi(r.delivered_parcels)} من ${bdi(r.parcels)}</td><td>${esc(formatRedboxDate(r.delivered_at))}</td><td>${esc(Object.hasOwn(redboxPhases,r.phase)?redboxPhases[r.phase]:'تحتاج مراجعة')}</td><td>${r.simulated_cashback_sar!=null&&Number.isFinite(Number(r.simulated_cashback_sar))?esc(redboxAmount.format(Number(r.simulated_cashback_sar))):'—'}</td></tr>`).join('');
 const eventRows=events.map(r=>`<tr><th scope="row">${bdi(r.tracking_number)}</th><td>${esc(redboxStatuses[r.status_code]??r.status_name??'—')}</td><td>${esc(Object.hasOwn(redboxMatches,r.match_state)?redboxMatches[r.match_state]:'تحتاج مراجعة')} ${r.external_order_id?'· '+bdi(r.external_order_id):''}</td><td>${esc(formatRedboxDate(r.received_at))}</td></tr>`).join('');
 return `<p class="muted">آخر 7 أيام · التوقيت بتوقيت السعودية · مبلغ الكاش باك مبني على مطابقة محتملة للإيداع مع الطلب.</p>
 <h4>الطلبات المرتبطة</h4>
 ${orderRows?`<div class="table-wrap"><table aria-label="طلبات سلة المرتبطة بشحنات ريد بوكس"><thead><tr><th scope="col">معرّف الطلب</th><th scope="col">الطرود المسلّمة</th><th scope="col">آخر تسليم</th><th scope="col">الخطوة التالية</th><th scope="col">الكاش باك المحتمل</th></tr></thead><tbody>${orderRows}</tbody></table></div>`:'<p class="muted">وصلت تحديثات، لكن لا يوجد طلب مطابق ضمن فترة المتابعة.</p>'}
 <details ${orderRows?'':'open'}><summary>أحدث تحديثات ريد بوكس (${events.length})</summary>
 ${eventRows?`<div class="table-wrap"><table aria-label="أحدث تحديثات ريد بوكس"><thead><tr><th scope="col">رقم التتبع</th><th scope="col">حالة الشحنة</th><th scope="col">الربط بسلة</th><th scope="col">وصول التحديث</th></tr></thead><tbody>${eventRows}</tbody></table></div>`:'<p class="muted">لا توجد تحديثات وصلت في هذه الفترة.</p>'}</details>`;
}
function bindRedbox(api){
 const box=document.getElementById('pp-redbox-status'),button=document.getElementById('pp-redbox-refresh');
 if(!box||!button)return;
 const load=async()=>{
  button.disabled=true;
  box.setAttribute('aria-busy','true');
  try{const data=await api('redbox-monitor');if(box.isConnected)box.innerHTML=redboxReport(data);}
  catch{if(box.isConnected)box.textContent='تعذّر تحميل متابعة ريد بوكس. اضغط «تحديث المتابعة» للمحاولة مجددًا.';}
  finally{button.disabled=false;box.removeAttribute('aria-busy');}
 };
 button.addEventListener('click',load);load();
}
const cashbackPanel='<section class="panel"><h3>الكاش باك بعد التوصيل</h3><p class="muted">قالب link_cashback_delivered_ar · تُرسل الرسالة تلقائيًا عند وصول «تم التوصيل» من سلة. تُستبعد الأرقام التي ألغت الاشتراك.</p><button class="secondary" id="cb-refresh" type="button">تحديث سجل الكاش باك</button><div id="cb-status" aria-live="polite">جارٍ تحميل حالة الكاش باك…</div></section>';
function bindCashback(api,toast){
 const box=document.getElementById('cb-status'),refreshButton=document.getElementById('cb-refresh');
 if(!box)return;
 const statuses={queued:'بانتظار الإرسال',sending:'محاولة محفوظة',accepted:'قبله المزود · التسليم غير مؤكد',rejected:'رفضه المزود',unknown:'نتيجة غير مؤكدة',cancelled:'لم يُرسل'};
 const reasons={already_contacted:'سبقت محاولة ما بعد البيع',optout:'ألغى العميل الاشتراك',consent_missing:'لا توجد موافقة واتساب',credit_expired:'انتهت صلاحية الرصيد',delivery_not_recent:'خرج الحدث من نطاق آخر 7 أيام',phone_mismatch:'رقم الهاتف تغيّر',order_not_delivered:'الطلب لم يعد مسلّمًا',paused:'الإرسال موقوف'};
 const destinations={cashback:'صفحة الكاش باك',personal:'اقتراحات مخصصة',model:'قسم موديل الجوال',accessories:'الإكسسوارات'};
 const call=(method,body)=>api('delivery-cashback',{method,body:JSON.stringify(body)});
 let loading=false;
 const testRequests=new Map();
 async function refresh(){
  if(loading)return;loading=true;refreshButton.disabled=true;
  try{
   const r=await api('delivery-cashback');if(!box.isConnected)return;
   if(!r.storage_ready){box.textContent='سجل الكاش باك يحتاج تجهيز قاعدة البيانات.';return;}
   const seen=new Set(r.rows.map(x=>x.order_id)),unreviewed=r.candidates.filter(x=>!seen.has(x.order_id));
   box.innerHTML=`<p><b>${r.enabled?'الإرسال مفعّل':'الإرسال موقوف'}</b>${r.server_ready?'':' · إعدادات واتساب غير جاهزة'}</p><button class="secondary" id="cb-toggle" type="button" ${!r.enabled&&!r.server_ready?'disabled':''}>${r.enabled?'إيقاف الإرسال':'تشغيل الإرسال التلقائي'}</button>
    <details class="pp-inner"><summary>طلبات توصيل حديثة (${unreviewed.length})</summary>
    <form id="cb-approve" class="pp-grid">
    <label>الطلب<select name="order" required><option value="">اختر الطلب</option>${unreviewed.map(x=>`<option value="${esc(x.order_id)}">${esc(x.order_reference||x.external_order_id)} · ${esc(x.customer_name||'بدون اسم')} · ${esc(date(x.delivered_at))}</option>`).join('')}</select></label>
    <button class="secondary" id="cb-preview" type="button">معاينة الرابط</button>
    <div id="cb-preview-result" role="status"></div></form>
    <p class="muted">تُستخدم هذه الطلبات لمعاينة الرابط أو إرسال تجربة إلى رقم الاختبار.</p>
    <details><summary>إرسال قالب تجريبي</summary><form id="cb-test-form" class="pp-grid">
    <label>رقم الاختبار المهيأ<input name="phone" inputmode="tel" dir="ltr" autocomplete="off" required></label>
    <label>الاسم في الرسالة<input name="name" maxlength="80" value="اختبار لنك" required></label>
    <button class="secondary" type="submit">أرسل القالب لرقم الاختبار</button><p id="cb-test-result" role="status"></p>
    </form></details></details>
    <details class="pp-inner"><summary>سجل الإرسال (${r.rows.length})</summary><div class="table-wrap" tabindex="0" role="region" aria-label="سجل إرسال الكاش باك"><table><thead><tr><th>معرّف الطلب</th><th>الحالة</th><th>الوجهة</th><th>آخر محاولة</th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${esc(x.external_order_id)}</td><td>${esc(statuses[x.status]||x.status)}${reasons[x.reason]?' · '+esc(reasons[x.reason]):''}</td><td>${esc(destinations[x.destination]||'—')}</td><td>${esc(date(x.attempted_at)||'—')}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد محاولات بعد.</td></tr>'}</tbody></table></div></details>`;
   const form=box.querySelector('#cb-approve');
   form.elements.order.addEventListener('change',()=>{box.querySelector('#cb-preview-result').textContent='';});
   box.querySelector('#cb-preview').onclick=async e=>{
    const btn=e.currentTarget,order_id=form.elements.order.value,result=box.querySelector('#cb-preview-result');
    if(!order_id){result.textContent='اختر طلبًا للمعاينة.';return;}
    btn.disabled=true;result.textContent='جارٍ تجهيز الرابط…';
    try{
     const p=await call('POST',{action:'preview',order_id});if(form.elements.order.value!==order_id)return;
     const u=new URL(p.url);if(u.origin!=='https://linkstore-sa.com')throw Error('رابط المتجر غير صالح');
     const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener';a.textContent='فتح '+(destinations[p.kind]||'رابط المتجر');result.replaceChildren(a);
    }catch(err){result.textContent=err.message;}finally{btn.disabled=false;}
   };
   const testForm=box.querySelector('#cb-test-form');
   testForm.onsubmit=async e=>{
    e.preventDefault();
    const order_id=form.elements.order.value, test_phone=testForm.elements.phone.value.trim(),test_name=testForm.elements.name.value.trim();
    const result=box.querySelector('#cb-test-result'),btn=testForm.querySelector('button');
    if(!order_id){result.textContent='اختر طلبًا لاستخدام رابطه التجريبي.';return;}
    const key=order_id+':'+test_phone;
    if(!testRequests.has(key))testRequests.set(key,crypto.randomUUID());
    btn.disabled=true;result.textContent='جارٍ إرسال القالب التجريبي…';
    try{
     const r=await call('POST',{action:'test-send',order_id,test_phone,test_name,request_id:testRequests.get(key),confirm_test:true});
     result.textContent=r.status==='accepted'?'قبل اتصالنا رسالة الاختبار. تحقّق من وصولها بواتساب.':r.status==='rejected'?'رفض اتصالنا إرسال القالب (HTTP '+r.provider_code+').':r.status==='duplicate'?'سُجلت محاولة لهذا الاختبار. لم تُعد.':'نتيجة محاولة الاختبار غير مؤكدة. لم تُعد.';
    }catch(err){result.textContent=err.message;}finally{btn.disabled=false;}
   };
   form.onsubmit=e=>e.preventDefault();
   box.querySelector('#cb-toggle').onclick=async e=>{
    const enabled=!r.enabled;if(enabled&&!confirm('تشغيل إرسال قالب الكاش باك تلقائيًا لأحداث التوصيل الجديدة؟'))return;
    const btn=e.currentTarget;btn.disabled=true;
    try{await call('PUT',{action:'configure',enabled,confirm_live:enabled});await refresh();}
    catch(err){toast(err.message);}finally{btn.disabled=false;}
   };
  }catch(err){if(box.isConnected)box.textContent=err.message;}
  finally{loading=false;refreshButton.disabled=false;}
 }
 refreshButton.onclick=refresh;refresh();
}
function render(d){state=d;const head='<div class="page-heading"><div><h1>ما بعد البيع</h1><p class="muted">عروض مكملة حسب مشتريات العميل وموديل جهازه.</p></div><span class="badge" id="pp-mode-label">جارٍ قراءة حالة التشغيل</span></div>';
if(!d.ready)return head+redboxPanel+cashbackPanel+'<section class="panel"><h3>تجهيز قاعدة البيانات</h3><p>شغّل ملف crm-postpurchase.sql في SQL Editor بسوبابيس، ثم حدّث الصفحة.</p><a class="secondary" href="https://github.com/Anas-mehdy/link-video-shop/blob/main/crm-postpurchase.sql" target="_blank" rel="noopener">فتح ملف SQL</a></section>';
const s=d.settings,p=d.products,options='<option value="">اختر منتجًا معرّفًا</option>'+p.map((x,i)=>`<option value="${i}">${esc(x.name)} · ${esc(x.model)}${x.variant_id?' · نسخة '+esc(x.variant_id):''}</option>`).join('');
return head+redboxPanel+cashbackPanel+`<section class="panel"><h3>تشغيل إرسال ما بعد البيع</h3><p class="muted">القالب link_complete_protection_ar · دفعات في ساعات ${s.batch_hours.join('، ')} بتوقيت السعودية · أقصى ${s.batch_limit} محاولات لكل دفعة · ${s.cooldown_days} يومًا بين عرضين لنفس الرقم. يعتمد على ووركفلو الدقيقة الموجود، ويشارك بعض الدقائق مع تذكيرات السلات. لا توجد إعادة تلقائية لنتيجة إرسال غير مؤكدة.</p><button class="secondary" id="pp-delivery-refresh">تحديث حالة الإرسال</button><div id="pp-delivery-status" role="status" aria-live="polite"></div></section><section class="panel"><h3>تجربة قالب ما بعد البيع المعتمد</h3><p class="muted">اختر عرضًا من المعاينة لتجربته على رقم WHATSAPP_TEST_PHONE المحفوظ. خيار الصفحة الشخصية يستخدم القالب المعتمد link_complete_protection_ar، بصورة ثابتة واسم العميل وموديل جواله ورابط خياراته المكملة. خيار المنتج يستخدم القالب السابق. لا تُرسل للعميل، ولا تُفعّل الإرسال التلقائي، ولا تستهلك طلبات سلة.</p><form id="pp-test" class="pp-grid"><label>العرض التجريبي<select name="offer" required><option value="">اختر عرضًا</option>${d.preview.rows.map((x,i)=>x.offer_product_id&&['stock_check_required','delay'].includes(x.reason)?`<option value="${i}">${esc(x.purchased_name)} ← ${esc(x.offer_name)}</option>`:'').join('')}</select></label><label>وجهة زر الرسالة<select name="destination"><option value="personal_page">صفحة الحماية الشخصية · جميع الخيارات المكملة</option><option value="product">صفحة المنتج فقط</option></select></label><button class="primary">إرسال تجربة لرقمي</button></form><div class="form-row" style="margin-top:12px"><button class="secondary" type="button" id="pp-landing-link">إنشاء صفحة حماية مخصصة لهذا الطلب</button></div><div class="form-row" style="margin-top:12px"><button class="secondary" type="button" id="pp-stock-check">فحص توفر منتجات هذا الطلب</button></div><div id="pp-stock-status" role="status" aria-live="polite"></div><p class="muted">فحص المخزون: طلبان بحد أقصى لكل خطوة، والنتيجة تُشارك بين العملاء لمدة 4 ساعات. الحد الشهري 700 طلب أو الميزانية الأقل المحفوظة. تجهيز مرة واحدة: <a href="https://github.com/Anas-mehdy/link-video-shop/blob/main/crm-postpurchase-stock.sql" target="_blank" rel="noopener">SQL فحص المخزون</a></p><div id="pp-landing-status" role="status" aria-live="polite"></div><div id="pp-test-status" role="status" aria-live="polite"></div><p class="muted">مرة واحدة: <a href="https://github.com/Anas-mehdy/link-video-shop/blob/main/crm-postpurchase-test-send.sql" target="_blank" rel="noopener">فتح SQL سجل التجربة</a></p></section>`+`<section class="panel"><h3>مراجعة المستحقين لمتابعة ما بعد البيع</h3><p class="muted">مراجعة محلية للطلب والتسليم والرقم وإلغاء الاشتراك والمكملات الناقصة. لا تستدعي API سلة ولا ترسل رسائل.</p><button class="secondary" id="pp-eligibility-review">تحديث مراجعة المستحقين</button><div id="pp-eligibility-status" role="status" aria-live="polite"></div></section>`+automatic(d)+`<div class="notice">تستخدم هذه الصفحة الطلبات المحفوظة لآخر 30 يومًا. فتح الصفحة وحفظ الإعدادات لا يطلبان API من سلة. فحص المخزون والإرسال يعملان ضمن الدفعات عند التفعيل.</div>
<details class="panel" id="pp-manual"><summary>مراجعة استثناء أو تعريف منتج يدويًا</summary><h3>تعريف المنتجات والبكجات</h3><p class="muted">حدّد الموديل بدقة، مثل iPhone 17 Pro Max، واختر جميع مكونات البكج. إذا كان المنتج متعدد الموديلات، عرّف كل نسخة بمعرّف SKU منفصل.</p>
<form id="pp-product" class="pp-grid"><label>منتج من الطلبات الأخيرة<select id="pp-catalog"><option value="">إدخال يدوي</option>${d.catalog.map((x,i)=>`<option value="${i}">${esc(x.name)} · ${esc(x.product_id)}</option>`).join('')}</select></label><label>معرّف منتج سلة<input name="product_id" required inputmode="numeric" pattern="[0-9]{1,20}"></label><label>معرّف النسخة SKU، إن وجدت<input name="variant_id" inputmode="numeric" pattern="[0-9]{0,20}"></label><label>اسم المنتج<input name="name" required maxlength="150"></label><label>موديل الجهاز<input name="model" required placeholder="iPhone 17 Pro Max" maxlength="100"></label><label>رابط المنتج<input name="product_url" type="url" dir="ltr" placeholder="https://linkstore-sa.com/..."></label><fieldset class="pp-components"><legend>محتويات المنتج أو البكج</legend>${Object.entries(tags).map(([k,v])=>`<label><input type="checkbox" name="components" value="${k}"> ${v}</label>`).join('')}</fieldset><button class="primary">حفظ تعريف المنتج</button></form>
<div class="table-wrap" tabindex="0" role="region" aria-label="جدول بيانات قابل للتمرير أفقيًا"><table><thead><tr><th>المنتج</th><th>الموديل</th><th>المحتويات</th><th>مصدر الربط</th><th>تعديل</th></tr></thead><tbody>${p.map((x,i)=>`<tr><td>${esc(x.name)}<br><small dir="ltr">${esc(x.product_id)}${x.variant_id?' / '+esc(x.variant_id):''}</small></td><td>${esc(x.model)}</td><td>${x.components.map(c=>esc(tags[c])).join('، ')}</td><td>${x.origin==='auto'?'تلقائي':'مراجعة يدوية'}</td><td><button class="secondary" data-pp-edit="${i}">تعديل</button></td></tr>`).join('')||'<tr><td colspan="5">لا توجد تعريفات بعد.</td></tr>'}</tbody></table></div></details>
<details class="panel"><summary>العروض المولّدة وإضافة استثناء يدوي</summary><h3>ربط المشتريات بالعروض</h3><form id="pp-rule" class="pp-grid"><label>اسم القاعدة<input name="name" required maxlength="120" placeholder="كفر iPhone 17 ← حماية شاشة"></label><label>إذا اشترى<select name="trigger" required>${options}</select></label><label>نقترح عليه<select name="offer" required>${options}</select></label><button class="primary">إضافة عرض مكمل</button></form><div class="table-wrap" tabindex="0" role="region" aria-label="جدول بيانات قابل للتمرير أفقيًا"><table><thead><tr><th>القاعدة</th><th>الحالة</th><th>تغيير</th></tr></thead><tbody>${d.rules.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.active?'ضمن المعاينة':'متوقفة'}</td><td><button class="secondary" data-pp-rule="${esc(x.id)}">${x.active?'إيقاف':'إدراج في المعاينة'}</button></td></tr>`).join('')||'<tr><td colspan="3">أضف أول قاعدة بعد تعريف المنتجين.</td></tr>'}</tbody></table></div></details>
<section class="panel"><h3>إعدادات التشغيل المقترحة</h3><form id="pp-settings" class="pp-grid"><label>أيام بعد الشراء للطلبات المسلّمة<input name="delay_days" type="number" min="1" max="30" value="${s.delay_days}" required></label><label>أوقات الدفعات بتوقيت السعودية<input name="batch_hours" dir="ltr" value="${s.batch_hours.join(', ')}" required></label><label>أقصى عملاء لكل دفعة<input name="batch_limit" type="number" min="1" max="10" value="${s.batch_limit}" required></label><label>أيام بين عرضين لنفس العميل<input name="cooldown_days" type="number" min="7" max="90" value="${s.cooldown_days}" required></label><label>ميزانية فحص المخزون شهريًا<input name="stock_api_budget" type="number" min="0" max="1000" value="${s.stock_api_budget}" required></label><button class="primary">حفظ إعدادات المعاينة</button></form><p class="muted">تُستخدم هذه الإعدادات عند تفعيل إرسال ما بعد البيع من القسم أعلاه. الميزانية تخص أتمتة ما بعد البيع، ضمن حد تطبيق سلة الكلي.</p></section>
<section class="panel"><h3>4. معاينة العملاء والعروض</h3>${d.preview.requires_title_update?'<p>يلزم تحديث المطابقة بالاسم؛ الأرقام أدناه من النسخة السابقة.</p><a class="secondary" href="https://github.com/Anas-mehdy/link-video-shop/blob/main/crm-postpurchase-title-matching.sql" target="_blank" rel="noopener">فتح تحديث SQL</a>':''}<p class="muted">${d.preview.scope==='single_product'?`من ${d.preview.scanned_orders} طلبًا مسلّمًا: ${d.preview.single_product_orders} طلبًا فيه منتج واحد، استبعدنا منها ${d.preview.excluded_bundle_orders} بكجًا و${d.preview.excluded_other_orders||0} منتجًا خارج النطاق${d.preview.excluded_model_orders?`، و${d.preview.excluded_model_orders} طلبًا لـ Fold 8 خارج استهداف هذه المرحلة`:''}. وجدنا عروضًا مكملة لـ ${d.preview.matched_orders} طلبًا${d.preview.matching==='order_title'?` من ${d.preview.target_orders} ضمن الاستهداف. ${d.preview.no_offer_orders} طلبًا بلا منتج مكمل مصنف ومتوفر في الكتالوج المحفوظ، و${d.preview.paused_orders} بلا عرض بسبب الإيقاف`:''}. ${d.preview.unclassified_orders} طلبًا يحتاج تأكيد المنتج. الطلبات متعددة المنتجات خارج الاستهداف.`:`يلزم تطبيق تحديث استهداف المنتج الواحد أولًا. الأرقام الحالية من المعاينة القديمة.`} ${d.preview.schedule_basis==='purchase'?'الموعد من تاريخ الشراء الأصلي؛ الطلبات التي مضى عليها عدد الأيام المحدد تصبح مستحقة الآن إذا كانت مسلّمة. يشمل التحليل آخر 30 يومًا فقط.':'يلزم تطبيق تحديث حساب الموعد من تاريخ الشراء للاستفادة من الطلبات السابقة.'}</p><div class="table-wrap" tabindex="0" role="region" aria-label="جدول بيانات قابل للتمرير أفقيًا"><table><thead><tr><th>العميل / الطلب</th><th>اشترى</th><th>العرض</th><th>يصبح مؤهّلًا بتوقيت السعودية</th><th>النتيجة</th></tr></thead><tbody>${d.preview.rows.map(x=>`<tr><td>${esc(x.customer_name||'بدون اسم')}<br>${esc(x.external_order_id)}</td><td>${esc(x.purchased_name)}</td><td>${esc(x.offer_name||'—')}</td><td>${esc(date(x.scheduled_for))}</td><td>${esc(reasons[x.reason]||x.reason)}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد طلبات ضمن هذا الاستهداف حتى الآن.</td></tr>'}</tbody></table></div></section>`+unmatchedProducts(d.preview);
}
function bind({api,toast,navigate}){bindRedbox(api);bindCashback(api,toast);if(!state.ready)return;
const testForm=document.getElementById('pp-test'),testIds=new Map();
async function refreshDelivery(){
 const box=document.getElementById('pp-delivery-status');if(!box)return;
 try{const r=await api('postpurchase',{method:'POST',body:JSON.stringify({action:'delivery-state'})});if(!box.isConnected)return;box.innerHTML=deliveryReport(r);const badge=document.getElementById('pp-mode-label');if(badge){badge.textContent=r.enabled?'إرسال تلقائي مفعّل':'إرسال ما بعد البيع موقوف';badge.classList.toggle('green',r.enabled===true);badge.classList.toggle('amber',r.enabled!==true);}
 box.querySelector('#pp-lux-toggle')?.addEventListener('click',async e=>{
  const button=e.currentTarget,enabled=!r.lux_enabled;
  if(enabled&&!confirm('تشغيل عرض LUX للزبائن المستحقين، بحد أقصى 20 محاولة يوميًا؟'))return;
  button.disabled=true;
  try{await api('postpurchase',{method:'PUT',body:JSON.stringify({action:'lux-config',enabled,confirm_live:enabled})});await refreshDelivery();toast(enabled?'فُعّل عرض LUX':'أُوقف عرض LUX');}
  catch(err){toast(err.message);button.disabled=false;}
 });
 box.querySelector('#pp-delivery-toggle')?.addEventListener('click',async e=>{
 const enabled=!r.enabled;if(enabled&&!confirm('تشغيل رسائل ما بعد البيع للزبائن المستحقين في المواعيد المحددة، بحد أقصى '+state.settings.batch_limit+' محاولات لكل دفعة؟'))return;
 e.currentTarget.disabled=true;
 try{await api('postpurchase',{method:'PUT',body:JSON.stringify({action:'delivery-config',enabled,confirm_live:enabled})});await refreshDelivery();await reviewEligible();toast(enabled?'فُعّل إرسال ما بعد البيع':'أُوقف إرسال ما بعد البيع');}catch(err){toast(err.message);e.currentTarget.disabled=false;}
 });}catch(err){if(box.isConnected)box.textContent=err.message;}
}
document.getElementById('pp-delivery-refresh')?.addEventListener('click',refreshDelivery);refreshDelivery();

async function reviewEligible(){
 const button=document.getElementById('pp-eligibility-review'),status=document.getElementById('pp-eligibility-status');if(!button||!status)return;
 button.disabled=true;status.textContent='جارٍ مراجعة البيانات المحفوظة؛ دون طلبات سلة أو إرسال رسائل…';
 try{const r=await api('postpurchase',{method:'POST',body:JSON.stringify({action:'eligibility-review'})});if(status.isConnected)status.innerHTML=eligibilityReport(r);}
 catch(e){if(status.isConnected)status.textContent=e.message;}finally{button.disabled=false;}
}
document.getElementById('pp-eligibility-review')?.addEventListener('click',reviewEligible);
reviewEligible();

document.getElementById('pp-stock-check')?.addEventListener('click',async e=>{
 const row=state.preview.rows[Number(testForm.elements.offer.value)],status=document.getElementById('pp-stock-status');
 if(testForm.elements.offer.value===''||!row){status.textContent='اختر عرضًا من القائمة أولًا؛ نفحص المنتجات المكملة لهذا الطلب.';return;}
 const button=e.currentTarget;button.disabled=true;
 status.textContent='جارٍ فحص التوفر؛ النتائج الحديثة تُستخدم دون طلب جديد…';
 let requests=0;
 try{
  for(let step=0;step<30;step++){
   if(!status.isConnected)break;
   const r=await api('postpurchase',{method:'POST',body:JSON.stringify({action:'stock-check',external_order_id:String(row.external_order_id)})});
   requests+=r.salla_requests;
   const labels={available:'متوفر',unavailable:'غير متوفر',error:'تعذر الفحص',busy:'فحص آخر جارٍ',pending:'بانتظار الفحص'};
   const reasons={budget_limit:'توقفنا عند الميزانية الشهرية',provider_error:'توقفنا عند خطأ من سلة؛ لا توجد إعادة تلقائية',busy:'هناك فحص متزامن؛ حاول لاحقًا',retry_later:'ننتظر مهلة إعادة الفحص',not_configured:'إعدادات الفحص غير جاهزة'};
   status.innerHTML=`<p>استهلاك هذا الفحص: ${requests} طلبات سلة · الشهر: ${r.monthly_requests??'—'} / ${r.budget??Math.min(state.settings.stock_api_budget,700)} · بدون إرسال رسائل</p>${r.reason&&reasons[r.reason]?`<p>${reasons[r.reason]}</p>`:''}<div class="table-wrap" tabindex="0" role="region" aria-label="جدول بيانات قابل للتمرير أفقيًا"><table><thead><tr><th>المنتج</th><th>التوفر</th><th>آخر فحص</th></tr></thead><tbody>${r.results.map(x=>`<tr><td>${esc(x.name)}</td><td>${labels[x.status]}</td><td>${esc(date(x.checked_at))}</td></tr>`).join('')}</tbody></table></div>`;
   if(!r.has_more)break;
  }
 }catch(err){status.textContent=err.message;}finally{button.disabled=false;}
});
document.getElementById('pp-landing-link')?.addEventListener('click',async e=>{
 const row=state.preview.rows[Number(testForm.elements.offer.value)],status=document.getElementById('pp-landing-status');
 if(testForm.elements.offer.value===''||!row){status.textContent='اختر عرضًا من القائمة أولًا؛ الصفحة ستجمع جميع المنتجات المكملة للطلب.';return;}
 const b=e.currentTarget;b.disabled=true;status.textContent='جارٍ تجهيز الصفحة من البيانات المحفوظة…';
 try{const r=await api('postpurchase',{method:'POST',body:JSON.stringify({action:'landing-link',external_order_id:String(row.external_order_id)})});
 status.innerHTML=`<a class="secondary" href="${esc(r.path)}" target="_blank" rel="noopener noreferrer">فتح صفحة ${esc(r.model)} · ${r.products} منتجًا</a> <a class="secondary" href="https://linkstore-sa.com/#link-complete=${esc(r.path.split('/').pop())}" target="_blank" rel="noopener noreferrer">فتح صفحة الحماية والإضافة للسلة داخل المتجر</a>`;

 }catch(err){status.textContent=err.message;}finally{b.disabled=false;}
});
testForm?.addEventListener('submit',async e=>{e.preventDefault();const row=state.preview.rows[Number(testForm.elements.offer.value)];if(!row?.offer_product_id)return;
 if(!confirm('إرسال تجربة هذا العرض إلى رقم الاختبار المحفوظ؟ لن تُرسل إلى العميل.'))return;
 const destination=testForm.elements.destination.value;
 const key=row.external_order_id+':'+row.offer_product_id+':'+destination+':protection-v1';
 if(!testIds.has(key))testIds.set(key,crypto.randomUUID());
 const button=testForm.querySelector('button'),status=document.getElementById('pp-test-status');button.disabled=true;status.textContent='جارٍ إرسال تجربة واحدة…';
 try{const r=await api('postpurchase',{method:'POST',body:JSON.stringify({action:'test-send',request_id:testIds.get(key),external_order_id:String(row.external_order_id),offer_product_id:row.offer_product_id,destination,confirm_test:true})});
 status.textContent=r.status==='accepted'?'قبل اتصالنا رسالة الاختبار. تحقق من وصول الصورة وزر الرسالة، ومن فتح الوجهة التي اخترتها على واتساب.':r.status==='rejected'?'رفض المزود الرسالة · الرمز '+r.provider_code:r.status==='duplicate'?r.reason:'نتيجة الإرسال غير مؤكدة؛ لن نعيد المحاولة تلقائيًا.';
 }catch(err){status.textContent=err.message;}finally{button.disabled=false;}
});
 document.getElementById('pp-copy-unmatched')?.addEventListener('click',async()=>{
  const text=JSON.stringify(state.preview.unmatched_products||[],null,2);
  try{await navigator.clipboard.writeText(text);toast('تم نسخ أسماء المنتجات وأسباب عدم المطابقة');}
  catch{const box=document.getElementById('pp-unmatched-copy');box.value=text;box.hidden=false;box.focus();box.select();toast('حدّد القائمة وانسخها');}
 });
async function save(form,method,body){const btn=form.querySelector('button');btn.disabled=true;try{await api('postpurchase',{method,body:JSON.stringify(body)});await navigate('postpurchase');toast('تم حفظ الإعدادات');}catch(e){toast(e.message);btn.disabled=false;}}
document.getElementById('pp-auto-analyze')?.addEventListener('click',async e=>{const b=e.currentTarget,target=document.getElementById('pp-auto-progress');b.disabled=true;b.textContent='جارٍ التحليل المحلي…';target.textContent='جارٍ تحليل المنتجات المحفوظة؛ بدون طلبات سلة…';try{const r=await api('postpurchase',{method:'POST',body:JSON.stringify({action:'analyze'})});analysisStatus=r.deferred?'استكمل جلب الكتالوج قبل إعادة التحليل':`اكتمل التحليل المحلي · ${r.auto} واضحًا · ${r.review} للمراجعة · ${r.excluded} مستبعدًا · 0 طلبات سلة`;await navigate('postpurchase');toast(r.deferred?'استكمل جلب الكتالوج قبل إعادة التحليل':'اكتمل التحليل المحلي');}catch(err){analysisStatus='لم يكتمل التحليل: '+err.message;if(target.isConnected)target.textContent=analysisStatus;toast(err.message);b.disabled=false;b.textContent='إعادة التحليل المحلي · 0 طلبات سلة';}});
document.getElementById('pp-auto-import')?.addEventListener('click',async e=>{const b=e.currentTarget,target=document.getElementById('pp-auto-progress');b.disabled=true;document.getElementById('pp-auto-analyze').disabled=true;let completed=false;try{for(let step=0;step<10;step++){if(!target.isConnected)break;const r=await api('postpurchase',{method:'POST',body:JSON.stringify({action:'import',refresh:step===0})});target.textContent=r.page?`حُفظت صفحة ${r.page} · الاستهلاك ${r.requests} / 20 طلبًا`:{cached:'الكتالوج محفوظ حديثًا؛ لا حاجة لطلب جديد',busy:'هناك جلب آخر قيد التشغيل',budget_limit:'وصلنا لحد الجلب؛ توقف بدون طلبات إضافية'}[r.reason]||'';if(r.done){completed=!r.reason||r.reason==='cached';break;}}if(completed){await api('postpurchase',{method:'POST',body:JSON.stringify({action:'analyze'})});toast('تم تجهيز الكتالوج وتوليد الربط');}else toast('توقف الجلب ضمن الحد؛ يمكنك متابعة الصفحات المتبقية');await navigate('postpurchase');}catch(err){toast(err.message);if(b.isConnected){b.disabled=false;document.getElementById('pp-auto-analyze').disabled=false;target.textContent=err.message;}}});
const product=document.getElementById('pp-product');function fill(p){document.getElementById('pp-manual').open=true;for(const k of ['product_id','variant_id','name','model','product_url'])product.elements[k].value=p[k]||'';product.querySelectorAll('[name=components]').forEach(c=>c.checked=(p.components||[]).includes(c.value));}
document.querySelectorAll('[data-pp-review]').forEach(b=>b.addEventListener('click',()=>{const x=state.automatic.suggestions.find(x=>x.product_id===b.dataset.ppReview&&x.variant_id==='');fill({...x.suggestion,product_id:x.product_id,variant_id:x.variant_id,name:x.name});product.scrollIntoView({behavior:'smooth',block:'center'});}));
document.getElementById('pp-catalog').addEventListener('change',e=>{if(e.target.value!=='')fill(state.catalog[Number(e.target.value)]);});
document.querySelectorAll('[data-pp-edit]').forEach(b=>b.addEventListener('click',()=>{fill(state.products[Number(b.dataset.ppEdit)]);product.scrollIntoView({behavior:'smooth',block:'center'});}));
product.addEventListener('submit',e=>{e.preventDefault();const b=Object.fromEntries(new FormData(product));b.components=[...product.querySelectorAll('[name=components]:checked')].map(x=>x.value);save(product,'PUT',{...b,action:'product'});});
const rule=document.getElementById('pp-rule');rule.addEventListener('submit',e=>{e.preventDefault();const t=state.products[Number(rule.elements.trigger.value)],f=state.products[Number(rule.elements.offer.value)];save(rule,'POST',{action:'rule',name:rule.elements.name.value,trigger_product_id:t.product_id,trigger_variant_id:t.variant_id,offer_product_id:f.product_id,offer_variant_id:f.variant_id});});
document.querySelectorAll('[data-pp-rule]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{const r=state.rules.find(x=>x.id===b.dataset.ppRule);await api('postpurchase',{method:'PATCH',body:JSON.stringify({action:'rule',id:r.id,active:!r.active})});await navigate('postpurchase');}catch(e){toast(e.message);b.disabled=false;}}));
const settings=document.getElementById('pp-settings');settings.addEventListener('submit',e=>{e.preventDefault();const b={action:'settings',mode:'preview'};for(const k of ['delay_days','batch_limit','cooldown_days','stock_api_budget'])b[k]=Number(settings.elements[k].value);b.batch_hours=settings.elements.batch_hours.value.split(',').map(x=>x.trim()).map(x=>/^\d{1,2}$/.test(x)?Number(x):NaN);save(settings,'PUT',b);});
}
window.LinkPostPurchase={render,bind};})();

