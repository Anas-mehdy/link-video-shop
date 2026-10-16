/* Link Store: shared preorder startup, included by the installed sidebar asset. */
(function(scope,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory;else factory(scope);
})(typeof window==='object'?window:globalThis,function(w){
 'use strict';const d=w.document,url=new URL(w.location.href);
 if(!(['linkstore-sa.com','www.linkstore-sa.com'].includes(url.hostname)||url.hostname==='salla.sa'&&/^\/linkstore122(?:\/|$)/.test(url.pathname)))return;
 if(/(?:^|\/)(?:cart|checkout)(?:\/|$)/.test(url.pathname)||w.__linkPreorderBootstrap)return;
 const state={ready:false,error:false};w.__linkPreorderBootstrap=state;
 const previous=w.LinkPreorderCheckItems;let resolve,reject,timeout;
 const waiting=new Promise((a,b)=>{resolve=a;reject=b;});waiting.catch(()=>{});
 const stub=async(...args)=>{await waiting;const check=w.LinkPreorderCheckItems;if(typeof check!=='function'||check===stub)throw Error('preorder_guard_unavailable');return check(...args);};
 if(typeof previous!=='function')w.LinkPreorderCheckItems=stub;
 const selector='salla-add-product-button,salla-quick-buy,salla-mini-checkout-widget,.s-add-product-button-buy-now,.s-fast-checkout-button';
 function capture(e){
  if(w.LinkPreorderBeforeAddStatus?.ready){finish();return;}
  const path=e.composedPath?.()||[e.target];if(!path.some(n=>n?.matches?.(selector))&&!e.target?.closest?.(selector))return;
  e.preventDefault();e.stopImmediatePropagation();
  w.salla?.notify?.error?.(state.error?'تعذر تجهيز معلومات الحجز. حدّث الصفحة قبل الإضافة.':'لحظة، نجهّز معلومات الطلب. اضغط الإضافة مجدداً بعد لحظات.');
 }
 function finish(){
  if(!w.LinkPreorderBeforeAddStatus?.ready||typeof w.LinkPreorderCheckItems!=='function'||w.LinkPreorderCheckItems===stub)return;
  state.ready=true;w.clearTimeout(timeout);d.removeEventListener('click',capture,true);d.removeEventListener('link:preorders-ready',finish);resolve();
 }
 function failed(){if(state.ready)return;state.error=true;w.clearTimeout(timeout);reject(Error('preorder_guard_unavailable'));}
 d.addEventListener('click',capture,true);d.addEventListener('link:preorders-ready',finish);
 timeout=w.setTimeout(failed,20000);
 if(w.LinkPreorderBeforeAddStatus?.ready){finish();return;}
 let script=d.getElementById('link-preorder-before-add-loader');
 if(!script){
  script=d.createElement('script');script.id='link-preorder-before-add-loader';
  script.src='https://link-video-shop.vercel.app/preorder-before-add.js?v=20261016-11';script.dataset.beforeAdd='1';script.async=true;
  script.addEventListener('load',finish,{once:true});script.addEventListener('error',failed,{once:true});d.head.appendChild(script);
 }else{script.addEventListener('load',finish,{once:true});script.addEventListener('error',failed,{once:true});}
});
