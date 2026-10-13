const {json}=require('../lib/supabase');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(req.method!=='GET')return json(res,405,{ok:false,error:'Method not allowed'});
 try{return json(res,200,{ok:true,...await require('../lib/postpurchase-landing').read(req.query?.token)});}
 catch(e){return json(res,[400,404].includes(e.statusCode)?e.statusCode:503,{ok:false,error:[400,404].includes(e.statusCode)?e.message:'تعذر تجهيز اقتراحاتك الآن؛ حاول لاحقًا'});}
};
