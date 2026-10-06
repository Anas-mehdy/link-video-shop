(() => {
  'use strict';
  // Reporting is fetched by the authenticated backend; no platform credentials reach this page.
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
  const reports=new Map();
  const keys=['spend','impressions','clicks','ctr','cpc','cpm','purchases','purchase_value','roas'];
  const format=value=>value==null?'—':Number(value).toLocaleString('ar-SA',{maximumFractionDigits:2});
  const reportKey=()=>`${state.from}|${state.to}`;
  function current(){return reports.get(reportKey());}
  async function load(token){
    if(['all','snapchat'].includes(state.provider)){
      const key=reportKey(),from=state.from,to=state.to,cached=reports.get(key);
      if(!cached||Date.now()-cached.at>60000){
        try{
          const response=await window.LinkAuth.fetch(`/api/snapchat-connect?${new URLSearchParams({action:'report',from,to})}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
          const data=await response.json();
          if(!response.ok||!data.ok)throw new Error(data.error||'تعذر تحميل تقرير سناب');
          reports.set(key,{at:Date.now(),data});
        }catch(e){reports.set(key,{at:Date.now(),error:e.message});}
      }
    }
    return render();
  }
  function chart(report){
    const days=report.daily,values=days.map(d=>d[state.chart]),valid=values.filter(v=>v!==null),max=Math.max(1,...valid);
    if(!valid.length)return '<div class="ads-chart-empty"><div><h3>لا توجد بيانات لهذا المؤشر</h3></div></div>';
    let path='',open=false;
    const points=days.map((d,i)=>{const value=d[state.chart];if(value===null){open=false;return '';}
      const x=days.length===1?320:25+i/(days.length-1)*590,y=160-value/max*130;
      path+=`${open?'L':'M'}${x.toFixed(2)},${y.toFixed(2)} `;open=true;
      return `<circle cx="${x}" cy="${y}" r="3" fill="#c5a0ff"><title>${esc(d.date)}: ${format(value)}</title></circle>`;});
    return `<svg class="ads-chart-svg" viewBox="0 0 640 190" style="width:100%;height:auto" role="img" aria-label="الأداء اليومي؛ القيم التفصيلية في الجدول أدناه"><path d="M25 160H615" stroke="#3a3f53"/><path d="${path}" fill="none" stroke="#c5a0ff" stroke-width="2"/>${points.join('')}</svg><details><summary>التفصيل اليومي</summary><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الإنفاق</th><th>الظهور</th><th>النقرات / Swipes</th><th>المشتريات</th><th>قيمتها</th><th>ROAS</th></tr></thead><tbody>${days.map(d=>`<tr><td>${esc(d.date)}</td>${['spend','impressions','clicks','purchases','purchase_value','roas'].map(k=>`<td>${format(d[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  function render() {
    const snapshot=['all','snapchat'].includes(state.provider)?current():null,report=snapshot?.data,status=report?.status,live=['all','snapchat'].includes(state.provider)&&status==='ready',currency=live?report.account.currency:'—';
    const selected=state.provider==='all' ? Object.keys(providers) : [state.provider];
    const label=state.provider==='all' ? 'كل المنصات' : providers[state.provider][0];
    const days=Math.round((new Date(state.to)-new Date(state.from))/86400000)+1;
    const range=`${readable(state.from)} — ${readable(state.to)}`;
    return `<div class="page-heading"><div><h1>إحصائيات الإعلانات</h1><p class="muted">تابع الإنفاق والنتائج، وقارن أداء المنصات خلال الفترة التي تختارها.</p></div><span class="badge ${live?'green':'amber'}">${live?'بيانات سناب':'بانتظار البيانات'}</span></div>
      <div class="ads-platform-tabs" role="group" aria-label="عرض إحصائيات المنصة">${[['all','كل المنصات','∑'],...Object.entries(providers).map(([id,[name,,icon]])=>[id,name,icon])].map(([id,name,icon])=>`<button type="button" data-ads-provider="${id}" aria-pressed="${state.provider===id}"><span class="integration-icon ${id}" aria-hidden="true">${icon}</span><span>${name}</span>${id==='meta'||id==='tiktok'?'<small>لم يُربط بعد</small>':''}</button>`).join('')}</div>
      <section class="panel ads-filters"><form id="ads-filters" class="form-row">
        <div class="form-field"><label for="ads-preset">الفترة</label><select id="ads-preset" name="preset">${presets.map(([id,name])=>`<option value="${id}" ${state.preset===id?'selected':''}>${name}</option>`).join('')}</select></div>
        <div class="form-field"><label for="ads-from">من تاريخ</label><input id="ads-from" name="from" type="date" value="${state.from}" max="${today()}" required></div>
        <div class="form-field"><label for="ads-to">إلى تاريخ</label><input id="ads-to" name="to" type="date" value="${state.to}" max="${today()}" required></div>
        <div class="form-field"><label for="ads-provider">المنصة</label><select id="ads-provider" name="provider"><option value="all">كل المنصات</option>${Object.entries(providers).map(([id,[name]])=>`<option value="${id}" ${state.provider===id?'selected':''}>${name}</option>`).join('')}</select></div>
        <button class="primary" type="submit">تطبيق الفلاتر</button>
      </form><p id="ads-filter-error" class="error" role="alert" hidden></p></section>
      <div class="ads-report-caption"><div><b>${label}</b><span>${range} · ${days.toLocaleString('ar-SA')} ${days===1?'يوم':'أيام'}</span></div><small>آخر تحديث: ${live?new Date(report.updated_at).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'}):'لم تصل بيانات بعد'}</small></div>
      <div class="notice ads-setup-notice"><div><b>${live?'تقرير الحساب: '+esc(report.account.name):'تجهيز مصدر الإحصائيات'}</b><p>${live?`العملة: ${esc(currency)} · توقيت الحساب: ${esc(report.account.timezone)}. ${state.provider==='all'?'الإجماليات الحالية تخص سناب فقط؛ المنصات الأخرى لم تُربط.':''} ${report.complete?'':'بعض الأيام غير متاحة؛ علامة — تعني بيانات ناقصة.'}`:esc(snapshot?.error|| (status==='select_account'?'اختر حساب سناب الإعلاني من صفحة التكاملات أولاً.':(['meta','tiktok'].includes(state.provider)?'هذه المنصة لم تُربط بعد؛ ستظهر إحصائياتها بعد إتمام الربط.':'اختر المنصة المربوطة لعرض إحصائياتها.')))}</p></div><button class="secondary" id="ads-integrations">حالة التكاملات ↗</button></div>
      <section class="ads-metrics" aria-label="مؤشرات أداء الإعلانات">${metrics.map(([name,description,unit],i)=>`<article class="metric"><div class="metric-top"><span>${name}</span>${unit?`<small class="ads-unit">${unit==='ر.س'?esc(currency):unit}</small>`:''}</div><strong>${live?format(report.totals[keys[i]]):'—'}</strong><small>${description}</small></article>`).join('')}</section>
      <section class="panel"><div class="panel-header ads-chart-header"><div><h3>الأداء اليومي</h3><p class="muted">${range}</p></div><div class="ads-chart-tabs" role="group" aria-label="المؤشر المعروض"><button type="button" data-ads-chart="spend" aria-pressed="${state.chart==='spend'}">الإنفاق</button><button type="button" data-ads-chart="purchases" aria-pressed="${state.chart==='purchases'}">المشتريات</button><button type="button" data-ads-chart="roas" aria-pressed="${state.chart==='roas'}">ROAS</button></div></div>
      ${live?chart(report):`<div class="ads-chart-empty"><div><span class="ads-chart-symbol" aria-hidden="true">↗</span><h3>بانتظار بيانات ${state.chart==='spend'?'الإنفاق':state.chart==='purchases'?'المشتريات':'العائد'}</h3><p>ستظهر بعد اختيار الحساب الإعلاني.</p></div></div>`}<div class="ads-chart-dates" dir="ltr"><span>${esc(state.from)}</span><span>${esc(state.to)}</span></div></section>
      <section class="panel"><div class="panel-header"><h3>مقارنة المنصات</h3><span class="badge">${label}</span></div><div class="table-wrap"><table class="ads-comparison"><thead><tr><th>المنصة</th><th>الإنفاق</th><th>الظهور</th><th>النقرات</th><th>CTR</th><th>CPC</th><th>CPM</th><th>المشتريات</th><th>قيمتها</th><th>ROAS</th><th>حالة البيانات</th></tr></thead><tbody>${selected.map(id=>`<tr><td><div class="ads-platform-name"><span class="integration-icon ${id}">${providers[id][2]}</span><div><b>${providers[id][0]}</b><small>${providers[id][1]}</small></div></div></td>${keys.map(k=>`<td>${id==='snapchat'&&live?format(report.totals[k]):'—'}</td>`).join('')}<td><span class="badge">${id==='snapchat'&&live?'بيانات مباشرة · '+esc(currency):id==='snapchat'?'بانتظار البيانات':'لم يُربط بعد'}</span></td></tr>`).join('')}</tbody></table></div></section>
      <div class="ads-notes"><p><b>عن هذه الأرقام</b> · المشتريات وROAS هنا يعتمدان على إسناد كل منصة؛ قد تنسب أكثر من منصة الطلب نفسه لنفسها. مبيعات المتجر الفعلية ستظهر منفصلة بعد ربط سلة.</p><p>التواريخ تشمل يوم البداية والنهاية. تجميع الأيام بحسب توقيت الحساب الإعلاني. أوقات التحديث تُعرض بتوقيت السعودية. قيم الإنفاق والمشتريات بعملة الحساب دون تحويل. نقرات سناب هنا هي Swipes. إسناد سناب: 28 يوماً للنقر ويوم واحد للمشاهدة، حسب وقت التحويل. بيانات الأيام الأخيرة قد تتغير.</p></div>`;
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
    document.querySelectorAll('[data-ads-provider]').forEach(button=>button.addEventListener('click',()=>{state.provider=button.dataset.adsProvider;navigate('ads');}));
    document.getElementById('ads-integrations').addEventListener('click',()=>navigate('integrations'));
    document.querySelectorAll('[data-ads-chart]').forEach(button=>button.addEventListener('click',()=>{state.chart=button.dataset.adsChart;navigate('ads');}));
  }
  window.LinkAds={render,bind,load,invalidate:()=>reports.clear()};
})();
