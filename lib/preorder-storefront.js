const {sb,json,MERCHANT_ID}=require('./supabase');
// Public dates only. No reservations, customer data, internal quantities or keys.
async function feed(req,res){
 const ids=String(req.query?.ids||'').split(',');
 if(!ids.length||ids.length>20||ids.some(id=>!/^\d{1,15}$/.test(id)))return json(res,400,{ok:false,error:'invalid_products'},{'Cache-Control':'no-store'});
 const preview=req.query?.preview==='1';
 try{
  const rows=await sb(`crm_preorder_batches?merchant_id=eq.${MERCHANT_ID}&product_id=in.(${[...new Set(ids)].join(',')})&select=product_id,product_name,color,status,expected_arrival,ship_from,ship_by,revision&order=created_at.desc&limit=100`,{signal:AbortSignal.timeout(8000)});
  const seen=new Set(),products=[];
  for(const row of rows){
   if(seen.has(row.product_id)||(!preview&&row.status==='draft'))continue;
   seen.add(row.product_id);
   products.push({id:row.product_id,name:row.product_name,color:row.color,status:row.status,expected_arrival:row.expected_arrival,ship_from:row.ship_from,ship_by:row.ship_by,revision:row.revision});
  }
  return json(res,200,{ok:true,preview,products},{'Cache-Control':'no-store'});
 }catch{return json(res,503,{ok:false,error:'schedule_unavailable'},{'Cache-Control':'no-store'});}
}
module.exports={feed};
