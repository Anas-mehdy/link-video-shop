/* Link Store Drip case additions. Scope: four model-specific case products. */
(function () {
  'use strict';
  if (window.__linkDripUpsells) return;
  const id = location.pathname.match(/\/p(\d+)\/?$/)?.[1];
  if (!['101121129','1335345819','1622979904','284157041'].includes(id)) return;
  window.__linkDripUpsells = true;
  const base = 'https://link-video-shop.vercel.app';
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const money = n => new Intl.NumberFormat('ar-SA-u-nu-latn',{maximumFractionDigits:2}).format(n)+' ر.س';
  function quantityPicker(name, available, onChange) {
    const box=el('div','','ld-quantity'), minus=el('button','−'), plus=el('button','+'), input=el('input');
    minus.type=plus.type='button'; input.type='number';input.min='1';input.step='1';input.value='1';
    input.setAttribute('aria-label','الكمية — '+name);
    minus.setAttribute('aria-label','تقليل الكمية — '+name);plus.setAttribute('aria-label','زيادة الكمية — '+name);
    const value=()=>{const n=Number(input.value);return Number.isSafeInteger(n)&&n>0?n:1;};
    const disable=disabled=>{input.disabled=plus.disabled=disabled;minus.disabled=disabled||value()<=1;};
    const changed=()=>{input.value=String(value());disable(!available);onChange?.();};
    input.addEventListener('change',changed);
    minus.addEventListener('click',()=>{input.value=String(Math.max(1,value()-1));changed();});
    plus.addEventListener('click',()=>{input.value=String(value()+1);changed();});
    box.append(minus,input,plus);disable(!available);return {box,value,disable};
  }
  function mount(config) {
    if (document.getElementById('link-drip-protection')) return true;
    const form = document.querySelector(`#product-${id} .main-content .product-form`) || document.querySelector('.product-form');
    const button = form?.querySelector(`salla-add-product-button[product-id="${id}"]`);
    const cart = window.salla?.cart;
    if (!form || !button || !cart?.addItem || !cart.event?.onItemAdded) return false;
    const style = el('style');
    style.textContent = `.link-drip-extra{direction:rtl;box-sizing:border-box;font-family:inherit;width:100%;color:#281b30;margin:20px 0;padding:18px;border:1px solid #e6d9ec;border-radius:16px;background:#fcf9fe}.link-drip-extra *{box-sizing:border-box}.link-drip-extra h2{font-size:19px;font-weight:700;margin:0 0 6px}.link-drip-extra p{font-size:13px;line-height:1.7;margin:5px 0;color:#74617e}.link-drip-extra .ld-row{display:flex;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid #eee5f2}.link-drip-extra .ld-row:last-child{border:0}.link-drip-extra img{width:64px;height:64px;object-fit:contain;border-radius:10px;background:white}.link-drip-extra .ld-copy{flex:1;min-width:0}.link-drip-extra a{font-size:14px;font-weight:600;color:inherit;text-decoration:none}.link-drip-extra label{font-size:14px;font-weight:600;cursor:pointer}.link-drip-extra input{width:19px;height:19px;accent-color:#51007a;flex-shrink:0}.link-drip-extra select{display:block;width:100%;font:inherit;font-size:13px;margin-top:8px;border:1px solid #d9c9e0;border-radius:8px;background:white;padding:8px;color:#281b30}.link-drip-extra strong{font-size:14px;white-space:nowrap;color:#51007a}.link-drip-extra button{font:inherit;border:0;border-radius:10px;background:#51007a;color:white;padding:10px 12px;cursor:pointer}.link-drip-extra button:disabled{opacity:.5;cursor:default}.link-drip-extra .ld-selected{background:#f3eaf8;border-radius:10px;padding-inline:8px}.link-drip-extra .ld-unavailable{opacity:.65}.link-drip-extra .ld-summary,.link-drip-extra .ld-status{color:#51007a}.link-drip-extra .ld-summary{font-weight:700}.link-drip-extra :focus-visible{outline:3px solid #21b0f1;outline-offset:3px}form[data-link-drip-selected] salla-mini-checkout-widget,form[data-link-drip-selected] salla-quick-buy{display:none!important}@media(max-width:420px){.link-drip-extra{padding:12px}.link-drip-extra .ld-row{gap:8px}.link-drip-extra img{width:45px;height:45px}.link-drip-extra button{padding:9px;font-size:12px}.link-drip-extra strong{font-size:13px}}`;
    style.textContent+=`.link-drip-extra .ld-actions{display:flex;flex-direction:column;align-items:center;gap:9px;flex-shrink:0}.link-drip-extra .ld-quantity{display:flex;direction:ltr;align-items:center;border:1px solid #dccde4;border-radius:9px;background:white;overflow:hidden}.link-drip-extra .ld-quantity input{width:36px;height:32px;border:0;padding:0;text-align:center;font:inherit;font-size:13px;appearance:textfield;-moz-appearance:textfield}.link-drip-extra .ld-quantity input::-webkit-inner-spin-button,.link-drip-extra .ld-quantity input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.link-drip-extra .ld-quantity button{width:28px;height:32px;padding:0;border-radius:0;background:white;color:#51007a;font-size:18px}@media(max-width:420px){.link-drip-extra .ld-actions{max-width:100px}.link-drip-extra .ld-quantity button{width:24px}.link-drip-extra .ld-quantity input{width:30px}}`;
    document.head.append(style);
    const section = el('section','','link-drip-extra'); section.id='link-drip-protection';
    section.setAttribute('aria-label','كمّل حماية جوالك');
    section.append(el('h2','كمّل حماية جوالك'),el('p','إضافات مناسبة لـ '+config.model+' — اختر حماية الشاشة وحماية الكاميرا التي تناسبك'));
    const controls = [], summary=el('p','','ld-summary'), status=el('p','','ld-status');
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const retry=el('button','أعد إضافة المنتجات التي لم تُضف');retry.type='button';retry.hidden=true;
    let pending=null,busy=false,failed=[];
    for (const p of config.items) {
      const row=el('div','','ld-row'), input=el('input'), image=el('img');
      input.type='checkbox';input.id='ld-pick-'+p.id;input.disabled=!p.available;
      image.src=p.image;image.alt='';image.loading='lazy';
      const copy=el('div','','ld-copy'), label=el('label',p.name);label.htmlFor=input.id;
      const link=el('a','عرض التفاصيل');link.href=p.url;
      copy.append(label,el('p',p.available?'اختياري':'غير متوفر حالياً'),link);
      const price=el('strong','+ '+money(p.price)), pickers=[];
      for(const choice of p.choices||[]) {
        const select=el('select');select.setAttribute('aria-label',choice.name+' — '+p.name);select.disabled=true;
        const empty=el('option',choice.name);empty.value='';select.append(empty);
        for(const v of choice.values){const option=el('option',v.name);option.value=String(v.id);select.append(option);}
        select.addEventListener('change',update);copy.append(select);pickers.push({choice,select});
      }
      const quantity=quantityPicker(p.name,p.available,update),actions=el('div','','ld-actions');actions.append(price,quantity.box);
      const control={product:p,row,input,price,pickers,quantity};controls.push(control);
      input.addEventListener('change',()=>{
        update();
      });
      if(!p.available)row.classList.add('ld-unavailable');
      row.append(input,image,copy,actions);section.append(row);
    }
    function currentPrice(control){
      const first=control.pickers[0];
      return first?.choice.values.find(v=>String(v.id)===first.select.value)?.price ?? control.product.price;
    }
    function update(){
      const raw=Number(form.querySelector('[name="quantity"]')?.value||1);
      let total=config.price*(Number.isSafeInteger(raw)&&raw>0?raw:1), selected=0;
      for(const c of controls){
        c.row.classList.toggle('ld-selected',c.input.checked);
        c.pickers.forEach(p=>p.select.disabled=busy||!c.input.checked);c.quantity.disable(busy||!c.product.available);
        c.price.textContent='+ '+money(currentPrice(c));
        if(c.input.checked){total+=currentPrice(c)*c.quantity.value();selected++;}
      }
      form.toggleAttribute('data-link-drip-selected',selected>0);
      summary.textContent='الإجمالي: '+money(total);
    }
    section.append(summary,el('p','اختر المنتجات وحدّد كمية كل منتج بشكل مستقل. حدّد لون العدسات ثم اضغط «أضف للسلة». الأسعار قبل خصومات السلة.'),status,retry);
    (button.closest('.sticky-product-bar')||button.parentElement).before(section);
    function setBusy(value){busy=value;for(const c of controls)c.input.disabled=value||!c.product.available;retry.disabled=value;update();}
    function selectedItems(){
      const items=[];
      for(const c of controls.filter(c=>c.input.checked)){
        const options={};
        for(const p of c.pickers){
          if(!p.select.value){status.textContent='اختر '+p.choice.name+' للمنتج المحدد قبل الإضافة للسلة';p.select.focus();return null;}
          options[p.choice.id]=Number(p.select.value);
        }
        items.push({id:c.product.id,options,name:c.product.name,quantity:c.quantity.value()});
      }
      return items;
    }
    async function addExtras(items){
      setBusy(true);failed=[];retry.hidden=true;status.textContent='تتم إضافة منتجات الحماية...';
      for(const p of items){
        try{
          const response=await cart.addItem({id:p.id,quantity:p.quantity,options:p.options});
          if(response?.success===false||Number(response?.status)>=400)throw new Error('add failed');
        }catch(_){failed.push({...p});}
      }
      status.textContent=failed.length?'الكفر انضاف، لكن لم تُضف: '+failed.map(p=>p.name).join('، '):'تمت إضافة الكفر ومنتجات الحماية للسلة ✓';
      retry.hidden=failed.length===0;setBusy(false);
    }
    form.addEventListener('submit',event=>{
      if(busy||pending){event.preventDefault();event.stopImmediatePropagation();return;}
      const items=selectedItems();
      if(items===null){event.preventDefault();event.stopImmediatePropagation();return;}
      failed=[];retry.hidden=true;status.textContent='';
      if(!items.length)return;
      const raw=Number(form.querySelector('[name="quantity"]')?.value||1);
      pending={items,quantity:Number.isInteger(raw)&&raw>0?raw:1};
      const ticket=pending;
      setTimeout(()=>{if(pending===ticket){pending=null;status.textContent='لم نتأكد من إضافة الكفر؛ تحقق من السلة قبل المحاولة مرة أخرى.';}},45000);
    },true);
    cart.event.onItemAdded((_response,productId)=>{
      if(String(productId)!==id||!pending)return;
      const item=pending;pending=null;
      if(location.pathname.match(/\/p(\d+)\/?$/)?.[1]===id)addExtras(item.items);
    });
    cart.event.onItemAddedFailed?.((_error,productId)=>{if(String(productId)===id){pending=null;status.textContent='لم تتم إضافة الكفر. تحقق من اللون والتوفر ثم حاول مرة أخرى.';}});
    retry.addEventListener('click',()=>{if(!busy&&failed.length){const items=failed.slice();addExtras(items);}});
    form.addEventListener('input',event=>{if(event.target.name==='quantity')update();});
    form.addEventListener('change',event=>{if(event.target.name==='quantity')update();});
    update();
    const accessories=el('section','','link-drip-extra');accessories.id='link-drip-accessories';
    accessories.append(el('h2','منتجات مختارة لك'),el('p','إكسسوارات لاستخدامك اليومي'));
    for(const p of config.accessories){
      const row=el('div','','ld-row'),image=el('img');image.src=p.image;image.alt='';image.loading='lazy';
      const copy=el('div','','ld-copy'),link=el('a',p.name);link.href=p.url;
      const notice=el('p','','ld-status');notice.setAttribute('role','status');
      copy.append(link,el('p',money(p.price)),notice);
      const add=el('button',p.available?'أضف للسلة':'غير متوفر');add.type='button';add.disabled=!p.available;
      const quantity=quantityPicker(p.name,p.available),actions=el('div','','ld-actions');actions.append(quantity.box,add);
      add.addEventListener('click',async()=>{
        if(add.disabled)return;const count=quantity.value();add.disabled=true;quantity.disable(true);notice.textContent='تتم الإضافة...';
        try{const result=await cart.addItem({id:p.id,quantity:count});if(result?.success===false||Number(result?.status)>=400)throw new Error('add failed');notice.textContent='تمت الإضافة ✓';}
        catch(_){notice.textContent='تعذرت الإضافة؛ تحقق من التوفر.';}finally{add.disabled=!p.available;quantity.disable(!p.available);}
      });
      row.append(image,copy,actions);accessories.append(row);
    }
    (button.closest('.sticky-product-bar')||button.parentElement).after(accessories);return true;
  }
  fetch(base+'/drip-upsells-config.json?v=1',{credentials:'omit'}).then(r=>r.ok?r.json():null).then(data=>{
    const config=data?.products?.[id];if(!config)return;
    if(mount(config))return;
    const observer=new MutationObserver(()=>{if(mount(config))observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }).catch(()=>{});
})();
