const { sb, json, requireWorker, MERCHANT_ID, noCache, errorResponse } = require('../lib/crm');
const { timingSafeEqual } = require('node:crypto');
const { bodyObject } = require('../lib/crm');

async function redboxMonitor(req, res) {
  const secret = process.env.REDBOX_MONITOR_WEBHOOK_SECRET;
  const header = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
  const pathKey = typeof req.query?.key === 'string' ? req.query.key : '';
  const provided = header ? header.replace(/^Bearer /i, '') : pathKey;
  if (!secret || !/^[a-f0-9]{64}$/.test(provided) || Buffer.byteLength(secret) !== 64 ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(provided))) return json(res, 404, { ok: false });
  if (req.method === 'GET') return json(res, 200, { ok: true, mode: 'monitor_only' });
  if (req.method !== 'POST') return json(res, 405, { ok: false }, { Allow: 'GET, POST' });
  try {
    const body = bodyObject(req);
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : body;
    const type = body.event ?? body.event_type ?? body.type;
    if (typeof type === 'string' && type !== 'shipment.status.update' && data !== body) {
      return json(res, 200, { ok: true, ignored: true });
    }
    const valueId = x => typeof x === 'string' || Number.isSafeInteger(x) ? String(x).trim() : '';
    const tracking = valueId(data.tracking_number);
    const shipment = valueId(data.shipment_id);
    const status = typeof data.status_name === 'string' ? data.status_name.trim() : '';
    const code = /^[0-9]{3,5}$/.test(valueId(data.status_code)) ? Number(data.status_code) : -1;
    const time = typeof data.date === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(data.date) ? new Date(data.date) : null;
    if (!/^[A-Za-z0-9_-]{3,100}$/.test(shipment) || !/^[A-Za-z0-9-]{5,60}$/.test(tracking) ||
        !/^[A-Za-z][A-Za-z -]{0,49}$/.test(status) || code < 0 || !Number.isFinite(time?.getTime())) {
      return json(res, 400, { ok: false, error: 'invalid shipment event' });
    }
    await sb('rpc/crm_record_redbox_monitor_event', {method:'POST', body:JSON.stringify({
      p_merchant_id: MERCHANT_ID, p_shipment_id: shipment, p_tracking_number: tracking,
      p_status_code: code, p_status_name: status, p_occurred_at: time.toISOString(),
    })});
    return json(res, 200, { ok: true, mode: 'monitor_only' });
  } catch (error) { return errorResponse(res, error); }
}

module.exports = async function handler(req, res) {
  noCache(res);
  if (req.query?.action === 'redbox-events') return redboxMonitor(req, res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  if (req.query?.action === 'whatsapp-events') return require('../lib/etisalna-webhook').handle(req, res);
  try {
    requireWorker(req);
    if(req.query?.action==='preorders')return json(res,200,{ok:true,...await require('../lib/preorders').tick()});
    if(req.query?.action==='whatsapp-delivery'){
      // Keep odd-minute cart priority. Cashback uses the same authenticated worker.
      if(new Date().getUTCMinutes()%2===0){
        try{const cashback=await require('../lib/cashback-delivery').tick();if(cashback.worked)return json(res,200,{ok:true,...cashback});}
        catch(e){console.error('cashback_worker_failed',/^[A-Za-z0-9_]{1,32}$/.test(String(e.code||''))?String(e.code):'unclassified');}
      }
      if(!require('../lib/whatsapp-delivery').readiness().ready)return json(res,200,{ok:true,...await require('../lib/whatsapp-delivery').tick()});
      // Repair at most one local batch first; this path never fetches Salla.
      await require('../lib/salla-sync').processEvents(undefined,{localOnly:true});
      // Share even-minute ticks in configured batch hours; cart sends retain odd minutes.
      let postpurchase={worked:false,reason:'cart_priority_minute'};
      if(new Date().getUTCMinutes()%2===0){
        try{const aftersale=await require('../lib/postpurchase-delivery').tick();postpurchase=aftersale;if(aftersale.worked)return json(res,200,{ok:true,...aftersale});}
        catch(e){postpurchase={worked:false,reason:'worker_error',code:/^[A-Za-z0-9_]{1,32}$/.test(String(e.code||''))?String(e.code):'unclassified'};console.error('postpurchase_worker_failed',postpurchase.code);}
      }
      // One bounded label job takes this tick; never delay a send beyond its claim lease.
      let recovery;
      try { recovery=await require('../lib/etisalna-labels').recoverOne(); }
      catch { recovery={worked:false,error:'recovery_label_unavailable'}; }
      if(recovery.worked)return json(res,200,{ok:true,mode:'automatic',sent:false,reason:'recovery_label_processed',...recovery,postpurchase});
      return json(res,200,{ok:true,...await require('../lib/whatsapp-delivery').tick(),postpurchase});
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

