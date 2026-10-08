/* Link Store product videos v2 — no database credentials, no autoplay on page load. */
(function () {
  'use strict';
  if (window.__linkProductVideos) return;
  window.__linkProductVideos = true;
  const BASE = 'https://link-video-shop.vercel.app';
  const config = window.LinkProductVideosConfig || {};
  let activePath = '', generation = 0, cleanup = () => {};
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  async function json(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Video request failed');
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function context() {
    const match = location.pathname.match(/\/p(\d+)\/?$/);
    const mount = document.querySelector('[data-link-product-videos]');
    const id = mount?.getAttribute('data-product-id') || match?.[1];
    if (!id || !/^\d+$/.test(id)) return null;
    if (mount) return { id, mount };
    const buttons = Array.from(document.querySelectorAll('salla-add-product-button'));
    const button = buttons.find(b => b.getAttribute('product-id') === id && !b.closest('#lvs-viewer'));
    let anchor;
    if (config.anchorSelector) {
      try { anchor = document.querySelector(config.anchorSelector); } catch (_) { return null; }
    } else {
      anchor = document.querySelector(`#product-${id} .main-content .product-form`) ||
        document.querySelector('.product-form') || (button && (button.closest('form') || button.parentElement));
    }
    return anchor ? { id, anchor } : null;
  }
  async function render(ctx, token) {
    let feed;
    try { feed = await json(BASE + '/api/video-shop-feed'); } catch (_) { return; }
    if (token !== generation || !feed.ok || !Array.isArray(feed.videos)) return;
    const videos = feed.videos.filter(v => /^\d+$/.test(String(v.tiktok_video_id)) &&
      Array.isArray(v.products) && v.products.some(p => String(p.id) === ctx.id));
    if (!videos.length) return;
    const host = el('section');
    host.id = 'link-product-videos';
    host.style.cssText = 'display:block;width:100%;margin:24px 0;clear:both';
    const root = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = `
      :host{font-family:inherit;color:#24152e;direction:rtl}*{box-sizing:border-box}
      h2{font-size:22px;margin:0 0 6px;text-align:center}p{font-size:14px;color:#777;margin:0 0 16px;text-align:center}
      .rail{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 12px;scroll-snap-type:x mandatory}
      button{font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #ab6bdd;outline-offset:3px}
      .card{position:relative;flex:0 0 156px;aspect-ratio:9/16;overflow:hidden;border:0;border-radius:18px;background:linear-gradient(145deg,#351347,#702790);color:white;scroll-snap-align:start;padding:0}
      .card:first-child{margin-inline-start:auto}.card:last-child{margin-inline-end:auto}
      .card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
      .play{position:absolute;top:40%;left:calc(50% - 25px);width:50px;height:50px;border-radius:50%;background:#fff;color:#51007a;display:grid;place-items:center;font-size:22px}
      .label{position:absolute;bottom:0;right:0;left:0;padding:35px 10px 12px;background:linear-gradient(transparent,rgba(0,0,0,.8));font-size:13px;line-height:1.6}
      dialog{border:0;border-radius:18px;padding:12px;background:#17121b;color:white;width:min(440px,calc(100vw - 20px));max-height:94dvh;overflow:auto}
      dialog::backdrop{background:rgba(0,0,0,.76)}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px}
      .close,.nav button,.buy{border:0;border-radius:10px;padding:10px 16px;background:#fff;color:#51007a;text-decoration:none}
      iframe{display:block;border:0;width:100%;height:min(65dvh,640px);background:#000;border-radius:10px}
      .nav{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px}.buy{display:block;text-align:center;background:#51007a;color:white;margin-top:10px}
      @media(min-width:768px){.card{flex-basis:180px}}
    `;
    root.append(style, el('h2', 'شوفها على الواقع'), el('p', 'شاهد المنتج بالفيديو قبل ما تختار'));
    const rail = el('div', '', 'rail');
    rail.setAttribute('aria-label', 'فيديوهات هذا المنتج');
    root.append(rail);
    const dialog = el('dialog');
    dialog.setAttribute('aria-label', 'شاهد المنتج على الواقع');
    const top = el('div', '', 'top'), title = el('span'), close = el('button', '✕', 'close');
    close.type = 'button'; close.setAttribute('aria-label', 'إغلاق الفيديو');
    top.append(title, close);
    const player = el('iframe');
    player.title = 'فيديو المنتج على TikTok';
    player.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    player.setAttribute('allowfullscreen', '');
    const nav = el('div', '', 'nav'), prev = el('button', 'السابق'), count = el('span'), next = el('button', 'التالي');
    prev.type = next.type = 'button'; nav.append(prev, count, next);
    nav.hidden = videos.length < 2;
    if (videos.length < 2) nav.style.display = 'none';
    const buy = el('button', 'رجوع لاختيار المنتج', 'buy'); buy.type = 'button';
    dialog.append(top, player, nav, buy); root.append(dialog);
    let index = 0, trigger, priorOverflow = '';
    function load(i) {
      index = (i + videos.length) % videos.length;
      const video = videos[index];
      title.textContent = video.title || 'شوفها على الواقع';
      count.textContent = (index + 1) + ' / ' + videos.length;
      player.src = 'https://www.tiktok.com/player/v1/' + video.tiktok_video_id + '?controls=1&autoplay=1&rel=0&description=0&music_info=0';
    }
    function stop() {
      player.removeAttribute('src');
      document.body.style.overflow = priorOverflow;
      trigger?.focus({ preventScroll: true });
    }
    dialog.addEventListener('close', stop);
    close.onclick = () => dialog.close();
    buy.onclick = () => {
      dialog.close();
      const c = context();
      (c?.anchor || ctx.anchor || host).scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    prev.onclick = () => load(index - 1); next.onclick = () => load(index + 1);
    dialog.addEventListener('click', e => { if (e.target === dialog && (e.clientX < dialog.getBoundingClientRect().left || e.clientX > dialog.getBoundingClientRect().right || e.clientY < dialog.getBoundingClientRect().top || e.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
    videos.forEach(video => {
      const card = el('button', '', 'card'); card.type = 'button';
      card.setAttribute('aria-label', 'مشاهدة ' + (video.title || 'فيديو المنتج'));
      const img = el('img'); img.alt = ''; img.loading = 'eager'; img.decoding = 'async'; img.style.opacity = '0';
      const play = el('span', '▶', 'play'); play.setAttribute('aria-hidden', 'true');
      card.append(img, play, el('span', video.title || 'شاهد الفيديو', 'label')); rail.append(card);
      card.onclick = () => {
        trigger = card; priorOverflow = document.body.style.overflow;
        dialog.showModal(); document.body.style.overflow = 'hidden'; load(videos.indexOf(video));
      };
      // The feed's thumbnail may be a product photo: use TikTok's cover only.
      const key = 'lvs-tiktok-cover-v2-' + video.tiktok_video_id;
      function show(url) {
        if (typeof url !== 'string' || !url.startsWith('https://')) return;
        img.onload = () => { img.style.opacity = '1'; };
        img.onerror = () => { img.style.opacity = '0'; try { localStorage.removeItem(key); } catch (_) {} };
        img.src = url;
      }
      async function cover() {
        try {
          const cached = JSON.parse(localStorage.getItem(key) || 'null');
          if (cached && cached.url && Date.now() - cached.ts < 3600000) { show(cached.url); return; }
        } catch (_) {}
        try {
          const data = await json('https://www.tiktok.com/oembed?url=' + encodeURIComponent('https://www.tiktok.com/@link.60/video/' + video.tiktok_video_id));
          if (token !== generation) return;
          show(data.thumbnail_url);
          if (data.thumbnail_url) try { localStorage.setItem(key, JSON.stringify({url:data.thumbnail_url,ts:Date.now()})); } catch (_) {}
        } catch (_) { /* Keep a branded play card; never substitute a product photo. */ }
      }
      cover();
    });
    if (token !== generation) return;
    if (ctx.mount) ctx.mount.append(host); else (document.getElementById('link-drip-accessories') || ctx.anchor).after(host);
    cleanup = () => { if (dialog.open) { dialog.close(); stop(); } host.remove(); };
  }
  function check() {
    const path = location.pathname;
    if (path !== activePath) { activePath = path; generation++; cleanup(); cleanup = () => {}; }
    if (document.getElementById('link-product-videos') || check.pending === generation) return;
    const ctx = context(); if (!ctx) return;
    check.pending = generation;
    render(ctx, generation).catch(() => {});
  }
  function start() {
    check();
    let scheduled;
    new MutationObserver(() => { clearTimeout(scheduled); scheduled = setTimeout(check, 150); }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', check);
    window.addEventListener('pageshow', check);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();


/* Optional add-ons: restricted to the three Samsung Ultra bundle pages. */
(function () {
  if (window.__linkBundleLoader) return;
  window.__linkBundleLoader = true;
  function loadBundleAdditions() {
    if (!/\/p(1721100195|1545880750|2079294120)\/?$/.test(location.pathname)) return;
    if (document.getElementById('link-bundle-upsells-loader')) return;
    var script = document.createElement('script');
    script.id = 'link-bundle-upsells-loader';
    script.src = 'https://link-video-shop.vercel.app/bundle-upsells.js?v=1';
    script.async = true;
    document.head.appendChild(script);
  }
  loadBundleAdditions();
  window.addEventListener('pageshow', loadBundleAdditions);
})();

/* Model-specific Drip case protection and accessory additions. */
(function () {
  if (window.__linkDripLoader) return;
  window.__linkDripLoader = true;
  function loadDripAdditions() {
    if (!/\/p(101121129|1335345819|1622979904|284157041|387390654)\/?$/.test(location.pathname)) return;
    if (document.getElementById('link-drip-upsells-loader')) return;
    var script = document.createElement('script');
    script.id = 'link-drip-upsells-loader';
    script.src = 'https://link-video-shop.vercel.app/drip-upsells.js?v=1';
    script.async = true;
    document.head.appendChild(script);
  }
  loadDripAdditions();
  window.addEventListener('pageshow', loadDripAdditions);
})();


/* Link carbon protection pilot v1 — only product 454677929. */
(function () {
  'use strict';
  if (!/\/p454677929\/?$/.test(location.pathname) || window.__linkCarbonProtection) return;
  window.__linkCarbonProtection = true;
  const id = 454677929;
  const catalog = [
  {
    "id": 454677929,
    "name": "كفر كاربون فايبر مغناطيسي – iPhone 17 Pro – سماوي",
    "price": 149,
    "image": "https://cdn.files.salla.network/products/1829345766/828437cc-de4a-49c5-a7d0-22e9e73293af-original.webp",
    "available": true,
    "max": 1,
    "options": []
  },
  {
    "id": 982757716,
    "name": "استيكر حماية لنك لامع – iPhone 17 Pro",
    "price": 129,
    "image": "https://cdn.salla.sa/Zpqzp/b7a44545-821d-44b7-8f99-437f4a2e6b84-402.77777777778x500-METwtPaSGjrDKxUHBQqQrt9gB2CRTBDSNZzYJfOO.png",
    "available": true,
    "max": 99,
    "options": []
  },
  {
    "id": 62439963,
    "name": "استيكر حماية لنك لامع خصوصي – iPhone 17 Pro",
    "price": 129,
    "image": "https://cdn.salla.sa/Zpqzp/4e39f630-9fe3-43fe-bcd9-fd0ae2ad9013-402.77777777778x500-EaJfGl8pEBJEE5gVHkH6xs8pLRZ2Xrn4fSAcCtgT.png",
    "available": true,
    "max": 99,
    "options": []
  },
  {
    "id": 1627040171,
    "name": "استيكر حماية لنك مطفي خصوصي – iPhone 17 Pro",
    "price": 129,
    "image": "https://cdn.salla.sa/Zpqzp/9f032db6-0fb8-434c-aa67-88a022206d91-402.77777777778x500-xGJHzlxLSoFh9uXMIWzhK1B6isfNkiO2xJbU5zEx.png",
    "available": true,
    "max": 99,
    "options": []
  },
  {
    "id": 641572861,
    "name": "استيكر حماية لنك مطفي – iPhone 17 Pro",
    "price": 129,
    "image": "https://cdn.salla.sa/Zpqzp/81de43d0-8693-46ad-98e0-29d5d4712ed8-402.77777777778x500-2w30yei0FMgMfRO6OYajBJxqgVjMtAlv4CEJqd5z.png",
    "available": false,
    "max": 99,
    "options": []
  },
  {
    "id": 322974234,
    "name": "عدسات Link لحماية الكاميرا – iPhone 17 Pro",
    "price": 79,
    "image": "https://cdn.salla.sa/Zpqzp/e7225a76-37a7-4509-9a33-2a527fa735e0-500x500-JQcd6JnJNErZjMCzmk1WN8vM0y1qxoteZy2ixQW9.png",
    "available": true,
    "max": 99,
    "options": [
      {
        "id": 1797702119,
        "name": "اختر اللون",
        "values": [
          {
            "id": 884470587,
            "name": "اورانج",
            "available": true
          },
          {
            "id": 1439697470,
            "name": "كحلى",
            "available": true
          }
        ]
      }
    ]
  },
  {
    "id": 346332705,
    "name": "مسطح حماية Link آيفون 17 برو",
    "price": 89,
    "image": "https://cdn.salla.sa/Zpqzp/026c7718-4af8-463b-8acf-5747b7533cf7-500x500-S1kcAj9twXs49EhjGYcgtYbi6bIVKWkAz1g9olJP.png",
    "available": true,
    "max": 99,
    "options": []
  }
]
;
  const product = catalog[0], screens = catalog.slice(1,5), lens = catalog[5], plate = catalog[6];
  const money = n => new Intl.NumberFormat('ar-SA-u-nu-latn',{maximumFractionDigits:2}).format(n)+' ر.س';
  const make = (tag,text,cls) => {const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const labels = ['لامع شفاف','لامع خصوصي','مطفي خصوصي','مطفي عادي'];
  const css = `
  #link-carbon-protection .lc-price-box{text-align:left;flex:none}
  #link-carbon-protection .lc-old-price{display:block;font-size:12px;color:#8b7d92;white-space:nowrap}
  #link-carbon-protection .lc-saving{display:inline-block;background:#edf8f1;color:#24653b;font-size:12px;font-weight:700;border-radius:6px;padding:3px 8px;margin-top:5px}

  #link-carbon-protection{direction:rtl;color:#281d32;font-family:inherit;border:1px solid #e5dce9;border-radius:18px;background:#fff;margin:20px 0;overflow:hidden;scroll-margin-top:90px}
  #link-carbon-protection *,#link-carbon-cart *{box-sizing:border-box}
  #link-carbon-protection .lc-head{padding:18px 18px 13px;background:linear-gradient(120deg,#faf6fc,#f2fbff)}
  #link-carbon-protection h2{font-size:20px;font-weight:800;margin:0 0 5px;color:#51007a}
  #link-carbon-protection p{font-size:13px;line-height:1.7;margin:4px 0;color:#746780}
  #link-carbon-protection .lc-body{padding:14px 16px}
  #link-carbon-protection button,#link-carbon-protection select,#link-carbon-protection input,#link-carbon-protection summary,#link-carbon-cart button{font:inherit}
  #link-carbon-protection .lc-package{display:flex;gap:11px;align-items:flex-start;border:1px solid #e6dee9;border-radius:12px;padding:13px;margin-bottom:9px;cursor:pointer;background:white}
  #link-carbon-protection .lc-package:has(input:checked){border-color:#6b1f91;box-shadow:inset 0 0 0 1px #6b1f91;background:#fcf8ff}
  #link-carbon-protection .lc-package:has(input:disabled){opacity:.55;cursor:default}
  #link-carbon-protection input[type=radio],#link-carbon-protection input[type=checkbox]{appearance:none;width:21px;height:21px;flex:none;border:1.5px solid #b6a4c0;border-radius:4px;margin:2px 0 0;background:white;display:grid;place-content:center;cursor:pointer}
  #link-carbon-protection input:checked{background:#51007a;border-color:#51007a}
  #link-carbon-protection input:checked::after{content:'✓';color:white;font-size:15px;font-weight:800}
  #link-carbon-protection .lc-copy{flex:1;min-width:0}
  #link-carbon-protection .lc-line{display:flex;justify-content:space-between;gap:9px;align-items:center}
  #link-carbon-protection b{font-size:14px;line-height:1.6;font-weight:750}
  #link-carbon-protection strong{color:#51007a;font-size:14px;white-space:nowrap}
  #link-carbon-protection .lc-pictures{display:flex;align-items:center;gap:5px;margin-top:9px}
  #link-carbon-protection .lc-pictures img{width:38px;height:38px;object-fit:contain;border:1px solid #ede7f0;border-radius:7px;background:white}
  #link-carbon-protection .lc-options{padding:4px 0 10px;display:grid;gap:12px}
  #link-carbon-protection .lc-field label{display:block;font-size:13px;font-weight:700;margin:0 0 6px}
  #link-carbon-protection select{display:block;width:100%;padding:10px 12px;border:1px solid #d7c8df;border-radius:9px;background:white;color:#281d32;font-size:14px;min-height:44px}
  #link-carbon-protection details{border-top:1px solid #ece5ef;padding-top:11px;margin-top:7px}
  #link-carbon-protection summary{color:#51007a;font-size:14px;font-weight:700;cursor:pointer;padding:5px 0;min-height:36px}
  #link-carbon-protection .lc-custom-row{display:flex;align-items:center;gap:9px;padding:12px 0;border-bottom:1px solid #eee8f1;font-size:13px}
  #link-carbon-protection .lc-custom-row label{flex:1;cursor:pointer}
  #link-carbon-protection .lc-custom-row input[type=number]{width:56px;height:38px;border:1px solid #d8c9df;border-radius:7px;text-align:center;color:#51007a;background:white;font-size:14px}
  #link-carbon-protection .lc-status{margin-top:10px;color:#51007a;overflow-wrap:anywhere}
  #link-carbon-protection [hidden]{display:none!important}
  #link-carbon-protection :focus-visible,#link-carbon-cart :focus-visible{outline:3px solid #21b0f1;outline-offset:3px}
  #link-carbon-cart{direction:rtl;font-family:inherit;display:flex;align-items:center;gap:14px;padding:13px 0;background:white;color:#281d32}
  #link-carbon-cart .lc-total{flex:1;min-width:105px}
  #link-carbon-cart small{display:block;font-size:11px;color:#81708d}
  #link-carbon-cart strong{display:block;font-size:20px;color:#51007a;white-space:nowrap;line-height:1.4}
  #link-carbon-cart button{flex:1;min-height:48px;border:0;border-radius:11px;background:#51007a;color:white;font-size:15px;font-weight:750;padding:12px;cursor:pointer}
  #link-carbon-cart button:disabled{opacity:.55;cursor:default}
  [data-link-carbon-native]{display:none!important}
  #product-454677929 form[data-link-carbon-extras] salla-installment{display:none!important}
  @media(max-width:767px){
    body.link-carbon-active{padding-bottom:calc(90px + env(safe-area-inset-bottom,0px))!important}
    #link-carbon-cart{position:fixed;inset:auto 0 0;z-index:60;margin:0;padding:11px 16px calc(11px + env(safe-area-inset-bottom,0px));border-top:1px solid #e5dce9;box-shadow:0 -5px 22px #35134312;gap:13px}
    #link-carbon-cart .lc-total{flex:0 0 112px}
    #link-carbon-protection .lc-head{padding:16px}
    #link-carbon-protection .lc-body{padding:12px}
    #link-carbon-protection .lc-package{padding:12px 10px;gap:9px}
    #link-carbon-protection .lc-line{align-items:flex-start}
    #link-carbon-protection .lc-line b{font-size:13px}
  }
  @media(max-width:359px){#link-carbon-cart{padding-inline:11px}#link-carbon-cart .lc-total{flex-basis:95px}#link-carbon-cart strong{font-size:18px}#link-carbon-protection .lc-line{flex-wrap:wrap}}
  `;
  function mount() {
    if(document.getElementById('link-carbon-protection'))return true;
    const form=document.querySelector('#product-454677929 .main-content .product-form');
    const native=form?.querySelector('salla-add-product-button[product-id="454677929"]');
    const cart=window.salla?.cart;
    if(!form||!native||!cart?.addItem)return false;
    const priceContainer=document.querySelector('#product-454677929 .main-content .price');
    const nativeBar=native.closest('.sticky-product-bar')||native;
    const root=make('section');root.id='link-carbon-protection';root.setAttribute('aria-label','اختَر حماية جوالك');
    const style=make('style');style.id='link-carbon-style';style.textContent=css;
    const head=make('div','','lc-head');head.append(make('h2','اختَر حماية جوالك'),make('p','خيارات مناسبة لآيفون 17 برو · اختر الكفر وحده أو كمّل حمايته'));
    const body=make('div','','lc-body'), packages=make('div');packages.setAttribute('role','radiogroup');packages.setAttribute('aria-label','خيارات الحماية');
    const state={mode:'case',screen:0,color:1439697470,picks:[false,false,false],quantities:[1,1,1],busy:false,complete:false,uncertain:false,remaining:null};
    let ready=false,liveChecked=false;
    const modes=[['case','الكفر فقط','الكفر السماوي'],['screen','الكفر + حماية الشاشة','الكفر + استيكر الشاشة'],['full','الكفر + حماية الشاشة والكاميرا','الكفر + استيكر + عدسات + مسطح كاميرا عادي']];
    const cards=modes.map(([key,title,description])=>{
      const label=make('label','','lc-package'),radio=make('input');radio.type='radio';radio.name='link-carbon-package';radio.value=key;radio.setAttribute('aria-label',title);
      const copy=make('div','','lc-copy'),line=make('div','','lc-line'),price=make('strong'),oldPrice=make('del','','lc-old-price'),badge=make('span','','lc-saving'),priceBox=make('div','','lc-price-box'),desc=make('p',description),pictures=make('div','','lc-pictures');
      priceBox.append(oldPrice,price);line.append(make('b',title),priceBox);copy.append(line,desc,badge,pictures);label.append(radio,copy);packages.append(label);
      radio.addEventListener('change',()=>{state.mode=key;state.picks=key==='case'?[false,false,false]:key==='screen'?[true,false,false]:[true,true,true];state.quantities=[1,1,1];status.textContent='';update();});
      return {key,radio,price,oldPrice,badge,pictures};
    });
    const options=make('div','','lc-options');
    const screenField=make('div','','lc-field'),screenLabel=make('label','نوع حماية الشاشة'),screenSelect=make('select');screenSelect.id='lc-screen';screenLabel.htmlFor=screenSelect.id;screenField.append(screenLabel,screenSelect);
    const colorField=make('div','','lc-field'),colorLabel=make('label','لون عدسات الكاميرا'),colorSelect=make('select');colorSelect.id='lc-color';colorLabel.htmlFor=colorSelect.id;colorField.append(colorLabel,colorSelect);
    options.append(screenField,colorField);
    const details=make('details'),summary=make('summary','خصّص الحماية — اختَر قطعًا محددة');details.append(summary,make('p','يمكنك اختيار أي قطعة أو إلغاء اختيارها وتعديل كميتها.'));
    const custom=['حماية الشاشة','عدسات الكاميرا','مسطح كاميرا عادي'].map((name,i)=>{
      const row=make('div','','lc-custom-row'),check=make('input'),label=make('label',name),price=make('strong'),qty=make('input');
      check.type='checkbox';check.id='lc-custom-'+i;label.htmlFor=check.id;qty.type='number';qty.min='1';qty.step='1';qty.value='1';qty.setAttribute('aria-label','كمية '+name);
      row.append(check,label,price,qty);details.append(row);
      check.addEventListener('change',()=>{state.picks[i]=check.checked;state.mode='custom';status.textContent='';update();});
      qty.addEventListener('change',()=>{const max=selectedProducts()[i].max;state.quantities[i]=Math.min(max,Math.max(1,Math.floor(Number(qty.value)||1)));state.mode='custom';update();});
      return {check,price,qty};
    });
    const note=make('p','وفّر 20 ر.س مع حماية الشاشة، أو 47 ر.س مع الحماية الكاملة. السعر قبل الشحن.'),status=make('p','','lc-status');status.id='lc-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const bar=make('div');bar.id='link-carbon-cart';const total=make('div','','lc-total'),totalPrice=make('strong'),count=make('small'),add=make('button','أضف للسلة');add.type='button';add.setAttribute('aria-describedby','lc-status');total.append(make('small','الإجمالي'),totalPrice,count);bar.append(total,add);
    const cartLink=make('a','عرض السلة');cartLink.href='/cart';cartLink.style.cssText='display:inline-block;margin-top:8px;color:#51007a;text-decoration:underline;font-size:13px';cartLink.hidden=true;
    body.append(packages,options,details,note,status,cartLink);root.append(head,body);
    function selectedProducts(){return [screens[state.screen],lens,plate];}
    // Verified live Salla buy-one-case/get-one-screen offer: 15.504%, rounded to 20 SAR.
    // Verified full-package offer: one screen, one lens and one normal plate = 47 SAR saving.
    const offerScreens=[982757716,62439963,1627040171];
    function saving(picks=state.picks,quantities=state.quantities){
      if(product.price!==149||screens[state.screen].price!==129||!offerScreens.includes(screens[state.screen].id))return 0;
      if(picks.every(Boolean)&&quantities.every(q=>q===1)&&lens.price===79&&plate.price===89)return 47;
      const pieces=picks.reduce((sum,p,i)=>sum+(p?quantities[i]:0),0);
      return picks[0]&&pieces<3?20:0;
    }
    function subtotal(){return product.price+selectedProducts().reduce((sum,p,i)=>sum+(state.picks[i]?p.price*state.quantities[i]:0),0);}
    function amount(){return subtotal()-saving();}
    function image(p){const img=make('img');img.src=p.image;img.alt=p===product?'الكفر السماوي':p.name;img.loading='lazy';return img;}
    function update(){
      const locked=state.busy||state.complete||state.uncertain||!!state.remaining;
      const ps=selectedProducts();
      cards.forEach(c=>{
        c.radio.checked=state.mode===c.key;c.radio.disabled=locked||!product.available||(c.key!=='case'&&!ps[0].available)||(c.key==='full'&&(!lens.available||!plate.available));
        const items=c.key==='case'?[product]:c.key==='screen'?[product,ps[0]]:[product,...ps];
        const original=items.reduce((sum,p)=>sum+p.price,0),discount=saving(c.key==='case'?[false,false,false]:c.key==='screen'?[true,false,false]:[true,true,true],[1,1,1]);
        c.price.textContent=money(original-discount);c.oldPrice.textContent=discount?money(original):'';c.oldPrice.hidden=!discount;
        c.badge.textContent=discount?(c.key==='full'?'أفضل قيمة · ':'')+'وفّر '+money(discount):'';c.badge.hidden=!discount;c.pictures.replaceChildren(...items.map(image));
      });
      custom.forEach((c,i)=>{c.check.checked=state.picks[i];c.check.disabled=locked||!ps[i].available;c.qty.disabled=locked||!state.picks[i]||!ps[i].available;c.qty.max=String(ps[i].max);c.qty.value=String(state.quantities[i]);c.price.textContent=ps[i].available?'+ '+money(ps[i].price):'نفد حاليًا';});
      screenField.hidden=!state.picks[0];colorField.hidden=!state.picks[1];
      screenSelect.disabled=colorSelect.disabled=locked;
      note.textContent=state.mode==='custom'&&state.quantities.some((q,i)=>state.picks[i]&&q>1)?'الخصم النهائي للكميات المخصصة يُحتسب في السلة. السعر قبل الشحن.':'وفّر 20 ر.س مع حماية الشاشة، أو 47 ر.س مع الحماية الكاملة. السعر قبل الشحن.';
      totalPrice.textContent=money(amount());const pieceCount=1+state.picks.reduce((sum,p,i)=>sum+(p?state.quantities[i]:0),0);count.textContent=saving()?'وفّرت '+money(saving()):pieceCount===1?'قطعة واحدة':pieceCount+' قطع مختارة';
      const invalid=!product.available||ps.some((p,i)=>state.picks[i]&&!p.available);
      add.disabled=state.busy||(!state.complete&&!state.uncertain&&(!ready||invalid));
      add.textContent=state.busy?'تتم الإضافة...':state.complete||state.uncertain?'عرض السلة':state.remaining?'أكمل إضافة القطع المتبقية':!product.available?'نفد الكفر حاليًا':'أضف للسلة';
      form.toggleAttribute('data-link-carbon-extras',state.picks.some(Boolean));
      root.dataset.price=String(amount());root.dataset.saving=String(saving());root.dataset.mode=state.mode;
      cartLink.hidden=!state.complete&&!state.uncertain&&!state.remaining;
    }
    function fillOptions(){
      screenSelect.replaceChildren(...screens.map((p,i)=>{const o=make('option',labels[i]+' — '+money(p.price)+(p.available?'':' · نفد حاليًا'));o.value=String(i);o.disabled=!p.available;return o;}));screenSelect.value=String(state.screen);
      colorSelect.replaceChildren(...(lens.options[0]?.values||[]).map(v=>{const o=make('option',(v.name==='كحلى'?'كحلي':v.name==='اورانج'?'برتقالي':v.name)+(v.available?'':' · نفد حاليًا'));o.value=String(v.id);o.disabled=!v.available;return o;}));colorSelect.value=String(state.color);
    }
    screenSelect.addEventListener('change',()=>{state.screen=Number(screenSelect.value);status.textContent='';update();});
    colorSelect.addEventListener('change',()=>{state.color=Number(colorSelect.value);status.textContent='';update();});
    function validOptions(){return !state.picks[1]||lens.options[0]?.values.some(v=>v.id===state.color&&v.available);}
    async function refresh(products){
      if(!window.salla.product?.getDetails)return false;
      const results=await Promise.allSettled(products.map(async p=>{let timer;try{return await Promise.race([window.salla.product.getDetails(p.id,['options']),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),8000);})]);}finally{clearTimeout(timer);}}));
      let checked=true;
      results.forEach((r,i)=>{
        if(r.status!=='fulfilled'){checked=false;return;}
        const response=r.value,d=response?.data?.product||response?.data||response?.product||response;
        if(String(d?.id)!==String(products[i].id)){checked=false;return;}
        const p=products[i],raw=d.price?.amount??d.price?.price??d.price,price=Number(raw);
        if(Number.isFinite(price)&&price>0)p.price=price;else checked=false;
        p.available=d.is_available!==false&&!['out','hidden','out_of_stock','unavailable'].includes(d.status);
        // Match known color IDs only; extra required options cannot be silently omitted.
        if(p===lens&&Array.isArray(d.options)&&d.options.length){
          const option=d.options.find(o=>Number(o.id)===lens.options[0].id);
          if(!option||d.options.some(o=>o.required&&Number(o.id)!==lens.options[0].id)){p.available=false;return;}
          if(Array.isArray(option.values))lens.options[0].values.forEach(v=>{const live=option.values.find(o=>Number(o.id)===v.id);v.available=!!live&&live.is_out_of_stock!==true&&live.is_available!==false;});
        }
      });
      if(!screens[state.screen].available&&!state.picks[0]){const first=screens.findIndex(p=>p.available);if(first>=0)state.screen=first;}
      root.dataset.catalogStatus=checked?'verified':'unverified';fillOptions();update();return checked;
    }
    function payloads(){
      return [{id,name:product.name,quantity:1,options:{}},...selectedProducts().flatMap((p,i)=>state.picks[i]?[{id:p.id,name:p.name,quantity:state.quantities[i],options:p===lens?{[lens.options[0].id]:state.color}:{}}]:[])];
    }
    add.addEventListener('click',async()=>{
      if(state.busy)return;
      if(state.complete||state.uncertain){location.assign('/cart');return;}
      if(!validOptions()){status.textContent='اختر لونًا متوفرًا للعدسات.';colorSelect.focus();return;}
      state.busy=true;update();status.textContent='نتحقق من السعر والتوفر...';
      const before=amount();
      liveChecked=await refresh([product,...selectedProducts().filter((p,i)=>state.picks[i])]);
      if(!liveChecked){state.busy=false;status.textContent='تعذر التحقق من السعر والتوفر؛ حاول بعد قليل.';update();return;}
      if(before!==amount()||!product.available||selectedProducts().some((p,i)=>state.picks[i]&&!p.available)||!validOptions()){
        state.busy=false;status.textContent='تغير السعر أو التوفر. راجع اختياراتك ثم اضغط الإضافة مجددًا.';update();return;
      }
      const queue=state.remaining||payloads();state.remaining=null;let added=0;
      for(let i=0;i<queue.length;i++){
        status.textContent='تتم إضافة '+(i+1)+' من '+queue.length+'...';
        try{
          const result=await cart.addItem({id:queue[i].id,quantity:queue[i].quantity,options:queue[i].options});
          if(result?.success===false||Number(result?.status)>=400)throw Object.assign(Error('rejected'),{status:result.status||422});
          added++;
        }catch(error){
          const code=Number(error?.response?.status||error?.status||error?.data?.status);
          if(code>=400&&code<500){state.remaining=queue.slice(i);status.textContent=(added?'أضيفت '+added+' قطعة. ':'')+'لم تكتمل إضافة «'+queue[i].name+'». يمكنك إكمال القطع المتبقية دون تكرار ما أُضيف.';}
          else{state.uncertain=true;status.textContent='لم نتأكد من اكتمال الإضافة. افتح السلة للتحقق قبل إعادة الطلب.';}
          state.busy=false;update();return;
        }
      }
      state.complete=true;state.busy=false;status.textContent='تمت إضافة اختياراتك للسلة ✓';update();
    });
    const preventNative=event=>{event.preventDefault();event.stopImmediatePropagation();if(!state.busy)add.click();};
    form.addEventListener('submit',preventNative,true);
    document.head.append(style);(priceContainer||form).after(root);root.append(bar);nativeBar.setAttribute('data-link-carbon-native','');
    const media=matchMedia('(max-width:767px)');
    function moveBar(){document.body.classList.toggle('link-carbon-active',media.matches);(media.matches?document.body:body).append(bar);}
    media.addEventListener('change',moveBar);moveBar();fillOptions();update();
    refresh(catalog).then(checked=>{liveChecked=checked;ready=true;status.textContent=checked?'':'الأسعار المعروضة للقطع؛ نتحقق منها عند الإضافة.';update();});
    function clean(){root.remove();bar.remove();style.remove();nativeBar.removeAttribute('data-link-carbon-native');form.removeAttribute('data-link-carbon-extras');document.body.classList.remove('link-carbon-active');form.removeEventListener('submit',preventNative,true);media.removeEventListener('change',moveBar);}
    const observer=new MutationObserver(()=>{if(!/\/p454677929\/?$/.test(location.pathname)||!root.isConnected){observer.disconnect();clean();}});observer.observe(document.body,{childList:true,subtree:true});
    return true;
  }
  function start(){if(mount())return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();


/* Link carbon protection — iPhone 17 Pro Max, blue and burgundy. */
(function () {
  'use strict';
  if (!/\/p(1651855797|1012035766)\/?$/.test(location.pathname) || window.__linkCarbonProtection) return;
  window.__linkCarbonProtection = true;
  const id = Number(location.pathname.match(/\/p(\d+)\/?$/)[1]);
  const cases = [{"id":1651855797,"name":"كفر كاربون فايبر مغناطيسي – iPhone 17 Pro Max – سماوي","price":149,"image":"https://cdn.files.salla.network/products/1829345766/5b26deee-c36b-4fe5-a314-4139e948e0e3-original.webp","available":true,"max":1,"options":[]},{"id":1012035766,"name":"كفر كاربون فايبر مغناطيسي – iPhone 17 Pro Max – بورغندي","price":149,"image":"https://cdn.files.salla.network/products/1829345766/d28d81b3-75c9-4511-8601-f24733b2eaa2-original.webp","available":true,"max":1,"options":[]}];
  const catalog = [cases.find(p=>p.id===id),...[{"id":34553168,"name":"استيكر حماية لنك لامع – iPhone 17 Pro Max","price":129,"image":"https://cdn.salla.sa/Zpqzp/c40c0b2f-9dcd-43c4-a8de-63a99bf0e3d6-402.77777777778x500-iXymsMt3xo5ZuSpG505etJW2mk482lqiSXL7cCZ9.png","available":true,"max":99,"options":[]},{"id":1045104749,"name":"استيكر حماية لنك لامع خصوصي – iPhone 17 Pro Max","price":129,"image":"https://cdn.salla.sa/Zpqzp/69eebe1f-61ab-4e8c-b633-4b4eefd0323d-402.77777777778x500-rg7XeqrNgnPsbXlLAvCTQ34eRrsMcJap8XdhWIaC.png","available":true,"max":99,"options":[]},{"id":2050176176,"name":"استيكر حماية لنك مطفي خصوصي – iPhone 17 Pro Max","price":129,"image":"https://cdn.salla.sa/Zpqzp/0a7f9b21-608d-413d-82d5-2647fcbb9fec-402.77777777778x500-5gYwT284CMgJ1nfJtCAhgTdbNcJ8mXgdSGpWv6jZ.png","available":true,"max":99,"options":[]},{"id":1731754180,"name":"استيكر حماية لنك مطفي – iPhone 17 Pro Max","price":129,"image":"https://cdn.salla.sa/Zpqzp/2911cd72-5081-4e37-b9e5-76c6a46998bc-402.77777777778x500-dKUlYpRBv4qmuOVAnLsaR7bugetusMvpHrrcTMVT.png","available":false,"max":99,"options":[]},{"id":1298389238,"name":"عدسات Link لحماية الكاميرا – iPhone 17 Pro Max","price":79,"image":"https://cdn.salla.sa/Zpqzp/a6acb90d-173b-4efe-be10-eb034be15a9c-500x500-xWC3RXAhQ5CeBjTWtB0wnsLnQkCulRA7LNt6VC4j.png","available":true,"max":99,"options":[{"id":2053840550,"name":"اختر اللون","values":[{"id":236618954,"name":"اورانج","available":true},{"id":592654295,"name":"كحلى","available":true}]}]},{"id":457870329,"name":"مسطح حماية Link آيفون 17 برو ماكس","price":59,"image":"https://cdn.salla.sa/Zpqzp/ee5662a9-e6c8-4217-b121-414e197cd584-500x500-cbZNCW80FmnYvYBkrlWsCYzZA5yvbeKPTJIBb5CC.png","available":true,"max":99,"options":[]}]];
  const product = catalog[0], screens = catalog.slice(1,5), lens = catalog[5], plate = catalog[6];
  const money = n => new Intl.NumberFormat('ar-SA-u-nu-latn',{maximumFractionDigits:2}).format(n)+' ر.س';
  const make = (tag,text,cls) => {const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const labels = ['لامع شفاف','لامع خصوصي','مطفي خصوصي','مطفي عادي'];
  const css = `
  #link-carbon-protection .lc-price-box{text-align:left;flex:none}
  #link-carbon-protection .lc-old-price{display:block;font-size:12px;color:#8b7d92;white-space:nowrap}
  #link-carbon-protection .lc-saving{display:inline-block;background:#edf8f1;color:#24653b;font-size:12px;font-weight:700;border-radius:6px;padding:3px 8px;margin-top:5px}

  #link-carbon-protection{direction:rtl;color:#281d32;font-family:inherit;border:1px solid #e5dce9;border-radius:18px;background:#fff;margin:20px 0;overflow:hidden;scroll-margin-top:90px}
  #link-carbon-protection *,#link-carbon-cart *{box-sizing:border-box}
  #link-carbon-protection .lc-head{padding:18px 18px 13px;background:linear-gradient(120deg,#faf6fc,#f2fbff)}
  #link-carbon-protection h2{font-size:20px;font-weight:800;margin:0 0 5px;color:#51007a}
  #link-carbon-protection p{font-size:13px;line-height:1.7;margin:4px 0;color:#746780}
  #link-carbon-protection .lc-body{padding:14px 16px}
  #link-carbon-protection button,#link-carbon-protection select,#link-carbon-protection input,#link-carbon-protection summary,#link-carbon-cart button{font:inherit}
  #link-carbon-protection .lc-package{display:flex;gap:11px;align-items:flex-start;border:1px solid #e6dee9;border-radius:12px;padding:13px;margin-bottom:9px;cursor:pointer;background:white}
  #link-carbon-protection .lc-package:has(input:checked){border-color:#6b1f91;box-shadow:inset 0 0 0 1px #6b1f91;background:#fcf8ff}
  #link-carbon-protection .lc-package:has(input:disabled){opacity:.55;cursor:default}
  #link-carbon-protection input[type=radio],#link-carbon-protection input[type=checkbox]{appearance:none;width:21px;height:21px;flex:none;border:1.5px solid #b6a4c0;border-radius:4px;margin:2px 0 0;background:white;display:grid;place-content:center;cursor:pointer}
  #link-carbon-protection input:checked{background:#51007a;border-color:#51007a}
  #link-carbon-protection input:checked::after{content:'✓';color:white;font-size:15px;font-weight:800}
  #link-carbon-protection .lc-copy{flex:1;min-width:0}
  #link-carbon-protection .lc-line{display:flex;justify-content:space-between;gap:9px;align-items:center}
  #link-carbon-protection b{font-size:14px;line-height:1.6;font-weight:750}
  #link-carbon-protection strong{color:#51007a;font-size:14px;white-space:nowrap}
  #link-carbon-protection .lc-pictures{display:flex;align-items:center;gap:5px;margin-top:9px}
  #link-carbon-protection .lc-pictures img{width:38px;height:38px;object-fit:contain;border:1px solid #ede7f0;border-radius:7px;background:white}
  #link-carbon-protection .lc-options{padding:4px 0 10px;display:grid;gap:12px}
  #link-carbon-protection .lc-field label{display:block;font-size:13px;font-weight:700;margin:0 0 6px}
  #link-carbon-protection select{display:block;width:100%;padding:10px 12px;border:1px solid #d7c8df;border-radius:9px;background:white;color:#281d32;font-size:14px;min-height:44px}
  #link-carbon-protection details{border-top:1px solid #ece5ef;padding-top:11px;margin-top:7px}
  #link-carbon-protection summary{color:#51007a;font-size:14px;font-weight:700;cursor:pointer;padding:5px 0;min-height:36px}
  #link-carbon-protection .lc-custom-row{display:flex;align-items:center;gap:9px;padding:12px 0;border-bottom:1px solid #eee8f1;font-size:13px}
  #link-carbon-protection .lc-custom-row label{flex:1;cursor:pointer}
  #link-carbon-protection .lc-custom-row input[type=number]{width:56px;height:38px;border:1px solid #d8c9df;border-radius:7px;text-align:center;color:#51007a;background:white;font-size:14px}
  #link-carbon-protection .lc-status{margin-top:10px;color:#51007a;overflow-wrap:anywhere}
  #link-carbon-protection [hidden]{display:none!important}
  #link-carbon-protection :focus-visible,#link-carbon-cart :focus-visible{outline:3px solid #21b0f1;outline-offset:3px}
  #link-carbon-cart{direction:rtl;font-family:inherit;display:flex;align-items:center;gap:14px;padding:13px 0;background:white;color:#281d32}
  #link-carbon-cart .lc-total{flex:1;min-width:105px}
  #link-carbon-cart small{display:block;font-size:11px;color:#81708d}
  #link-carbon-cart strong{display:block;font-size:20px;color:#51007a;white-space:nowrap;line-height:1.4}
  #link-carbon-cart button{flex:1;min-height:48px;border:0;border-radius:11px;background:#51007a;color:white;font-size:15px;font-weight:750;padding:12px;cursor:pointer}
  #link-carbon-cart button:disabled{opacity:.55;cursor:default}
  [data-link-carbon-native]{display:none!important}
  #product-${id} form[data-link-carbon-extras] salla-installment{display:none!important}
  @media(max-width:767px){
    body.link-carbon-active{padding-bottom:calc(90px + env(safe-area-inset-bottom,0px))!important}
    #link-carbon-cart{position:fixed;inset:auto 0 0;z-index:60;margin:0;padding:11px 16px calc(11px + env(safe-area-inset-bottom,0px));border-top:1px solid #e5dce9;box-shadow:0 -5px 22px #35134312;gap:13px}
    #link-carbon-cart .lc-total{flex:0 0 112px}
    #link-carbon-protection .lc-head{padding:16px}
    #link-carbon-protection .lc-body{padding:12px}
    #link-carbon-protection .lc-package{padding:12px 10px;gap:9px}
    #link-carbon-protection .lc-line{align-items:flex-start}
    #link-carbon-protection .lc-line b{font-size:13px}
  }
  @media(max-width:359px){#link-carbon-cart{padding-inline:11px}#link-carbon-cart .lc-total{flex-basis:95px}#link-carbon-cart strong{font-size:18px}#link-carbon-protection .lc-line{flex-wrap:wrap}}
  `;
  function mount() {
    if(document.getElementById('link-carbon-protection'))return true;
    const form=document.querySelector(`#product-${id} .main-content .product-form`);
    const native=form?.querySelector(`salla-add-product-button[product-id="${id}"]`);
    const cart=window.salla?.cart;
    if(!form||!native||!cart?.addItem)return false;
    const priceContainer=document.querySelector(`#product-${id} .main-content .price`);
    const nativeBar=native.closest('.sticky-product-bar')||native;
    const root=make('section');root.id='link-carbon-protection';root.setAttribute('aria-label','اختَر حماية جوالك');
    const style=make('style');style.id='link-carbon-style';style.textContent=css;
    const head=make('div','','lc-head');head.append(make('h2','اختَر حماية جوالك'),make('p','خيارات مناسبة لآيفون 17 برو ماكس · اختر الكفر وحده أو كمّل حمايته'));
    const body=make('div','','lc-body'), packages=make('div');packages.setAttribute('role','radiogroup');packages.setAttribute('aria-label','خيارات الحماية');
    const state={mode:'case',screen:0,color:592654295,picks:[false,false,false],quantities:[1,1,1],busy:false,complete:false,uncertain:false,remaining:null};
    let ready=false,liveChecked=false;
    const modes=[['case','الكفر فقط',id===1012035766?'الكفر البورغندي':'الكفر السماوي'],['screen','الكفر + حماية الشاشة','الكفر + استيكر الشاشة'],['full','الكفر + حماية الشاشة والكاميرا','الكفر + استيكر + عدسات + مسطح كاميرا عادي']];
    const cards=modes.map(([key,title,description])=>{
      const label=make('label','','lc-package'),radio=make('input');radio.type='radio';radio.name='link-carbon-package';radio.value=key;radio.setAttribute('aria-label',title);
      const copy=make('div','','lc-copy'),line=make('div','','lc-line'),price=make('strong'),oldPrice=make('del','','lc-old-price'),badge=make('span','','lc-saving'),priceBox=make('div','','lc-price-box'),desc=make('p',description),pictures=make('div','','lc-pictures');
      priceBox.append(oldPrice,price);line.append(make('b',title),priceBox);copy.append(line,desc,badge,pictures);label.append(radio,copy);packages.append(label);
      radio.addEventListener('change',()=>{state.mode=key;state.picks=key==='case'?[false,false,false]:key==='screen'?[true,false,false]:[true,true,true];state.quantities=[1,1,1];status.textContent='';update();});
      return {key,radio,price,oldPrice,badge,pictures};
    });
    const options=make('div','','lc-options');
    const screenField=make('div','','lc-field'),screenLabel=make('label','نوع حماية الشاشة'),screenSelect=make('select');screenSelect.id='lc-screen';screenLabel.htmlFor=screenSelect.id;screenField.append(screenLabel,screenSelect);
    const colorField=make('div','','lc-field'),colorLabel=make('label','لون عدسات الكاميرا'),colorSelect=make('select');colorSelect.id='lc-color';colorLabel.htmlFor=colorSelect.id;colorField.append(colorLabel,colorSelect);
    options.append(screenField,colorField);
    const details=make('details'),summary=make('summary','خصّص الحماية — اختَر قطعًا محددة');details.append(summary,make('p','يمكنك اختيار أي قطعة أو إلغاء اختيارها وتعديل كميتها.'));
    const custom=['حماية الشاشة','عدسات الكاميرا','مسطح كاميرا عادي'].map((name,i)=>{
      const row=make('div','','lc-custom-row'),check=make('input'),label=make('label',name),price=make('strong'),qty=make('input');
      check.type='checkbox';check.id='lc-custom-'+i;label.htmlFor=check.id;qty.type='number';qty.min='1';qty.step='1';qty.value='1';qty.setAttribute('aria-label','كمية '+name);
      row.append(check,label,price,qty);details.append(row);
      check.addEventListener('change',()=>{state.picks[i]=check.checked;state.mode='custom';status.textContent='';update();});
      qty.addEventListener('change',()=>{const max=selectedProducts()[i].max;state.quantities[i]=Math.min(max,Math.max(1,Math.floor(Number(qty.value)||1)));state.mode='custom';update();});
      return {check,price,qty};
    });
    const note=make('p','وفّر 20 ر.س مع حماية الشاشة، أو 47 ر.س مع الحماية الكاملة. السعر قبل الشحن.'),status=make('p','','lc-status');status.id='lc-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const bar=make('div');bar.id='link-carbon-cart';const total=make('div','','lc-total'),totalPrice=make('strong'),count=make('small'),add=make('button','أضف للسلة');add.type='button';add.setAttribute('aria-describedby','lc-status');total.append(make('small','الإجمالي'),totalPrice,count);bar.append(total,add);
    const cartLink=make('a','عرض السلة');cartLink.href='/cart';cartLink.style.cssText='display:inline-block;margin-top:8px;color:#51007a;text-decoration:underline;font-size:13px';cartLink.hidden=true;
    body.append(packages,options,details,note,status,cartLink);root.append(head,body);
    function selectedProducts(){return [screens[state.screen],lens,plate];}
    // Verified live Salla buy-one-case/get-one-screen offer: 15.504%, rounded to 20 SAR.
    // Verified full-package offer: one screen, one lens and one normal plate = 47 SAR saving.
    const offerScreens=[34553168,1045104749,2050176176];
    function saving(picks=state.picks,quantities=state.quantities){
      if(product.price!==149||screens[state.screen].price!==129||!offerScreens.includes(screens[state.screen].id))return 0;
      if(picks.every(Boolean)&&quantities.every(q=>q===1)&&lens.price===79&&plate.price===59)return 47;
      const pieces=picks.reduce((sum,p,i)=>sum+(p?quantities[i]:0),0);
      return picks[0]&&pieces<3?20:0;
    }
    function subtotal(){return product.price+selectedProducts().reduce((sum,p,i)=>sum+(state.picks[i]?p.price*state.quantities[i]:0),0);}
    function amount(){return subtotal()-saving();}
    function image(p){const img=make('img');img.src=p.image;img.alt=p.name;img.loading='lazy';return img;}
    function update(){
      const locked=state.busy||state.complete||state.uncertain||!!state.remaining;
      const ps=selectedProducts();
      cards.forEach(c=>{
        c.radio.checked=state.mode===c.key;c.radio.disabled=locked||!product.available||(c.key!=='case'&&!ps[0].available)||(c.key==='full'&&(!lens.available||!plate.available));
        const items=c.key==='case'?[product]:c.key==='screen'?[product,ps[0]]:[product,...ps];
        const original=items.reduce((sum,p)=>sum+p.price,0),discount=saving(c.key==='case'?[false,false,false]:c.key==='screen'?[true,false,false]:[true,true,true],[1,1,1]);
        c.price.textContent=money(original-discount);c.oldPrice.textContent=discount?money(original):'';c.oldPrice.hidden=!discount;
        c.badge.textContent=discount?(c.key==='full'?'أفضل قيمة · ':'')+'وفّر '+money(discount):'';c.badge.hidden=!discount;c.pictures.replaceChildren(...items.map(image));
      });
      custom.forEach((c,i)=>{c.check.checked=state.picks[i];c.check.disabled=locked||!ps[i].available;c.qty.disabled=locked||!state.picks[i]||!ps[i].available;c.qty.max=String(ps[i].max);c.qty.value=String(state.quantities[i]);c.price.textContent=ps[i].available?'+ '+money(ps[i].price):'نفد حاليًا';});
      screenField.hidden=!state.picks[0];colorField.hidden=!state.picks[1];
      screenSelect.disabled=colorSelect.disabled=locked;
      note.textContent=state.mode==='custom'&&state.quantities.some((q,i)=>state.picks[i]&&q>1)?'الخصم النهائي للكميات المخصصة يُحتسب في السلة. السعر قبل الشحن.':'وفّر 20 ر.س مع حماية الشاشة، أو 47 ر.س مع الحماية الكاملة. السعر قبل الشحن.';
      totalPrice.textContent=money(amount());const pieceCount=1+state.picks.reduce((sum,p,i)=>sum+(p?state.quantities[i]:0),0);count.textContent=saving()?'وفّرت '+money(saving()):pieceCount===1?'قطعة واحدة':pieceCount+' قطع مختارة';
      const invalid=!product.available||ps.some((p,i)=>state.picks[i]&&!p.available);
      add.disabled=state.busy||(!state.complete&&!state.uncertain&&(!ready||invalid));
      add.textContent=state.busy?'تتم الإضافة...':state.complete||state.uncertain?'عرض السلة':state.remaining?'أكمل إضافة القطع المتبقية':!product.available?'نفد الكفر حاليًا':'أضف للسلة';
      form.toggleAttribute('data-link-carbon-extras',state.picks.some(Boolean));
      root.dataset.price=String(amount());root.dataset.saving=String(saving());root.dataset.mode=state.mode;
      cartLink.hidden=!state.complete&&!state.uncertain&&!state.remaining;
    }
    function fillOptions(){
      screenSelect.replaceChildren(...screens.map((p,i)=>{const o=make('option',labels[i]+' — '+money(p.price)+(p.available?'':' · نفد حاليًا'));o.value=String(i);o.disabled=!p.available;return o;}));screenSelect.value=String(state.screen);
      colorSelect.replaceChildren(...(lens.options[0]?.values||[]).map(v=>{const o=make('option',(v.name==='كحلى'?'كحلي':v.name==='اورانج'?'برتقالي':v.name)+(v.available?'':' · نفد حاليًا'));o.value=String(v.id);o.disabled=!v.available;return o;}));colorSelect.value=String(state.color);
    }
    screenSelect.addEventListener('change',()=>{state.screen=Number(screenSelect.value);status.textContent='';update();});
    colorSelect.addEventListener('change',()=>{state.color=Number(colorSelect.value);status.textContent='';update();});
    function validOptions(){return !state.picks[1]||lens.options[0]?.values.some(v=>v.id===state.color&&v.available);}
    async function refresh(products){
      if(!window.salla.product?.getDetails)return false;
      const results=await Promise.allSettled(products.map(async p=>{let timer;try{return await Promise.race([window.salla.product.getDetails(p.id,['options']),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),8000);})]);}finally{clearTimeout(timer);}}));
      let checked=true;
      results.forEach((r,i)=>{
        if(r.status!=='fulfilled'){checked=false;return;}
        const response=r.value,d=response?.data?.product||response?.data||response?.product||response;
        if(String(d?.id)!==String(products[i].id)){checked=false;return;}
        const p=products[i],raw=d.price?.amount??d.price?.price??d.price,price=Number(raw);
        if(Number.isFinite(price)&&price>0)p.price=price;else checked=false;
        p.available=d.is_available!==false&&!['out','hidden','out_of_stock','unavailable'].includes(d.status);
        // Match known color IDs only; extra required options cannot be silently omitted.
        if(p===lens&&Array.isArray(d.options)&&d.options.length){
          const option=d.options.find(o=>Number(o.id)===lens.options[0].id);
          if(!option||d.options.some(o=>o.required&&Number(o.id)!==lens.options[0].id)){p.available=false;return;}
          if(Array.isArray(option.values))lens.options[0].values.forEach(v=>{const live=option.values.find(o=>Number(o.id)===v.id);v.available=!!live&&live.is_out_of_stock!==true&&live.is_available!==false;});
        }
      });
      if(!screens[state.screen].available&&!state.picks[0]){const first=screens.findIndex(p=>p.available);if(first>=0)state.screen=first;}
      root.dataset.catalogStatus=checked?'verified':'unverified';fillOptions();update();return checked;
    }
    function payloads(){
      return [{id,name:product.name,quantity:1,options:{}},...selectedProducts().flatMap((p,i)=>state.picks[i]?[{id:p.id,name:p.name,quantity:state.quantities[i],options:p===lens?{[lens.options[0].id]:state.color}:{}}]:[])];
    }
    add.addEventListener('click',async()=>{
      if(state.busy)return;
      if(state.complete||state.uncertain){location.assign('/cart');return;}
      if(!validOptions()){status.textContent='اختر لونًا متوفرًا للعدسات.';colorSelect.focus();return;}
      state.busy=true;update();status.textContent='نتحقق من السعر والتوفر...';
      const before=amount();
      liveChecked=await refresh([product,...selectedProducts().filter((p,i)=>state.picks[i])]);
      if(!liveChecked){state.busy=false;status.textContent='تعذر التحقق من السعر والتوفر؛ حاول بعد قليل.';update();return;}
      if(before!==amount()||!product.available||selectedProducts().some((p,i)=>state.picks[i]&&!p.available)||!validOptions()){
        state.busy=false;status.textContent='تغير السعر أو التوفر. راجع اختياراتك ثم اضغط الإضافة مجددًا.';update();return;
      }
      const queue=state.remaining||payloads();state.remaining=null;let added=0;
      for(let i=0;i<queue.length;i++){
        status.textContent='تتم إضافة '+(i+1)+' من '+queue.length+'...';
        try{
          const result=await cart.addItem({id:queue[i].id,quantity:queue[i].quantity,options:queue[i].options});
          if(result?.success===false||Number(result?.status)>=400)throw Object.assign(Error('rejected'),{status:result.status||422});
          added++;
        }catch(error){
          const code=Number(error?.response?.status||error?.status||error?.data?.status);
          if(code>=400&&code<500){state.remaining=queue.slice(i);status.textContent=(added?'أضيفت '+added+' قطعة. ':'')+'لم تكتمل إضافة «'+queue[i].name+'». يمكنك إكمال القطع المتبقية دون تكرار ما أُضيف.';}
          else{state.uncertain=true;status.textContent='لم نتأكد من اكتمال الإضافة. افتح السلة للتحقق قبل إعادة الطلب.';}
          state.busy=false;update();return;
        }
      }
      state.complete=true;state.busy=false;status.textContent='تمت إضافة اختياراتك للسلة ✓';update();
    });
    const preventNative=event=>{event.preventDefault();event.stopImmediatePropagation();if(!state.busy)add.click();};
    form.addEventListener('submit',preventNative,true);
    document.head.append(style);(priceContainer||form).after(root);root.append(bar);nativeBar.setAttribute('data-link-carbon-native','');
    const media=matchMedia('(max-width:767px)');
    function moveBar(){document.body.classList.toggle('link-carbon-active',media.matches);(media.matches?document.body:body).append(bar);}
    media.addEventListener('change',moveBar);moveBar();fillOptions();update();
    refresh(catalog).then(checked=>{liveChecked=checked;ready=true;status.textContent=checked?'':'الأسعار المعروضة للقطع؛ نتحقق منها عند الإضافة.';update();});
    function clean(){root.remove();bar.remove();style.remove();nativeBar.removeAttribute('data-link-carbon-native');form.removeAttribute('data-link-carbon-extras');document.body.classList.remove('link-carbon-active');form.removeEventListener('submit',preventNative,true);media.removeEventListener('change',moveBar);}
    const observer=new MutationObserver(()=>{if(!/\/p(1651855797|1012035766)\/?$/.test(location.pathname)||!root.isConnected){observer.disconnect();clean();}});observer.observe(document.body,{childList:true,subtree:true});
    return true;
  }
  function start(){if(mount())return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
