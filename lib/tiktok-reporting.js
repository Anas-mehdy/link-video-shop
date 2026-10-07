const tt=require('./tiktok');
const {fail}=require('./crm');
const {validateRange}=require('./snapchat-reporting');
const BASE='https://business-api.tiktok.com/open_api/v1.3/';
const BASE_FIELDS=['spend','impressions','clicks'];
const PURCHASE_FIELDS=['complete_payment','total_complete_payment_rate'];
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
function derived(m){return {...m,ctr:m.clicks!==null&&m.impressions>0?m.clicks/m.impressions*100:null,cpc:m.spend!==null&&m.clicks>0?m.spend/m.clicks:null,cpm:m.spend!==null&&m.impressions>0?m.spend/m.impressions*1000:null,roas:m.purchase_value!==null&&m.spend>0?m.purchase_value/m.spend:null};}
async function get(path,params,token){
  if(!['advertiser/info/','report/integrated/get/'].includes(path))throw fail(503,'رابط تقرير غير صالح');
  const res=await fetch(BASE+path+'?'+new URLSearchParams(params),{headers:{'Access-Token':token},signal:AbortSignal.timeout(12000),redirect:'error'});
  if(res.status===401||res.status===403)throw fail(400,'تحقق من تفويض تيك توك وصلاحية قراءة التقارير');
  if(!res.ok)throw fail(503,'تعذر تحميل تقرير تيك توك');
  const body=require('./salla-sync').losslessJSON(await res.text());
  if(body.code!==0||!body.data)throw Object.assign(fail(503,'تيك توك رفض التقرير؛ تحقق من صلاحية Reporting في التطبيق'),{provider_code:body.code});
  return body.data;
}
async function account(id,token){
  const data=await get('advertiser/info/',{advertiser_ids:JSON.stringify([id]),fields:JSON.stringify(['advertiser_id','name','currency','timezone'])},token);
  const a=data.list?.find(a=>String(a.advertiser_id)===id);
  if(!a||typeof a.currency!=='string'||!/^[A-Z]{3}$/.test(a.currency)||typeof a.timezone!=='string'||!a.timezone)throw fail(503,'بيانات عملة وتوقيت حساب تيك توك غير مكتملة');
  // Keep TikTok's supplied timezone label; API reports already use account calendar days.
  return {id,name:String(a.name||id).slice(0,200),currency:a.currency,timezone:a.timezone.slice(0,100)};
}
async function rows(id,from,to,token,fields){
  const result=[],started=Date.now();let page=1,totalPages=1;
  do{
    if(page>10||Date.now()-started>35000)throw fail(503,'التقرير كبير؛ اختر فترة أقصر');
    const data=await get('report/integrated/get/',{advertiser_id:id,report_type:'BASIC',service_type:'AUCTION',data_level:'AUCTION_ADVERTISER',dimensions:JSON.stringify(['advertiser_id','stat_time_day']),metrics:JSON.stringify(fields),start_date:from,end_date:to,page:String(page),page_size:'1000'},token);
    if(!Array.isArray(data.list))throw fail(503,'تقرير تيك توك غير مكتمل');
    const info=data.page_info;
    if(!info||Number(info.page)!==page||!Number.isInteger(Number(info.total_page))||Number(info.total_page)<0||(data.list.length&&Number(info.total_page)<page))throw fail(503,'صفحات تقرير تيك توك غير مكتملة');
    totalPages=Number(info.total_page);result.push(...data.list);page++;
  }while(page<=totalPages);
  return result;
}
function parse(rows,id,from,to,hasPurchases=true){
  const byDay=new Map();
  for(const row of rows){
    const d=row.dimensions,day=d?.stat_time_day?.slice(0,10);
    if(String(d?.advertiser_id)!==id||!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||day<from||day>to||byDay.has(day)||!row.metrics)throw fail(503,'تقرير تيك توك مكرر أو لا يطابق الحساب والفترة');
    const m=row.metrics;
    byDay.set(day,derived({date:day,spend:num(m.spend),impressions:num(m.impressions),clicks:num(m.clicks),purchases:hasPurchases?num(m.complete_payment):null,purchase_value:hasPurchases?num(m.total_complete_payment_rate):null}));
  }
  const daily=[];
  for(let day=from;day<=to;day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10)){
    // Omitted days stay unknown instead of inventing financial or conversion figures.
    daily.push(byDay.get(day)||derived({date:day,spend:null,impressions:null,clicks:null,purchases:null,purchase_value:null}));
  }
  const sums={};for(const k of ['spend','impressions','clicks','purchases','purchase_value'])sums[k]=daily.every(d=>d[k]!==null)?daily.reduce((n,d)=>n+d[k],0):null;
  return {daily,totals:derived(sums),complete:daily.every(d=>['spend','impressions','clicks','purchases','purchase_value'].every(k=>d[k]!==null))};
}
async function report(from,to){
  validateRange(from,to);
  const s=await tt.session(),id=s.tokens.selected_account?.id;
  if(!id)return {status:'select_account',account:null};
  if(typeof id!=='string'||!/^\d{1,30}$/.test(id))throw fail(400,'اختر حساب تيك توك الإعلاني مجددًا');
  const a=await account(id,s.tokens.access_token);let data,hasPurchases=true;
  try{data=await rows(id,from,to,s.tokens.access_token,[...BASE_FIELDS,...PURCHASE_FIELDS]);}
  catch(e){
    // A parameter rejection can mean purchase metrics are unavailable at this level.
    // Keep spend/impressions/clicks available, but never substitute all conversions for purchases.
    if(Number(e.provider_code)!==40002)throw e;
    hasPurchases=false;data=await rows(id,from,to,s.tokens.access_token,BASE_FIELDS);
  }
  return {status:'ready',account:a,from,to,...parse(data,id,from,to,hasPurchases),updated_at:new Date().toISOString(),attribution:{source:'TikTok website purchase reporting; account attribution settings'},warnings:hasPurchases?[]:['مؤشرات مشتريات الموقع غير متاحة في هذا التقرير؛ تظهر بعلامة —.']};
}
module.exports={report,parse,derived};
