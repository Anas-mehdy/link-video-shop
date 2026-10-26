/* Link Store: model-specific iPhone 15/16 Pro bundle complementary protection */
(function(){
'use strict';
if(window.__linkIphoneBundleExtras)return;
const id=(location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1];if(!id)return;
window.__linkIphoneBundleExtras=true;
const BASE='https://link-video-shop.vercel.app';
const node=(tag,text='',cls='')=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const money=x=>new Intl.NumberFormat('ar-SA-u-nu-latn',{maximumFractionDigits:2}).format(x)+' ر.س';
const CSS=[
'.lib-extra{direction:rtl;font-family:inherit;color:#281b30;background:#fcf9fe;border:1px solid #e5d9ed;border-radius:16px;padding:18px;margin:20px 0;width:100%;box-sizing:border-box}',
'.lib-extra *{box-sizing:border-box}.lib-extra h2{font-size:20px;font-weight:800;margin:0 0 5px;color:#51007a}',
'.lib-extra p{font-size:13px;line-height:1.7;color:#76647f;margin:4px 0 10px}',
'.lib-extra .lib-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:13px 0}',
'.lib-extra .lib-option{display:flex;gap:9px;align-items:center;min-width:0;background:white;padding:11px;border:1px solid #eadfed;border-radius:11px;cursor:pointer}',
'.lib-extra .lib-option:has(input:checked){border-color:#6b1f91;background:#f4ecf8}',
'.lib-extra input{accent-color:#51007a;width:18px;height:18px;flex-shrink:0}',
'.lib-extra .lib-option img{width:46px;height:46px;object-fit:contain;background:white;border-radius:8px;flex:none}',
'.lib-extra .lib-option span{font-size:13px;line-height:1.5;flex:1;min-width:0}',
'.lib-extra strong,.lib-extra .lib-total{font-size:13px;color:#51007a;font-weight:750}',
'.lib-extra .lib-select{display:block!important;width:100%!important;min-height:45px!important;border:1px solid #d7c8e1!important;border-radius:10px!important;padding:9px!important;background:white!important;font:inherit!important;font-size:14px!important;color:#281b30!important}',
'.lib-extra .lib-msg{color:#51007a!important;min-height:18px}',
'.lib-extra button{background:#51007a;color:white;border:none;border-radius:9px;padding:9px 12px;font:inherit;font-size:12px;cursor:pointer}',
'.lib-extra button:disabled{opacity:.6;cursor:wait}.lib-extra :focus-visible{outline:3px solid #21b0f1;outline-offset:2px}',
'.lib-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}',
'.lib-card{display:flex;align-items:center;gap:10px;min-width:0;background:white;border:1px solid #eee5f2;border-radius:12px;padding:11px}',
'.lib-card img{width:64px;height:64px;object-fit:contain;border-radius:8px;flex:none}',
'.lib-card .lib-info{flex:1;min-width:0}.lib-card a{color:#301839;font-size:13px;font-weight:700;text-decoration:none}',
'.lib-card .lib-price{color:#51007a;font-weight:750;margin:4px 0!important}',
'form[data-link-iphone-addon] salla-mini-checkout-widget,form[data-link-iphone-addon] salla-quick-buy{display:none!important}',
'@media(max-width:650px){.lib-extra{padding:12px}.lib-extra .lib-options,.lib-items{grid-template-columns:1fr}.lib-card img{width:52px;height:52px}.lib-card button{padding:8px}}'
].join('');
function mount(cfg){
if(document.getElementById('link-iphone-addon'))return true;
const form=document.querySelector('#product-'+id+' .main-content .product-form')||document.querySelector('.product-form');
const button=form?.querySelector('salla-add-product-button[product-id="'+id+'"]');
const cart=window.salla?.cart;
if(!form||!button||!cart?.addItem||!cart.event?.onItemAdded)return false;
const setting=cfg.bundles[id],m=cfg.models[setting.model];if(!m)return true;
if(!document.getElementById('link-iphone-extra-css')){const s=node('style');s.id='link-iphone-extra-css';s.textContent=CSS;document.head.appendChild(s);}
const root=node('section','','lib-extra');root.id='link-iphone-addon';root.setAttribute('aria-label','كمّل حماية جوالك');
const screenMode=setting.includes==='lenses';
root.append(node('h2','كمّل حماية جوالك'),node('p',screenMode?'اختر استيكر شاشة مناسبًا لـ '+m.label+' مع البكج.':'أضف عدسات حماية الكاميرا واختر لونها المناسب لـ '+m.label+'.'));
const options=node('div','','lib-options'),total=node('p','','lib-total'),msg=node('p','','lib-msg');
msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
const retry=node('button','أعد إضافة الملحق فقط');retry.type='button';retry.hidden=true;
let selected=null,color='',colorSelect=null,lensCheck=null,pending=null,failed=null,busy=false;
function update(){
form.toggleAttribute('data-link-iphone-addon',!!selected);
total.textContent=selected?'+ '+money(selected.price)+' للإضافة المختارة':'تقدر تطلب البكج بدون أي إضافات.';
if(!busy)msg.textContent='';
}
function choice(labelText,p){
const label=node('label','','lib-option'),input=node('input');
input.type=screenMode?'radio':'checkbox';input.value=String(p?.id||0);
label.append(input);
if(p?.image){const image=node('img');image.src=p.image;image.loading='lazy';image.alt='';label.append(image);}
label.append(node('span',labelText));
label.append(node('strong',p?'+ '+money(p.price):'بدون إضافة'));
options.append(label);return input;
}
if(screenMode){
const inputs=[],items=[null,...m.screens.filter(p=>p.available)];
items.forEach((p,index)=>{
const input=choice(p?p.name.replace('استيكر حماية لنك','استيكر'):'بدون استيكر إضافي',p);
inputs.push(input);input.checked=index===0;
input.addEventListener('change',()=>{
inputs.forEach(other=>{if(other!==input)other.checked=false;});
selected=p;update();
});
});
}else if(m.lens?.available&&m.lens?.colors?.length){
const p=m.lens;lensCheck=choice('طقم عدسات حماية الكاميرا (3 عدسات)',p);
colorSelect=node('select','','lib-select');colorSelect.setAttribute('aria-label','اختر لون عدسات الكاميرا');
colorSelect.disabled=true;
const empty=node('option','اختر لون العدسات');empty.value='';colorSelect.append(empty);
p.colors.forEach(c=>{const o=node('option',c.name);o.value=String(c.id);colorSelect.append(o);});
lensCheck.addEventListener('change',()=>{selected=lensCheck.checked?p:null;colorSelect.disabled=!lensCheck.checked;update();});
colorSelect.addEventListener('change',()=>{color=colorSelect.value;update();});
}
root.append(options);if(colorSelect)root.append(colorSelect);
root.append(total,msg,retry);
const anchor=button.closest('.sticky-product-bar')||button.parentElement;
anchor.before(root);
function qty(){const q=Number(form.querySelector('[name="quantity"]')?.value||1);return Number.isSafeInteger(q)&&q>0?q:1;}
function setBusy(v){busy=v;if(lensCheck)lensCheck.disabled=v;if(colorSelect)colorSelect.disabled=v||!lensCheck.checked;}
function prepare(e){
if(busy){e.preventDefault();e.stopImmediatePropagation();return;}
if(selected&&!screenMode&&!color){
e.preventDefault();e.stopImmediatePropagation();msg.textContent='اختر لون العدسات أولًا.';colorSelect.focus();return;
}
const opts=selected&&!screenMode?{[m.lens.colorOptionId]:Number(color)}:null;
pending=selected?{item:{id:selected.id,quantity:qty(),options:opts},at:Date.now()}:null;
failed=null;retry.hidden=true;
}
async function addExtra(item){
setBusy(true);msg.textContent='تتم إضافة الحماية...';retry.hidden=true;
try{
if(window.LinkPreorderCheckItems&&!await window.LinkPreorderCheckItems([{id:item.id}])){msg.textContent='ألغيت إضافة الملحق.';return;}
const args={id:item.id,quantity:item.quantity};if(item.options)args.options=item.options;
const res=await cart.addItem(args);
if(res?.success===false||Number(res?.status)>=400)throw Error('Add failed');
failed=null;msg.textContent='تمت إضافة البكج والملحق للسلة ✓';
}catch(_){failed=item;retry.hidden=false;msg.textContent='انضاف البكج، لكن الملحق لم يُضف. أعد إضافة الملحق فقط.';}
finally{setBusy(false);}
}
button.addEventListener('click',prepare,true);
form.addEventListener('submit',prepare,true);
cart.event.onItemAdded((_result,productId)=>{
if(String(productId)!==id||!pending)return;
const entry=pending;pending=null;
if(Date.now()-entry.at>60000)return;
if((location.pathname.match(/\/p(\d+)(?:\/|$)/)||[])[1]===id)addExtra(entry.item);
});
cart.event.onItemAddedFailed?.((_error,productId)=>{if(String(productId)===id)pending=null;});
retry.addEventListener('click',()=>{if(failed&&!busy)addExtra(failed);});
update();
const section=node('section','','lib-extra');section.id='link-iphone-recommended';
section.append(node('h2','منتجات مختارة'),node('p','إكسسوارات تناسب استخدامك اليومي؛ تقدر تضيفها للسلة مباشرة.'));
const grid=node('div','','lib-items');
cfg.accessories.filter(p=>p.available).forEach(p=>{
const card=node('div','','lib-card'),img=node('img'),info=node('div','','lib-info');
img.src=p.image;img.alt=p.name;img.loading='lazy';
const link=node('a',p.name);link.href=p.url;
const status=node('p','','lib-msg');status.setAttribute('role','status');
info.append(link,node('p',money(p.price),'lib-price'),status);
const add=node('button','أضف للسلة');add.type='button';
add.addEventListener('click',async()=>{
if(add.disabled)return;add.disabled=true;status.textContent='تتم الإضافة...';
try{
if(window.LinkPreorderCheckItems&&!await window.LinkPreorderCheckItems([{id:p.id}])){status.textContent='ألغيت الإضافة.';return;}
const res=await cart.addItem({id:p.id,quantity:1});
if(res?.success===false||Number(res?.status)>=400)throw Error('Add failed');
status.textContent='تمت الإضافة ✓';
}catch(_){status.textContent='تعذرت الإضافة؛ تحقق من التوفر.';}
finally{add.disabled=false;}
});
card.append(img,info,add);grid.append(card);
});
section.append(grid);form.after(section);return true;
}
fetch(BASE+'/iphone-bundle-upsells-config.json',{credentials:'omit'}).then(r=>{if(!r.ok)throw Error('Config unavailable');return r.json();}).then(cfg=>{
if(!cfg?.bundles?.[id])return;
if(mount(cfg))return;
const obs=new MutationObserver(()=>{if(mount(cfg))obs.disconnect();});
obs.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(()=>obs.disconnect(),25000);
}).catch(error=>console.warn('[Link iPhone bundles]',error));
})();
