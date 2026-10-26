/* Link — 3-step landing: model > case > existing Salla product. No cart changes. */
(() => {
  'use strict';
  const modelLabels = {
    '15-pro': 'iPhone 15 Pro',
    '15-pro-max': 'iPhone 15 Pro Max',
    '16-pro': 'iPhone 16 Pro',
    '16-pro-max': 'iPhone 16 Pro Max'
  };
  const cases = [
    {
      key: 'slim',
      name: 'سلم',
      ribbon: 'خفيف وشفاف',
      description: 'كفر شفاف ونحيف يحافظ على شكل جوالك الأصلي، مناسب للي يحب التصميم البسيط والاستخدام اليومي.',
      features: ['نحيف وخفيف', 'مظهر شفاف', 'حماية يومية']
    },
    {
      key: 'splendor',
      name: 'سبلندر',
      ribbon: 'شفافية وأناقة',
      description: 'كفر شفاف بتصميم أنيق يبرز لون الجوال ويحافظ على مظهره، مع حماية للظهر والحواف أثناء الاستخدام.',
      features: ['تصميم شفاف', 'مظهر أنيق', 'حماية الظهر والحواف']
    },
    {
      key: 'majesty',
      name: 'ماجستي',
      ribbon: 'تصميم فاخر',
      description: 'ظهر نصف شفاف مطفي وحواف سيليكونية معزّزة، مع إطار كاميرا معدني ودعم MagSafe للإكسسوارات المغناطيسية.',
      features: ['ظهر مطفي', 'إطار كاميرا معدني', 'MagSafe']
    }
  ];
  const state = { model: null, caseType: null, products: [] };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const e = (tag, text = '', className = '') => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const show = (element, visible) => { element.hidden = !visible; };
  const fmt = price => new Intl.NumberFormat('ar-SA-u-nu-latn', {maximumFractionDigits:0}).format(price);
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smoothView = section => {
    requestAnimationFrame(() => section.scrollIntoView({
      behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start'
    }));
  };
  function track(event, data) {
    if (Array.isArray(window.dataLayer)) window.dataLayer.push({event, ...data});
  }
  function setProgress(current) {
    $$('[data-progress]').forEach(item => {
      const n = Number(item.dataset.progress);
      item.classList.toggle('current', n === current);
      item.classList.toggle('complete', n < current);
      if (n === current) item.setAttribute('aria-current','step');
      else item.removeAttribute('aria-current');
    });
  }
  function syncQuery() {
    const url = new URL(window.location.href);
    if (state.model) url.searchParams.set('model', state.model);
    else url.searchParams.delete('model');
    if (state.caseType) url.searchParams.set('case', state.caseType);
    else url.searchParams.delete('case');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  function productUrl(product) {
    const dest = new URL(product.url);
    const from = new URLSearchParams(location.search);
    const keep = new Set(['gclid','fbclid','ttclid','msclkid','gbraid','wbraid','ScCid','sc_click_id','sccid']);
    from.forEach((value, key) => {
      if ((key.toLowerCase().startsWith('utm_') || keep.has(key)) && value.length <= 200 && !dest.searchParams.has(key)) {
        dest.searchParams.set(key,value);
      }
    });
    return dest.href;
  }
  function chooseModel(model, options = {}) {
    if (!modelLabels[model]) return;
    state.model = model; state.caseType = null;
    $$('[data-model]').forEach(button => {
      const yes = button.dataset.model === model;
      button.classList.toggle('selected', yes);
      button.setAttribute('aria-pressed',String(yes));
    });
    show($('#step-case'),true);
    show($('#step-bundle'),false);
    $('#selected-model').textContent=modelLabels[model];
    renderCases();
    setProgress(2);
    syncQuery();
    track('link_bundle_model_selected', {phone_model:modelLabels[model]});
    if (options.scroll !== false) smoothView($('#step-case'));
  }
  function chooseCase(key, options = {}) {
    if (!state.model || !cases.some(c=>c.key===key)) return;
    const list = state.products.filter(p=>p.model===state.model && p.case===key && p.available);
    if (!list.length) return;
    state.caseType=key;
    $$('.case-card').forEach(button => {
      const yes=button.dataset.case===key;
      button.classList.toggle('selected',yes);
      button.setAttribute('aria-pressed',String(yes));
    });
    const choiceName=cases.find(c=>c.key===key).name;
    $('#selected-choice').textContent=modelLabels[state.model]+' — كفر '+choiceName;
    show($('#step-bundle'),true);
    renderBundles(list);
    setProgress(3);
    syncQuery();
    track('link_bundle_case_selected', {phone_model:modelLabels[state.model],case_type:key});
    if(options.scroll!==false) smoothView($('#step-bundle'));
  }
  function renderCases() {
    const grid=$('#case-grid');
    grid.replaceChildren();
    cases.forEach(caseInfo=>{
      const available=state.products.filter(p=>p.model===state.model&&p.case===caseInfo.key&&p.available);
      const button=e('button','','case-card');
      button.type='button';button.dataset.case=caseInfo.key;
      button.disabled=!available.length;button.setAttribute('aria-pressed','false');
      if(!available.length)button.setAttribute('aria-label','كفر '+caseInfo.name+' غير متوفر لـ '+modelLabels[state.model]);
      const image=e('div','','case-image');
      const representative=available.find(p=>p.kind==='lenses')||available[0];
      if(representative?.image){
        const img=e('img');img.src=representative.image;img.loading='lazy';img.alt='صورة بكج كفر '+caseInfo.name;image.append(img);
      }else{
        image.append(e('span','✦','case-placeholder'));
      }
      image.append(e('span',available.length?caseInfo.ribbon:'غير متوفر لهذا الموديل','case-top-tag'));
      const copy=e('div','','case-text');
      copy.append(e('h4','كفر '+caseInfo.name),e('p',caseInfo.description));
      const features=e('div','','case-features');
      caseInfo.features.forEach(feature=>features.append(e('span',feature)));
      const action=e('div',available.length?'اختيار كفر '+caseInfo.name:'غير متوفر لهذا الموديل','case-cta');
      if(available.length){
        action.append(e('span','←'));
        button.addEventListener('click',()=>chooseCase(caseInfo.key));
      }
      button.append(image,copy,features,action);grid.append(button);
    });
  }
  function renderBundles(available){
    const grid=$('#bundle-grid');
    grid.replaceChildren();
    grid.classList.toggle('single', available.length===1);
    const order={lenses:1,screen:2};
    available.sort((a,b)=>order[a.kind]-order[b.kind]);
    available.forEach(p=>{
      const kindName=p.kind==='lenses'?'عدسات حماية الكاميرا':'استيكر حماية الشاشة';
      const caseName=cases.find(c=>c.key===p.case).name;
      const article=e('article','','bundle-card');
      article.append(e('span',p.kind==='lenses'?'حماية عدسات الكاميرا':'حماية شاشة الجوال','bundle-tag'));
      const preview=e('div','','bundle-preview');
      const picture=e('img');picture.src=p.image;picture.alt='صورة '+p.name;picture.loading='lazy';
      const info=e('div','','bundle-info');
      info.append(e('h4','كفر '+caseName+' + '+kindName),
        e('p',p.kind==='lenses'
          ? 'كفر + طقم 3 عدسات. اختر لون العدسات في صفحة البكج.'
          : 'كفر + استيكر شاشة. اختر نوع الاستيكر في صفحة البكج.'));
      preview.append(picture,info);
      const details=e('div','','bundle-includes');
      details.append(e('span','كفر '+caseName),e('span',kindName),e('span',modelLabels[p.model]));
      const bottom=e('div','','bundle-bottom'),price=e('div','','bundle-price');
      price.append(e('strong',fmt(p.price)+' ر.س'),e('small',fmt(p.regularPrice)+' ر.س'));
      const link=e('a','اختيار البكج','go-product');
      link.href=productUrl(p);
      link.setAttribute('aria-label','الانتقال إلى '+p.name+' في متجر لنك');
      link.addEventListener('click',()=>track('link_bundle_product_click',{
        item_id:String(p.id),phone_model:modelLabels[p.model],case_type:p.case,bundle_kind:p.kind,price:p.price
      }));
      link.append(e('span','↗'));
      bottom.append(price,link);
      article.append(preview,details,bottom);grid.append(article);
    });
  }
  function validate(data) {
    if (!Array.isArray(data?.products))throw Error('Catalog missing');
    const seen=new Set();
    return data.products.filter(p=>{
      const id=String(p.id);
      if(seen.has(id)||!modelLabels[p.model]||!cases.some(c=>c.key===p.case)
        ||!['lenses','screen'].includes(p.kind)
        ||!Number.isFinite(p.price)||!Number.isFinite(p.regularPrice)
        ||typeof p.url!=='string'||!p.url.startsWith('https://linkstore-sa.com/')
        ||typeof p.image!=='string'
        ||!/^https:\/\//.test(p.image))return false;
      seen.add(id);return true;
    });
  }
  async function init(){
    const status=$('#load-message');
    try{
      const response=await fetch('/iphone-bundles-catalog.json',{credentials:'omit'});
      if(!response.ok)throw Error('Could not fetch catalog');
      state.products=validate(await response.json());
      if(!state.products.length)throw Error('No bundles in catalog');
      show(status,false);
      $$('[data-model]').forEach(button=>button.addEventListener('click',()=>chooseModel(button.dataset.model)));
      $$('[data-go]').forEach(button=>button.addEventListener('click',()=>{
        const n=Number(button.dataset.go);
        const section=n===1?$('#step-model'):$('#step-case');
        if(n===1){state.caseType=null;show($('#step-bundle'),false);show($('#step-case'),false);setProgress(1);}
        else if(n===2){state.caseType=null;show($('#step-bundle'),false);setProgress(2);}
        syncQuery();smoothView(section);
      }));
      const params=new URLSearchParams(location.search),model=params.get('model'),key=params.get('case');
      if(modelLabels[model]){
        chooseModel(model,{scroll:false});
        if(cases.some(c=>c.key===key))chooseCase(key,{scroll:false});
      }
      track('link_bundle_landing_view',{available_bundles:state.products.filter(p=>p.available).length});
    }catch(error){
      status.textContent='تعذر عرض البكجات حاليًا. تقدر تتصفحها مباشرة من متجر لنك.';
      const visit=e('a','زيارة متجر لنك');
      visit.href='https://linkstore-sa.com/';visit.style.cssText='display:block;color:#51007a;font-weight:800;margin-top:7px';
      status.append(visit);
      console.error('[Link iPhone landing]',error);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

