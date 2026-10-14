/* Loaded only by the separate preorder loader. Never changes stock or places orders. */
(()=>{
 'use strict';
 if(window.__linkPreorderWidget)return;window.__linkPreorderWidget=true;
 const script=document.currentScript,origin=new URL(script?.src||location.href).origin;
 const preview=script?.dataset.mode==='preview',targetId='318533359';
 const productId=(location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1];
 const cartPage=/^\/(?:ar\/|en\/)?cart\/?$/.test(location.pathname);
 const demo=preview&&location.pathname==='/preorder-preview.html';
 if(!cartPage&&!demo&&productId!==targetId)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const day=d=>new Intl.DateTimeFormat('ar-SA-u-nu-latn',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Riyadh',calendar:'gregory'}).format(new Date(d+'T12:00:00Z'));
 const today=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Riyadh'}).format(new Date());
 const parse=r=>{const d=r?.data??r;const items=[d?.items,d?.cart?.items,d?.data?.items].find(Array.isArray);if(!items)throw Error('incomplete_cart');return items;};
 const pid=i=>String(i?.product_id??i?.product?.id??'');
 const css=document.createElement('style');css.textContent=`.link-preorder{direction:rtl;text-align:right;font-family:inherit;border:1px solid #d9c8e5;border-radius:18px;background:#faf6fd;color:#30223b;padding:19px;margin:18px 0;line-height:1.8;scroll-margin-top:100px}.link-preorder *{box-sizing:border-box}.link-preorder .po-tag{display:inline-block;background:#51007a;color:#fff;border-radius:7px;padding:2px 10px;font-size:12px;font-weight:700}.link-preorder h3{font-size:19px;line-height:1.5;color:#51007a;margin:9px 0 5px}.link-preorder p{margin:6px 0;font-size:14px}.link-preorder .po-date{font-size:17px;font-weight:800;color:#51007a}.link-preorder .po-muted{font-size:12px;color:#675870}.link-preorder label{display:flex;align-items:flex-start;gap:10px;border-top:1px solid #e3d7eb;padding-top:12px;margin-top:12px;cursor:pointer;font-size:13px}.link-preorder input{width:19px;height:19px;flex:none;margin:4px 0 0;accent-color:#51007a}.link-preorder .po-error{color:#a61b38;font-weight:700;font-size:13px;min-height:0}.link-preorder.po-focus{outline:2px solid #9a4bc0}.link-preorder .po-test{color:#765a82;font-size:11px}.link-preorder ul{margin:5px 0;padding-inline-start:20px}`;document.head.appendChild(css);
 let schedule=[],root,ack=false,signature='',busy=false,timer,stopped=false,loadedAt=0,knownPreorderCart=false;
 function mount(){
  const anchor=cartPage||demo&&document.querySelector('[data-po-demo-cart]')
   ?document.querySelector('[data-cart-submit],.cart-submit,.cart-summary,salla-cart-summary,form[action*="checkout"],[data-po-demo-cart]')
   :document.querySelector(`#product-${targetId} .main-content .product-form,.product-form,[data-po-demo-product]`);
  if(!anchor)return false;
  if(!root||!root.isConnected){signature='';root=document.createElement('section');root.className='link-preorder';root.id='link-preorder-notice';root.setAttribute('aria-label','تفاصيل الحجز المسبق');anchor.before(root);root.addEventListener('change',e=>{if(e.target.matches('[data-po-ack]')){ack=e.target.checked;root.querySelector('.po-error').textContent='';root.classList.remove('po-focus');}});}
  return true;
 }
 function render(products,mixed=false,error=false){
  if(!products.length&&!error){root?.remove();root=null;signature='';ack=false;return;}
  if(!mount())return;
  const next=JSON.stringify({products,mixed,error});if(next===signature)return;signature=next;ack=false;
  if(error){root.innerHTML='<span class="po-tag">حجز مسبق</span><h3>تعذر التحقق من موعد الشحن</h3><p>حدّث الصفحة أو تواصل معنا للتأكد من الموعد قبل متابعة الطلب.</p>';return;}
  const unavailable=products.some(p=>p.status!=='open'||p.ship_by<today());
  root.innerHTML=`${preview?'<p class="po-test">معاينة على ثيم التجارب — الحجز لم يُفتح للعملاء</p>':''}<span class="po-tag">حجز مسبق</span><h3>${mixed?'طلبك يجمع منتجات جاهزة وحجزاً مسبقاً':'هذا المنتج غير متوفر للشحن الفوري'}</h3>${products.map(p=>`<p><b>${esc(p.name)} · ${esc(p.color)}</b></p><p class="po-date">الشحن المتوقع: ${day(p.ship_from)} — ${day(p.ship_by)}</p>`).join('')}<p>هذه فترة تسليم الطلب لشركة الشحن؛ تُضاف بعدها مدة التوصيل حسب مدينتك.</p>${mixed?'<p><strong>يُشحن الطلب كاملاً مع منتجات الحجز في شحنة واحدة عند جاهزيتها.</strong> إذا تبغى المنتجات الجاهزة الآن، اطلبها بطلب مستقل؛ تظهر رسوم كل طلب قبل الدفع.</p>':'<p class="po-muted">إذا أضفت منتجات جاهزة، يُشحن الطلب كاملاً عند جاهزية الحجز. لطلب الجاهز الآن، أنشئ طلباً مستقلاً.</p>'}${unavailable?'<p><strong>الحجز غير مفتوح حالياً. لا تتابع الدفع قبل تأكيد إتاحته وموعد الشحن.</strong></p>':''}<label><input type="checkbox" data-po-ack><span>اطّلعت على موعد الشحن، وأفهم أن الطلب سيُشحن كاملاً عند جاهزية منتجات الحجز.</span></label><p class="po-error" role="alert"></p>`;
 }
 async function refresh(){
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
    const response=await fetch(`${origin}/api/protection-feed?mode=preorders&ids=${targetId}${preview?'&preview=1':''}`,{credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error('schedule');const data=await response.json();if(!data.ok||!Array.isArray(data.products))throw Error('schedule');
    schedule=data.products.filter(p=>String(p.id)===targetId&&/^\d{4}-\d{2}-\d{2}$/.test(p.ship_from)&&/^\d{4}-\d{2}-\d{2}$/.test(p.ship_by));loadedAt=Date.now();
   }
   render(schedule,mixed,!schedule.length);
  }catch{if((!cartPage&&!demo)||demo&&!document.querySelector('[data-po-demo-cart]')||knownPreorderCart)render([],false,true);}finally{busy=false;}
 }
 // Covers native DOM clicks/submit, including composed web-component paths.
 // This is a UI reminder, not a server-side checkout restriction or consent record.
 function guard(e){
  if(!root?.isConnected)return;
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
