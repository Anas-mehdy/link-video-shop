const { sb, json, cors, requireAdmin, MERCHANT_ID } = require('../lib/supabase');
const catalog = require('../data/protection-catalog.json');
const byId = new Map(catalog.map(p => [String(p.id), p]));
const { modelKey, modelsIn } = require('../lib/protection-models');
const modes = new Set(['off','protection','accessories']);
const roles = new Set(['lens','camera_plate','case','screen','accessory','bundle','unknown']);

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  try {
    await requireAdmin(req);
    if (req.method === 'GET') {
      const [settings, rules, live] = await Promise.all([
        sb(`protection_settings?merchant_id=eq.${MERCHANT_ID}&select=enabled,default_mode`),
        sb(`protection_product_rules?merchant_id=eq.${MERCHANT_ID}&select=external_product_id,mode,brand,model,role,color,recommendations`),
        sb(`products?merchant_id=eq.${MERCHANT_ID}&select=external_product_id,name,thumbnail_url,main_image_url,status,is_available&limit=1000`)
      ]);
      const seen = new Set();
      const mapped = (live || []).map(p => { const id=String(p.external_product_id),hint=byId.get(id);seen.add(id);return {id,name:p.name||hint?.name||('منتج #'+id),image:p.thumbnail_url||p.main_image_url||null,status:p.is_available===false?'غير متاح':p.status==='hidden'?'مخفي':'متاح',brand:hint?.brand||null,role:hint?.role||'unknown',variable:hint?.variable??true,review:hint?.review??true,models:hint?.models||modelsIn(p.name)}; });
      return json(res, 200, {ok:true, settings:settings[0] || {enabled:false,default_mode:'off'}, rules:rules || [], catalog:[...mapped,...catalog.filter(p=>!seen.has(p.id))]});
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (req.method === 'PUT') {
      if (typeof body.enabled !== 'boolean' || !modes.has(body.default_mode)) return json(res,400,{ok:false,error:'إعدادات غير صالحة'});
      await sb('protection_settings', {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{merchant_id:MERCHANT_ID,enabled:body.enabled,default_mode:body.default_mode,updated_at:new Date().toISOString()}])});
      return json(res,200,{ok:true});
    }
    if (req.method === 'PATCH') {
      const id = String(body.external_product_id || '');
      if (!/^\d{1,15}$/.test(id) || !modes.has(body.mode) || !roles.has(body.role) || !['iphone','samsung',''].includes(body.brand || '')) return json(res,400,{ok:false,error:'بيانات المنتج غير صالحة'});
      const recs = body.recommendations;
      if (!Array.isArray(recs) || recs.length > 12 || new Set(recs.map(String)).size !== recs.length || recs.some(x => !/^\d{1,15}$/.test(String(x)) || String(x) === id)) return json(res,400,{ok:false,error:'تحقق من المنتجات المقترحة'});
      const ids=[id,...recs.map(String)];
      const live=await sb(`products?merchant_id=eq.${MERCHANT_ID}&external_product_id=in.(${ids.join(',')})&select=external_product_id`);
      const known=new Set((live||[]).map(p=>String(p.external_product_id)));
      if (ids.some(x=>!known.has(x) && !byId.has(x))) return json(res,400,{ok:false,error:'منتج غير موجود في الخريطة'});
      if (String(body.model || '').length > 100 || String(body.color || '').length > 30) return json(res,400,{ok:false,error:'النص طويل جدًا'});
      if (body.mode !== 'off') {
        const model=modelKey(body.model),source=byId.get(id);
        if (!recs.length || (body.mode === 'protection' && !model)) return json(res,400,{ok:false,error:'حدد الموديل والمنتجات المقترحة'});
        if (body.mode === 'protection' && source?.models?.length > 1) return json(res,400,{ok:false,error:'هذا المنتج يحتوي عدة موديلات؛ يلزم تحديد موديل الخيار في صفحة المتجر أولًا'});
        if (body.mode === 'protection' && source?.models?.length === 1 && !source.models.some(x=>modelKey(x)===model)) return json(res,400,{ok:false,error:'موديل المنتج لا يطابق الموديل المحدد'});
        if (body.mode === 'protection' && recs.some(x=>!byId.get(String(x))?.models?.some(m=>modelKey(m)===model))) return json(res,400,{ok:false,error:'بعض القطع المقترحة لا تدعم موديل الجهاز المحدد'});
      }
      await sb('protection_product_rules', {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{merchant_id:MERCHANT_ID,external_product_id:Number(id),mode:body.mode,brand:body.brand||null,model:String(body.model||'').trim()||null,role:body.role,color:String(body.color||'').trim()||null,recommendations:recs.map(Number),updated_at:new Date().toISOString()}])});
      return json(res,200,{ok:true});
    }
    return json(res,405,{ok:false,error:'Method not allowed'});
  } catch(e) { console.error(e); return json(res,e.statusCode||500,{ok:false,error:e.statusCode===401?'Unauthorized':'تعذر الوصول للبيانات؛ تأكد من تشغيل protection-schema.sql في مشروع Video Shop'}); }
};
