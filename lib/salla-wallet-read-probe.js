const crypto=require('node:crypto');
const {sb,MERCHANT_ID,decryptCredentials,json}=require('./crm');
module.exports=async(req,res)=>{
 const code=typeof req.query?.code==='string'?req.query.code:'';
 if(req.method!=='GET'||Date.now()>1795435456675||!crypto.timingSafeEqual(crypto.createHash('sha256').update(code).digest(),Buffer.from('4fc9cbb4fa9af1de85b672b394acda3abbfca251c9c796ee153233872e782021','hex')))return json(res,404,{ok:false});
 try{
  const [c]=await sb('crm_connections?merchant_id=eq.'+MERCHANT_ID+'&provider=eq.salla&select=status,credentials_encrypted,token_expires_at');
  if(c?.status!=='connected'||!c.credentials_encrypted||Date.parse(c.token_expires_at)<=Date.now())return json(res,503,{ok:false,stage:'connection'});
  const {access_token}=decryptCredentials(c.credentials_encrypted);
  const opt={headers:{Authorization:'Bearer '+access_token,Accept:'application/json'},signal:AbortSignal.timeout(4500),redirect:'error'};
  const p=new URL('https://api.salla.dev/merchant-reports/v1/wallets/transactions-list');
  for(const [k,v] of Object.entries({_from_date:'2026-11-22 16:30:00',_to_date:'2026-11-22 16:45:00',from_date_int:'2026-11-22',to_date_int:'2026-11-22',_limit:'30',store_id:String(MERCHANT_ID)}))p.searchParams.set(k,v);
  const [report,control]=await Promise.allSettled([fetch(p,opt),fetch('https://api.salla.dev/admin/v2/store/info',opt)]);
  const rr=report.status==='fulfilled'?report.value:null;
  const body=rr?.ok?await rr.json().catch(()=>null):null;
  const rows=Array.isArray(body?.rows)?body.rows:Array.isArray(body?.data?.rows)?body.data.rows:Array.isArray(body?.data)?body.data:[];
  const row=rows.find(x=>x.type==='cashback'&&x.transaction_type==='deposit'&&String(x.order_id)==='1209548854');
  return json(res,200,{ok:true,control_status:control.status==='fulfilled'?control.value.status:null,report_status:rr?.status??null,rows_count:rows.length,order_matched:!!row,amount_matched:row?Number(row.amount)===35.44:false});
 }catch{return json(res,503,{ok:false,stage:'server_probe'});}
};