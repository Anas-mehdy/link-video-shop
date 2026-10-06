const { sb, json, verifyWebhook, bodyObject, normalizeEvent, noCache, errorResponse } = require('../lib/crm');
module.exports = async function handler(req, res) {
  noCache(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  try {
    verifyWebhook(req);
    const event = normalizeEvent(bodyObject(req));
    // Acknowledge only after inbox + connection state commit atomically.
    const result = await sb('rpc/crm_ingest_event', { method: 'POST', body: JSON.stringify(event) });
    return json(res, 200, { ok: true, duplicate: result.duplicate, event_id: result.event_id });
  } catch (e) { return errorResponse(res, e); }
};
