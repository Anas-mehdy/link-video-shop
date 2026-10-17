/* Link Store — fiber Samsung bundles extras. Scoped strictly to 22 product IDs. */
(()=>{'use strict';
const ids={
'868193571':'S24 Ultra','195931898':'S23 Ultra','1004068331':'S25 Ultra','81019550':'S23 Ultra',
'1974746699':'S25 Ultra','353874798':'S23 Ultra','388956440':'S25 Ultra','382788829':'S23 Ultra',
'316768505':'S25 Ultra','702158061':'S23 Ultra','1293159908':'S25 Ultra','138002617':'S25 Ultra',
'274336065':'S23 Ultra','226667877':'S25','577784353':'S23 Ultra','2023951170':'S25',
'497977612':'S23 Ultra','1658110619':'S24 Ultra','1168464312':'S25 Ultra','1475876922':'S25 Ultra',
'1619145201':'S23 Ultra','601583214':'S24 Ultra'};
const id=location.pathname.match(/\/p(\d+)\/?$/)?.[1]; if(!id||!ids[id]||window.__linkFiberExtras)return;
window.__linkFiberExtras=true;
const el=(tag,txt='',cls='')=>{const e=document.createElement(tag);if(txt)e.textContent=txt;if(cls)e.className=cls;return e;};
const money=n=>new Intl.NumberFormat('ar-SA-u-nu-latn',{maximumFractionDigits:2}).format(n)+' ر.س';
const lenses={
'S24 Ultra':{id:540794920,name:'عدسات Link لحماية الكاميرا – Galaxy S24 Ultra',price:49,option:17448494,colors:[[490141847,'أسود'],[914916252,'فضي'],[5612189,'تيتانيوم'],[1905328748,'بنفسجي']]},
'S23 Ultra':{id:870924025,name:'عدسات Link لحماية الكاميرا – Galaxy S23 Ultra',price:49,option:1502507331,colors:[[10933991,'أسود'],[2009436397,'أخضر زيتي']]},
'S25 Ultra':{id:2000656879,name:'عدسات Link لحماية الكاميرا – Galaxy S25 Ultra',price:85,option:2075226229,colors:[[191341677,'أسود'],[1699529582,'أبيض'],[16122216,'وردي'],[1389568105,'أزرق'],[750276458,'فضي'],[2122673771,'تيتانيوم']]}
};
// Other models intentionally have no camera item until an active, model-confirmed lens SKU is verified.
const recommendations=[
[387390654,'حامل Link المغناطيسي للسيارة – LUX',69,'https://cdn.salla.sa/Zpqzp/75f2866a-e73a-441f-aff0-57af073887fb-500x500-UIC6zqHbtxGZJaJ08zPeanCmdE6PQfRFaZ1Qcm8E.png'],
[102701081,'باور بنك Link 10000mAh – شحن سريع 20W',89,'https://cdn.salla.sa/Zpqzp/a8c82c42-0838-41ee-93f9-9162301de5f9-500x500-zYYoLNkmMUlUEJwYXNvEczg8rmbhmVgnLivb2XVk.jpg'],
[2112678166,'شاحن لنك الجداري السريع 45W Type-C',89,'https://cdn.salla.sa/Zpqzp/f8c9a963-d869-4122-a8b7-4db6036aacec-500x500-3DfGLBpE0wodjokWzgCV5mVc0yKUWuk3hLRPq7Kh.jpg'],
[346029211,'شاحن سيارة لنك سريع 60W بمنفذين Type-C',89,'https://cdn.salla.sa/Zpqzp/36e2f3e2-b1ae-4cd7-96ed-e11a620b1265-500x500-Yaph4yNkFR8WuexECkP0r7tDqeeh0QsX8Mk0TN9x.jpg'],
[2114039606,'وصلة شحن Link تايب سي × تايب سي | 2 م',55,'https://cdn.salla.sa/Zpqzp/b0029e9c-e21b-4303-988f-364c3f1ef6c4-500x500-M2q0XB6V9I7GCfaFRhkPNJ8gZ5q2kKMerGIAqtjb.png'],
[261123594,'سماعة لنك السلكية Type-C',69,'https://cdn.salla.sa/Zpqzp/4d482045-0b0e-4777-b1ee-18ebaa795704-500x500-laY8TPGrs1ILZ7rUGkmYc7fAjHVAdMm31l0jxxOk.jpg']
];
function css(){if(document.getElementById('link-fiber-extras-style'))return;const s=el('style');s.id='link-fiber-extras-style';s.textContent=`
.link-fiber-extra{direction:rtl;font-family:inherit;background:#fcf9fe;color:#281b30;border:1px solid #e5d8ec;border-radius:17px;padding:18px;margin:20px 0;width:100%;box-sizing:border-box}
.link-fiber-extra *{box-sizing:border-box}.link-fiber-extra h2{font-size:20px;font-weight:700;margin:0 0 4px}.link-fiber-extra .lf-muted{font-size:13px;color:#806b89;margin:0 0 12px}
.link-fiber-extra .lf-option{display:flex;align-items:center;gap:9px;border:1px solid #e7ddec;border-radius:12px;padding:12px;margin:8px 0;background:#fff;cursor:pointer}
.link-fiber-extra .lf-option:has(input:checked){background:#f3eaf8;border-color:#51007a}
.link-fiber-extra input{accent-color:#51007a}.link-fiber-extra .lf-option strong{margin-inline-start:auto;color:#51007a;font-size:13px}
.link-fiber-extra select.lf-color{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:48px!important;height:auto!important;direction:rtl!important;text-align:right!important;box-sizing:border-box!important;border:1px solid #d9c4e4!important;background:#fff!important;color:#281b30!important;border-radius:10px!important;padding:11px 14px!important;font:inherit!important;font-size:14px!important;line-height:1.6!important;margin:10px 0 0!important;opacity:1!important;white-space:normal!important;text-overflow:clip!important;appearance:auto!important}.link-fiber-extra select.lf-color option{color:#281b30!important;background:#fff!important}.link-fiber-extra select.lf-color:disabled{display:none!important}
.link-fiber-extra .lf-note{font-size:12px;color:#715c7c;line-height:1.7;margin:9px 0}.link-fiber-extra .lf-msg{font-size:12px;color:#51007a;min-height:18px;margin-top:8px}
.link-fiber-extra .lf-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #e9e0ed}
.link-fiber-extra .lf-row:last-child{border:0}.link-fiber-extra img{height:64px;width:64px;object-fit:contain;border-radius:9px;background:white}
.link-fiber-extra .lf-copy{flex:1;min-width:0}.link-fiber-extra .lf-copy a{color:#291634;text-decoration:none;font-size:13px;font-weight:600}.link-fiber-extra .lf-copy small{display:block;color:#51007a}
.link-fiber-extra button{background:#51007a;color:#fff;border:0;border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit;font-size:13px;font-weight:700;white-space:nowrap}
.link-fiber-extra button:disabled{opacity:.6;cursor:wait}
@media(max-width:420px){.link-fiber-extra{padding:12px}.link-fiber-extra .lf-row{gap:8px}.link-fiber-extra img{height:49px;width:49px}.link-fiber-extra button{padding:8px;font-size:11px}}
`;document.head.appendChild(s);}
let mainNode=null,extras=null;
function render(){
if(document.getElementById('link-fiber-camera')&&document.getElementById('link-fiber-accessories'))return true;
const form=document.querySelector('#product-'+id+' .main-content .product-form')||document.querySelector('.product-form');
const nativeButton=form?.querySelector('salla-add-product-button[product-id="'+id+'"]')||document.querySelector('salla-add-product-button[product-id="'+id+'"]');
const cart=window.salla?.cart;if(!form||!nativeButton||!cart?.addItem)return false;
css();const camera=el('section','','link-fiber-extra');camera.id='link-fiber-camera';
camera.append(el('h2','كمّل حماية جوالك'),el('p','الباكج يحتوي استيكر شاشة؛ أضف عدسات حماية الكاميرا المتوافقة مع جهازك.','lf-muted'));
const lens=lenses[ids[id]]; let selected=false,color=null,waiting=null,busy=false;
const msg=el('p','','lf-msg');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
if(lens){
const row=el('label','','lf-option'),input=el('input');input.type='checkbox';input.setAttribute('aria-label','إضافة عدسات حماية الكاميرا');
row.append(input,el('span',lens.name),el('strong','+ '+money(lens.price)));camera.append(row);
const select=el('select','','lf-color');const placeholder=el('option','اختر لون العدسات');placeholder.value='';select.append(placeholder);
lens.colors.forEach(([value,label])=>{const opt=el('option',label);opt.value=value;select.append(opt);});
select.disabled=true;select.setAttribute('aria-label','لون عدسات الحماية');select.setAttribute('dir','rtl');camera.append(select);
input.addEventListener('change',()=>{selected=input.checked;select.disabled=!selected;msg.textContent='';if(selected)select.focus();});
select.addEventListener('change',()=>{color=Number(select.value)||null;msg.textContent='';});
camera.append(el('p','اختياري: اختر العدسات واللون، ثم اضغط «أضف للسلة» للباكج. تُضاف العدسات كمنتج مستقل بالسعر الموضح.','lf-note'),msg);
function currentQuantity(){const q=Number(form.querySelector('[name="quantity"]')?.value||1);return Number.isInteger(q)&&q>0?q:1;}
form.addEventListener('submit',e=>{if(!selected){waiting=null;return;}if(!color){e.preventDefault();e.stopImmediatePropagation();msg.textContent='اختر لون العدسات أولاً.';return;}waiting={quantity:currentQuantity(),time:Date.now()};},{capture:true});
cart.event?.onItemAdded?.(async(_response,productId)=>{if(String(productId)!==id||!waiting||busy)return;const req=waiting;waiting=null;busy=true;msg.textContent='جاري إضافة العدسات...';
try{const product={id:lens.id,quantity:req.quantity,options:{[lens.option]:color}};
if(window.LinkPreorderCheckItems&&!await window.LinkPreorderCheckItems([{id:lens.id}]))throw Error('blocked');
const res=await cart.addItem(product);if(res?.success===false||Number(res?.status)>=400)throw Error('failed');msg.textContent='تمت إضافة الباكج والعدسات للسلة ✓';}
catch(e){msg.textContent='أُضيف الباكج، لكن تعذرت إضافة العدسات. أضفها من صفحة العدسات بشكل مستقل.';}
finally{busy=false;}});
}else{
camera.append(el('p','عدسات الحماية المناسبة لهذا الموديل غير مؤكدة التوفر حالياً. لن نعرض لك عدسات لموديل مختلف.','lf-note'));
}
const accessories=el('section','','link-fiber-extra');accessories.id='link-fiber-accessories';
accessories.append(el('h2','منتجات مختارة لك'),el('p','إضافات تناسب استخدامك اليومي','lf-muted'));
recommendations.forEach(([pid,name,price,img])=>{
const row=el('div','','lf-row'),image=el('img');image.src=img;image.alt='';image.loading='lazy';
const copy=el('div','','lf-copy'),link=el('a',name);link.href='https://linkstore-sa.com/?product_id='+pid;const cost=el('small',money(price)),note=el('small','','lf-msg');copy.append(link,cost,note);
const btn=el('button','أضف للسلة');btn.type='button';btn.addEventListener('click',async()=>{
btn.disabled=true;note.textContent='جاري الإضافة...';
try{if(window.LinkPreorderCheckItems&&!await window.LinkPreorderCheckItems([{id:pid}]))throw Error('blocked');const r=await cart.addItem({id:pid,quantity:1});if(r?.success===false||Number(r?.status)>=400)throw Error('fail');note.textContent='تمت الإضافة ✓';}
catch(e){note.textContent='تعذرت الإضافة، تحقق من صفحة المنتج.';}finally{btn.disabled=false;}
});
row.append(image,copy,btn);accessories.append(row);
});
const anchor=nativeButton.closest('.sticky-product-bar')||nativeButton;
anchor.before(camera);form.after(accessories);return true;
}
if(render())return;const obs=new MutationObserver(()=>{if(render())obs.disconnect();});obs.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),15000);
})();