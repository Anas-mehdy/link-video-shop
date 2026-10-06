const { sb, json, requireAdmin, MERCHANT_ID, noCache, errorResponse, bodyObject, countRows, fail } = require('../lib/crm');
const RULE_EVENTS = new Set(['abandoned.cart','order.created','order.status.updated','customer.created']);
const { resources, listRecords } = require('../lib/crm-records');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
module.exports = async function handler(req, res) {
  noCache(res);
  try {
    const resource = req.query?.resource || 'overview';
    if(resource==='auth') {
      const auth=require('../lib/admin-auth'),action=req.query?.action||'session';
      try {
        if(req.method==='GET'&&action==='config')return json(res,200,{ok:true,mode:auth.mode()});
        if(auth.mode()!=='supabase')return json(res,400,{ok:false,error:'تسجيل حسابات سوبابيس لم يُفعّل بعد'});
        if(req.method==='POST'&&action==='login')return json(res,200,{ok:true,user:await auth.login(req,res,bodyObject(req))});
        if(req.method==='GET'&&action==='session')return json(res,200,{ok:true,user:await auth.session(req,res)});
        if(req.method==='POST'&&action==='logout'){await auth.logout(req,res);return json(res,200,{ok:true});}
        return json(res,405,{ok:false,error:'Method not allowed'});
      }catch(e){if(e.statusCode===401&&action==='session')auth.clearSession(res);return json(res,[400,401,403,429,503].includes(e.statusCode)?e.statusCode:503,{ok:false,error:e.statusCode?e.message:'تعذر تسجيل الدخول'});}
    }
    await requireAdmin(req);
    if (resource === 'whatsapp' && req.method === 'GET') return json(res,200,{ok:true,...await require('../lib/whatsapp-workspace').load()});
    if (resource === 'whatsapp' && req.method === 'PUT') return json(res,200,{ok:true,...await require('../lib/whatsapp-workspace').save(bodyObject(req))});
    if (req.method === 'GET' && resource === 'overview') {
      const results = await Promise.allSettled([
        countRows('products'), countRows('video_shop_videos'), countRows('orders'), countRows('customers'), countRows('abandoned_carts'),
        sb(`crm_connections?merchant_id=eq.${MERCHANT_ID}&select=provider,status,authorized_at,token_expires_at,updated_at`),
        sb(`crm_event_inbox?merchant_id=eq.${MERCHANT_ID}&select=id,event_name,status,received_at,occurred_at&order=received_at.desc&limit=8`),
        sb(`crm_automation_rules?merchant_id=eq.${MERCHANT_ID}&select=id,name,event_name,enabled,delay_minutes,mode&order=created_at.asc`),
      ]);
      const names = ['products','videos','orders','customers','carts','connections','events','rules'];
      const data = Object.fromEntries(names.map((key, i) => [key, results[i].status === 'fulfilled' ? results[i].value : null]));
      return json(res, 200, { ok: true, merchant_id: MERCHANT_ID, data, unavailable: names.filter((_, i) => results[i].status === 'rejected') });
    }
    if (req.method === 'GET' && Object.hasOwn(resources, resource)) {
      return json(res, 200, { ok: true, ...await listRecords(resource, req.query || {}) });
    }
    if (req.method === 'GET' && resource === 'events') {
      const events = await sb(`crm_event_inbox?merchant_id=eq.${MERCHANT_ID}&select=id,event_name,status,occurred_at,received_at,processed_at&order=received_at.desc&limit=100`);
      return json(res, 200, { ok: true, events });
    }
    if (req.method === 'GET' && resource === 'runs') {
      const runs = await sb(`crm_automation_runs?merchant_id=eq.${MERCHANT_ID}&select=id,rule_id,event_id,status,scheduled_for,created_at,summary&order=created_at.desc&limit=100`);
      return json(res, 200, { ok: true, runs });
    }
    if (req.method === 'GET' && resource === 'rules') {
      const rules = await sb(`crm_automation_rules?merchant_id=eq.${MERCHANT_ID}&select=id,name,event_name,enabled,delay_minutes,mode,created_at&order=created_at.asc`);
      return json(res, 200, { ok: true, rules });
    }
    if (req.method === 'POST' && resource === 'process') {
      const processed = await sb('rpc/crm_process_events', { method: 'POST', body: JSON.stringify({ p_merchant_id: MERCHANT_ID, p_limit: 20 }) });
      return json(res, 200, { ok: true, processed, mode: 'dry_run' });
    }
    if (req.method === 'PATCH' && resource === 'rules') {
      const body = bodyObject(req);
      if (!UUID.test(body.id || '') || typeof body.enabled !== 'boolean' || !Number.isInteger(body.delay_minutes) || body.delay_minutes < 0 || body.delay_minutes > 10080) throw fail(400, 'إعدادات القاعدة غير صالحة');
      const rules = await sb(`crm_automation_rules?id=eq.${body.id}&merchant_id=eq.${MERCHANT_ID}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ enabled: body.enabled, delay_minutes: body.delay_minutes, updated_at: new Date().toISOString() }) });
      if (!rules?.length) throw fail(400, 'القاعدة غير موجودة');
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && resource === 'rules') {
      const body = bodyObject(req), name = String(body.name || '').trim();
      if (!name || name.length > 100 || !RULE_EVENTS.has(body.event_name) || !Number.isInteger(body.delay_minutes) || body.delay_minutes < 0 || body.delay_minutes > 10080) throw fail(400, 'إعدادات القاعدة غير صالحة');
      await sb('crm_automation_rules', { method: 'POST', body: JSON.stringify({ merchant_id: MERCHANT_ID, name, event_name: body.event_name, delay_minutes: body.delay_minutes, enabled: false, mode: 'dry_run' }) });
      return json(res, 201, { ok: true });
    }
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (e) { return errorResponse(res, e); }
};
