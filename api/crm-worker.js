const { sb, json, requireWorker, MERCHANT_ID, noCache, errorResponse } = require('../lib/crm');
module.exports = async function handler(req, res) {
  noCache(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  if (req.query?.action === 'whatsapp-events') return require('../lib/etisalna-webhook').handle(req, res);
  try {
    requireWorker(req);
    if(req.query?.action==='whatsapp-delivery'){
      // Repair at most one local batch first; this path never fetches Salla.
      await require('../lib/salla-sync').processEvents(undefined,{localOnly:true});
      return json(res,200,{ok:true,...await require('../lib/whatsapp-delivery').tick()});
    }
    if(req.query?.action==='whatsapp-test')return json(res,200,{ok:true,...await require('../lib/whatsapp-test-send').send(require('../lib/crm').bodyObject(req))});
    if(req.query?.action==='cart-followup')return json(res,200,{ok:true,mode:'dry_run',records:await require('../lib/cart-followup').refresh()});
    if(req.query?.action==='salla')return json(res,200,{ok:true,...await require('../lib/salla-sync').processEvents()});
    const processed = await sb('rpc/crm_process_events', { method: 'POST', body: JSON.stringify({ p_merchant_id: MERCHANT_ID, p_limit: 20 }) });
    return json(res, 200, { ok: true, mode: 'dry_run', processed });
  } catch (e) { return errorResponse(res, e); }
};
