(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const paths = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3"/>',
    customers: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0112 0v3M16 5a3 3 0 010 6M21 21v-3a6 6 0 00-3-5"/>',
    carts: '<path d="M3 3h2l3 12h11l2-8H6M9 20h.01M18 20h.01"/>',
    ads: '<path d="M4 20h16M6 16V9M12 16V4M18 16v-5"/>',
    automations: '<path d="M13 2L4 14h7l-1 8 10-13h-7z"/>',
    integrations: '<path d="M9 7H7a5 5 0 000 10h2M15 7h2a5 5 0 010 10h-2M8 12h8"/>',
    events: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
    videos: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M10 8l6 4-6 4z"/>',
    protection: '<path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  };
  const pages = [['overview','نظرة عامة'],['orders','الطلبات'],['customers','العملاء'],['carts','السلات المتروكة'],['ads','إحصائيات الإعلانات'],['automations','الأتمتة'],['integrations','التكاملات'],['events','سجل الأحداث'],['videos','الفيديو شوب'],['protection','حماية الهاتف'],['settings','الإعدادات']];
  const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.overview}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => value == null ? '—' : Number(value).toLocaleString('ar-SA');
  const date = value => value ? new Date(value).toLocaleString('ar-SA', { dateStyle:'short', timeStyle:'short', timeZone:'Asia/Riyadh' }) : 'لم يصل بعد';
  let token = sessionStorage.getItem('lvs_admin') || '', page = 'overview', overview = null, requestId = 0;
  const recordState = Object.fromEntries(['orders','customers','carts'].map(key => [key,{page:1,search:''}]));
  const money = (value, currency) => `${fmt(value)} ${esc(currency || '—')}`;
  async function api(resource, options = {}) {
    const res = await fetch(`/api/crm-admin?resource=${resource}`, { ...options, headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, cache:'no-store' });
    let data;
    try { data = await res.json(); } catch { throw new Error('تعذر قراءة استجابة الخادم'); }
    if (res.status === 401) { token = ''; sessionStorage.removeItem('lvs_admin'); $('app').hidden = true; $('login').hidden = false; throw new Error('رمز الإدارة غير صحيح أو انتهت الجلسة'); }
    if (!res.ok || !data.ok) throw new Error(data.error || 'تعذر تحميل البيانات');
    return data;
  }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { $('toast').hidden = true; }, 5000); }
  function heading(title, description, action = '') { return `<div class="page-heading"><div><h1>${title}</h1><p class="muted">${description}</p></div>${action}</div>`; }
  function empty(title, description, icon = 'events') { return `<div class="empty">${svg(icon)}<h3>${title}</h3><p>${description}</p></div>`; }
  function eventTable(events) {
    if (!events?.length) return empty('بانتظار أول حدث', 'ستظهر أحداث المتجر هنا بعد تفعيل الربط واستقبالها.');
    return `<div class="table-wrap"><table><thead><tr><th>الحدث</th><th>الحالة</th><th>وقت الاستقبال</th></tr></thead><tbody>${events.map(e => `<tr><td><code dir="ltr">${esc(e.event_name)}</code></td><td><span class="badge ${e.status === 'processed' ? 'green' : 'amber'}">${e.status === 'processed' ? 'تمت المعالجة' : 'بانتظار المعالجة'}</span></td><td>${date(e.received_at)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const providerInfo = {
    salla:['سلة','المتجر والطلبات والعملاء','S'], meta:['Meta','فيسبوك وإنستغرام','∞'], tiktok:['TikTok','الإعلانات والمحتوى','♪'], snapchat:['Snapchat','الإعلانات والتحويلات','S'], whatsapp:['WhatsApp','المحادثات والمتابعة','W'],
  };
  function connectionRows(connections) {
    return Object.entries(providerInfo).map(([provider, [name, description, letter]]) => {
      const c = connections?.find(c => c.provider === provider);
      const expired = c?.status === 'connected' && c.token_expires_at && new Date(c.token_expires_at) <= new Date();
      const connected = c?.status === 'connected' && !expired;
      const status = expired ? 'يحتاج تجديدًا' : connected ? 'متصل' : c?.status === 'revoked' ? 'أُلغي الربط' : provider === 'salla' ? 'بانتظار التفويض' : 'لم يُربط بعد';
      return `<div class="integration-row"><div class="integration-icon ${provider}">${letter}</div><div class="integration-info"><b>${name}</b><small>${description}</small></div><span class="badge ${connected ? 'green' : expired ? 'amber' : ''}">${status}</span></div>`;
    }).join('');
  }
  function home(result) {
    const d = result.data, salla = d.connections?.find(c => c.provider === 'salla');
    const connected = salla?.status === 'connected' && (!salla.token_expires_at || new Date(salla.token_expires_at) > new Date());
    const metrics = [['الطلبات',d.orders,'الطلبات المسجلة في قاعدة البيانات','orders'],['العملاء',d.customers,'العملاء المسجلون في قاعدة البيانات','customers'],['السلات المتروكة',d.carts,'كل السلات المسجلة، بجميع حالاتها','carts'],['المنتجات',d.products,'من كتالوج المتجر الحالي','carts'],['الفيديوهات',d.videos,'فيديوهات المتجر المسجلة','videos'],['قواعد الأتمتة',d.rules?.length,'تُشغّل في وضع الاختبار فقط','automations'],['سلة',null,connected ? 'وصل تفويض المتجر' : 'بانتظار تفعيل التطبيق','integrations']];
    return heading('نظرة عامة','مرحبًا بك في مساحة لنك. هنا تبدأ متابعة متجرك.', '<button class="secondary" data-page="integrations">إدارة التكاملات ↗</button>') +
      `<section class="welcome"><div><span class="eyebrow" style="color:#d7bde5">مساحة لنك الجديدة</span><h2>كل التفاصيل، أقرب إليك.</h2><p>أساس واحد يجمع إدارة الفيديوهات، أحداث المتجر، وقواعد المتابعة. نجهّز البيت لاستقبال بيانات سلة، ثم نوسّعه مع نمو متجرك.</p></div><button class="secondary" data-page="automations">استكشف الأتمتة ←</button></section>` +
      (result.unavailable.length ? `<div class="notice warn">بعض البيانات غير متاحة حاليًا. ${result.unavailable.some(k => ['connections','events','rules'].includes(k)) ? 'تأكد من إعداد قاعدة بيانات اللوحة الجديدة.' : 'تحقق من اتصال قاعدة البيانات.'} الأرقام غير المتاحة تظهر بعلامة —.</div>` : '') +
      `<section class="metrics">${metrics.map(([label,value,sub,icon]) => `<div class="metric"><div class="metric-top"><span>${label}</span><span class="metric-icon">${svg(icon)}</span></div><strong>${label === 'سلة' ? `<span style="font-size:20px">${connected ? 'متصل' : 'بانتظار الربط'}</span>` : fmt(value)}</strong><small>${sub}</small></div>`).join('')}</section>` +
      `<div class="columns"><div><section class="panel"><div class="panel-header"><h3>آخر أحداث المتجر</h3><button class="text-button" data-page="events">عرض السجل ←</button></div>${d.events === null ? empty('السجل غير متاح','لم يكتمل إعداد سجل الأحداث بعد.') : eventTable(d.events)}</section><section class="panel"><div class="panel-header"><h3>أدوات المتجر</h3><span class="badge green">متاحة الآن</span></div><div class="form-row"><button class="secondary" data-page="videos">${svg('videos')} إدارة الفيديو شوب</button><button class="secondary" data-page="protection">${svg('protection')} إدارة حماية الهاتف</button></div></section></div><div><section class="panel"><div class="panel-header"><h3>حالة التكاملات</h3><span class="badge">${fmt(d.connections?.filter(c => c.status === 'connected' && (!c.token_expires_at || new Date(c.token_expires_at) > new Date())).length ?? 0)} متصل</span></div>${connectionRows(d.connections)}</section><section class="panel"><h3>خطوات الانطلاق</h3><div class="step done"><span class="step-number">✓</span><div><b>تجهيز مساحة الإدارة</b><small>الفيديو شوب والحماية داخل لوحة واحدة.</small></div></div><div class="step ${connected ? 'done' : ''}"><span class="step-number">${connected ? '✓' : '2'}</span><div><b>ربط تطبيق سلة</b><small>نستقبل التفويض والأحداث بعد إتمام التثبيت.</small></div></div><div class="step"><span class="step-number">3</span><div><b>تجربة الأتمتة ثم تشغيلها</b><small>نراجع نتائج الاختبار قبل ربط الإرسال الفعلي.</small></div></div></section></div></div>`;
  }
  function rulesView(rules) {
    return heading('الأتمتة','قواعد متابعة المتجر، من الحدث إلى الإجراء.', '<button class="secondary" id="process-events">اختبار الأحداث المعلقة</button>') +
      '<div class="notice">وضع الاختبار: تفعيل القاعدة يسجّل نتيجة محاكاة فقط. لا تُرسل رسائل ولا تُنفّذ تغييرات على المتجر. مدة الانتظار تظهر كتوقيت مقترح في سجل الاختبار.</div>' +
      `<div class="rule-grid">${rules.map(r => `<form class="rule-card" data-rule="${esc(r.id)}"><div class="rule-top"><div><h3>${esc(r.name)}</h3><code dir="ltr">${esc(r.event_name)}</code></div><span class="badge">اختبار فقط</span></div><p class="muted">عند وصول الحدث، نختبر القاعدة ونسجّل النتيجة.</p><div class="rule-edit"><label class="switch"><input name="enabled" type="checkbox" ${r.enabled ? 'checked' : ''}> تفعيل الاختبار</label><label>بعد <input name="delay" aria-label="مدة الانتظار بالدقائق" type="number" min="0" max="10080" value="${r.delay_minutes}" required> دقيقة</label><button class="primary" type="submit">حفظ</button></div></form>`).join('') || `<section class="panel">${empty('لا توجد قواعد','أضف أول قاعدة من النموذج أدناه.','automations')}</section>`}</div>` +
      '<section class="panel" style="margin-top:22px"><h3>إضافة قاعدة</h3><form id="new-rule" class="form-row"><div class="form-field"><label for="rule-name">اسم القاعدة</label><input id="rule-name" name="name" maxlength="100" required placeholder="مثال: متابعة العميل الجديد"></div><div class="form-field"><label for="rule-event">الحدث</label><select id="rule-event" name="event"><option value="abandoned.cart">سلة متروكة</option><option value="order.created">طلب جديد</option><option value="order.status.updated">تغيير حالة طلب</option><option value="customer.created">عميل جديد</option></select></div><div class="form-field short"><label for="rule-delay">الانتظار بالدقائق</label><input id="rule-delay" name="delay" type="number" min="0" max="10080" value="60" required></div><button class="primary" type="submit">إضافة القاعدة</button></form></section><section class="panel"><div class="panel-header"><h3>نتائج الاختبار</h3><button class="text-button" id="load-runs">عرض النتائج ←</button></div><div id="runs">اضغط عرض النتائج للاطلاع على سجل المحاكاة.</div></section>';
  }
  function recordsView(resource, result) {
    const state=recordState[resource], title=pages.find(([id])=>id===resource)[1];
    const customerName = r => r.name || [r.first_name,r.last_name].filter(Boolean).join(' ') || '—';
    const schema = {
      orders: { headers:['رقم الطلب','الحالة','الدفع','طريقة الدفع','الإجمالي','تاريخ الطلب'], cells:r=>[esc(r.order_reference || r.external_order_id),esc(r.status || r.status_slug || '—'),esc(r.payment_status || '—'),esc(r.payment_method || '—'),money(r.total_amount,r.currency),date(r.ordered_at)] },
      customers: { headers:['العميل','الهاتف','البريد الإلكتروني','المدينة','عدد الطلبات','آخر طلب'], cells:r=>[esc(customerName(r)),`<span dir="ltr">${esc(r.phone || '—')}</span>`,esc(r.email || '—'),esc(r.city || '—'),fmt(r.orders_count),date(r.last_order_at)] },
      carts: { headers:['السلة','العميل','الهاتف','الحالة','عدد المنتجات','الإجمالي','تاريخ الترك','آخر متابعة'], cells:r=>[esc(r.external_cart_id),esc(r.customer_name || '—'),`<span dir="ltr">${esc(r.phone || '—')}</span>`,esc(r.status),fmt(r.items_count),money(r.total_amount,r.currency),date(r.abandoned_at),date(r.last_contact_at)] },
    }[resource];
    const placeholder = resource==='orders' ? 'رقم الطلب أو مرجعه' : 'الاسم أو الهاتف أو البريد أو المعرّف';
    const table = result.records.length ? `<div class="table-wrap"><table><thead><tr>${schema.headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${result.records.map(r=>`<tr>${schema.cells(r).map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty(state.search ? 'لا توجد نتائج مطابقة' : 'لا توجد سجلات بعد',state.search ? 'جرّب اسمًا أو رقمًا آخر، أو امسح البحث.' : 'ستظهر البيانات المسجلة هنا عند وصولها إلى قاعدة البيانات.',resource);
    return heading(title,'عرض البيانات الحالية المسجلة في المتجر.') + '<div class="notice">نعرض السجلات الموجودة في قاعدة البيانات. استقبال أحداث سلة وتجهيز المزامنة لا يزالان قيد الإعداد.</div>' +
      `<section class="panel"><form id="records-search" class="form-row"><div class="form-field"><label for="search-term">البحث</label><input id="search-term" name="search" maxlength="100" value="${esc(state.search)}" placeholder="${placeholder}"></div><button class="primary" type="submit">بحث</button><button class="secondary" type="button" id="clear-search">مسح البحث</button></form></section><section class="panel">${table}<div class="records-pagination"><button class="secondary" id="records-prev" ${result.page===1 ? 'disabled' : ''}>السابق</button><span>الصفحة ${fmt(result.page)} · ${fmt(result.records.length)} سجل</span><button class="secondary" id="records-next" ${result.has_more ? '' : 'disabled'}>التالي</button></div></section>`;
  }
  function bindContent() {
    $('snapchat-start')?.addEventListener('click',async e=>{
      const b=e.currentTarget;b.disabled=true;
      try {
        const res=await fetch('/api/snapchat-connect?action=start',{method:'POST',headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
        const data=await res.json();
        if(!res.ok||!data.ok)throw new Error(data.error||'تعذر بدء التفويض');
        const url=new URL(data.url);
        if(url.origin!=='https://accounts.snapchat.com'||url.pathname!=='/login/oauth2/authorize')throw new Error('رابط التفويض غير صالح');
        location.assign(url.href);
      }catch(e){toast(e.message);b.disabled=false;}
    });
    $('snapchat-refresh')?.addEventListener('click',async e=>{
      const b=e.currentTarget;b.disabled=true;
      try {
        const res=await fetch('/api/snapchat-connect?action=refresh',{method:'POST',headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
        const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||'تعذر تجديد التفويض');
        await navigate('integrations');toast('تم تجديد تفويض سناب');
      }catch(e){toast(e.message);b.disabled=false;}
    });
    if (page==='ads') window.LinkAds.bind({navigate,toast});
    if (recordState[page]) {
      const resource=page,state=recordState[resource];
      $('records-search')?.addEventListener('submit',e=>{e.preventDefault();state.search=e.target.elements.search.value.trim();state.page=1;navigate(resource);});
      $('clear-search')?.addEventListener('click',()=>{state.search='';state.page=1;navigate(resource);});
      $('records-prev')?.addEventListener('click',()=>{state.page=Math.max(1,state.page-1);navigate(resource);});
      $('records-next')?.addEventListener('click',()=>{state.page++;navigate(resource);});
    }
    $('content').querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.page)));
    $('content').querySelectorAll('[data-rule]').forEach(form => form.addEventListener('submit', async e => {
      e.preventDefault(); const b = form.querySelector('button'); b.disabled = true;
      try { await api('rules',{method:'PATCH',body:JSON.stringify({id:form.dataset.rule,enabled:form.elements.enabled.checked,delay_minutes:Number(form.elements.delay.value)})}); toast('تم حفظ إعدادات الاختبار'); } catch(e) { toast(e.message); } finally { b.disabled = false; }
    }));
    $('new-rule')?.addEventListener('submit', async e => {
      e.preventDefault(); const f=e.target,b=f.querySelector('button'); b.disabled=true;
      try { await api('rules',{method:'POST',body:JSON.stringify({name:f.elements.name.value,event_name:f.elements.event.value,delay_minutes:Number(f.elements.delay.value)})}); toast('أُضيفت القاعدة، والاختبار غير مفعّل افتراضيًا'); await navigate('automations'); } catch(e) { toast(e.message); } finally { b.disabled=false; }
    });
    $('process-events')?.addEventListener('click', async e => {
      const b=e.currentTarget; b.disabled=true;
      try { const data=await api('process',{method:'POST'}); toast(`تمت معالجة ${fmt(data.processed)} حدث في وضع الاختبار`); await loadRuns(); } catch(e) { toast(e.message); } finally { b.disabled=false; }
    });
    $('load-runs')?.addEventListener('click', loadRuns);
  }
  async function loadRuns() {
    const target=$('runs'); if(!target)return;
    try { const {runs}=await api('runs'); if (!target.isConnected) return;
      target.innerHTML = !runs.length ? empty('لا توجد نتائج اختبار','فعّل اختبار قاعدة، ثم عالج الأحداث المطابقة لها.','automations') : `<div class="table-wrap"><table><thead><tr><th>القاعدة</th><th>التوقيت المقترح</th><th>النتيجة</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${esc(r.summary?.rule_name)}</td><td>${date(r.scheduled_for)}</td><td><span class="badge green">محاكاة · لم تُرسل رسالة</span></td></tr>`).join('')}</tbody></table></div>`;
    }catch(e){toast(e.message);}
  }
  async function navigate(next) {
    page = pages.some(([id])=>id===next) ? next : 'overview';
    const currentPage=page, id=++requestId;
    location.hash=page; $('sidebar').classList.remove('open'); $('menu-toggle').setAttribute('aria-expanded','false');
    $('nav').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.page===page); b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});
    const title=pages.find(([p])=>p===page)[1]; $('breadcrumb-title').textContent=title;
    $('content').innerHTML='<div class="loading">جارٍ تحميل مساحة العمل…</div>';
    try {
      let html;
      if (page==='overview') { overview=await api('overview'); html=home(overview); }
      else if (page==='ads') { html=window.LinkAds.render(); }
      else if (recordState[page]) { const state=recordState[page]; html=recordsView(page,await api(`${page}&${new URLSearchParams({page:state.page,search:state.search})}`)); }
      else if (page==='automations') { const {rules}=await api('rules'); html=rulesView(rules); }
      else if (page==='events') { const {events}=await api('events'); html=heading(title,'كل حدث يصل إلى اللوحة، مع حالته ووقت استقباله.')+`<section class="panel">${eventTable(events)}</section>`; }
      else if (page==='integrations') {
        overview=await api('overview');
        let snapConfig=null;
        try { const r=await fetch('/api/snapchat-connect',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(r.ok)snapConfig=await r.json(); } catch {}
        const snap=overview.data.connections?.find(c=>c.provider==='snapchat');
        const result=new URLSearchParams(location.search);
        const message=result.get('connection')==='snapchat'?({success:snap?.status==='connected'?'تم حفظ تفويض سناب بنجاح. الخطوة التالية تحديد الحساب الإعلاني وربط إحصائياته.':'تحقق من حالة الاتصال؛ تعذر تأكيد التفويض المحفوظ.',cancelled:'تم إلغاء الموافقة من سناب. يمكنك إعادة المحاولة.',failed:'لم يكتمل تفويض سناب. ابدأ الربط مجدداً من هذا المتصفح، وتحقق من إعدادات Vercel.'}[result.get('result')]||''):'';
        html=heading(title,'حالة اتصال المتجر والقنوات التي سنجمعها في مساحة واحدة.')+
          (message?`<div class="notice ${result.get('result')==='success'?'':'warn'}">${message}</div>`:'')+
          `<section class="panel">${connectionRows(overview.data.connections)}</section><section class="panel"><h3>ربط إعلانات سناب شات</h3><p class="muted">وافق من حساب سناب الذي لديه صلاحية الوصول إلى إعلانات لنك. نحفظ التفويض مشفراً، ثم نحدد الحساب الإعلاني ونربط إحصائياته في الخطوة التالية.</p>`+
          (!snapConfig?.ready?`<div class="notice warn">${snapConfig?.missing?.length?'أكمل متغيرات Vercel: '+snapConfig.missing.map(esc).join('، '):'تحقق من إعدادات الربط؛ رابط الرجوع أو مفتاح التشفير غير صالح، أو الخدمة غير متاحة.'}</div>`:'')+
          `<div class="form-row"><button class="primary" id="snapchat-start" ${snapConfig?.ready?'':'disabled'}>${snap?.status==='connected'?'إعادة تفويض سناب شات':'ربط سناب شات'}</button>${snap?.status==='connected'?`<button class="secondary" id="snapchat-refresh" ${snapConfig?.ready?'':'disabled'}>تجديد التفويض</button>`:''}</div><p class="muted">تفويض المنصة لا يعني أن إحصائيات الإعلانات بدأت بالمزامنة.</p></section><section class="panel"><h3>ربط سلة</h3><p class="muted">بعد تفعيل التطبيق، نستقبل تفويض المتجر ونحفظ بياناته المشفرة. ظهور الحالة «متصل» يعني وصول التفويض، ولا يعني اكتمال مزامنة الطلبات والعملاء.</p></section>`;
        if(message)history.replaceState(null,'',`${location.pathname}#integrations`);
      }
      else if (page==='videos' || page==='protection') { const url=page==='videos'?'/video-shop-admin':'/protection-admin'; html=heading(title,'أدوات المتجر الحالية داخل مساحة لنك.',`<a class="back-link" href="${url}" target="_blank" rel="noopener">فتح في صفحة مستقلة ↗</a>`)+`<iframe class="embed" title="${title}" src="${url}"></iframe>`; }
      else if (page==='settings') { html=heading(title,'إعدادات مساحة العمل وتجهيز المرحلة التالية.')+`<section class="panel"><div class="settings-list"><div><span>المتجر</span><b>Link Store</b></div><div><span>معرّف المتجر</span><code>1829345766</code></div><div><span>المنطقة الزمنية للعرض</span><b>السعودية</b></div><div><span>المصادقة الحالية</span><b>رمز إدارة الفيديو شوب</b></div><div><span>تشغيل الأتمتة</span><span class="badge">اختبار فقط</span></div></div></section><section class="panel"><h3>الطلبات والعملاء والسلات</h3><p class="muted">تمت مراجعة أعمدة الجداول وإعداد عرض سجلاتها. الخطوة القادمة تفعيل تطبيق سلة وربط الأحداث والمزامنة بالجداول.</p></section>`; }
      else { html=heading(title,'مساحة جاهزة لاستقبال بيانات المتجر.')+`<section class="panel">${empty('الربط في المرحلة التالية','الجدول موجود في قاعدة البيانات. سنربطه هنا بعد مراجعة أعمدته وتجهيز مزامنة سلة، لتظهر بيانات دقيقة وقابلة للاستخدام.',page)}</section>`; }
      if(id!==requestId || currentPage!==page)return;
      $('content').innerHTML=html; bindContent();
    }catch(e){if(id===requestId){$('content').innerHTML=heading(title,'')+`<section class="panel">${empty('تعذر تحميل هذا القسم',esc(e.message))}</section>`;}}
  }
  async function enter() {
    overview=await api('overview'); sessionStorage.setItem('lvs_admin',token); $('login').hidden=true; $('app').hidden=false;
    await navigate(location.hash.slice(1)||'overview');
  }
  $('nav').innerHTML=pages.map(([id,label])=>`<button class="nav-button" data-page="${id}">${svg(id)}<span>${label}</span></button>`).join('');
  $('nav').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
  $('login-form').addEventListener('submit',async e=>{e.preventDefault();token=$('admin-token').value.trim();const b=e.target.querySelector('button');b.disabled=true;$('login-error').textContent='';try{await enter();$('admin-token').value='';}catch(e){$('login-error').textContent=e.message;}finally{b.disabled=false;}});
  $('logout').addEventListener('click',()=>{sessionStorage.removeItem('lvs_admin');location.reload();});
  $('refresh').addEventListener('click',()=>navigate(page));
  $('menu-toggle').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('open');$('menu-toggle').setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',e=>{if(!e.target.closest('#sidebar')&&!e.target.closest('#menu-toggle')){$('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');}});
  window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(token&&next!==page)navigate(next);});
  $('today').textContent=new Date().toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Riyadh'});
  if(token)enter().catch(e=>{$('login-error').textContent=e.message;});
})();
