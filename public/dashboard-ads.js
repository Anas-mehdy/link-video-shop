(() => {
  'use strict';
  // UI only for now. Platform authorization and the reporting source come next.
  const providers = { meta:['Meta','فيسبوك وإنستغرام','∞'], tiktok:['TikTok','تيك توك','♪'], snapchat:['Snapchat','سناب شات','S'] };
  const presets = [['today','اليوم'],['yesterday','أمس'],['last7','آخر 7 أيام'],['last30','آخر 30 يومًا'],['month','هذا الشهر'],['custom','فترة مخصصة']];
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const shift = (day, count) => {const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);};
  const readable = day => new Date(`${day}T12:00:00Z`).toLocaleDateString('ar-SA-u-ca-gregory',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Riyadh'});
  function period(preset) {
    const end=today();
    if(preset==='today')return {from:end,to:end};
    if(preset==='yesterday')return {from:shift(end,-1),to:shift(end,-1)};
    if(preset==='last7')return {from:shift(end,-6),to:end};
    if(preset==='last30')return {from:shift(end,-29),to:end};
    if(preset==='month')return {from:`${end.slice(0,7)}-01`,to:end};
    return null;
  }
  let state={provider:'all',preset:'last7',...period('last7'),chart:'spend'};
  const metrics=[
    ['الإنفاق الإعلاني','المبلغ المنفق خلال الفترة','ر.س'],
    ['مرات الظهور','عدد مرات عرض الإعلانات',''],
    ['النقرات','حسب تعريف النقر لكل منصة',''],
    ['معدل النقر CTR','النقرات ÷ مرات الظهور','%'],
    ['تكلفة النقرة CPC','الإنفاق ÷ النقرات','ر.س'],
    ['تكلفة الألف CPM','الإنفاق لكل ألف ظهور','ر.س'],
    ['المشتريات المنسوبة','كما تنسبها المنصة للإعلانات',''],
    ['قيمة المشتريات','القيمة التي تبلغ عنها المنصة','ر.س'],
    ['العائد ROAS','قيمة المشتريات ÷ الإنفاق','×'],
  ];
  function render() {
    const selected=state.provider==='all' ? Object.keys(providers) : [state.provider];
    const label=state.provider==='all' ? 'كل المنصات' : providers[state.provider][0];
    const days=Math.round((new Date(state.to)-new Date(state.from))/86400000)+1;
    const range=`${readable(state.from)} — ${readable(state.to)}`;
    return `<div class="page-heading"><div><h1>إحصائيات الإعلانات</h1><p class="muted">تابع الإنفاق والنتائج، وقارن أداء المنصات خلال الفترة التي تختارها.</p></div><span class="badge amber">بانتظار الربط</span></div>
      <section class="panel ads-filters"><form id="ads-filters" class="form-row">
        <div class="form-field"><label for="ads-preset">الفترة</label><select id="ads-preset" name="preset">${presets.map(([id,name])=>`<option value="${id}" ${state.preset===id?'selected':''}>${name}</option>`).join('')}</select></div>
        <div class="form-field"><label for="ads-from">من تاريخ</label><input id="ads-from" name="from" type="date" value="${state.from}" max="${today()}" required></div>
        <div class="form-field"><label for="ads-to">إلى تاريخ</label><input id="ads-to" name="to" type="date" value="${state.to}" max="${today()}" required></div>
        <div class="form-field"><label for="ads-provider">المنصة</label><select id="ads-provider" name="provider"><option value="all">كل المنصات</option>${Object.entries(providers).map(([id,[name]])=>`<option value="${id}" ${state.provider===id?'selected':''}>${name}</option>`).join('')}</select></div>
        <button class="primary" type="submit">تطبيق الفلاتر</button>
      </form><p id="ads-filter-error" class="error" role="alert" hidden></p></section>
      <div class="ads-report-caption"><div><b>${label}</b><span>${range} · ${days.toLocaleString('ar-SA')} ${days===1?'يوم':'أيام'}</span></div><small>آخر تحديث: لم تصل بيانات بعد</small></div>
      <div class="notice ads-setup-notice"><div><b>مساحة تقاريرك جاهزة</b><p>نربط الحسابات الإعلانية في الخطوة التالية لتظهر الإحصائيات هنا تلقائيًا. علامة — تعني أن البيانات لم تصل بعد.</p></div><button class="secondary" id="ads-integrations">حالة التكاملات ↗</button></div>
      <section class="ads-metrics" aria-label="مؤشرات أداء الإعلانات">${metrics.map(([name,description,unit])=>`<article class="metric"><div class="metric-top"><span>${name}</span>${unit?`<small class="ads-unit">${unit}</small>`:''}</div><strong aria-label="لا توجد بيانات">—</strong><small>${description}</small></article>`).join('')}</section>
      <section class="panel"><div class="panel-header ads-chart-header"><div><h3>الأداء اليومي</h3><p class="muted">${range}</p></div><div class="ads-chart-tabs" role="group" aria-label="المؤشر المعروض"><button type="button" data-ads-chart="spend" aria-pressed="${state.chart==='spend'}">الإنفاق</button><button type="button" data-ads-chart="purchases" aria-pressed="${state.chart==='purchases'}">المشتريات</button><button type="button" data-ads-chart="roas" aria-pressed="${state.chart==='roas'}">ROAS</button></div></div>
      <div class="ads-chart-empty"><div><span class="ads-chart-symbol" aria-hidden="true">↗</span><h3>بانتظار بيانات ${state.chart==='spend'?'الإنفاق':state.chart==='purchases'?'المشتريات':'العائد'}</h3><p>سيظهر التغيّر اليومي هنا بعد ربط ${label}.</p></div></div><div class="ads-chart-dates" dir="ltr"><span>${esc(state.from)}</span><span>${esc(state.to)}</span></div></section>
      <section class="panel"><div class="panel-header"><h3>مقارنة المنصات</h3><span class="badge">${label}</span></div><div class="table-wrap"><table class="ads-comparison"><thead><tr><th>المنصة</th><th>الإنفاق</th><th>الظهور</th><th>النقرات</th><th>CTR</th><th>CPC</th><th>CPM</th><th>المشتريات</th><th>قيمتها</th><th>ROAS</th><th>حالة البيانات</th></tr></thead><tbody>${selected.map(id=>`<tr><td><div class="ads-platform-name"><span class="integration-icon ${id}">${providers[id][2]}</span><div><b>${providers[id][0]}</b><small>${providers[id][1]}</small></div></div></td>${Array.from({length:9},()=>'<td>—</td>').join('')}<td><span class="badge">لم يُربط بعد</span></td></tr>`).join('')}</tbody></table></div></section>
      <div class="ads-notes"><p><b>عن هذه الأرقام</b> · المشتريات وROAS هنا يعتمدان على إسناد كل منصة؛ قد تنسب أكثر من منصة الطلب نفسه لنفسها. مبيعات المتجر الفعلية ستظهر منفصلة بعد ربط سلة.</p><p>التواريخ تشمل يوم البداية والنهاية. المنطقة الزمنية للعرض: السعودية. سنوضح العملة والمنطقة الزمنية للحسابات عند الربط.</p></div>`;
  }
  function bind({navigate,toast}) {
    const form=document.getElementById('ads-filters');
    form.elements.preset.addEventListener('change',()=>{const range=period(form.elements.preset.value);if(range){form.elements.from.value=range.from;form.elements.to.value=range.to;}});
    for(const name of ['from','to'])form.elements[name].addEventListener('change',()=>{form.elements.preset.value='custom';});
    form.addEventListener('submit',e=>{
      e.preventDefault();const from=form.elements.from.value,to=form.elements.to.value;
      const valid=day=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
      const error=document.getElementById('ads-filter-error');
      if(!valid(from)||!valid(to)||from>to||to>today()){error.hidden=false;error.textContent='اختر فترة صحيحة: تاريخ البداية قبل النهاية أو يساويها، ولا تتجاوز اليوم.';return;}
      state={...state,from,to,preset:form.elements.preset.value,provider:form.elements.provider.value};
      navigate('ads');toast('تم تطبيق الفترة والمنصة');
    });
    document.getElementById('ads-integrations').addEventListener('click',()=>navigate('integrations'));
    document.querySelectorAll('[data-ads-chart]').forEach(button=>button.addEventListener('click',()=>{state.chart=button.dataset.adsChart;navigate('ads');}));
  }
  window.LinkAds={render,bind};
})();
