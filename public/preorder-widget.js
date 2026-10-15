/* Loaded only by the separate preorder loader. Never changes stock or places orders. */
(()=>{
 'use strict';
 if(window.__linkPreorderWidget)return;window.__linkPreorderWidget=true;
 const script=document.currentScript,origin=new URL(script?.src||location.href).origin;
 const preview=script?.dataset.mode==='preview',beforeAdd=script?.dataset.beforeAdd==='1',targetId=/^\d+$/.test(script?.dataset.productId||'')?script.dataset.productId:'318533359';
 const productId=(location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1];
 const bridge=productId==='981596666';
 const cartPage=/^\/(?:ar\/|en\/)?cart\/?$/.test(location.pathname);
 const demo=preview&&location.pathname==='/preorder-preview.html';
 if(!cartPage&&!demo&&!bridge&&productId!==targetId)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const day=d=>new Intl.DateTimeFormat('ar-SA-u-nu-latn',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Riyadh',calendar:'gregory'}).format(new Date(d+'T12:00:00Z'));
 const range=p=>p.ship_from.slice(0,7)===p.ship_by.slice(0,7)?`${Number(p.ship_from.slice(-2))}–${day(p.ship_by)}`:`${day(p.ship_from)} — ${day(p.ship_by)}`;
 const dates=p=>`<div class="po-timeline">${/^\d{4}-\d{2}-\d{2}$/.test(p.expected_arrival||'')?`<div><span>وصول الدفعة المتوقع</span><b>${day(p.expected_arrival)}</b></div>`:''}<div><span>شحن طلبك المتوقع</span><b>${range(p)}</b></div></div>`;
 const today=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Riyadh'}).format(new Date());
 const parse=r=>{const d=r?.data??r;const items=[d?.items,d?.cart?.items,d?.data?.items].find(Array.isArray);if(!items)throw Error('incomplete_cart');return items;};
 const pid=i=>String(i?.product_id??i?.product?.id??'');
 const safeBookingURL=c=>{try{const u=new URL(c.booking_url);return u.protocol==='https:'&&['linkstore-sa.com','www.linkstore-sa.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname.endsWith('/p'+c.booking_id);}catch{return false;}};
 const css=document.createElement('style');css.textContent=`.link-preorder{direction:rtl;text-align:right;font-family:inherit;border:1px solid #d9c8e5;border-radius:18px;background:#faf6fd;color:#30223b;padding:19px;margin:18px 0;line-height:1.8;scroll-margin-top:100px}.link-preorder *{box-sizing:border-box}.link-preorder .po-tag{display:inline-block;background:#51007a;color:#fff;border-radius:7px;padding:2px 10px;font-size:12px;font-weight:700}.link-preorder h3{font-size:19px;line-height:1.5;color:#51007a;margin:9px 0 5px}.link-preorder p{margin:6px 0;font-size:14px}.link-preorder .po-date{font-size:17px;font-weight:800;color:#51007a}.link-preorder .po-muted{font-size:12px;color:#675870}.link-preorder label{display:flex;align-items:flex-start;gap:10px;border-top:1px solid #e3d7eb;padding-top:12px;margin-top:12px;cursor:pointer;font-size:13px}.link-preorder input{width:19px;height:19px;flex:none;margin:4px 0 0;accent-color:#51007a}.link-preorder .po-error{color:#a61b38;font-weight:700;font-size:13px;min-height:0}.link-preorder.po-focus{outline:2px solid #9a4bc0}.link-preorder .po-test{color:#765a82;font-size:11px}.link-preorder ul{margin:5px 0;padding-inline-start:20px}`;document.head.appendChild(css);
 css.textContent+=`.link-preorder .po-timeline{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:15px 0}.link-preorder .po-timeline>div{padding:12px;border-radius:12px;background:#fff;border:1px solid #e7daed}.link-preorder .po-timeline span{display:block;font-size:12px;color:#776481}.link-preorder .po-timeline b{display:block;font-size:16px;color:#51007a;margin-top:4px}.link-preorder .po-lead{font-size:15px;line-height:1.9}.link-preorder .po-reassure{color:#51007a;font-weight:700}@media(max-width:420px){.link-preorder .po-timeline{grid-template-columns:1fr}.link-preorder h3{font-size:18px}}`;
 css.textContent+=`.link-preorder .po-color-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.link-preorder .po-color-card{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #e7daed;border-radius:14px;padding:14px;min-width:0}.link-preorder .po-color-card img{flex:none;width:88px;height:88px;object-fit:contain;border-radius:10px}.link-preorder .po-color-copy{flex:1;min-width:0}.link-preorder h4{display:flex;align-items:center;gap:7px;margin:0;color:#30223b;font-size:16px}.link-preorder .po-color-dot{width:13px;height:13px;border:1px solid #0002;border-radius:50%;flex:none}.link-preorder .po-color-state{color:#51007a;font-weight:700;font-size:13px}.link-preorder .po-color-action{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:13px;font-weight:700;text-align:center;text-decoration:none;border:0;border-radius:9px;background:#51007a;color:#fff;padding:10px 8px;margin-top:10px;cursor:pointer}.link-preorder .po-color-action:disabled{background:#eee8f1;color:#77667f;cursor:default}.link-preorder .po-color-action:focus-visible{outline:3px solid #21b0f1;outline-offset:3px}@media(max-width:640px){.link-preorder .po-color-grid{grid-template-columns:1fr}.link-preorder .po-color-card img{width:76px;height:76px}}`;
 let schedule=[],root,ack=false,signature='',busy=false,timer,stopped=false,loadedAt=0,knownPreorderCart=false,bridgeConfig=null,bridgeStock=null;
 function mount(){
  const anchor=cartPage||demo&&document.querySelector('[data-po-demo-cart]')
   ?document.querySelector('[data-cart-submit],.cart-submit,.cart-summary,salla-cart-summary,form[action*="checkout"],[data-po-demo-cart]')
   :document.querySelector(`#product-${targetId} .main-content .product-form,.product-form,[data-po-demo-product]`);
  if(!anchor)return false;
  if(!root||!root.isConnected){signature='';root=document.createElement('section');root.className='link-preorder';root.id='link-preorder-notice';root.setAttribute('aria-label','تفاصيل الحجز المسبق');anchor.before(root);root.addEventListener('change',e=>{if(e.target.matches('[data-po-ack]')){ack=e.target.checked;root.querySelector('.po-error').textContent='';root.classList.remove('po-focus');}});}
  return true;
 }
 function render(products,mixed=false,error=false){
  if(bridge&&!error&&bridgeConfig&&bridgeStock&&!bridgeConfig.colors.some(c=>bridgeStock[c.option_id]===true)){root?.remove();root=null;signature='';return;}
  if(!products.length&&!error){root?.remove();root=null;signature='';ack=false;return;}
  if(!mount())return;
  const next=JSON.stringify({products,mixed,error,bridgeStock});if(next===signature)return;signature=next;ack=false;
  if(error){root.innerHTML='<span class="po-tag">حجز مسبق</span><h3>تعذر التحقق من موعد الشحن</h3><p>حدّث الصفحة أو تواصل معنا للتأكد من الموعد قبل متابعة الطلب.</p>';return;}
  const unavailable=products.some(p=>p.status!=='open'||p.ship_by<today());
  if(bridge){
   const source=products.find(p=>String(p.id)===bridgeConfig?.schedule_source_id),colors=(bridgeConfig?.colors||[]).filter(c=>bridgeStock?.[c.option_id]===true);
   if(!colors.length){root.remove();root=null;signature='';return;}
   const future=source&&source.ship_by>=today();
   const link=c=>{const u=new URL(location.href),target=new URL(c.booking_url);return u.hostname==='salla.sa'&&/^\/linkstore122(?:\/|$)/.test(u.pathname)?u.origin+'/linkstore122'+target.pathname+u.search:target.href;};
   root.innerHTML=`${preview?'<p class="po-test">معاينة على ثيم التجارب</p>':''}<span class="po-tag">الألوان القادمة</span><h3>لونك المفضّل راجع قريب 💜</h3><p class="po-lead">نفدت هالألوان من الدفعة الحالية، ودفعة جديدة بالطريق. اختر لونك واطّلع على حالة الحجز أدناه.</p>${future?dates(source):'<p class="po-muted">نعمل على تحديث موعد الدفعة القادمة.</p>'}<div class="po-color-grid">${colors.map(c=>{
    const booking=products.find(p=>String(p.id)===c.booking_id),open=!preview&&booking?.status==='open'&&booking.ship_by>=today();
    return `<article class="po-color-card" data-po-color="${esc(c.option_id)}"><img src="${esc(c.image)}" width="88" height="88" loading="lazy" decoding="async" alt="إطار آيفون 18 برو ماكس — ${esc(c.name)}"><div class="po-color-copy"><h4><span class="po-color-dot" style="background:${esc(c.swatch)}" aria-hidden="true"></span>${esc(c.name)}</h4><p class="po-color-state">${open?'متاح للحجز المسبق':c.booking_id?'الحجز غير متاح حالياً':'فتح الحجز قريباً'}</p><p class="po-muted">${open?'احجز من الدفعة القادمة، ونشحن لك بعد وصولها وفحصها.':'اللون ضمن الدفعة القادمة. سنفتح الحجز عند اكتمال تجهيزه.'}</p>${open?`<a class="po-color-action" href="${esc(link(c))}">احجز ${esc(c.name)}</a>`:`<button type="button" class="po-color-action" disabled>${c.booking_id?'الحجز غير متاح حالياً':'الحجز يفتح قريباً'}</button>`}</div></article>`;
   }).join('')}</div><p class="po-muted">موعد الشحن يعني تسليم الطلب للناقل؛ وتُضاف مدة التوصيل حسب مدينتك. الألوان المتوفرة الآن تُطلب من خيارات المنتج المعتادة.</p>`;
   return;
  }
  root.innerHTML=`${preview?'<p class="po-test">معاينة على ثيم التجارب — الحجز لم يُفتح للعملاء</p>':''}<span class="po-tag">حجز مسبق · الدفعة القادمة</span><h3>${mixed?'طلبك يجمع منتجات جاهزة وحجزاً مسبقاً':'نفدت الدفعة… وقطعتك الجاية بالطريق 💜'}</h3>${mixed?'':'<p class="po-lead">نفدت الكمية الحالية من هذا المنتج بسبب الإقبال عليه. والخبر الحلو؟ دفعة جديدة في الطريق!</p>'}${products.map(p=>`<p><b>${esc(p.name)}${p.color?' · '+esc(p.color):''}</b></p>${dates(p)}`).join('')}<p class="po-reassure">${!unavailable&&!preview?'احجز قطعتك من الدفعة القادمة؛ وبمجرد وصولها وفحصها نجهّز طلبك ونشحنه لك ضمن الموعد الموضّح.':'بمجرد وصول الدفعة وفحصها، نجهّز طلبات الحجز ونشحنها ضمن الموعد الموضّح.'}</p><p class="po-muted">هذا حجز مسبق، والمنتج غير جاهز للشحن الآن. موعد الشحن يعني تسليم طلبك للناقل، وتُضاف بعده مدة التوصيل حسب مدينتك.</p>${mixed?'<p><strong>يُشحن الطلب كاملاً مع منتجات الحجز في شحنة واحدة عند جاهزيتها.</strong> إذا تبغى المنتجات الجاهزة الآن، اطلبها بطلب مستقل؛ تظهر رسوم كل طلب قبل الدفع.</p>':'<p class="po-muted">إذا أضفت منتجات جاهزة، يُشحن الطلب كاملاً عند جاهزية الحجز. إذا تبغاها الآن، اطلبها بطلب مستقل.</p>'}${unavailable?`<p class="po-muted">${preview?'هذه معاينة للدفعة القادمة، والحجز لم يُفتح بعد.':'الحجز متوقف حالياً. تواصل معنا للتأكد من موعد فتحه.'}</p>`:''}<label><input type="checkbox" data-po-ack><span>اطّلعت على الموعد المتوقع، وأوافق على شحن الطلب كاملاً عند جاهزية منتجات الحجز.</span></label><p class="po-error" role="alert"></p>`;
  if(beforeAdd)root.querySelector('[data-po-ack]')?.closest('label')?.remove();
 }
 async function refresh(){
  if(cartPage&&window.__linkShippingTrial){render([]);return;}
  if(busy||stopped)return;busy=true;
  try{
   const isCart=cartPage||demo&&document.querySelector('[data-po-demo-cart]');
   let mixed=false;
   if(isCart){
    const items=parse(await window.salla.cart.details());
    knownPreorderCart=items.some(i=>pid(i)===targetId);
    if(!knownPreorderCart){render([]);return;}
    mixed=items.some(i=>pid(i)!==targetId);
   }
   if(Date.now()-loadedAt>30000){
    if(bridge){
     const configResponse=await fetch(origin+'/preorder-frame-colors.json?v=20261015-6',{credentials:'omit',cache:'no-store'});
     if(!configResponse.ok)throw Error('bridge_config');const config=await configResponse.json();
     if(config.product_id!==productId||!/^\d+$/.test(config.schedule_source_id||'')||!Array.isArray(config.colors)||config.colors.length>20||config.colors.some(c=>!/^\d+$/.test(c.option_id||'')||c.booking_id!==null&&!/^\d+$/.test(c.booking_id||'')||!/^#[0-9a-f]{6}$/i.test(c.swatch||'')||!/^https:\/\//.test(c.image||'')))throw Error('bridge_config');
     if(config.colors.some(c=>c.booking_id&&!safeBookingURL(c)))throw Error('bridge_config');
     bridgeConfig=config;
     // The theme supplies authoritative option state as details[].is_out.
     // Read that observed page contract first; the SDK projection can omit it.
     const native=document.querySelector('salla-product-options[product-id="'+productId+'"]');
     let options;
     if(native?.hasAttribute('options'))options=JSON.parse(native.getAttribute('options'));
     else{
      if(typeof window.salla?.product?.getDetails!=='function')throw Error('bridge_stock');
      let stockTimer;const response=await Promise.race([window.salla.product.getDetails(productId,['options']),new Promise((_,reject)=>{stockTimer=setTimeout(()=>reject(Error('bridge_stock_timeout')),8000);})]).finally(()=>clearTimeout(stockTimer));
      const detail=response?.data?.product||response?.data||response?.product||response;
      if(String(detail?.id)!==productId)throw Error('bridge_stock');options=detail.options;
     }
     if(!Array.isArray(options))throw Error('bridge_stock');
     const values=options.flatMap(o=>o.details||o.values||[]),stock={};
     for(const c of config.colors){
      const matches=values.filter(v=>String(v.id)===c.option_id);if(matches.length!==1)throw Error('bridge_stock');
      const v=matches[0],out=typeof v.is_out==='boolean'?v.is_out:v.is_out_of_stock;
      if(typeof out!=='boolean')throw Error('bridge_stock');stock[c.option_id]=out;
     }
     bridgeStock=stock;
    }
    const requestedIds=bridge?[...new Set([bridgeConfig.schedule_source_id,...bridgeConfig.colors.map(c=>c.booking_id).filter(Boolean)])].join(','):targetId;
    const response=await fetch(`${origin}/api/protection-feed?mode=preorders&ids=${requestedIds}${preview?'&preview=1':''}`,{credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error('schedule');const data=await response.json();if(!data.ok||!Array.isArray(data.products))throw Error('schedule');
    schedule=data.products.filter(p=>(bridge||String(p.id)===targetId)&&/^\d{4}-\d{2}-\d{2}$/.test(p.ship_from)&&/^\d{4}-\d{2}-\d{2}$/.test(p.ship_by));loadedAt=Date.now();
   }
   render(schedule,mixed,!schedule.length);
  }catch{if((!cartPage&&!demo)||demo&&!document.querySelector('[data-po-demo-cart]')||knownPreorderCart)render([],false,true);}finally{busy=false;}
 }
 // Covers native DOM clicks/submit, including composed web-component paths.
 // This is a UI reminder, not a server-side checkout restriction or consent record.
 function guard(e){
  if(beforeAdd&&!cartPage)return;
  if(cartPage&&window.__linkShippingTrial)return;
  if(bridge||!root?.isConnected)return;
  const path=e.composedPath?.()||[e.target];
  const checkout=cartPage||demo&&document.querySelector('[data-po-demo-cart]');
  const selector=checkout?'[data-cart-submit],.cart-submit,a[href*="/checkout"],button[name="checkout"],form[action*="checkout"]':`.product-form button[type="submit"],.product-form salla-add-product-button,salla-add-product-button[product-id="${targetId}"],[data-po-demo-add]`;
  if(e.type==='submit'&&!e.target.matches(checkout?'form[action*="checkout"],form[data-cart-submit]':'.product-form'))return;
  if(e.type==='click'&&!path.some(el=>el?.matches?.(selector)))return;
  const unavailable=schedule.some(p=>p.status!=='open'||p.ship_by<today());
  if(ack&&!unavailable&&!root.querySelector('.po-test'))return;
  e.preventDefault();e.stopImmediatePropagation();root.classList.add('po-focus');
  const error=root.querySelector('.po-error');if(error)error.textContent=preview?'هذه معاينة؛ الحجز لم يفتح بعد.':unavailable?'الحجز غير مفتوح حالياً؛ تواصل معنا قبل المتابعة.':'فضلاً اطّلع على موعد الشحن وحدد مربع الإقرار للمتابعة.';
  root.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});root.querySelector('input')?.focus({preventScroll:true});
 }
 document.addEventListener('click',guard,true);document.addEventListener('submit',guard,true);
 function start(){
  refresh();
  // Local DOM refreshes don't call the merchant API. Debounce theme redraws.
  const observer=new MutationObserver(records=>{if(records.every(r=>root?.contains(r.target)))return;clearTimeout(timer);timer=setTimeout(()=>{if(cartPage||!root?.isConnected)refresh();},800);});
  observer.observe(document.body,{childList:true,subtree:true});
  const events=window.salla?.cart?.event;
  for(const name of ['onItemAdded','onItemRemoved','onItemUpdated'])if(typeof events?.[name]==='function')events[name](()=>{clearTimeout(timer);timer=setTimeout(refresh,300);});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
  window.addEventListener('pagehide',()=>{stopped=true;observer.disconnect();clearTimeout(timer);},{once:true});
 }
 if(window.salla?.onReady)window.salla.onReady(start);else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
