const { json,requireAdmin,noCache,bodyObject } = require('../lib/crm');
const snap = require('../lib/snapchat');
module.exports = async function handler(req,res) {
  noCache(res);
  try {
    await requireAdmin(req);
    if (req.method==='GET') {
      if(req.query?.action==='accounts')return json(res,200,{ok:true,...await require('../lib/snapchat-reporting').accounts()});
      if(req.query?.action==='report')return json(res,200,{ok:true,...await require('../lib/snapchat-reporting').report(req.query.from,req.query.to)});
      if(req.query?.action)return json(res,400,{ok:false,error:'Invalid action'});
      const missing=snap.missingConfig(); let valid=false;
      try { snap.config();valid=true; } catch {}
      return json(res,200,{ok:true,ready:valid,missing});
    }
    if (req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
    snap.config();
    if (req.headers.origin !== new URL(snap.CALLBACK).origin) return json(res,403,{ok:false,error:'ابدأ الربط من الداشبورد المنشور'});
    if(req.query?.action==='select')return json(res,200,{ok:true,selected:await require('../lib/snapchat-reporting').selectAccount(bodyObject(req).account_id)});
    if (req.query?.action==='refresh') { await snap.refresh();return json(res,200,{ok:true}); }
    if (req.query?.action && req.query.action!=='start') return json(res,400,{ok:false,error:'Invalid action'});
    // Confirm the existing private tables are available before opening consent.
    const {sb,MERCHANT_ID}=require('../lib/crm');
    await sb(`crm_connections?merchant_id=eq.${MERCHANT_ID}&provider=eq.snapchat&select=provider&limit=1`);
    return json(res,200,{ok:true,url:snap.start(res)});
  } catch(e) {
    return json(res,e.statusCode===401?401:e.statusCode===400?400:503,{ok:false,error:e.statusCode===401?'Unauthorized':e.statusCode===400?e.message:'تعذر الاتصال بسناب؛ تحقق من التفويض وإعدادات الخادم، ثم أعد المحاولة'});
  }
};
