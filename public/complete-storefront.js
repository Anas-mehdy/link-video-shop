/* Loaded on Malak test homepage. Dormant unless an encrypted protection hash is present. */
(()=>{'use strict';
 const match=location.hash.match(/^#link-complete=([-_A-Za-z0-9]{80,300})$/);if(!match||window.__linkCompleteStore)return;window.__linkCompleteStore=true;
 const token=match[1],apiOrigin='https://link-video-shop.vercel.app',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const root=document.createElement('div');root.id='link-complete-store';root.innerHTML=`<style>#link-complete-store{position:fixed;inset:0;z-index:2147483000;background:#fbf9fc}#link-complete-store>iframe{width:100%;height:100%;border:0}#link-complete-store>.lc-close{position:absolute;top:12px;left:12px;background:white;color:#51007a;border:1px solid #ddd;border-radius:50%;width:36px;height:36px;font-size:25px;cursor:pointer}#link-complete-store dialog{border:1px solid #e7dfed;border-radius:20px;width:min(650px,calc(100% - 24px));max-height:90vh;padding:24px;direction:rtl;background:white;color:#21152c;font-family:inherit;font-size:17px}#link-complete-store dialog::backdrop{background:#21152caa}#link-complete-store .lc-product{padding:18px 0;border-top:1px solid #e7dfed}#link-complete-store .lc-product h3{font-size:18px;margin:0 0 12px}#link-complete-store .lc-confirm{border:0;background:#51007a;color:white;padding:13px 20px;border-radius:12px;width:100%;font-size:18px;font-weight:700}#link-complete-store .lc-status{line-height:1.7;margin:12px 0;color:#706676}</style><iframe title="كمّل حماية جوالك" referrerpolicy="no-referrer" src="${apiOrigin}/complete/${token}?storefront=1&store_origin=${encodeURIComponent(location.origin)}"></iframe><button type="button" class="lc-close" aria-label="إغلاق">×</button><dialog><h2>خيارات منتجاتك</h2><p>حدد الخيارات المطلوبة، ثم نضيف جميع اختياراتك للسلة.</p><div class="lc-options"></div><p class="lc-status" role="status" aria-live="polite"></p><button type="button" class="lc-confirm">أضف اختياراتي للسلة</button></dialog>`;
 document.body.append(root);const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const frame=root.querySelector('iframe'),dialog=root.querySelector('dialog'),confirm=root.querySelector('.lc-confirm'),status=root.querySelector('.lc-status'),close=root.querySelector('.lc-close');let busy=false,pending=null;
 close.onclick=()=>{if(busy)return;root.remove();window.__linkCompleteStore=false;document.getElementById('link-complete-storefront-loader')?.remove();document.body.style.overflow=previousOverflow;history.replaceState(null,'',location.pathname+location.search);};
 const requests=new Map(),storageKey='link_complete_attempts_'+token;
 function getStates(){return JSON.parse(sessionStorage.getItem(storageKey)||'{}');}
 const getState=id=>getStates()[id],setState=(id,value)=>{const s=getStates();s[id]=value;sessionStorage.setItem(storageKey,JSON.stringify(s));};
 const send=(id,result)=>frame.contentWindow.postMessage({type:'link-complete-cart-result',request_id:id,...result},apiOrigin);
 function timeout(promise,ms){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('تعذر تحميل خيارات المنتج؛ حاول لاحقًا')),ms))]);}
 const catalog=fetch(apiOrigin+'/api/video-shop-feed?resource=postpurchase&token='+encodeURIComponent(token),{cache:'no-store',referrerPolicy:'no-referrer'}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw Error('تعذر تحميل منتجات الصفحة');return new Map(d.products.map(p=>[p.id,p]));});
 const cartScript=document.createElement('script');cartScript.src=apiOrigin+'/complete-cart.js';document.head.append(cartScript);
 window.addEventListener('message',async e=>{
  if(e.origin!==apiOrigin||e.source!==frame.contentWindow||e.data?.type!=='link-complete-cart-add')return;
  const id=e.data.request_id;if(typeof id!=='string'||!/^[-\w]{20,80}$/.test(id))return;
  if(requests.has(id)){const r=requests.get(id);if(r)send(id,r);return;}if(busy||pending)return;
  requests.set(id,null);pending={id,items:null};
  try{
   const products=await catalog,items=e.data.items;
   if(!Array.isArray(items)||!items.length||items.length>20||new Set(items.map(x=>x.id)).size!==items.length||items.some(x=>!products.has(x.id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>10))throw Error('اختيارات غير صالحة');
   if(!window.salla?.cart?.addItem)throw Error('سلة المتجر ليست جاهزة؛ أعد فتح الصفحة');
   pending={id,items};root.querySelector('.lc-options').innerHTML=items.map(x=>{const p=products.get(x.id);return `<section class="lc-product"><h3>${esc(p.name)} · الكمية ${x.quantity}</h3>${p.has_options?`<salla-product-options product-id="${esc(x.id)}"></salla-product-options>`:'<p>لا يحتاج خيارات إضافية.</p>'}</section>`;}).join('');status.textContent='';confirm.disabled=false;dialog.showModal();
  }catch(err){pending=null;const r={error:err.message,complete:false,results:[]};requests.set(id,r);send(id,r);}
 });
 dialog.addEventListener('cancel',e=>{if(busy){e.preventDefault();return;}if(pending){const r={error:'أُلغيت الإضافة',results:[],complete:false};requests.set(pending.id,r);send(pending.id,r);pending=null;}});
 confirm.onclick=async()=>{
  if(busy||!pending)return;busy=true;confirm.disabled=true;close.disabled=true;status.textContent='جارٍ التحقق من الخيارات…';const job=pending;
  try{
   const items=[];
   for(const x of job.items){const el=dialog.querySelector(`salla-product-options[product-id="${x.id}"]`);let options;
    if(el){await timeout(customElements.whenDefined('salla-product-options'),15000);const validate=typeof el.reportValidity==='function'?el.reportValidity.bind(el):typeof el.reportValidty==='function'?el.reportValidty.bind(el):null;if(!validate||typeof el.getSelectedOptionsData!=='function')throw Error('خيارات المنتج ليست جاهزة');
     if(!await timeout(validate(),15000)||await timeout(el.hasOutOfStockOption(),15000))throw Error('أكمل خيارات المنتجات واختر خيارات متوفرة');options=await timeout(el.getSelectedOptionsData(),15000);
     if(!options||Array.isArray(options)||typeof options!=='object')throw Error('تعذر قراءة الخيارات');}
    items.push({...x,options});
   }
   if(!window.LinkCompleteCart)throw Error('الإضافة ليست جاهزة؛ حاول لاحقًا');
   status.textContent='جارٍ إضافة اختياراتك للسلة…';
   const result=await window.LinkCompleteCart.add(items,{addItem:x=>window.salla.cart.addItem(x),getState,setState});requests.set(job.id,result);send(job.id,result);pending=null;dialog.close();
   if(result.complete)location.assign('/cart');
  }catch(err){status.textContent=err.message;}
  finally{busy=false;confirm.disabled=false;close.disabled=false;}
 };
})();
