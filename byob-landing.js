/* Link Store 'Build Your Bundle' landing page v1 — loads only on landing 1852264485. */
'use strict';
function __linkByobMount(){
  var root=document.getElementById('lnk-byob');
  if(!root||root.getAttribute('data-ready'))return false;
  root.setAttribute('data-ready','1');
  var products=[
    {id:207290951,max:3,image:'https://cdn.salla.sa/Zpqzp/4067087b-3b9e-47ad-82a1-6d1f9ae940c6-500x500-kCkSkPb9s0IqzgdsyUH2DWdD1qr4s6Cp5hwFJWoe.png'},
    {id:671957057,max:2,image:'https://cdn.salla.sa/Zpqzp/f50bdf88-1adb-4bd9-b38c-2e00bb9f686e-1000x1000-HcbZq5GVkA74PuUZnGsKLfNlygTwD9QD14qiA6oQ.jpg'},
    {id:1471188547,max:3,image:'https://cdn.salla.sa/Zpqzp/db06e583-14e6-4ce1-9159-cde50c647844-1000x1000-x9mFNIojI3If7dXgu6OmtdZZZqATItwoVDYsEn2Z.png'}
  ];
  var qty={207290951:0,671957057:0,1471188547:0};
  var loading=false;
  function el(id){return document.getElementById(id)}
  function count(){return products.reduce(function(s,p){return s+qty[p.id]},0)}
  function paint(){
    var n=count(),amount=n*45,remain=Math.max(0,349-amount);
    el('lb-count').textContent=n;
    el('lb-count-top').textContent='بكجك: '+n+' من 8';
    el('lb-total').textContent=amount;
    el('lb-count-bar').style.width=Math.min(100,n/8*100)+'%';
    el('lb-ship-bar').style.width=Math.min(100,amount/349*100)+'%';
    el('lb-shipping-msg').textContent=remain?'باقي '+remain+' ر.س للشحن المجاني':'تأهل البكج للشحن المجاني عبر RedBox';
    var note=n<3?'أضف '+(3-n)+' قطع لبدء البكج':n<8?'أضف '+(8-n)+' قطع للوصول لمرحلة الشحن المجاني':'وصلت لأكبر بكج تجريبي';
    el('lb-next').textContent=note;
    el('lb-dock-next').textContent=note;
    el('lb-to-cart').disabled=loading||n<3||n>8;
    el('lb-to-cart').textContent=loading?'جاري إضافة المنتجات…':'أضف البكج للسلة';
    var thumbs=el('lb-thumbs');thumbs.textContent='';
    products.forEach(function(p){el('lb-qty-'+p.id).textContent=qty[p.id];var card=root.querySelector('[data-product="'+p.id+'"]');if(card)card.classList.toggle('is-selected',qty[p.id]>0);if(qty[p.id]){var im=document.createElement('img');im.src=p.image;im.alt='';thumbs.appendChild(im);}});
  }
  root.addEventListener('click',function(e){
    var tab=e.target.closest('button[data-tab]');
    if(tab){var group=tab.getAttribute('data-tab');root.querySelectorAll('button[data-tab]').forEach(function(b){b.setAttribute('aria-selected',b===tab?'true':'false')});root.querySelectorAll('.card[data-group]').forEach(function(c){c.hidden=(group!=='all'&&c.getAttribute('data-group')!==group)});return;}
    var b=e.target.closest('button[data-act]');
    if(!b||loading)return;
    var id=Number(b.getAttribute('data-id')),p=products.find(function(x){return x.id===id});
    if(!p)return;
    if(b.getAttribute('data-act')==='plus'){if(count()>=8){el('lb-feedback').textContent='الحد الأقصى 8 قطع';return;}if(qty[id]>=p.max){el('lb-feedback').textContent='وصلت للحد الأعلى لهذا المنتج';return;}qty[id]++}
    else qty[id]=Math.max(0,qty[id]-1);
    el('lb-feedback').textContent='';paint();
  });
  el('lb-to-cart').addEventListener('click',async function(){
    if(loading||count()<3||count()>8)return;
    if(!window.salla||!window.salla.cart||typeof window.salla.cart.addItem!=='function'){
      el('lb-feedback').textContent='تعذر الاتصال بسلة. افتح الصفحة داخل المتجر وحدّثها.';return;
    }
    loading=true;paint();el('lb-feedback').textContent='';
    try{
      for(var i=0;i<products.length;i++){var p=products[i];if(qty[p.id]>0){var result=await window.salla.cart.addItem({id:p.id,quantity:qty[p.id]});if(result&&result.success===false)throw new Error('تعذر إضافة منتج إلى السلة');}}
      window.location.assign('https://linkstore-sa.com/cart');
    }catch(e){
      el('lb-feedback').textContent='تعذرت إضافة كل القطع. افحص السلة قبل إعادة المحاولة.';
      loading=false;paint();
    }
  });
  paint();
  return true;
}

(function(){
 if(!location.pathname.includes('/pages/lp1304367330/1852264485'))return;
 if(window.__linkByobBootstrapInstalled)return;
 window.__linkByobBootstrapInstalled=true;
 function init(){try{return __linkByobMount()===true}catch(err){console.error('[Link BYOB] init failed',err);return false}}
 if(init())return;
 var obs=new MutationObserver(function(){if(init())obs.disconnect()});
 obs.observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('DOMContentLoaded',function(){if(init())obs.disconnect()},{once:true});
})();
