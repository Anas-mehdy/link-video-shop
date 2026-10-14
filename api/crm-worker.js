const { sb, json, requireWorker, MERCHANT_ID, noCache, errorResponse } = require('../lib/crm');
module.exports = async function handler(req, res) {
  noCache(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  if (req.query?.action === 'whatsapp-events') return require('../lib/etisalna-webhook').handle(req, res);
  try {
    requireWorker(req);
    if(req.query?.action==='preorders')return json(res,200,{ok:true,...await require('../lib/preorders').tick()});
    if(req.query?.action==='whatsapp-delivery'){
      if(!require('../lib/whatsapp-delivery').readiness().ready)return json(res,200,{ok:true,...await require('../lib/whatsapp-delivery').tick()});
      // Repair at most one local batch first; this path never fetches Salla.
      await require('../lib/salla-sync').processEvents(undefined,{localOnly:true});
      // Share even-minute ticks in configured batch hours; cart sends retain odd minutes.
      if(new Date().getUTCMinutes()%2===0){
        try{const aftersale=await require('../lib/postpurchase-delivery').tick();if(aftersale.worked)return json(res,200,{ok:true,...aftersale});}
        catch{/* A postpurchase failure must not interrupt cart reminders. */}
      }
      // One bounded label job takes this tick; never delay a send beyond its claim lease.
      let recovery;
      try { recovery=await require('../lib/etisalna-labels').recoverOne(); }
      catch { recovery={worked:false,error:'recovery_label_unavailable'}; }
      if(recovery.worked)return json(res,200,{ok:true,mode:'automatic',sent:false,reason:'recovery_label_processed',...recovery});
      return json(res,200,{ok:true,...await require('../lib/whatsapp-delivery').tick()});
    }
    if(req.query?.action==='whatsapp-test')return json(res,200,{ok:true,...await require('../lib/whatsapp-test-send').send(require('../lib/crm').bodyObject(req))});
    if(req.query?.action==='cart-followup')return json(res,200,{ok:true,mode:'dry_run',records:await require('../lib/cart-followup').refresh()});
    if(req.query?.action==='salla'){
      const data=await require('../lib/salla-sync').processEvents();
      try{data.preorders=await require('../lib/preorders').tick();}catch{data.preorders_pending=true;}
      return json(res,200,{ok:true,...data});
    }
    const processed = await sb('rpc/crm_process_events', { method: 'POST', body: JSON.stringify({ p_merchant_id: MERCHANT_ID, p_limit: 20 }) });
    return json(res, 200, { ok: true, mode: 'dry_run', processed });
  } catch (e) { return errorResponse(res, e); }
};

