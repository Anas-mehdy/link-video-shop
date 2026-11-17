/* Add-on for the existing Salla Video Shop. No Salla API requests or polling. */
(function(){
 'use strict';if(window.__linkVideoMedia)return;window.__linkVideoMedia=true;
 const BASE='https://link-video-shop.vercel.app';
 let feed=null,request=null,active=null,generation=0;
 function getFeed(){
   if(feed)return Promise.resolve(feed);
   if(!request)request=fetch(BASE+'/api/video-shop-feed',{credentials:'omit',signal:AbortSignal.timeout(15000)})
     .then(r=>{if(!r.ok)throw Error('feed');return r.json()}).then(j=>{if(!j.ok)throw Error('feed');return feed=j.videos})
     .catch(e=>{request=null;throw e});
   return request;
 }
 function stop(){generation++;if(active){active.pause();active.removeAttribute('src');active.load();active.remove();active=null;}}
 function bind(){
   const host=document.getElementById('link-video-shop');
   if(!host||host.dataset.mediaBound)return;
   host.dataset.mediaBound='1';
   host.addEventListener('click',async e=>{
     const card=e.target.closest('.lvs-card');if(!card||!host.contains(card))return;
     stop();const legacy=document.getElementById('lvs-player');if(legacy)legacy.style.display='';document.getElementById('lvs-media-cta')?.remove();
     const token=generation;
     const videos=await getFeed().catch(()=>null),v=videos?.find(x=>x.id===card.dataset.id);
     if(token!==generation||!v?.media_url)return;
     // The existing synchronous open handler has filled the product panel.
     const frame=document.getElementById('lvs-player');if(!frame)return;
     stop();frame.src='about:blank';frame.style.display='none';
     const native=document.createElement('video');native.id='lvs-direct-player';native.controls=true;native.playsInline=true;native.preload='none';
     native.style.cssText='display:block;width:100%;height:100%;object-fit:contain;background:#000';
     native.poster=v.thumbnail_url||'';native.src=v.media_url;frame.after(native);active=native;
     const prior=document.getElementById('lvs-media-cta');if(prior)prior.remove();
     if(v.cta_url){const a=document.createElement('a');a.id='lvs-media-cta';a.textContent='شوف العرض';a.href=v.cta_url;a.style.cssText='display:block;margin:12px 0;padding:12px;text-align:center;background:#51007a;color:white;border-radius:10px';document.getElementById('lvs-products')?.after(a);}
     native.play().catch(()=>{});
   });
   getFeed().catch(()=>{});
 }
 document.addEventListener('click',e=>{if(e.target.closest('.lvs-close'))stop();},true);
 window.addEventListener('hashchange',()=>{if(location.hash!=='#lvs-viewer')stop();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
 new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();
