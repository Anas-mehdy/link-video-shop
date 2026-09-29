const { sb, json, cors, MERCHANT_ID } = require('../lib/supabase');
const catalog = require('../data/protection-catalog.json');
const byId = new Map(catalog.map(p => [String(p.id),p]));
const off = {ok:true,enabled:false,mode:'off',product:null,recommendations:[]};

module.exports = async function handler(req,res) {
  cors(req,res);
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method!=='GET') return json(res,405,{ok:false,error:'Method not allowed'});
  const id=String(req.query?.id||'');
  if(!/^\d{1,15}$/.test(id)) return json(res,200,off);
  try {
    const [settings,rules]=await Promise.all([
      sb(`protection_settings?merchant_id=eq.${MERCHANT_ID}&select=enabled,default_mode`),
      sb(`protection_product_rules?merchant_id=eq.${MERCHANT_ID}&external_product_id=eq.${id}&select=mode,brand,model,role,color,recommendations`)
    ]);
    const global=settings[0],rule=rules[0],mode=rule?.mode||global?.default_mode||'off';
    if(!global?.enabled||mode==='off'||!rule||!rule.model||!Array.isArray(rule.recommendations)) return json(res,200,off,{'Cache-Control':'public, s-maxage=30'});
    const ids=[id,...rule.recommendations.map(String)].filter(x=>/^\d{1,15}$/.test(x)).slice(0,13);
    const [rows, recRules]=await Promise.all([sb(`products?merchant_id=eq.${MERCHANT_ID}&external_product_id=in.(${ids.join(',')})&select=external_product_id,name,url,thumbnail_url,main_image_url,price,sale_price,currency,status,is_available`),
      sb(`protection_product_rules?merchant_id=eq.${MERCHANT_ID}&external_product_id=in.(${ids.join(',')})&select=external_product_id,role`)
    ]);
    const live=new Map((rows||[]).map(p=>[String(p.external_product_id),p]));
    const mappedRoles=new Map((recRules||[]).map(r=>[String(r.external_product_id),r.role]));
    const isAvailable=p=>p&&p.is_available!==false&&!['hidden','unavailable','out_of_stock'].includes(String(p.status||'').toLowerCase());
    if(!isAvailable(live.get(id))) return json(res,200,off,{'Cache-Control':'public, s-maxage=30'});
    const recommendations=rule.recommendations.map(x=>{const p=live.get(String(x)),hint=byId.get(String(x));return isAvailable(p)&&hint?.status!=='مخفي'&&hint?.status!=='غير متاح'?{id:String(x),name:p.name,image:p.thumbnail_url||p.main_image_url||hint?.image,url:p.url||null,price:p.sale_price??p.price??null,currency:p.currency||'SAR',role:mappedRoles.get(String(x))||hint?.role||'accessory',variable:hint?.variable??true}:null}).filter(Boolean);
    return json(res,200,{ok:true,enabled:recommendations.length>0,mode,product:{id,name:live.get(id).name,brand:rule.brand||byId.get(id)?.brand,model:rule.model,role:rule.role||byId.get(id)?.role||'unknown',color:rule.color||''},recommendations},{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=60'});
  } catch(e) { console.error(e); return json(res,200,off,{'Cache-Control':'no-store'}); }
};
