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
    if (!/\/p(101121129|1335345819|1622979904|284157041)\/?$/.test(location.pathname)) return;
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
