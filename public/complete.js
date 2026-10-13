(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={case:'الكفرات',screen:'حماية الشاشة',lens:'حماية العدسات',camera_frame:'مسطح وإطار الكاميرا'};
const descriptions={case:'اختر الستايل اللي يناسبك.',screen:'شفاف أو خصوصية، اختر اللي يناسب استخدامك.',lens:'تفاصيل تكمل حماية كاميراتك.',camera_frame:'خيارات لحماية منطقة الكاميرا.'};
const money=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2})+' ريال';
let products=[],picked=new Map();
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function selection(){const selected=products.filter(p=>picked.has(p.id)),total=selected.reduce((n,p)=>n+p.price*picked.get(p.id),0);$('selection').hidden=!selected.length;$('count').textContent=selected.length+' منتجات';$('total').textContent=money(total);return {selected,total};}
function render(d){
 products=d.products;$('title').textContent='كمّل حماية '+d.model;$('subtitle').textContent='جمعنا لك خيارات تكمل حماية جوالك. اختر منها اللي يناسبك.';
 $('owned').innerHTML=d.owned_components.map(c=>`<span>عندك ${esc(labels[c]||c)} ✓</span>`).join('');
 const groups=Object.keys(labels).filter(c=>products.some(p=>p.component===c));
 $('categories').innerHTML=groups.map(c=>`<a href="#group-${c}">${labels[c]}</a>`).join('');
 $('status').textContent=products.length?'':'حمايتك مكتملة، أو لا توجد خيارات مكملة متاحة حاليًا. تقدر ترجع لصفحتك لاحقًا.';
 $('products').innerHTML=groups.map(c=>`<section class="group" id="group-${c}"><h2>${labels[c]}</h2><p>${descriptions[c]}</p><div class="cards">${products.filter(p=>p.component===c).map(p=>`<article class="card" data-card="${esc(p.id)}"><img class="photo" src="${esc(safeUrl(p.image))}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer"><div class="card-body"><h3>${esc(p.name)}</h3><span class="price">${money(p.price)}</span><label class="pick"><input type="checkbox" data-pick="${esc(p.id)}"> أضف لاختياراتي</label><label class="quantity" hidden>الكمية <input type="number" min="1" max="10" value="1" data-quantity="${esc(p.id)}"></label><a class="product-link" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">شوف المنتج ↗</a>${p.has_options?'<span class="options-note">اختر اللون والخيارات داخل صفحة المنتج.</span>':''}</div></article>`).join('')}</div></section>`).join('');$('footnote').hidden=!products.length;
 $('products').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.removeAttribute('src');img.alt='صورة المنتج غير متاحة';},{once:true}));
}
$('products').addEventListener('change',e=>{const el=e.target;if(el.dataset.pick){el.checked?picked.set(el.dataset.pick,1):picked.delete(el.dataset.pick);const card=el.closest('.card');card.classList.toggle('picked',el.checked);card.querySelector('.quantity').hidden=!el.checked;card.querySelector('[data-quantity]').value='1';}else if(el.dataset.quantity){const n=Math.max(1,Math.min(10,Math.trunc(Number(el.value)||1)));el.value=n;if(picked.has(el.dataset.quantity))picked.set(el.dataset.quantity,n);}selection();});
$('review').addEventListener('click',()=>{const {selected,total}=selection();$('summary-products').innerHTML=selected.map(p=>`<div class="summary-row"><div>${esc(p.name)}<br><small>${picked.get(p.id)} × ${money(p.price)}</small></div><a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">فتح المنتج ↗</a></div>`).join('');$('summary-total').textContent='المجموع التقديري: '+money(total);$('summary').showModal();});$('close').addEventListener('click',()=>$('summary').close());
const token=location.pathname.split('/').filter(Boolean)[1];
if(!/^[-_A-Za-z0-9]{80,300}$/.test(token||'')){$('status').textContent='افتح الرابط الخاص الذي وصلك من لنك.';$('subtitle').textContent='منتجات تكمل حماية جوالك.';return;}
fetch('/api/postpurchase-page?token='+encodeURIComponent(token),{cache:'no-store',referrerPolicy:'no-referrer'}).then(async r=>{const d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'تعذر فتح الصفحة');render(d);}).catch(e=>{$('status').textContent=e.message;$('subtitle').textContent='تقدر تحاول لاحقًا، أو تتواصل معنا من متجر لنك.';});
})();
