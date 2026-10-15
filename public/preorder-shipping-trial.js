/* Opt-in trial only. No prices, orders, stock, payments or database writes. */
(function (scope, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { scope.LinkPreorderShipping = api; api.start(scope); }
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const PRODUCT = '318533359', KEY = 'link.preorder.split.trial.v1';
  const fail = code => Object.assign(new Error(code), {code});
  const stable = value => JSON.stringify(sort(value));
  function sort(v) {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])]));
    return v;
  }
  function snapshot(response) {
    if (response?.success === false || Number(response?.status) >= 400) throw fail('cart_unavailable');
    const data = response?.data ?? response;
    const rows = [data?.items, data?.cart?.items, data?.data?.items].find(Array.isArray);
    if (!rows) throw fail('cart_unavailable');
    const items = rows.map(row => {
      const product = String(row.product_id ?? row.product?.id ?? '');
      const line = String(row.cart_item_id ?? row.id ?? '');
      const quantity = Number(row.quantity);
      if (!/^\d+$/.test(product) || !line || line.length > 160 || !Number.isSafeInteger(quantity) || quantity < 1) throw fail('unsupported_cart');
      // Preserve ready items in place, including their options/files. Never reconstruct them.
      const identity = {line, product, quantity};
      for (const k of ['options', 'attachments', 'files', 'fields', 'custom_fields', 'notes', 'note', 'sku', 'product_sku_id', 'variant_id', 'booking', 'gift', 'donation']) {
        if (row[k] != null) identity[k] = row[k];
      }
      return {line, product, quantity, identity, row};
    });
    if (new Set(items.map(i => i.line)).size !== items.length) throw fail('unsupported_cart');
    const preorder = items.filter(i => i.product === PRODUCT), ready = items.filter(i => i.product !== PRODUCT);
    return {items, preorder, ready, mixed: preorder.length > 0 && ready.length > 0};
  }
  const fingerprint = items => stable(items.map(i => i.identity).sort((a,b) => a.line.localeCompare(b.line)));
  const quantity = cart => cart.preorder.reduce((n,i) => n + i.quantity, 0);
  function simplePreorder(cart) {
    if (cart.preorder.length !== 1 || quantity(cart) > 400) throw fail('unsupported_preorder');
    const row = cart.preorder[0].row;
    for (const k of ['options', 'attachments', 'files', 'fields', 'custom_fields', 'notes', 'note', 'booking', 'gift', 'donation']) {
      const value = row[k];
      if (value != null && value !== '' && value !== false && (!Array.isArray(value) || value.length) && (typeof value !== 'object' || Object.keys(value).length)) throw fail('unsupported_preorder');
    }
    if (row.product?.is_variable === true || row.is_variable === true) throw fail('unsupported_preorder');
  }
  function controller({cart, storage, lock, digest, now = Date.now}) {
    let working = false;
    function saved() {
      let value;
      try { value = storage.get(); } catch { throw fail('storage_unavailable'); }
      if (value == null) return null;
      if (value.v !== 1 || value.product !== PRODUCT || !Number.isSafeInteger(value.quantity) || value.quantity < 1 || value.quantity > 400 ||
          !['separating','ready','restoring','uncertain'].includes(value.stage) || !/^[a-f0-9]{64}$/.test(value.readyHash || '') ||
          !Number.isFinite(value.createdAt)) throw fail('saved_invalid');
      return value;
    }
    function write(value) {
      try { storage.set(value); if (stable(storage.get()) !== stable(value)) throw Error(); }
      catch { throw fail('storage_unavailable'); }
    }
    const read = async () => snapshot(await cart.read());
    const hash = items => digest(fingerprint(items));
    async function exclusive(fn) {
      if (working) throw fail('busy');
      working = true;
      try { return await lock(async () => fn()); } finally { working = false; }
    }
    async function inspect() { const state = await read(); return {cart: state, saved: saved()}; }
    async function split(expectedFingerprint) {
      return exclusive(async () => {
        if (saved()) throw fail('saved_exists');
        const before = await read();
        if (fingerprint(before.items) !== expectedFingerprint) throw fail('cart_changed');
        if (!before.mixed) throw fail('not_mixed');
        simplePreorder(before);
        const journal = {v:1, product:PRODUCT, quantity:quantity(before), stage:'separating', readyHash:await hash(before.ready), createdAt:now()};
        write(journal); // A verified durable copy MUST exist before deleting anything.
        const justBefore = await read();
        if (fingerprint(justBefore.items) !== expectedFingerprint) { write(null); throw fail('cart_changed'); }
        let requestFailed = false;
        try {
          const result = await cart.remove(before.preorder[0].line);
          if (result?.success === false || Number(result?.status) >= 400) requestFailed = true;
        } catch { requestFailed = true; }
        let after;
        try { after = await read(); } catch { write({...journal, stage:'uncertain'}); throw fail('uncertain'); }
        if (!after.preorder.length && await hash(after.ready) === journal.readyHash) {
          write({...journal, stage:'ready'}); return {cart:after, saved:saved()};
        }
        if (fingerprint(after.items) === expectedFingerprint) { write(null); throw fail(requestFailed ? 'remove_failed' : 'remove_unconfirmed'); }
        write({...journal, stage:'uncertain'}); throw fail('uncertain');
      });
    }
    async function restore({cancel = false, confirmedFirstOrder = false} = {}) {
      return exclusive(async () => {
        const journal = saved();
        if (!journal) throw fail('nothing_saved');
        if (journal.stage !== 'ready') throw fail('uncertain');
        const before = await read();
        if (before.preorder.length) throw fail('preorder_already_present');
        if (cancel ? await hash(before.ready) !== journal.readyHash : before.items.length > 0) throw fail('cart_not_empty');
        if (!cancel && !confirmedFirstOrder) throw fail('confirm_first_order');
        const restoreHash = await hash(before.ready);
        write({...journal, stage:'restoring', restoreHash});
        // Re-read after persistence, before the single add request. Never retry an ambiguous add.
        const fresh = await read();
        if (fingerprint(fresh.items) !== fingerprint(before.items)) { write({...journal, stage:'ready'}); throw fail('cart_changed'); }
        try { await cart.add({id:Number(PRODUCT), quantity:journal.quantity}); } catch { /* Read the cart to resolve network ambiguity. */ }
        let after;
        try { after = await read(); } catch { throw fail('uncertain'); }
        if (quantity(after) === journal.quantity && await hash(after.ready) === restoreHash) {
          simplePreorder(after); write(null); return {cart:after, saved:null};
        }
        // Even a timeout can mean the add succeeded. Keep the journal and require review, not a retry.
        write({...journal, stage:'uncertain', restoreHash}); throw fail('uncertain');
      });
    }
    async function recover() {
      return exclusive(async () => {
        const journal = saved(); if (!journal) return inspect();
        const state = await read();
        if (['restoring','uncertain'].includes(journal.stage) && /^[a-f0-9]{64}$/.test(journal.restoreHash || '') &&
            quantity(state) === journal.quantity && await hash(state.ready) === journal.restoreHash) {
          simplePreorder(state); write(null); return {cart:state, saved:null};
        }
        // A browser closed after removal but before recording completion can recover without mutation.
        if (['separating','uncertain'].includes(journal.stage) && !journal.restoreHash && !state.preorder.length && await hash(state.ready) === journal.readyHash) {
          write({...journal, stage:'ready'}); return {cart:state, saved:saved()};
        }
        return {cart:state, saved:journal};
      });
    }
    return {inspect, split, restore, recover};
  }

  function start(w) {
    const d = w.document, script = d.currentScript;
    // Explicit opt-in; loading this asset alone never activates it in the production theme.
    if (script?.dataset.shippingTrial !== '1' || w.__linkShippingTrial) return;
    // Native cart trial withdrawn after merchant feedback. Keep the isolated demo,
    // but no native cart reads, mutations, checkout guards, saved-cart banner or redirects.
    if (script.dataset.demo !== '1') {
      w.LinkPreorderShippingTrialPaused = true;
      // Existing test-theme loader now delegates only to the approved pre-add gate.
      // Absolutely no script/UI is installed on native cart or checkout routes.
      if (!/(?:^|\/)(?:cart|checkout)(?:\/|$)/.test(w.location.pathname) && !d.getElementById('link-preorder-before-add-loader')) {
        const productScript = d.createElement('script');productScript.id='link-preorder-before-add-loader';
        productScript.src = new URL(script.src).origin + '/preorder-before-add.js?v=20261015-7';productScript.dataset.beforeAdd='1';
        productScript.async = true; d.head.appendChild(productScript);
      }
      return;
    }
    w.__linkShippingTrial = true;
    const origin = new URL(script.src).origin;
    // Theme previews can prefix the cart route with the store/language path.
    const demo = script.dataset.demo === '1', isCart = demo || /(?:^|\/)cart\/?$/.test(w.location.pathname);
    if (!isCart) {
      if (/\/p(?:318533359|981596666)(?:\/|$)/.test(w.location.pathname) && !w.__linkPreorderWidget) {
        const productScript = d.createElement('script'); productScript.src = origin + '/preorder-widget.js'; productScript.async = true; d.head.appendChild(productScript);
      }
      // The recovery link is deliberately independent of payment-success URL assumptions.
      try { if (w.localStorage.getItem(KEY)) {
        const a = d.createElement('a'); a.textContent = 'حجز البرغندي محفوظ لك — تابع من السلة'; a.href = '/cart'; a.className = 'po-saved-link';
        a.style.cssText = 'position:fixed;bottom:20px;inset-inline:16px;z-index:9999;background:#51007a;color:white;padding:14px;border-radius:12px;text-align:center;font:14px/1.5 inherit';
        d.body.appendChild(a);
      }} catch { /* No mutation outside cart. */ }
      return;
    }
    // Prevent an older disclosure from competing with this opt-in cart UI.
    w.__linkPreorderWidget = true;
    d.getElementById('link-preorder-notice')?.remove();
    const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const messages = {
      cart_unavailable:'تعذر قراءة السلة. حدّث الصفحة قبل المتابعة.', unsupported_cart:'بعض تفاصيل السلة تحتاج مراجعة. لم نفصل المنتجات؛ تواصل معنا للمساعدة.',
      unsupported_preorder:'خيارات هذا الحجز تحتاج مراجعة قبل الفصل. لم نحذف أي منتج.', storage_unavailable:'تعذر حفظ الحجز على هذا المتصفح. لن نفصل السلة قبل التأكد من حفظه.',
      saved_invalid:'تعذر قراءة الحجز المحفوظ. تواصل معنا للمساعدة قبل إعادة إضافة المنتجات.', cart_changed:'تغيّرت السلة. راجع الكميات واختر طريقة الشراء من جديد.',
      saved_exists:'عندك حجز محفوظ من عملية فصل سابقة. أكمله أو أرجعه للسلة أولاً.', remove_failed:'لم تتم إزالة الحجز. راجع السلة وحاول مجدداً.',
      remove_unconfirmed:'لم نتأكد من فصل الحجز. راجع السلة قبل المتابعة.', uncertain:'لم نتأكد من اكتمال العملية. احتفظنا بنسخة الحجز؛ لا نكرر الإضافة تلقائياً حتى لا تتضاعف الكمية. راجع السلة أو تواصل معنا.',
      cart_not_empty:'السلة ليست فارغة أو تغيّرت محتوياتها. أكمل طلب المنتجات المتوفرة أولاً، أو ألغِ الفصل لإرجاع الحجز.',
      preorder_already_present:'الحجز موجود بالفعل في السلة. راجع كميته؛ لن نضيفه مرة ثانية.', confirm_first_order:'أكد إتمام طلب المنتجات المتوفرة أولاً.',
      busy:'توجد عملية أخرى جارية. انتظر اكتمالها.', lock_unavailable:'هذا المتصفح لا يدعم الفصل الآمن بين الصفحات. استخدم متصفحاً حديثاً أو تواصل معنا.',
      checkout_missing:'تم تجهيز السلة. استخدم زر إتمام الطلب الخاص بسلة أدناه.', schedule_unavailable:'تعذر التحقق من موعد الحجز. حدّث الصفحة قبل المتابعة.',
      not_mixed:'تغيّرت المنتجات؛ راجع السلة قبل المتابعة.', nothing_saved:'لا يوجد حجز محفوظ للاستعادة.',
      sdk_unavailable:'لم تكتمل تهيئة السلة. حدّث الصفحة ثم اضغط التحقق من السلة. رمز الفحص: PO-SDK.',
      product_mismatch:'ظهر الحجز في الصفحة لكن لم تتطابق بياناته مع السلة. لم نغيّر أي منتج. رمز الفحص: PO-MAP.'
    };
    const style = d.createElement('style'); style.textContent = `
      #link-po-shipping{display:block;position:relative;float:none;clear:both;width:100%;min-width:0;max-width:100%;direction:rtl;text-align:right;font-family:inherit;background:#fbf8fd;border:1px solid #dccbe7;border-radius:18px;padding:18px;margin:0 0 18px;color:#30223b;line-height:1.8;scroll-margin-top:90px;box-sizing:border-box}
      #link-po-shipping *{box-sizing:border-box}#link-po-shipping h2{font-size:21px;color:#51007a;margin:6px 0}#link-po-shipping p{font-size:14px;margin:8px 0}
      #link-po-shipping .po-tag{font-size:12px;font-weight:700;color:#6b1f91}#link-po-shipping .po-choice{display:flex;gap:12px;border:1px solid #dbd1e1;border-radius:12px;padding:14px;background:white;margin:10px 0;cursor:pointer}
      #link-po-shipping .po-choice:has(input:checked){border-color:#6b1f91;box-shadow:0 0 0 1px #6b1f91}#link-po-shipping input{accent-color:#51007a;flex:none;width:19px;height:19px;margin-top:5px}
      #link-po-shipping .po-choice b{display:block}#link-po-shipping small{display:block;color:#6b5c73;line-height:1.7}#link-po-shipping button{font:inherit;cursor:pointer;border:0;border-radius:10px;background:#51007a;color:white;padding:11px 16px;margin:8px 0}
      #link-po-shipping button.secondary{background:white;color:#51007a;border:1px solid #d4bfe0;margin-inline-start:8px}#link-po-shipping button:disabled{opacity:.55;cursor:wait}#link-po-shipping .po-ack{display:flex;gap:10px;font-size:13px;margin-top:14px}
      #link-po-shipping .po-error{color:#a51e3b;font-weight:700}#link-po-shipping .po-summary{background:#fff;border-radius:10px;padding:12px}#link-po-shipping:focus-within{outline-offset:3px}
      @media(max-width:480px){#link-po-shipping{padding:15px}#link-po-shipping h2{font-size:19px}#link-po-shipping button{width:100%}#link-po-shipping button.secondary{margin-inline-start:0}}
    `; d.head.appendChild(style);
    let root, state, choice = '', ack = false, busy = false, error = '', revision = '', bypass = null, schedule = null, feedTime = 0, timer, disposed = false;
    let loading = true, initialized = false, bootTimer, bootTries = 0;
    let frozen = [];
    function freezeCart() {
      if (frozen.length || !root) return;
      // Disable native quantity/delete/add controls during a mutation in this page.
      // This cannot lock native Salla mutations from another device or tab.
      let branch = root;
      while (branch.parentElement && branch.parentElement !== d.documentElement) {
        for (const sibling of branch.parentElement.children) if (sibling !== branch && !['SCRIPT','STYLE'].includes(sibling.tagName)) {
          frozen.push([sibling,sibling.inert]); sibling.inert = true;
        }
        branch = branch.parentElement;
      }
    }
    function unfreezeCart() { for (const [el,value] of frozen) el.inert = value; frozen = []; }
    let ctl;
    const memory = demo ? w.__poDemoStorage : null;
    const storage = memory || {
      get:() => { const text = w.localStorage.getItem(KEY); return text == null ? null : JSON.parse(text); },
      set:value => value == null ? w.localStorage.removeItem(KEY) : w.localStorage.setItem(KEY, JSON.stringify(value))
    };
    const digest = async text => Array.from(new Uint8Array(await w.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const lock = fn => {
      if (!w.navigator.locks?.request) throw fail('lock_unavailable');
      return w.navigator.locks.request('link-po-split-trial', {mode:'exclusive', ifAvailable:true}, token => { if (!token) throw fail('busy'); return fn(); });
    };
    function mount() {
      if (root?.isConnected) return true;
      const selectors='[data-cart-summary],#cart-summary,.cart-summary,.cart-summary-wrapper,salla-cart-summary,salla-cart-summary-card,[data-po-demo-cart]';
      const control=Array.from(d.querySelectorAll(nativeSelector+',button,salla-button')).find(el=>!el.closest('header,nav,dialog,[role="dialog"]')&&checkoutControl([el]));
      let host=control?.closest(selectors) || d.querySelector(selectors);
      // Prefer the actual card containing the checkout button. Never create a
      // sibling in the theme's grid, and never prepend content ahead of its header.
      if(!host&&control){
        for(let node=control.parentElement;node&&node!==d.body;node=node.parentElement){
          if(Array.from(node.querySelectorAll('h2,h3,h4,h5,h6')).some(h=>h.textContent.trim()==='ملخص الطلب')){host=node;break;}
        }
        if(!host&&control.parentElement!==d.body)host=control.parentElement;
      }
      if(!host)host=d.querySelector('[data-cart-items],.cart-page,.cart-content,.s-cart-empty,.cart-empty,#cart-empty,main');
      // The generic body fallback previously shifted the header in Malak.
      // If the native cart has not rendered, its DOM observer remounts us later.
      if(!host||host===d.body||host.closest('header,nav'))return false;
      root = d.createElement('div'); root.id = 'link-po-shipping'; root.setAttribute('role','region');root.setAttribute('aria-label','طريقة شحن الحجز المسبق');
      host.prepend(root);
      root.addEventListener('change', e => {
        if (e.target.name === 'link-po-shipping-choice') { choice = e.target.value; ack = false; error = ''; render(); }
        else if (e.target.matches('[data-ack]')) { ack = e.target.checked; error = ''; }
        else if (e.target.matches('[data-first-done]')) ack = e.target.checked;
      });
      root.addEventListener('click', async e => {
        const button = e.target.closest('[data-action]'); if (!button || busy) return;
        const action = button.dataset.action;
        if (action === 'refresh') { error = ''; if(!ctl)waitForSDK();else await refresh(); return; }
        await perform(async () => {
          if (action === 'split') { if (choice !== 'separate') throw fail('cart_changed'); await checkSchedule(); state = await ctl.split(revision); choice = ''; ack = false; }
          if (action === 'restore') state = await ctl.restore({confirmedFirstOrder:ack});
          if (action === 'cancel') state = await ctl.restore({cancel:true});
          if (action === 'checkout') await continueNative();
        });
      });
      return true;
    }
    const dateText = p => {
      const day = x => new Intl.DateTimeFormat('ar-SA-u-nu-latn',{day:'numeric',month:'long',year:'numeric',calendar:'gregory',timeZone:'Asia/Riyadh'}).format(new Date(x+'T12:00:00Z'));
      return p ? `${day(p.ship_from)} إلى ${day(p.ship_by)}` : '';
    };
    function render() {
      if (!state && !error && !loading) return;
      if (state && !state.cart.preorder.length && !state.saved && !error && !loading) { root?.remove(); return; }
      if(!mount())return;
      const cart = state?.cart, saved = state?.saved;
      let body = loading ? '<span class="po-tag">خيارات شحن الحجز</span><p role="status">جارٍ التحقق من محتويات السلة…</p>' : '';
      if (saved) {
        body = `<span class="po-tag">حجزك محفوظ على هذا المتصفح</span><h2>إطار البرغندي بانتظارك 💜</h2><p>حفظنا ${saved.quantity} قطعة من الحجز. الحفظ لا يحجز المخزون؛ يتأكد التوفر والسعر عند إتمام الشراء.</p>`;
        if (saved.stage !== 'ready') body += '<p>نحتاج مراجعة السلة قبل أي إضافة جديدة حتى لا تتكرر الكمية.</p><button class="secondary" data-action="refresh">تحقق من السلة</button><p><a href="https://linkstore-sa.com/p318533359">راجع منتج الحجز أو تواصل معنا للمساعدة</a></p>';
        else if (!cart.items.length) body += '<p>إذا أكملت طلب المنتجات المتوفرة، تقدر الآن ترجع الحجز للسلة وتكمل طلبه المستقل. تظهر رسوم شحنه حسب عنوانك قبل الدفع.</p><label class="po-ack"><input type="checkbox" data-first-done '+(ack?'checked':'')+'><span>أكملت طلب المنتجات المتوفرة وأرغب بإكمال الحجز.</span></label><button data-action="restore">استرجع الحجز للسلة</button>';
        else if (!cart.preorder.length) body += '<p>أكمل شراء المنتجات الموجودة بالسلة أولاً. بعدها ارجع هنا لإكمال الحجز بطلب مستقل ورسوم شحن مستقلة.</p><button data-action="checkout">أكمل طلب المنتجات المتوفرة</button><button class="secondary" data-action="cancel">إلغاء الفصل وإرجاع الحجز للسلة</button>';
        else body += '<p>توجد منتجات حجز في السلة أيضاً. راجع الكمية قبل المتابعة؛ لن نضيف الحجز المحفوظ مرة ثانية.</p>';
      } else if (cart?.mixed) {
        body = `<span class="po-tag">منتجات متوفرة + حجز مسبق</span><h2>كيف تحب تستلم طلبك؟</h2><p>اختر اللي يناسبك؛ لكل طريقة موعد ورسوم شحن مختلفة.</p><div class="po-summary">الحجز: إطار البرغندي × ${quantity(cart)}${schedule?`<small>الشحن المتوقع للحجز: ${esc(dateText(schedule))}. تُضاف مدة توصيل الناقل.</small>`:''}</div>
          <label class="po-choice"><input type="radio" name="link-po-shipping-choice" value="together" ${choice==='together'?'checked':''}><span><b>أوفّر الشحن وأستلمها مع بعض</b><small>ننتظر وصول الحجز وفحصه، ثم نشحن طلبك كامل بشحنة واحدة. تُحسب رسوم الشحن حسب عنوانك قبل الدفع.</small></span></label>
          <label class="po-choice"><input type="radio" name="link-po-shipping-choice" value="separate" ${choice==='separate'?'checked':''}><span><b>أبي المتوفر أول، والحجز بعدين</b><small>تكمل شراء المتوفر أولاً، ثم الحجز بعملية شراء ثانية. لكل طلب رسوم شحن حسب عنوانك، وتظهر قبل دفعه.</small></span></label>
          ${choice==='together'?`<label class="po-ack"><input type="checkbox" data-ack ${ack?'checked':''}><span>أوافق أن المنتجات المتوفرة تنتظر مع الحجز، ويُشحن الطلب كامل ضمن الموعد المتوقع الموضّح.</span></label><p>تابع من زر إتمام الطلب الخاص بسلة.</p>`:choice==='separate'?'<button data-action="split">احفظ الحجز وجهّز سلة المنتجات المتوفرة</button><small>نحفظ كمية الحجز أولاً، ثم نزيله وحده من هذه السلة. تقدر ترجع عن الفصل قبل شراء المتوفر.</small>':''}`;
      } else if (cart?.preorder.length) {
        body = `<span class="po-tag">طلب حجز مسبق</span><h2>قطعتك الجاية بالطريق 💜</h2><p>هذه السلة تحتوي منتجات الحجز فقط.${schedule?` الشحن المتوقع: ${esc(dateText(schedule))}.`:''} تُضاف مدة التوصيل حسب مدينتك.</p><label class="po-ack"><input type="checkbox" data-ack ${ack?'checked':''}><span>اطّلعت على الموعد المتوقع وأوافق أن المنتج غير جاهز للشحن الآن.</span></label>`;
      }
      root.innerHTML = `${demo?'<p class="po-tag">محاكاة فقط — لا شراء ولا سلة حقيقية</p>':''}${body}<p class="po-error" role="alert">${esc(error)}</p>${error?'<button class="secondary" data-action="refresh">تحقق من السلة</button>':''}<p class="po-busy" role="status">${busy?'جارٍ التحقق من السلة…':''}</p>`;
      root.querySelectorAll('button,input').forEach(el=>el.disabled=busy);
    }
    async function checkSchedule() {
      if (!schedule || Date.now()-feedTime > 30000) {
        const response = await w.fetch(origin+'/api/protection-feed?mode=preorders&ids='+PRODUCT, {credentials:'omit',cache:'no-store'});
        if (!response.ok) throw fail('schedule_unavailable');
        const data = await response.json();
        const next = data?.ok && data.products?.find(p=>String(p.id)===PRODUCT);
        if (schedule && stable(next) !== stable(schedule)) { choice = ''; ack = false; }
        schedule = next;
        feedTime = Date.now();
      }
      const today = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Riyadh'}).format(new Date());
      if (!schedule || schedule.status !== 'open' || !/^\d{4}-\d{2}-\d{2}$/.test(schedule.ship_from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(schedule.ship_by || '') || schedule.ship_by < today) throw fail('schedule_unavailable');
    }
    async function refresh() {
      if (busy || disposed) return;
      error = '';
      try {
        state = await ctl.recover();
        const nativePreorder = !demo && d.querySelector('a[href*="/p318533359"]');
        if (nativePreorder && !state.cart.preorder.length && !state.saved) throw fail('product_mismatch');
        const next = fingerprint(state.cart.items);
        if (next !== revision) { revision = next; choice = ''; ack = false; }
        if (state.cart.preorder.length) await checkSchedule();
      } catch (e) { error = messages[e.code] || messages.cart_unavailable; }
      finally { loading = false; }
      render();
    }
    async function perform(fn) {
      busy = true; error = ''; render(); freezeCart();
      try { await fn(); }
      catch (e) { error = messages[e.code] || messages.cart_unavailable; }
      finally {
        unfreezeCart();
        busy = false;
        try { state = await ctl.inspect(); const next = fingerprint(state.cart.items); if (next !== revision) {revision = next; choice = ''; ack = false;} } catch { /* Keep the error and the recovery UI visible. */ }
        render();
      }
    }
    const nativeSelector = '[data-cart-submit],#cart-submit,.cart-submit,.btn--checkout,a[href*="/checkout"],button[name="checkout"],[onclick*="cart.submit"],[data-on-click*="cart.submit"],form[action*="checkout"]';
    function checkoutControl(path) {
      return path.find(el=>el?.matches && !root?.contains(el) && (el.matches(nativeSelector) || el.matches('button,salla-button') && /^(?:إتمام الطلب|اتمام الطلب|إكمال الطلب|اكمال الطلب|متابعة الدفع|إتمام الشراء|اتمام الشراء)$/.test(el.textContent.trim())));
    }
    async function allowNative(el) {
      if (!el?.isConnected) throw fail('checkout_missing');
      unfreezeCart();
      bypass = el;
      try { if (el.matches('form')) el.requestSubmit(); else el.click(); }
      finally { bypass = null; }
    }
    async function continueNative() {
      const fresh = await ctl.inspect();
      if (fingerprint(fresh.cart.items) !== revision) throw fail('cart_changed');
      if (fresh.saved?.stage !== 'ready' || fresh.cart.preorder.length) throw fail('uncertain');
      const control = Array.from(d.querySelectorAll(nativeSelector+',button,salla-button')).find(el=>checkoutControl([el]));
      await allowNative(control);
    }
    function guard(e) {
      const path = e.composedPath?.() || [e.target], el = checkoutControl(path);
      if (!el || bypass && path.includes(bypass)) return;
      // Coupons, quantity controls and unrelated forms never enter this path.
      e.preventDefault(); e.stopImmediatePropagation();
      if (busy) return;
      perform(async () => {
        const fresh = await ctl.inspect();
        if (fingerprint(fresh.cart.items) !== revision) throw fail('cart_changed');
        if (fresh.saved && (fresh.saved.stage !== 'ready' || fresh.cart.preorder.length)) throw fail('uncertain');
        if (fresh.cart.preorder.length) {
          await checkSchedule();
          if (fresh.cart.mixed && choice !== 'together') throw fail('choose_shipping');
          if (!ack) throw fail('ack_required');
        }
        await allowNative(el);
      });
    }
    messages.choose_shipping = 'اختر طريقة استلام طلبك أولاً. إذا اخترت الشحن المنفصل، استخدم زر حفظ الحجز وتجهيز السلة.';
    messages.ack_required = 'فضلاً وافق على موعد شحن الحجز قبل المتابعة.';
    async function init() {
      const readCart = () => new Promise((resolve,reject) => {
        const timeout = w.setTimeout(()=>reject(fail('cart_unavailable')),12000);
        Promise.resolve().then(()=>w.salla.cart.details()).then(resolve,reject).finally(()=>w.clearTimeout(timeout));
      });
      ctl = controller({cart:{read:readCart, remove:id=>w.salla.cart.deleteItem(id), add:payload=>w.salla.cart.addItem(payload)},storage,lock,digest});
      d.addEventListener('click',guard,true); d.addEventListener('submit',guard,true);
      await refresh();
      const scheduleRefresh = () => { if (busy) return; w.clearTimeout(timer); timer = w.setTimeout(refresh,400); };
      // DOM redraws only remount cached UI. A cart read can itself redraw the theme;
      // reading again from that mutation would create a request loop.
      const observer = new w.MutationObserver(()=>{if(!root?.isConnected && (state?.cart.preorder.length || state?.saved || error))render();});
      observer.observe(d.body,{childList:true,subtree:true});
      const events = w.salla?.cart?.event;
      for (const name of ['onItemAdded','onItemDeleted','onItemRemoved','onItemUpdated','onItemQuantityUpdated']) if (typeof events?.[name] === 'function') events[name](scheduleRefresh);
      w.addEventListener('storage',scheduleRefresh);
      d.addEventListener('visibilitychange',()=>{if(d.visibilityState==='visible')scheduleRefresh();});
      w.addEventListener('pagehide',()=>{disposed=true;observer.disconnect();w.clearTimeout(timer);});
      w.addEventListener('pageshow',e=>{if(e.persisted){disposed=false;observer.observe(d.body,{childList:true,subtree:true});refresh();}});
    }
    function begin() {
      if (!d.body || typeof w.salla?.cart?.details !== 'function') return;
      w.clearTimeout(bootTimer);
      if (initialized) { if(error && !busy) {error='';refresh();} return; }
      initialized = true; error = ''; loading = true; render();
      init().catch(()=>{loading=false;error=messages.sdk_unavailable;render();});
    }
    function waitForSDK() {
      if (initialized) return;
      w.clearTimeout(bootTimer);
      if (!d.body || typeof w.salla?.cart?.details !== 'function') {
        if (++bootTries <= 100) {bootTimer=w.setTimeout(waitForSDK,100);return;}
        loading=false;error=messages.sdk_unavailable;render();return;
      }
      // SDK versions expose callback and/or Promise readiness. Async theme loaders
      // can arrive after that event; the bounded fallback avoids a silent no-op.
      if (typeof w.salla.onReady === 'function') {
        try { const ready=w.salla.onReady(begin);if(ready?.then)ready.then(begin,()=>{}); } catch { /* Fallback below. */ }
        if (!initialized) bootTimer=w.setTimeout(begin,1200);
      } else begin();
    }
    if(d.body){render();waitForSDK();}else d.addEventListener('DOMContentLoaded',()=>{render();waitForSDK();},{once:true});
  }
  return {PRODUCT, KEY, snapshot, fingerprint, controller, start};
});
