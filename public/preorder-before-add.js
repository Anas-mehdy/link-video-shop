/* Opt-in choice before native Salla product button clicks.
   Cart is read-only: no add/delete, checkout interception or storage. */
(function(scope,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{scope.LinkPreorderBeforeAdd=api;api.start(scope);}
})(typeof window==='object'?window:globalThis,function(){
 'use strict';const PRODUCT='318533359';
 const error=code=>Object.assign(new Error(code),{code});
 const stable=x=>JSON.stringify(clean(x));
 function clean(x){if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,clean(x[k])]));return x;}
 function inspect(response){
  if(response?.success===false||Number(response?.status)>=400)throw error('cart_unavailable');
  const data=response?.data??response,rows=[data?.items,data?.cart?.items,data?.data?.items].find(Array.isArray);
  if(!rows)throw error('cart_unavailable');
  const items=rows.map(r=>{const id=String(r.product_id??r.product?.id??''),quantity=Number(r.quantity);
   if(!/^\d+$/.test(id)||!Number.isSafeInteger(quantity)||quantity<1)throw error('cart_unavailable');
   return {id,quantity,options:r.options??null};
  });
  const hasPreorder=items.some(i=>i.id===PRODUCT),hasReady=items.some(i=>i.id!==PRODUCT);
  return {items,hasPreorder,hasReady,mixed:hasPreorder&&hasReady,key:stable(items)};
 }
 function decide(cart,id){
  id=String(id);if(!/^\d+$/.test(id))throw error('product_unknown');
  return {mixes:id===PRODUCT?cart.hasReady:cart.hasPreorder,existingMixed:cart.mixed,addingPreorder:id===PRODUCT};
 }
 function cartURL(location){
  const url=new URL(location.href);
  if(url.hostname==='salla.sa')return /^\/linkstore122(?:\/|$)/.test(url.pathname)?new URL('/linkstore122/cart',url.origin).href:null;
  if(['linkstore-sa.com','www.linkstore-sa.com'].includes(url.hostname))return new URL('/cart',url.origin).href;
  return null;
 }
 function gate(){
  let cart=null,permission=null;
  return {
   update(response){const next=inspect(response);if(cart?.key!==next.key)permission=null;cart=next;return next;},
   invalidate(){cart=null;permission=null;},
   current:()=>cart,
   grant(id){if(!cart)throw error('cart_unavailable');permission={id:String(id),key:cart.key};},
   cancel(){permission=null;},
   validate(id){if(!cart)return {allowed:false,reason:'loading'};const decision=decide(cart,id);
    if(!decision.mixes)return {allowed:true,...decision};
    if(permission?.id===String(id)&&permission.key===cart.key){permission=null;return {allowed:true,...decision};}
    return {allowed:false,reason:'choice',...decision};
   }
  };
 }
 function start(w){
  const d=w.document,script=d.currentScript;
  if(script?.dataset.beforeAdd!=='1'||w.__linkBeforeAddStarted)return;
  // Product buttons only. Native cart and checkout pages remain completely untouched.
  if(/(?:^|\/)(?:cart|checkout)(?:\/|$)/.test(w.location.pathname))return;
  w.__linkBeforeAddStarted=true;
  const origin=new URL(script.src).origin,demo=script.dataset.demo==='1';
  const model=gate();let dialog,context=null,ack=false,schedule=null,ready=false,reading=null,version=0,bootTimer,stopped=false,bootTries=0,watching=false;
  const status={ready:false,reason:'waiting_for_sdk'};w.LinkPreorderBeforeAddStatus=status;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=x=>new Intl.DateTimeFormat('ar-SA-u-nu-latn',{day:'numeric',month:'long',year:'numeric',calendar:'gregory',timeZone:'Asia/Riyadh'}).format(new Date(x+'T12:00:00Z'));
  const bounded=fn=>new Promise((resolve,reject)=>{const timer=w.setTimeout(()=>reject(error('read_timeout')),10000);Promise.resolve().then(fn).then(resolve,reject).finally(()=>w.clearTimeout(timer));});
  // Retain the established date/marketing card, without a competing add-button guard.
  if(!demo&&/\/p(?:318533359|981596666)(?:\/|$)/.test(w.location.pathname)&&!w.__linkPreorderWidget){
   const s=d.createElement('script');s.src=origin+'/preorder-widget.js';s.dataset.beforeAdd='1';s.async=true;d.head.appendChild(s);
  }
  function styles(){if(d.getElementById('po-before-add-style'))return;const s=d.createElement('style');s.id='po-before-add-style';s.textContent=`
   #po-before-add{box-sizing:border-box;direction:rtl;text-align:right;font-family:inherit;color:#30223b;background:#fff;border:1px solid #ddcce6;border-radius:18px;width:min(92vw,500px);max-height:86dvh;overflow:auto;padding:22px;position:fixed;inset:0;margin:auto;line-height:1.8}
   #po-before-add:not([open]){display:none}#po-before-add::backdrop{background:rgb(28 12 36 / .5)}#po-before-add h2{color:#51007a;font-size:22px;line-height:1.5;margin:8px 0}#po-before-add p{font-size:14px;margin:10px 0}
   #po-before-add .po-label{font-size:12px;color:#765282}#po-before-add .po-date{background:#f7f1fa;padding:12px;border-radius:10px;font-size:14px}#po-before-add label{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:15px 0}
   #po-before-add input{width:19px;height:19px;flex:none;accent-color:#51007a;margin-top:5px}#po-before-add button,#po-before-add a.po-link{font:inherit;display:block;width:100%;box-sizing:border-box;text-align:center;cursor:pointer;border-radius:10px;border:1px solid #dac9e4;padding:11px;text-decoration:none;margin:9px 0;background:white;color:#51007a}
   #po-before-add .po-primary{background:#51007a;color:white;border:0}#po-before-add small{display:block;color:#76667d;font-size:12px}#po-before-add .po-error{color:#a51e3b}#po-before-add button:disabled{opacity:.5;cursor:wait}
  `;d.head.appendChild(s);}
  function close(){if(dialog?.open&&typeof dialog.close==='function')dialog.close();else dialog?.removeAttribute('open');context=null;ack=false;}
  function show(message=''){
   const known=model.current();
   // Shipping choices are meaningful only when this addition mixes stock types.
   if(!context||!known||!decide(known,context.id).mixes){model.cancel();close();return;}
   if(!d.body)return;styles();
   if(!dialog){dialog=d.createElement('dialog');dialog.id='po-before-add';dialog.setAttribute('aria-labelledby','po-before-title');d.body.appendChild(dialog);
    dialog.addEventListener('cancel',()=>{model.cancel();context=null;ack=false;});
    dialog.addEventListener('change',e=>{if(e.target.matches('[data-po-together]')){ack=e.target.checked;const b=dialog.querySelector('[data-po-approve]');if(b)b.disabled=!ack;}});
    dialog.addEventListener('click',async e=>{
     if(e.target.closest('[data-po-close]')){model.cancel();close();return;}
     if(e.target.closest('[data-po-retry]')){try{await read();show();}catch{show('تعذر التحقق من السلة. حاول مجدداً قبل الإضافة.');}return;}
     const approval=e.target.closest('[data-po-approve]');if(!approval||!ack||!context)return;
     approval.disabled=true;const expected=model.current()?.key,candidate=context.id,component=context.component;
     try{
      await read();if(!context||context.id!==candidate)return;
      if(model.current()?.key!==expected){model.cancel();ack=false;show('تغيّرت السلة. راجع الخيارات ووافق من جديد.');return;}
      if(!scheduleValid()){show('تعذر التحقق من موعد الحجز. حاول مجدداً قبل الإضافة.');return;}
      model.grant(candidate);close();
      // Customer presses the original native add button. Never replay a click or submit.
      const target=component?.el??component;target?.focus?.({preventScroll:true});
      w.salla?.notify?.success?.('تم اعتماد الشحنة الواحدة. اضغط زر الإضافة الأصلي لإكمال الإضافة.');
     }catch{show('تعذر التحقق من السلة. لم نضف أو نحذف أي منتج.');}
    });
   }
   const cart=model.current(),decision=cart&&context?decide(cart,context.id):null;
   const url=demo?'#demo-cart':cartURL(w.location);
   let body;
   {
    const first=decision.addingPreorder?'المنتجات المتوفرة':'منتجات الحجز',next=decision.addingPreorder?'الحجز':'المنتج المتوفر';
    body=`<p>${decision.addingPreorder?'عندك منتجات متوفرة بالسلة، والمنتج اللي بتضيفه حجز مسبق.':'عندك حجز مسبق بالسلة، والمنتج اللي بتضيفه متوفر للشحن.'}</p>
     ${schedule?`<div class="po-date">الشحن المتوقع للحجز: <b>${esc(fmt(schedule.ship_from))} إلى ${esc(fmt(schedule.ship_by))}</b><small>تُضاف مدة توصيل الناقل حسب مدينتك.</small></div>`:''}
     <label><input type="checkbox" data-po-together ${ack?'checked':''}><span><b>أوفّر الشحن وأستلم الطلب كامل مع بعض</b><small>أوافق أن المنتجات المتوفرة تنتظر وصول الحجز وفحصه. شحنة واحدة، ورسومها تظهر حسب عنواني قبل الدفع.</small></span></label>
     <button class="po-primary" data-po-approve ${!ack||!scheduleValid()?'disabled':''}>اعتمد الشحنة الواحدة</button><small>بعد الاعتماد، اضغط زر الإضافة الأصلي مرة ثانية. لن تُضاف منتجات تلقائياً.</small>
     <hr><p><b>أفضل أستلم كل نوع بطلب مستقل</b></p>
     <p>${decision.existingMixed?'سلتك تجمع النوعين بالفعل. عدّل محتوياتها من سلة الأصلية لإكمال كل نوع بطلب مستقل. لن نفصلها تلقائياً.':`أكمل شراء ${first} الموجودة بالسلة أولاً، ثم ارجع لهذه الصفحة لشراء ${next} بطلب مستقل. لكل طلب رسوم شحن تظهر حسب عنوانك قبل الدفع.`}</p>
     ${url?`<a class="po-link" href="${esc(url)}" ${demo?'':'target="_blank" rel="noopener"'}>${decision.existingMixed?'افتح سلة المتجر للمراجعة':`أكمل طلب ${first} أولاً`}</a>`:'<p>افتح سلة المتجر من أيقونة السلة لإكمال الطلب الأول.</p>'}
     <small>المنتج الجديد لم يُضف بعد. تبقى صفحة المنتج مفتوحة للعودة إليها.</small>`;
   }
   dialog.innerHTML=`<span class="po-label">${demo?'محاكاة فقط · ':''}قبل إضافة المنتج</span><h2 id="po-before-title">كيف تحب تستلم طلبك؟</h2>${body}<p class="po-error" role="alert">${esc(message)}</p><button data-po-close>رجوع للمنتج</button>`;
   if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  }
  function scheduleValid(){
   if(!schedule||schedule.status!=='open'||!/^\d{4}-\d{2}-\d{2}$/.test(schedule.ship_from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(schedule.ship_by||''))return false;
   const today=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Riyadh'}).format(new Date());return schedule.ship_by>=today;
  }
  async function read(){
   if(reading)return reading;
   const expectedVersion=version;
   reading=(async()=>{
    const response=await bounded(()=>w.salla.cart.details());
    if(expectedVersion!==version||stopped)throw error('cart_changed');
    const cart=model.update(response);
    const currentId=context?.id??(w.location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1];
    if(cart.hasPreorder||currentId===PRODUCT){
     const json=await bounded(async()=>{const r=await w.fetch(origin+'/api/protection-feed?mode=preorders&ids='+PRODUCT,{credentials:'omit',cache:'no-store'});if(!r.ok)throw error('schedule_unavailable');return r.json();}).catch(()=>null);
     if(expectedVersion!==version||stopped)throw error('cart_changed');
     schedule=json?.ok&&json.products?.find(p=>String(p.id)===PRODUCT);
    }
    status.reason='ready';return cart;
   })().catch(e=>{model.invalidate();status.reason=e.code||'cart_unavailable';throw e;}).finally(()=>{reading=null;});
   return reading;
  }
  function validation(ctx){
   if(ctx.isValid===false||stopped)return;
   const id=String(ctx.productId??ctx.component?.productId??ctx.component?.getAttribute?.('product-id')??'');if(!/^\d+$/.test(id))return;
   const result=model.validate(id);
   if(result.allowed)return; // Native preorder campaign validates availability; no shipping dialog for one type.
   ctx.isValid=false; // Block this native gesture; mixed-cart approval requires a fresh customer press.
   context={id,component:ctx.component};ack=false;
   show(id===PRODUCT&&!scheduleValid()?'نتحقق من موعد الحجز قبل الإضافة.':'');
   if(result.reason==='loading'||id===PRODUCT&&!scheduleValid())read().then(()=>{if(context)show();}).catch(()=>show('تعذر التحقق من السلة أو موعد الحجز. حاول مجدداً.'));
  }
  function install(){
   if(ready||stopped)return;
   if(typeof w.salla?.cart?.details!=='function')return;
   ready=true;status.ready=true;status.reason='reading_cart';
   // Actual Twilight 2.14.600 calls its validate hook only with a product-options
   // component, and omits productId. Capture the native button gesture instead.
   // Native validation and cart addition still execute normally after approval.
   let resuming=false,pendingGesture=false;
   function capture(e){
    if(resuming)return;
    if(e.defaultPrevented||stopped)return;
    const nodes=e.composedPath?.()||[e.target];
    const button=nodes.find(n=>n?.matches?.('salla-add-product-button'))||e.target?.closest?.('salla-add-product-button');
    if(!button)return;
    if(pendingGesture){e.preventDefault();e.stopImmediatePropagation();return;}
    const id=button.productId??button.getAttribute('product-id');
    const ctx={productId:id,component:button,isValid:true};
    if(!/^\d+$/.test(String(id??'')))return;
    if(!model.current()){
     // Stop before native handlers; wait silently for the initial cart snapshot.
     // Resume exactly this unprocessed gesture once, never a submitted cart request.
     e.preventDefault();e.stopImmediatePropagation();
     if(pendingGesture)return;pendingGesture=true;
     const target=nodes.find(n=>typeof n?.click==='function')||button,path=w.location.pathname;
     button.setAttribute('aria-busy','true');
     read().then(()=>{
      if(stopped||!button.isConnected||w.location.pathname!==path)return;
      validation(ctx);if(ctx.isValid===false)return;
      d.getElementById('po-cart-read-error')?.remove();
      resuming=true;try{target.click();}finally{resuming=false;}
     }).catch(()=>{
      if(stopped||!button.isConnected)return;
      let note=d.getElementById('po-cart-read-error');if(!note){note=d.createElement('p');note.id='po-cart-read-error';note.setAttribute('role','alert');button.after(note);}
      note.textContent='تعذر التحقق من السلة. حاول الإضافة مجدداً.';
     }).finally(()=>{pendingGesture=false;button.removeAttribute('aria-busy');});
     return;
    }
    d.getElementById('po-cart-read-error')?.remove();validation(ctx);
    if(ctx.isValid===false){e.preventDefault();e.stopImmediatePropagation();}
   }
   d.addEventListener('click',capture,true);
   const unsubscribe=()=>d.removeEventListener('click',capture,true);
   read().catch(()=>{});
   w.__linkBeforeAddUnsubscribe=unsubscribe;
   if(!watching){watching=true;
    const changed=()=>{if(stopped)return;version++;model.invalidate();ack=false;read().then(()=>{if(context)show();}).catch(()=>{});};
    const events=w.salla.cart.event;
    for(const name of ['onItemAdded','onItemDeleted','onItemRemoved','onItemUpdated','onItemQuantityUpdated'])if(typeof events?.[name]==='function')events[name](changed);
    d.addEventListener('visibilitychange',()=>{if(d.visibilityState==='visible')changed();});
    w.addEventListener('pagehide',()=>{stopped=true;w.clearTimeout(bootTimer);w.__linkBeforeAddUnsubscribe?.();});
    w.addEventListener('pageshow',e=>{if(e.persisted){stopped=false;ready=false;install();}});
   }
  }
  function boot(){
   if(stopped||ready)return;install();if(ready)return;
   if(++bootTries<80)bootTimer=w.setTimeout(boot,150);else status.reason='sdk_unavailable';
  }
  if(d.body){if(w.salla?.onReady)try{const r=w.salla.onReady(install);r?.then?.(install,()=>{});}catch{}boot();}
  else d.addEventListener('DOMContentLoaded',boot,{once:true});
 }
 return {PRODUCT,inspect,decide,cartURL,gate,start};
});
