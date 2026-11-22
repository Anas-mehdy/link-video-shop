(async function () {
  const player=document.getElementById('lux-player'), status=document.getElementById('status');
  function unavailable(){
    player.hidden=true;
    status.hidden=false;
    status.textContent='الفيديو غير متاح الآن. تقدر تشوف تفاصيل الحامل من زر التسوّق.';
  }
  try{
    const response=await fetch('/api/video-shop-feed',{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Video feed unavailable');
    const feed=await response.json();
    const lux=feed.videos?.find(v=>v.id==='68e42ef7-821e-4275-8c08-5ddde6ea2e94');
    function publicURL(value){
      if(!value)return null;
      try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}
      catch{return null;}
    }
    const url=publicURL(lux?.media_url);
    if(!url)throw Error('Video unavailable');
    player.addEventListener('error',unavailable,{once:true});
    const cover=publicURL(lux.thumbnail_url);
    if(cover)player.poster=cover;
    player.src=url;
    player.hidden=false;
    status.hidden=true;
  }catch{unavailable();}
})();
