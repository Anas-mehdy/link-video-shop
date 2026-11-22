const media = require('../lib/video-media');
const { sb, json, cors, requireAdmin, extractTikTokId, MERCHANT_ID } = require('../lib/supabase');

async function hydrate(videos) {
  if (!videos.length) return [];
  const ids = videos.map(v=>v.id);
  const links = await sb(`video_shop_video_products?video_id=in.(${ids.join(',')})&order=sort_order.asc&select=video_id,external_product_id,sort_order`);
  const grouped = {};
  for (const l of links || []) (grouped[l.video_id] ||= []).push(l.external_product_id);
  const productIds = [...new Set((links || []).map(l=>String(l.external_product_id)))].filter(id=>/^\\d+$/.test(id));
  const products = productIds.length ? await sb(`products?merchant_id=eq.${MERCHANT_ID}&external_product_id=in.(${productIds.join(',')})&select=external_product_id,name`) : [];
  const names = Object.fromEntries((products || []).map(p=>[String(p.external_product_id),p.name]));
  return videos.map(v=>({...v, product_ids:grouped[v.id] || [], product_names:Object.fromEntries((grouped[v.id] || []).map(id=>[String(id),names[String(id)]||('منتج #'+id)]))}));
}

function storeLink(value){
  let u;try{u=new URL(value)}catch{throw Object.assign(Error('رابط العرض غير صالح'),{statusCode:400})}
  if(u.protocol!=='https:'||u.hostname!=='linkstore-sa.com'||u.username||u.password)throw Object.assign(Error('استخدم رابط صفحة من متجر لنك'),{statusCode:400});
  return u.href;
}
module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, {});

  try {
    await requireAdmin(req);

    if (req.method === 'POST' && req.body?.action === 'upload') {
      return json(res,200,{ok:true,...await media.signUpload(req.body,MERCHANT_ID)},{'Cache-Control':'no-store'});
    }
    if (req.method === 'GET') {
      const videos = await sb(`video_shop_videos?merchant_id=eq.${MERCHANT_ID}&order=is_active.desc,sort_order.asc,id.asc&select=*`);
      return json(res, 200, {ok:true, videos:await hydrate(videos || [])});
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (['POST','PATCH'].includes(req.method) && Object.hasOwn(body,'sort_order') &&
        (!Number.isInteger(body.sort_order) || body.sort_order<1 || body.sort_order>2147483647)) {
      return json(res,400,{ok:false,error:'الترتيب لازم يكون رقمًا صحيحًا يبدأ من 1'});
    }
    if (req.method === 'POST') {
      const tiktokId = extractTikTokId(body.tiktok_url);
      if ((!tiktokId && !body.media_path) || !String(body.title||'').trim()) return json(res, 400, {ok:false,error:'أدخل العنوان وارفع الفيديو أو أضف رابط TikTok'});

      const payload = [{
        merchant_id: MERCHANT_ID,
        title: String(body.title).trim(),
        badge: body.badge ? String(body.badge).trim() : null,
        tiktok_url: tiktokId ? String(body.tiktok_url).trim() : null,
        tiktok_video_id: tiktokId,
        thumbnail_url: body.thumbnail_url || null,
        description: body.description || null,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active !== false
      }];

      if(body.media_path) {
        payload[0].media_url=await media.verifiedMedia(body.media_path,MERCHANT_ID);
        payload[0].media_path=body.media_path;
      }
      if(body.poster_path){
        payload[0].thumbnail_url=await media.verifiedMedia(body.poster_path,MERCHANT_ID,true);
        payload[0].poster_path=body.poster_path;
      }
      if(body.cta_url)payload[0].cta_url=storeLink(body.cta_url);
      const created = await sb('video_shop_videos', {
        method:'POST',
        headers:{Prefer:'return=representation'},
        body:JSON.stringify(payload)
      });
      const video = created[0];

      const ids = Array.isArray(body.product_ids) ? body.product_ids.map(Number).filter(Boolean) : [];
      if (ids.length) {
        await sb('video_shop_video_products', {
          method:'POST',
          headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},
          body:JSON.stringify(ids.map((id,i)=>({video_id:video.id,external_product_id:id,sort_order:i+1})))
        });
      }
      return json(res, 201, {ok:true, video:{...video,product_ids:ids}});
    }

    if (req.method === 'PATCH') {
      const id = String(body.id || '');
      if (!id) return json(res, 400, {ok:false,error:'id is required'});

      if(!/^[0-9a-f-]{36}$/i.test(id))return json(res,400,{ok:false,error:'Invalid id'});
      const owned=await sb('video_shop_videos?id=eq.'+id+'&merchant_id=eq.'+MERCHANT_ID+'&select=id');
      if(!owned?.length)return json(res,404,{ok:false,error:'Video not found'});
      const update = {};
      if(body.media_path){
        update.media_url=await media.verifiedMedia(body.media_path,MERCHANT_ID);
        update.media_path=body.media_path;
      }
      if(body.poster_path){
        update.thumbnail_url=await media.verifiedMedia(body.poster_path,MERCHANT_ID,true);
        update.poster_path=body.poster_path;
      }
      if(Object.hasOwn(body,'cta_url'))update.cta_url=body.cta_url?storeLink(body.cta_url):null;
      for (const key of ['title','badge','description','sort_order','is_active']) {
        if (Object.prototype.hasOwnProperty.call(body,key)) update[key] = body[key];
      }
      if (body.tiktok_url) {
        const tiktokId = extractTikTokId(body.tiktok_url);
        if (!tiktokId) return json(res,400,{ok:false,error:'Invalid TikTok URL'});
        update.tiktok_url = body.tiktok_url;
        update.tiktok_video_id = tiktokId;
      }

      if (Object.keys(update).length) {
        await sb(`video_shop_videos?id=eq.${encodeURIComponent(id)}&merchant_id=eq.${MERCHANT_ID}`, {
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify(update)
        });
      }

      if (Array.isArray(body.product_ids)) {
        await sb(`video_shop_video_products?video_id=eq.${encodeURIComponent(id)}`, {method:'DELETE'});
        const ids = body.product_ids.map(Number).filter(Boolean);
        if (ids.length) {
          await sb('video_shop_video_products', {
            method:'POST',
            headers:{Prefer:'return=minimal'},
            body:JSON.stringify(ids.map((pid,i)=>({video_id:id,external_product_id:pid,sort_order:i+1})))
          });
        }
      }

      return json(res, 200, {ok:true});
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.id || '');
      if (!id) return json(res, 400, {ok:false,error:'id is required'});
      await sb(`video_shop_videos?id=eq.${encodeURIComponent(id)}&merchant_id=eq.${MERCHANT_ID}`, {method:'DELETE'});
      return json(res, 200, {ok:true});
    }

    return json(res, 405, {ok:false,error:'Method not allowed'});
  } catch (e) {
    console.error(e);
    return json(res, e.statusCode || 500, {ok:false,error:e.message});
  }
};
