const { json, noCache, errorResponse, bodyObject } = require('../lib/crm');
const staffSales = require('../lib/staff-sales');

module.exports = async function handler(req, res) {
  noCache(res);
  if (req.method !== 'POST') return json(res, 405, { ok:false, error:'Method not allowed' }, { Allow:'POST' });
  try {
    const body = bodyObject(req), action = String(body.action || '');
    if (action === 'generate') return json(res, 200, { ok:true, ...(await staffSales.generate(body.url, body.platform)) });
    if (action === 'copy') return json(res, 200, { ok:true, ...(await staffSales.copy(body.url, body.platform)) });
    return json(res, 400, { ok:false, error:'الإجراء غير صالح' });
  } catch (e) {
    return errorResponse(res, e);
  }
};
