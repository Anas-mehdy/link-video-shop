const { sb, json, cors, MERCHANT_ID } = require('../lib/supabase');

const VALID = new Set(['impression','open','next','prev','product_click']);

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, {ok:false,error:'Method not allowed'});
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    if (!VALID.has(b.event_type)) return json(res,400,{ok:false,error:'Invalid event type'});

    await sb('video_shop_events', {
      method:'POST',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify([{
        merchant_id:MERCHANT_ID,
        video_id:b.video_id || null,
        external_product_id:b.external_product_id ? Number(b.external_product_id) : null,
        event_type:b.event_type,
        session_id:b.session_id ? String(b.session_id).slice(0,120) : null,
        page_url:b.page_url ? String(b.page_url).slice(0,500) : null,
        user_agent:String(req.headers['user-agent'] || '').slice(0,500)
      }])
    });
    return json(res,202,{ok:true});
  } catch(e) {
    console.error(e);
    return json(res,e.statusCode || 500,{ok:false});
  }
};
