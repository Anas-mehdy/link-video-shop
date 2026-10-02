/* Link Store Samsung bundle additions v1. Native bundle options remain in Salla. */
(function () {
  'use strict';
  if (window.__linkBundleUpsells) return;
  window.__linkBundleUpsells = true;
  const BASE = 'https://link-video-shop.vercel.app';
  const allowed = new Set(['1721100195', '1545880750', '2079294120']);
  const id = location.pathname.match(/\/p(\d+)\/?$/)?.[1];
  if (!allowed.has(id)) return;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const money = n => new Intl.NumberFormat('ar-SA-u-nu-latn', {maximumFractionDigits: 2}).format(n) + ' ر.س';
  function mount(config) {
    if (document.getElementById('link-bundle-screen')) return true;
    const form = document.querySelector(`#product-${id} .main-content .product-form`) || document.querySelector('.product-form');
    const cart = window.salla?.cart;
    const button = form?.querySelector(`salla-add-product-button[product-id="${id}"]`);
    if (!form || !button || !cart?.addItem || !cart.event?.onItemAdded) return false;
    const style = el('style');
    style.textContent = '.link-bundle-extra{direction:rtl;font-family:inherit;box-sizing:border-box;color:#281b30;width:100%;margin:20px 0;padding:18px;border:1px solid #e6d9ec;border-radius:16px;background:#fcf9fe}.link-bundle-extra h2{font-size:19px;font-weight:700;margin:0 0 6px}.link-bundle-extra p{font-size:13px;line-height:1.7;margin:5px 0;color:#74617e}.link-bundle-extra label{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #e9e1ed;border-radius:12px;background:white;margin:8px 0;cursor:pointer}.link-bundle-extra label:has(input:checked){border-color:#51007a;background:#f3eaf8}.link-bundle-extra input{accent-color:#51007a;width:18px;height:18px}.link-bundle-extra strong{margin-inline-start:auto;color:#51007a;white-space:nowrap}.link-bundle-extra .lb-summary{color:#51007a;font-weight:700}.link-bundle-extra button{font:inherit;border:0;border-radius:10px;padding:10px 14px;cursor:pointer;background:#51007a;color:white}.link-bundle-extra button:disabled{opacity:.5;cursor:wait}.link-bundle-extra button:focus-visible,.link-bundle-extra a:focus-visible{outline:3px solid #b479d0;outline-offset:3px}.link-bundle-extra .lb-row{display:flex;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid #eee5f2}.link-bundle-extra .lb-row:last-child{border-bottom:0}.link-bundle-extra img{width:70px;height:70px;object-fit:contain;background:white;border-radius:10px}.link-bundle-extra .lb-copy{flex:1;min-width:0}.link-bundle-extra a{color:inherit;font-weight:600;font-size:14px;text-decoration:none}.link-bundle-extra .lb-status{color:#51007a}@media(max-width:390px){.link-bundle-extra{padding:12px}.link-bundle-extra .lb-row{gap:8px}.link-bundle-extra img{width:52px;height:52px}.link-bundle-extra .lb-row button{padding:9px;font-size:12px}}';
    document.head.append(style);
    style.textContent += 'form[data-link-screen-selected] salla-mini-checkout-widget,form[data-link-screen-selected] salla-quick-buy{display:none!important}';
    const screen = el('section', '', 'link-bundle-extra');
    screen.id = 'link-bundle-screen';
    screen.setAttribute('aria-label', 'كمّل حماية جوالك');
    screen.append(el('h2', 'كمّل حماية جوالك'), el('p', 'أضف استيكر شاشة مناسب لـ ' + config.model + ' مع الباكج'));
    let selected = null, pending = null, adding = false, retryItem = null;
    const summary = el('p', '', 'lb-summary');
    const status = el('p', '', 'lb-status');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const retry = el('button', 'أعد إضافة الاستيكر فقط'); retry.type = 'button'; retry.hidden = true;
    const radios = [];
    [null, ...config.screens].forEach((p, index) => {
      const label = el('label'), input = el('input');
      input.type = 'radio'; input.name = 'link-screen-selection'; input.value = p ? String(p.id) : 'none';
      input.checked = index === 0;
      radios.push(input);
      label.append(input, el('span', p ? p.name : 'الباكج بدون استيكر'), el('strong', p ? '+ ' + money(p.price) : 'بدون إضافة'));
      input.addEventListener('change', () => {selected = p; updateSummary();});
      screen.append(label);
    });
    function quantity() {const q = Number(form.querySelector('[name="quantity"]')?.value || 1); return Number.isInteger(q) && q > 0 ? q : 1;}
    function updateSummary() {
      // Checkout shortcuts purchase only the native bundle. Use the cart flow when an add-on is selected.
      form.toggleAttribute('data-link-screen-selected', Boolean(selected));
      summary.textContent = selected ? 'الباكج مع الاستيكر: ' + money(config.price + selected.price) + ' للقطعة' : 'الباكج: ' + money(config.price);
    }
    screen.append(summary, el('p', 'اختياري. يُضاف الاستيكر كمنتج مستقل بنفس عدد الباكجات، مع تحديد موديل Ultra تلقائيًا. السعر النهائي والتوفر يُؤكّدان في السلة.'), status, retry);
    // Unnamed picker fields are excluded from Salla's native FormData.
    const pickerAnchor = button.closest('.sticky-product-bar') || button.parentElement;
    pickerAnchor.before(screen);
    radios.forEach(r => r.removeAttribute('name'));
    // Group radios manually, without adding any unrelated field to Salla's native FormData.
    radios.forEach(r => r.addEventListener('change', () => radios.forEach(other => {if (other !== r) other.checked = false;})));
    function setBusy(value) {adding = value; radios.forEach(r => r.disabled = value); retry.disabled = value;}
    async function addScreen(item) {
      setBusy(true); status.textContent = 'تتم إضافة الاستيكر...'; retry.hidden = true;
      try {
        const response = await cart.addItem({id: item.product.id, quantity: item.quantity, options: item.product.options});
        if (response?.success === false || Number(response?.status) >= 400) throw new Error('screen add failed');
        retryItem = null; status.textContent = 'تمت إضافة الباكج والاستيكر للسلة ✓';
      } catch (_) {
        retryItem = item; retry.hidden = false;
        status.textContent = 'الباكج انضاف، لكن الاستيكر لم يُضف. تحقق من التوفر وأعد إضافة الاستيكر فقط.';
      } finally {setBusy(false);}
    }
    form.addEventListener('submit', e => {
      if (adding || pending) {e.preventDefault(); e.stopImmediatePropagation(); return;}
      retry.hidden = true; retryItem = null; status.textContent = '';
      pending = {product: selected, quantity: quantity(), time: Date.now()};
      setTimeout(() => {if (pending && Date.now() - pending.time >= 45000) pending = null;}, 45000);
    }, true);
    cart.event.onItemAdded((_response, productId) => {
      if (String(productId) !== id || !pending) return;
      const item = pending; pending = null;
      if (item.product && location.pathname.match(/\/p(\d+)\/?$/)?.[1] === id) addScreen(item);
    });
    cart.event.onItemAddedFailed?.((_error, productId) => {if (String(productId) === id) pending = null;});
    retry.addEventListener('click', () => {if (retryItem && !adding) addScreen(retryItem);});
    updateSummary();
    const accessories = el('section', '', 'link-bundle-extra');
    accessories.id = 'link-bundle-accessories';
    accessories.append(el('h2', 'منتجات مختارة لك'), el('p', 'إضافات تناسب استخدامك اليومي'));
    for (const p of config.accessories) {
      const row = el('div', '', 'lb-row'), img = el('img'); img.src = p.image; img.alt = ''; img.loading = 'lazy';
      const copy = el('div', '', 'lb-copy'), link = el('a', p.name); link.href = p.url;
      copy.append(link, el('p', money(p.price)));
      const add = el('button', 'أضف للسلة'); add.type = 'button';
      const notice = el('p', '', 'lb-status'); notice.setAttribute('role', 'status'); copy.append(notice);
      add.addEventListener('click', async () => {
        if (add.disabled) return;
        add.disabled = true; notice.textContent = 'تتم الإضافة...';
        try {
          const res = await cart.addItem({id:p.id, quantity:1});
          if (res?.success === false || Number(res?.status) >= 400) throw new Error('add failed');
          notice.textContent = 'تمت الإضافة ✓';
        } catch (_) {notice.textContent = 'تعذرت الإضافة؛ تحقق من التوفر.';}
        finally {add.disabled = false;}
      });
      row.append(img, copy, add); accessories.append(row);
    }
    form.after(accessories);
    return true;
  }
  fetch(BASE + '/bundle-upsells-config.json', {credentials:'omit'}).then(r => r.ok ? r.json() : null).then(data => {
    const config = data?.bundles?.[id]; if (!config) return;
    if (mount(config)) return;
    const observer = new MutationObserver(() => {if (mount(config)) observer.disconnect();});
    observer.observe(document.documentElement, {childList:true, subtree:true});
    setTimeout(() => observer.disconnect(), 15000);
  }).catch(() => {});
})();
