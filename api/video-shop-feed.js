const { sb, json, cors, MERCHANT_ID } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'GET') return json(res, 405, { ok:false, error:'Method not allowed' });

  try {
    const videos = await sb(
      `video_shop_videos?merchant_id=eq.${MERCHANT_ID}&is_active=eq.true&order=sort_order.asc&select=id,title,badge,tiktok_url,tiktok_video_id,thumbnail_url,description,sort_order`
    );

    if (!Array.isArray(videos) || !videos.length) {
      return json(res, 200, { ok:true, videos:[] }, {
        'Cache-Control':'public, s-maxage=60, stale-while-revalidate=600'
      });
    }

    const ids = videos.map(v => v.id);
    const links = await sb(
      `video_shop_video_products?video_id=in.(${ids.join(',')})&order=sort_order.asc&select=video_id,external_product_id,sort_order`
    );

    const productIds = [...new Set((links || []).map(x => x.external_product_id))];
    let products = [];

    if (productIds.length) {
      products = await sb(
        `products?merchant_id=eq.${MERCHANT_ID}&external_product_id=in.(${productIds.join(',')})&select=external_product_id,name,url,thumbnail_url,main_image_url,price,sale_price,currency,status,is_available`
      );
    }

    const productMap = new Map(products.map(p => [String(p.external_product_id), p]));
    const linksByVideo = new Map();
    for (const link of links || []) {
      const k = String(link.video_id);
      if (!linksByVideo.has(k)) linksByVideo.set(k, []);
      linksByVideo.get(k).push(link);
    }

    const out = videos.map(v => {
      const vlinks = linksByVideo.get(String(v.id)) || [];
      const vProducts = vlinks
        .map(l => productMap.get(String(l.external_product_id)))
        .filter(Boolean)
        .map(p => ({
          id: p.external_product_id,
          name: p.name,
          url: p.url,
          image: p.thumbnail_url || p.main_image_url || null,
          price: p.sale_price ?? p.price ?? null,
          currency: p.currency || 'SAR',
          available: p.is_available !== false && p.status !== 'hidden',
        }));

      return {
        id: v.id,
        title: v.title,
        badge: v.badge,
        description: v.description,
        tiktok_url: v.tiktok_url,
        tiktok_video_id: v.tiktok_video_id,
        thumbnail_url: v.thumbnail_url || vProducts[0]?.image || null,
        sort_order: v.sort_order,
        products: vProducts,
      };
    });

    return json(res, 200, { ok:true, merchant_id:MERCHANT_ID, videos:out }, {
      'Cache-Control':'public, s-maxage=300, stale-while-revalidate=3600'
    });
  } catch (e) {
    console.error(e);
    return json(res, e.statusCode || 500, { ok:false, error:'Feed unavailable' });
  }
};
