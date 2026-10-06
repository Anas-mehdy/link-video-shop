const snap=require('./snapchat');
const {fail}=require('./crm');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const BASE='https://adsapi.snapchat.com';
const FIELDS=['spend','impressions','swipes','conversion_purchases','conversion_purchases_value'];
function success(value){return String(value).toLowerCase()==='success';}
async function get(path,token) {
  const url=new URL(path,BASE);
  if(url.origin!==BASE||!url.pathname.startsWith('/v1/'))throw fail(503,'رابط المنصة غير صالح');
  const res=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000),redirect:'error'});
  if(res.status===401)throw fail(400,'انتهى تفويض سناب؛ أعد الربط من التكاملات');
  if(res.status===403)throw fail(400,'حساب سناب لا يملك صلاحية قراءة هذا الحساب الإعلاني');
  if(!res.ok)throw fail(503,'تعذر تحميل تقرير سناب');
  const data=await res.json();if(!success(data.request_status))throw fail(503,'تعذر قراءة استجابة سناب');
  return data;
}
function accountInfo(a) {
  if(!a||!UUID.test(a.id)||!a.currency||!a.timezone)throw fail(503,'بيانات الحساب الإعلاني غير مكتملة');
  try{new Intl.DateTimeFormat('en',{timeZone:a.timezone}).format();}catch{throw fail(503,'توقيت الحساب غير صالح');}
  return {id:a.id,name:String(a.name||a.id).slice(0,200),currency:String(a.currency),timezone:String(a.timezone)};
}
async function account(id,token) {
  if(!UUID.test(id||''))throw fail(400,'معرّف الحساب الإعلاني غير صالح');
  const data=await get(`/v1/adaccounts/${id}`,token),row=data.adaccounts?.find(r=>success(r.sub_request_status)&&r.adaccount?.id===id);
  return accountInfo(row?.adaccount);
}
async function accounts() {
  const session=await snap.session();let path='/v1/me/organizations?with_ad_accounts=true';const accounts=new Map(),seen=new Set();
  for(let page=0;path&&page<10;page++) {
    if(seen.has(path))throw fail(503,'تعذر تحميل جميع الحسابات');seen.add(path);
    const data=await get(path,session.tokens.access_token);
    if(!Array.isArray(data.organizations))throw fail(503,'قائمة الحسابات غير مكتملة');
    for(const row of data.organizations){if(!success(row.sub_request_status))throw fail(503,'تعذر قراءة إحدى المؤسسات');for(const a of row.organization?.ad_accounts||[]){accounts.set(a.id,accountInfo(a));}}
    path=data.paging?.next_link||null;
  }
  if(path)throw fail(503,'عدد الحسابات كبير؛ تعذر إكمال القائمة');
  return {accounts:[...accounts.values()],selected:session.tokens.account?accountInfo(session.tokens.account):null};
}
async function selectAccount(id) {
  const session=await snap.session(),selected=await account(id,session.tokens.access_token);
  await snap.updateSession(session,{...session.tokens,account:selected});return selected;
}
function validDay(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
function shift(day,n){return new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);}
function localDay(time,tz){return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));}
function midnight(day,tz) {
  const target=Date.parse(`${day}T00:00:00Z`);let instant=target;
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<4;i++){
    const p=Object.fromEntries(fmt.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    const wall=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
    if(wall===target)return new Date(instant).toISOString();instant+=target-wall;
  }
  throw fail(400,'هذه الفترة تتضمن تغيير توقيت غير مدعوم؛ اختر فترة أخرى');
}
function validateRange(from,to){
  if(!validDay(from)||!validDay(to)||from>to||from<'2013-01-01'||to>localDay(Date.now(),'Asia/Riyadh'))throw fail(400,'اختر فترة تاريخ صحيحة لا تتجاوز اليوم');
  const days=(Date.parse(to)-Date.parse(from))/86400000+1;if(days>366)throw fail(400,'اختر فترة لا تتجاوز 366 يوماً');return days;
}
function number(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;}
function metrics(s){
  const spend=number(s.spend),value=number(s.conversion_purchases_value);
  return derived({spend:spend===null?null:spend/1e6,impressions:number(s.impressions),clicks:number(s.swipes),purchases:number(s.conversion_purchases),purchase_value:value===null?null:value/1e6});
}
function derived(m){return {...m,ctr:m.clicks!==null&&m.impressions>0?m.clicks/m.impressions*100:null,cpc:m.spend!==null&&m.clicks>0?m.spend/m.clicks:null,cpm:m.spend!==null&&m.impressions>0?m.spend/m.impressions*1000:null,roas:m.purchase_value!==null&&m.spend>0?m.purchase_value/m.spend:null};}
function parse(data,a,from,to) {
  if(!Array.isArray(data.timeseries_stats)||data.paging?.next_link)throw fail(503,'التقرير غير مكتمل');
  const rows=new Map();
  for(const entry of data.timeseries_stats){
    const series=entry.timeseries_stat;
    if(!success(entry.sub_request_status)||series?.id!==a.id||series.granularity!=='DAY'||!Array.isArray(series.timeseries))throw fail(503,'التقرير غير مكتمل');
    for(const row of series.timeseries){
      if(!Number.isFinite(Date.parse(row.start_time)))throw fail(503,'توقيت التقرير غير صالح');
      const day=localDay(row.start_time,a.timezone);
      if(day<from||day>to||rows.has(day)||!row.stats)throw fail(503,'التقرير لا يطابق الفترة المطلوبة');
      rows.set(day,{date:day,...metrics(row.stats)});
    }
  }
  const daily=[];for(let day=from;day<=to;day=shift(day,1))daily.push(rows.get(day)||{date:day,...metrics({})});
  const total={};for(const key of ['spend','impressions','clicks','purchases','purchase_value'])total[key]=daily.every(d=>d[key]!==null)?daily.reduce((sum,d)=>sum+d[key],0):null;
  return {daily,totals:derived(total),complete:rows.size===daily.length};
}
async function report(from,to) {
  validateRange(from,to);
  const session=await snap.session();
  if(!session.tokens.account)return {status:'select_account',account:null};
  // Fetch current metadata and verify account permission on every report.
  const a=await account(session.tokens.account.id,session.tokens.access_token);
  const params=new URLSearchParams({granularity:'DAY',fields:FIELDS.join(','),start_time:midnight(from,a.timezone),end_time:midnight(shift(to,1),a.timezone),omit_empty:'false',swipe_up_attribution_window:'28_DAY',view_attribution_window:'1_DAY',action_report_time:'conversion'});
  const data=await get(`/v1/adaccounts/${a.id}/stats?${params}`,session.tokens.access_token);
  return {status:'ready',account:a,from,to,...parse(data,a,from,to),updated_at:new Date().toISOString(),attribution:{click:'28_DAY',view:'1_DAY',report_time:'conversion'}};
}
module.exports={accounts,selectAccount,report,validateRange,midnight,parse};
