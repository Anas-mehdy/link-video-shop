const { sb, json, cors, requireAdmin, MERCHANT_ID } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  cors(req, res);
  res.setHeader('Cache-Control','no-store');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  try {
    await requireAdmin(req);
    if (req.method === 'POST') {
      const {bodyObject}=require('../lib/crm');
      const result=await require('../lib/video-product-sync').page(bodyObject(req));
      return json(res,200,{ok:true,...result});
    }
    if (req.method !== 'GET') return json(res, 405, {ok:false,error:'Method not allowed'});

    const q = String(req.query?.q || '').trim().slice(0,80);
    let filter = `merchant_id=eq.${MERCHANT_ID}&select=external_product_id,name,url,thumbnail_url,main_image_url,price,sale_price,currency,status,is_available&limit=20`;
    if (q) filter += `&name=ilike.*${encodeURIComponent(q)}*`;

    const products = await sb(`products?${filter}`);
    return json(res, 200, {ok:true, products});
  } catch (e) {
    return json(res, e.statusCode || 500, {ok:false,error:e.sallaSafe||[400,401,403].includes(e.statusCode)?e.message:'تعذرت مزامنة المنتجات أو قراءتها؛ حاول مجددًا يدويًا'});
  }
};
