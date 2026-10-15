/* Opt-in choice before native Salla product button clicks.
   Cart is read-only: no add/delete, checkout interception or storage. */
(function(scope,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{scope.LinkPreorderBeforeAdd=api;api.start(scope);}
})(typeof window==='object'?window:globalThis,function(){
 'use strict'; const PRODUCT='318533359'; // Historical bridge/demo ID, never used to classify live catalog.
 const error=code=>Object.assign(new Error(code),{code});
 const stable=x=>JSON.stringify(clean(x));
 function clean(x){if(Array.isArray(x))return x.map(clean);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,clean(x[k])]));return x;}
 const realDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 function catalogOf(products){
  if(!Array.isArray(products)||products.length>200)throw error('catalog_unavailable');
  const catalog={};
  for(const p of products){const id=String(p.id??'');
   if(!/^\d+$/.test(id)||catalog[id]||!['open','paused'].includes(p.status)||![p.expected_arrival,p.ship_from,p.ship_by].every(realDate)||p.expected_arrival>p.ship_from||p.ship_from>p.ship_by||!Number.isInteger(p.revision)||p.revision<1)throw error('catalog_unavailable');
   catalog[id]={id,name:String(p.name||'منتج حجز'),color:String(p.color||''),status:p.status,expected_arrival:p.expected_arrival,ship_from:p.ship_from,ship_by:p.ship_by,revision:p.revision};
  }
  return catalog;
 }
 const group=p=>p?'preorder:'+p.expected_arrival+':'+p.ship_from+':'+p.ship_by:'ready';
 // Dedicated booking products stay recognizable while their CRM batches are pending.
 // The manifest never grants selling permission; only an open dated CRM batch does.
 function pendingCatalog(catalog,config){
  if(config?.product_id!=='981596666'||!/^\d+$/.test(config.schedule_source_id||'')||!Array.isArray(config.colors)||config.colors.length>20)throw error('catalog_unavailable');
  const result={...catalog},seen=new Set(),source=catalog[config.schedule_source_id];
  for(const c of config.colors){
   if(c.booking_id===null)continue;
   const id=String(c.booking_id??'');
   if(!/^\d+$/.test(id)||seen.has(id)||typeof c.name!=='string'||!c.name.trim())throw error('catalog_unavailable');seen.add(id);
   if(!result[id])result[id]={id,name:'إطار Link المعدني iPhone 18 Pro Max',color:c.name,status:'pending',expected_arrival:source?.expected_arrival||null,ship_from:source?.ship_from||null,ship_by:source?.ship_by||null,revision:0};
  }
  return result;
 }
 function inspect(response,catalog={}){
  if(response?.success===false||Number(response?.status)>=400)throw error('cart_unavailable');
  const data=response?.data??response,rows=[data?.items,data?.cart?.items,data?.data?.items].find(Array.isArray);
  if(!rows)throw error('cart_unavailable');
  const items=rows.map(r=>{const id=String(r.product_id??r.product?.id??''),quantity=Number(r.quantity);
   if(!/^\d+$/.test(id)||!Number.isSafeInteger(quantity)||quantity<1)throw error('cart_unavailable');
   return {id,quantity,options:r.options??null};
  });
  const hasPreorder=items.some(i=>!!catalog[i.id]),hasReady=items.some(i=>!catalog[i.id]);
  return {items,catalog,hasPreorder,hasReady,mixed:new Set(items.map(i=>group(catalog[i.id]))).size>1,key:stable({items,catalog})};
 }
 function decide(cart,incoming){
  const ids=(Array.isArray(incoming)?incoming:[incoming]).map(String);
  if(!ids.length||ids.some(id=>!/^\d+$/.test(id)))throw error('product_unknown');
  const all=[...new Set([...cart.items.map(i=>i.id),...ids])],products=all.map(id=>cart.catalog[id]).filter(Boolean);
  const groups=new Set(all.map(id=>group(cart.catalog[id]))),preorderGroups=new Set(products.map(group));
  return {mixes:groups.size>1,existingMixed:cart.mixed,addingPreorder:ids.some(id=>!!cart.catalog[id]),bothIncoming:new Set(ids.map(id=>group(cart.catalog[id]))).size>1,differentDates:preorderGroups.size>1,products,
   combined:products.length?{ship_from:products.map(p=>p.ship_from).sort().at(-1),ship_by:products.map(p=>p.ship_by).sort().at(-1)}:null};
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
   update(response,catalog){const next=inspect(response,catalog);if(cart?.key!==next.key)permission=null;cart=next;return next;},
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
  const model=gate();let dialog,context=null,ack=false,ready=false,reading=null,version=0,bootTimer,stopped=false,bootTries=0,watching=false,noticePermission=null,approving=false;
  const nativeForms=new WeakMap();
  const formState=form=>stable([...form.querySelectorAll('input,select,textarea')].map(x=>[x.name,x.type,x.value,!!x.checked]));
  const status={ready:false,reason:'waiting_for_sdk'};w.LinkPreorderBeforeAddStatus=status;
  const quickSelector='salla-quick-buy,salla-mini-checkout-widget,.s-add-product-button-buy-now,.s-fast-checkout-button';
  function syncShortcuts(){
   const cart=model.current(),pageId=(w.location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1];
   d.documentElement.toggleAttribute('data-link-po-cart-flow',!cart||cart.hasPreorder||!!cart?.catalog[pageId]);
  }
  const quickStyle=d.createElement('style');quickStyle.id='po-shortcuts-style';quickStyle.textContent=quickSelector.split(',').map(x=>'html[data-link-po-cart-flow] '+x).join(',')+'{display:none!important}';d.head.appendChild(quickStyle);syncShortcuts();
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=x=>realDate(x)?new Intl.DateTimeFormat('ar-SA-u-nu-latn',{day:'numeric',month:'long',year:'numeric',calendar:'gregory',timeZone:'Asia/Riyadh'}).format(new Date(x+'T12:00:00Z')):'قيد التأكيد';
  const available=p=>p.status==='open'&&[p.expected_arrival,p.ship_from,p.ship_by].every(realDate)&&p.ship_by>=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Riyadh'}).format(new Date());
  const bounded=fn=>new Promise((resolve,reject)=>{const timer=w.setTimeout(()=>reject(error('read_timeout')),10000);Promise.resolve().then(fn).then(resolve,reject).finally(()=>w.clearTimeout(timer));});
  // Date card is loaded only for catalog-recognized preorder products.
  function disclose(){
   const pageId=(w.location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1];
   if(!demo&&(model.current()?.catalog[pageId]||pageId==='981596666')&&!w.__linkPreorderWidget&&!d.getElementById('link-po-disclosure-loader')){
    const s=d.createElement('script');s.id='link-po-disclosure-loader';s.src=origin+'/preorder-widget.js?v=20261015-7';s.dataset.beforeAdd='1';s.dataset.productId=pageId==='981596666'?PRODUCT:pageId;s.async=true;d.head.appendChild(s);
   }
  }
  function styles(){if(d.getElementById('po-before-add-style'))return;const s=d.createElement('style');s.id='po-before-add-style';s.textContent=`
   #po-before-add{box-sizing:border-box;direction:rtl;text-align:right;font-family:inherit;color:#30223b;background:#fff;border:1px solid #ddcce6;border-radius:18px;width:min(92vw,500px);max-height:86dvh;overflow:auto;padding:22px;position:fixed;inset:0;margin:auto;line-height:1.8}
   #po-before-add:not([open]){display:none}#po-before-add::backdrop{background:rgb(28 12 36 / .5)}#po-before-add h2{color:#51007a;font-size:22px;line-height:1.5;margin:8px 0}#po-before-add p{font-size:14px;margin:10px 0}
   #po-before-add .po-label{font-size:12px;color:#765282}#po-before-add .po-date{background:#f7f1fa;padding:12px;border-radius:10px;font-size:14px}#po-before-add label{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:15px 0}
   #po-before-add input{width:19px;height:19px;flex:none;accent-color:#51007a;margin-top:5px}#po-before-add button,#po-before-add a.po-link{font:inherit;display:block;width:100%;box-sizing:border-box;text-align:center;cursor:pointer;border-radius:10px;border:1px solid #dac9e4;padding:11px;text-decoration:none;margin:9px 0;background:white;color:#51007a}
   #po-before-add .po-primary{background:#51007a;color:white;border:0}#po-before-add small{display:block;color:#76667d;font-size:12px}#po-before-add .po-error{color:#a51e3b}#po-before-add button:disabled{opacity:.5;cursor:wait}
  `;d.head.appendChild(s);}
  function close(approved=false){const resolve=context?.resolve;if(dialog?.open&&typeof dialog.close==='function')dialog.close();else dialog?.removeAttribute('open');context=null;ack=false;resolve?.(approved);}
  function decisionFor(cart,c){return decide(cart,c.ids||c.id);}
  function show(message=''){
   const known=model.current();
   // Shipping choices are meaningful only when this addition mixes stock types.
   if(!context||!known){model.cancel();close();return;}
   const decision=decisionFor(known,context),unavailable=decision.products.some(p=>!available(p)),pending=decision.products.some(p=>p.status==='pending');
   if(!decision.mixes&&!context.external&&!unavailable){model.cancel();close();return;}
   if(!d.body)return;styles();
   if(!dialog){dialog=d.createElement('dialog');dialog.id='po-before-add';dialog.setAttribute('aria-labelledby','po-before-title');d.body.appendChild(dialog);
    dialog.addEventListener('cancel',()=>{model.cancel();close();});
    dialog.addEventListener('change',e=>{if(e.target.matches('[data-po-together]')){ack=e.target.checked;const b=dialog.querySelector('[data-po-approve]');if(b)b.disabled=!ack;}});
    dialog.addEventListener('click',async e=>{
     if(e.target.closest('[data-po-close],a.po-link')){model.cancel();noticePermission=null;close();return;}
     if(e.target.closest('[data-po-retry]')){try{await read();show();}catch{show('تعذر التحقق من السلة. حاول مجدداً قبل الإضافة.');}return;}
     const approval=e.target.closest('[data-po-approve]');if(!approval||!ack||!context||approving)return;
     approving=true;approval.disabled=true;const expected=model.current()?.key,request=context,candidate=context.id,component=context.component;
     try{
      await read();if(context!==request)return;
      if(model.current()?.key!==expected){model.cancel();ack=false;show('تغيّرت السلة أو مواعيد الدفعات. راجع التفاصيل ووافق من جديد.');return;}
      if(!scheduleValid()){show('تعذر التحقق من موعد الحجز. حاول مجدداً قبل الإضافة.');return;}
      if(context.resolve){close(true);return;}
      if(context.external){
       const resume=context.resume;
       if(typeof resume!=='function'||!component?.isConnected){close();return;}
       noticePermission={id:candidate,key:model.current().key,component};model.grant(candidate);close();
       // Resume the original, unprocessed native button once after explicit consent.
       // Capture runs again, consumes both approvals, then leaves Salla validation in charge.
       resume();return;
      }
      model.grant(candidate);close();
      // Customer presses the original native add button. Never replay a click or submit.
      const target=component?.el??component;target?.focus?.({preventScroll:true});
      w.salla?.notify?.success?.('تم اعتماد الشحنة الواحدة. اضغط زر الإضافة الأصلي لإكمال الإضافة.');
     }catch{show('تعذر التحقق من السلة. لم نضف أو نحذف أي منتج.');}finally{approving=false;}
    });
   }
   const cart=model.current();
   const url=demo?'#demo-cart':cartURL(w.location);
   let body;
   if(unavailable){
    body=`<p>${pending?'نعمل على تجهيز الحجز لهذا المنتج. الإضافة غير متاحة حالياً حتى تأكيد جاهزية الحجز.':'الحجز غير متاح حالياً. نراجع حالة الدفعة ومواعيدها قبل إتاحة الإضافة مجدداً.'}</p>${decision.products.filter(p=>!available(p)).map(p=>`<div class="po-date"><b>${esc(p.name)}${p.color?' · '+esc(p.color):''}</b><small>وصول الدفعة المتوقع: ${esc(fmt(p.expected_arrival))}</small><small>الشحن المتوقع: ${esc(fmt(p.ship_from))} إلى ${esc(fmt(p.ship_by))}</small><small>هذه مواعيد متوقعة للدفعة؛ الحجز غير متاح الآن.</small></div>`).join('')}<button data-po-retry>تحقق من إتاحة الحجز</button>`;
   }else if(context.external&&!decision.mixes){
    body=`<p>قطعتك من الدفعة القادمة 💜 هذا المنتج <b>حجز مسبق</b> وغير جاهز للشحن الآن.</p>${decision.products.filter(p=>(context.ids||[context.id]).includes(p.id)).map(p=>`<div class="po-date"><b>${esc(p.name)}${p.color?' · '+esc(p.color):''}</b><small>وصول الدفعة المتوقع: ${esc(fmt(p.expected_arrival))}</small><small>شحن طلبك المتوقع: ${esc(fmt(p.ship_from))} إلى ${esc(fmt(p.ship_by))}</small></div>`).join('')}<p>بمجرد وصول الدفعة وفحصها، نجهّز طلبك ونشحنه لك ضمن الموعد الموضّح. وتُضاف مدة التوصيل حسب مدينتك.</p><label><input type="checkbox" data-po-together ${ack?'checked':''}><span>اطّلعت على المواعيد المتوقعة، وأوافق على انتظار المنتج حتى وصوله وتجهيزه للشحن.</span></label><button class="po-primary" data-po-approve ${!ack?'disabled':''}>أوافق، أضف للحجز</button>`;
   }else{
    const first='المنتجات الموجودة بالسلة',next='الاختيارات الجديدة';
    body=`<p>${decision.differentDates?'طلبك فيه حجوزات بمواعيد وصول مختلفة. باختيار شحنة واحدة، نجهّز طلبك كامل بعد وصول آخر قطعة وفحصها.':decision.bothIncoming?'اختياراتك تجمع منتجات جاهزة وحجزاً مسبقاً.':decision.addingPreorder?'عندك منتجات بموعد مختلف بالسلة، والمنتج اللي بتضيفه حجز مسبق.':'عندك حجز مسبق بالسلة، والمنتج اللي بتضيفه متوفر للشحن.'}</p>
     ${decision.products.map(p=>`<div class="po-date"><b>${esc(p.name)}${p.color?' · '+esc(p.color):''}</b><small>الوصول المتوقع: ${esc(fmt(p.expected_arrival))}</small><small>الشحن المتوقع: ${esc(fmt(p.ship_from))} إلى ${esc(fmt(p.ship_by))}</small></div>`).join('')}
     ${decision.combined?`<div class="po-date" data-po-combined>شحن الطلب كامل في شحنة واحدة متوقع: <b>${esc(fmt(decision.combined.ship_from))} إلى ${esc(fmt(decision.combined.ship_by))}</b><small>تُضاف مدة توصيل الناقل حسب مدينتك. الموعد مرتبط بجاهزية آخر دفعة.</small></div>`:''}
     <label><input type="checkbox" data-po-together ${ack?'checked':''}><span><b>أوفّر الشحن وأستلم الطلب كامل مع بعض</b><small>أوافق على انتظار جميع منتجات الطلب حتى وصول آخر دفعة وفحصها. شحنة واحدة، ورسومها تظهر حسب عنواني قبل الدفع.</small></span></label>
     <button class="po-primary" data-po-approve ${!ack||!scheduleValid()?'disabled':''}>${context.external?'أوافق، أضف للحجز بشحنة واحدة':'اعتمد الشحنة الواحدة'}</button><small>${context.resolve||context.external?'بعد الاعتماد نكمل إضافة اختياراتك.':'بعد الاعتماد، اضغط زر الإضافة الأصلي مرة ثانية. لن تُضاف منتجات تلقائياً.'}</small>
     ${!scheduleValid()?'<button data-po-retry>أعد التحقق من الموعد</button>':''}<hr><p><b>أفضل أستلم كل دفعة بطلب مستقل</b></p>
     <p>${decision.bothIncoming?'للشحن على دفعات، ارجع لاختياراتك وأضف كل مجموعة بموعد واحد بطلب مستقل. لن تُضاف المجموعة الحالية.':decision.existingMixed?'سلتك تجمع مجموعات بمواعيد مختلفة بالفعل. عدّل محتوياتها من سلة الأصلية لإكمال كل مجموعة بطلب مستقل. لن نفصلها تلقائياً.':`أكمل شراء ${first} الموجودة بالسلة أولاً، ثم ارجع لهذه الصفحة لشراء ${next} بطلب مستقل. لكل طلب رسوم شحن تظهر حسب عنوانك قبل الدفع.`}</p>
     ${url&&!decision.bothIncoming?`<a class="po-link" href="${esc(url)}" ${demo?'':'target="_blank" rel="noopener"'}>${decision.existingMixed?'افتح سلة المتجر للمراجعة':`أكمل طلب ${first} أولاً`}</a>`:decision.bothIncoming?'':'<p>افتح سلة المتجر من أيقونة السلة لإكمال الطلب الأول.</p>'}
     <small>المنتج الجديد لم يُضف بعد. تبقى صفحة المنتج مفتوحة للعودة إليها.</small>`;
   }
   dialog.innerHTML=`<span class="po-label">${demo?'محاكاة فقط · ':''}قبل إضافة المنتج</span><h2 id="po-before-title">${unavailable?pending?'الحجز قيد التجهيز':'الحجز غير متاح حالياً':context.external&&!decision.mixes?'موعد قطعتك قبل الحجز':'كيف تحب تستلم طلبك؟'}</h2>${body}<p class="po-error" role="alert">${esc(message)}</p><button data-po-close>رجوع</button>`;
   if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  }
  // Explicit opt-in integration for our own bulk/video/accessory add flows.
  // Does not wrap or replace any Salla SDK method.
  w.LinkPreorderCheckItems=async (items,{nativeForm}={})=>{
   if(stopped)throw error('cart_unavailable');
   if(!Array.isArray(items)||!items.length||items.some(x=>!/^\d+$/.test(String(x.id))))throw error('product_unknown');
   if(context)return false;
   const ticket=nativeForm&&nativeForms.get(nativeForm);if(nativeForm)nativeForms.delete(nativeForm);
   await read();
   if(context)return false;
   const ids=items.map(x=>String(x.id)),candidate={ids,id:ids[0]};
   if(ticket&&ids.length===1&&ids[0]===ticket.id&&ticket.key===model.current().key&&ticket.until>=Date.now()&&ticket.state===formState(nativeForm))return true;
   const decision=decisionFor(model.current(),candidate),pageId=(w.location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1];
   const external=decision.products.some(p=>ids.includes(p.id)&&pageId!==p.id);
   if(!decision.mixes&&!external&&decision.products.every(available))return true;
   return new Promise(resolve=>{context={...candidate,external,resolve};ack=false;show();});
  };
  function scheduleValid(){
   const cart=model.current();if(!cart||!context)return false;
   const products=decisionFor(cart,context).products;
   return products.length>0&&products.every(available);
  }
  async function read(){
   if(reading)return reading;
   const expectedVersion=version;
   reading=(async()=>{
    const [response,json,config]=await Promise.all([
     bounded(()=>w.salla.cart.details()),
     bounded(async()=>{const r=await w.fetch(origin+'/api/protection-feed?mode=preorders&catalog=1',{credentials:'omit',cache:'no-store'});if(!r.ok)throw error('catalog_unavailable');return r.json();}),
     bounded(async()=>{const r=await w.fetch(origin+'/preorder-frame-colors.json?v=20261015-8',{credentials:'omit',cache:'no-store'});if(!r.ok)throw error('catalog_unavailable');return r.json();})
    ]);
    if(expectedVersion!==version||stopped)throw error('cart_changed');
    if(!json?.ok||json.catalog!==true||json.complete!==true)throw error('catalog_unavailable');
    const cart=model.update(response,pendingCatalog(catalogOf(json.products),config));syncShortcuts();disclose();
    status.reason='ready';return cart;
   })().catch(e=>{model.invalidate();syncShortcuts();status.reason=e.code||'cart_unavailable';throw e;}).finally(()=>{reading=null;});
   return reading;
  }
  function validation(ctx){
   if(ctx.isValid===false||stopped)return;
   const id=String(ctx.productId??ctx.component?.productId??ctx.component?.getAttribute?.('product-id')??'');if(!/^\d+$/.test(id))return;
   const cart=model.current(),p=cart?.catalog[id],pageId=(w.location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1],external=!!p&&pageId!==id;
   if(p&&!available(p)&&!external){
    ctx.isValid=false;noticePermission=null;
    let note=d.getElementById('po-booking-state');if(!note){note=d.createElement('p');note.id='po-booking-state';note.setAttribute('role','alert');ctx.component?.after(note);}
    note.textContent=(p.status==='pending'?'الحجز قيد التجهيز':'الحجز غير متاح حالياً')+' — '+p.name+(p.color?' · '+p.color:'')+'. لا يمكن الإضافة حتى تأكيد جاهزية الحجز.';
    return;
   }
   d.getElementById('po-booking-state')?.remove();
   if(p&&!available(p)||external&&!(noticePermission?.id===id&&noticePermission.key===cart.key&&noticePermission.component===ctx.component)){
    ctx.isValid=false;noticePermission=null;context={id,component:ctx.component,external,resume:ctx.resume};ack=false;show();return;
   }
   if(external)noticePermission=null;
   const result=model.validate(id);
   if(result.allowed){
    const form=ctx.component?.closest?.('form[data-link-po-preflight="1"]');
    if(form)nativeForms.set(form,{id,key:model.current().key,state:formState(form),until:Date.now()+2000});
    return;
   }
   ctx.isValid=false; // Block this native gesture; mixed-cart approval requires a fresh customer press.
   context={id,component:ctx.component};ack=false;
   show();
   if(result.reason==='loading'||!scheduleValid())read().then(()=>{if(context)show();}).catch(()=>show('تعذر التحقق من السلة أو موعد الحجز. حاول مجدداً.'));
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
    const quick=nodes.find(n=>n?.matches?.(quickSelector))||e.target?.closest?.(quickSelector);
    if(quick&&d.documentElement.hasAttribute('data-link-po-cart-flow')){
     e.preventDefault();e.stopImmediatePropagation();
     w.salla?.notify?.error?.('أضف المنتج للسلة لإكمال اختيار طريقة الاستلام. تقدر تدفع بأبل باي في إتمام الطلب.');return;
    }
    const button=nodes.find(n=>n?.matches?.('salla-add-product-button'))||e.target?.closest?.('salla-add-product-button');
    if(!button)return;
    if(pendingGesture){e.preventDefault();e.stopImmediatePropagation();return;}
    const id=button.productId??button.getAttribute('product-id');
    const target=nodes.find(n=>typeof n?.click==='function')||button,path=w.location.pathname;
    const ctx={productId:id,component:button,isValid:true,resume:()=>{if(!stopped&&button.isConnected&&w.location.pathname===path)target.click();}};
    if(!/^\d+$/.test(String(id??'')))return;
    if(!model.current()){
     // Stop before native handlers; wait silently for the initial cart snapshot.
     // Resume exactly this unprocessed gesture once, never a submitted cart request.
     e.preventDefault();e.stopImmediatePropagation();
     if(pendingGesture)return;pendingGesture=true;
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
   if(typeof w.CustomEvent==='function')d.dispatchEvent(new w.CustomEvent('link:preorders-ready'));
   const unsubscribe=()=>d.removeEventListener('click',capture,true);
   read().catch(()=>{});
   w.__linkBeforeAddUnsubscribe=unsubscribe;
   if(!watching){watching=true;
    const changed=()=>{if(stopped)return;version++;noticePermission=null;model.invalidate();syncShortcuts();ack=false;read().then(()=>{if(context)show();}).catch(()=>{});};
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
 return {PRODUCT,catalogOf,pendingCatalog,inspect,decide,cartURL,gate,start};
});
