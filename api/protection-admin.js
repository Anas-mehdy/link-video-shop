const { sb, json, cors, requireAdmin, MERCHANT_ID } = require('../lib/supabase');
const catalog = require('../data/protection-catalog.json');
const byId = new Map(catalog.map(p => [String(p.id), p]));
const modes = new Set(['off','protection','accessories']);
const roles = new Set(['lens','camera_plate','case','screen','accessory','bundle','unknown']);

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  try {
    requireAdmin(req);
    if (req.method === 'GET') {
      const [settings, rules] = await Promise.all([
        sb(`protection_settings?merchant_id=eq.${MERCHANT_ID}&select=enabled,default_mode`),
        sb(`protection_product_rules?merchant_id=eq.${MERCHANT_ID}&select=external_product_id,mode,brand,model,role,color,recommendations`)
      ]);
      return json(res, 200, {ok:true, settings:settings[0] || {enabled:false,default_mode:'off'}, rules:rules || [], catalog});
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (req.method === 'PUT') {
      if (typeof body.enabled !== 'boolean' || !modes.has(body.default_mode)) return json(res,400,{ok:false,error:'إعدادات غير صالحة'});
      await sb('protection_settings', {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{merchant_id:MERCHANT_ID,enabled:body.enabled,default_mode:body.default_mode,updated_at:new Date().toISOString()}])});
      return json(res,200,{ok:true});
    }
    if (req.method === 'PATCH') {
      const id = String(body.external_product_id || '');
      if (!byId.has(id) || !modes.has(body.mode) || !roles.has(body.role) || !['iphone','samsung',''].includes(body.brand || '')) return json(res,400,{ok:false,error:'بيانات المنتج غير صالحة'});
      const recs = body.recommendations;
      if (!Array.isArray(recs) || recs.length > 12 || new Set(recs.map(String)).size !== recs.length || recs.some(x => !byId.has(String(x)) || String(x) === id)) return json(res,400,{ok:false,error:'تحقق من المنتجات المقترحة'});
      if (String(body.model || '').length > 100 || String(body.color || '').length > 30) return json(res,400,{ok:false,error:'النص طويل جدًا'});
      await sb('protection_product_rules', {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{merchant_id:MERCHANT_ID,external_product_id:Number(id),mode:body.mode,brand:body.brand||null,model:String(body.model||'').trim()||null,role:body.role,color:String(body.color||'').trim()||null,recommendations:recs.map(Number),updated_at:new Date().toISOString()}])});
      return json(res,200,{ok:true});
    }
    return json(res,405,{ok:false,error:'Method not allowed'});
  } catch(e) { console.error(e); return json(res,e.statusCode||500,{ok:false,error:e.statusCode===401?'Unauthorized':'تعذر الوصول للبيانات؛ تأكد من تشغيل protection-schema.sql في مشروع Video Shop'}); }
};
