const { sb, json, requireWorker, MERCHANT_ID, noCache, errorResponse } = require('../lib/crm');
module.exports = async function handler(req, res) {
  noCache(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  try {
    requireWorker(req);
    const processed = await sb('rpc/crm_process_events', { method: 'POST', body: JSON.stringify({ p_merchant_id: MERCHANT_ID, p_limit: 20 }) });
    return json(res, 200, { ok: true, mode: 'dry_run', processed });
  } catch (e) { return errorResponse(res, e); }
};
