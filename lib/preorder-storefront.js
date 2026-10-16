const {sb,json,MERCHANT_ID}=require('./supabase');
// Public dates only. No reservations, customer data, internal quantities or keys.
async function feed(req,res){
 const catalog=req.query?.catalog==='1';
 const ids=String(req.query?.ids||'').split(',');
 if(!catalog&&(!ids.length||ids.length>20||ids.some(id=>!/^\d{1,15}$/.test(id))))return json(res,400,{ok:false,error:'invalid_products'},{'Cache-Control':'no-store'});
 const preview=!catalog&&req.query?.preview==='1';
 try{
  const filter=catalog?'status=in.(open,paused)':`product_id=in.(${[...new Set(ids)].join(',')})`;
  const rows=await sb(`crm_preorder_batches?merchant_id=eq.${MERCHANT_ID}&${filter}&select=product_id,variant_id,product_name,color,status,expected_arrival,ship_from,ship_by,revision&order=created_at.desc&limit=${catalog?201:100}`,{signal:AbortSignal.timeout(8000)});
  if(!Array.isArray(rows)||catalog&&(rows.length>200||rows.some(r=>r.variant_id)))return json(res,503,{ok:false,error:'catalog_requires_review'},{'Cache-Control':'no-store'});
  const seen=new Set(),products=[];
  for(const row of rows){
   if(seen.has(String(row.product_id))||(!preview&&row.status==='draft')||catalog&&!['open','paused'].includes(row.status))continue;
   if(catalog&&rows.some(r=>String(r.product_id)===String(row.product_id)&&r!==row))return json(res,503,{ok:false,error:'catalog_requires_review'},{'Cache-Control':'no-store'});
   seen.add(String(row.product_id));
   products.push({id:row.product_id,name:row.product_name,color:row.color==='بدون خيارات'?'':row.color,status:row.status,expected_arrival:row.expected_arrival,ship_from:row.ship_from,ship_by:row.ship_by,revision:row.revision});
  }
  let consent;
  if(catalog){const service=require('./preorder-consent-service'),active=await service.control();consent={enabled:active!==false,available:active!==null,policy_version:service.VERSION,policy_text:service.TEXT};}
  return json(res,200,{ok:true,preview,...(catalog?{catalog:true,complete:true,consent}:{}),products},{'Cache-Control':'no-store'});
 }catch{return json(res,503,{ok:false,error:'schedule_unavailable'},{'Cache-Control':'no-store'});}
}
module.exports={feed};
