const {test,afterEach}=require('node:test');const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='db-private';process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);process.env.TIKTOK_APP_ID='7693876032643350548';process.env.TIKTOK_APP_SECRET='app-private';
const tt=require('../lib/tiktok'),reporting=require('../lib/tiktok-reporting'),{windowDates}=require('../lib/salla-sync');
const original=global.fetch;afterEach(()=>global.fetch=original);
const id='7244443234628403202',to=windowDates().to,from=new Date(Date.parse(to)-86400000).toISOString().slice(0,10);
const tokens={client_id:process.env.TIKTOK_APP_ID,access_token:'access-private',selected_account:{id,name:'Link'}};
const row=(day,spend='100',extra={})=>({dimensions:{advertiser_id:id,stat_time_day:day+' 00:00:00'},metrics:{spend,impressions:'1000',clicks:'50',complete_payment:'2',total_complete_payment_rate:'400',...extra}});
const json=data=>new Response(JSON.stringify(data));
function mock(callback){global.fetch=async(url,options)=>{
  if(url.startsWith('https://test.supabase.co/'))return json([{status:'connected',credentials_encrypted:tt.encrypt(tokens)}]);
  assert.ok(url.startsWith('https://business-api.tiktok.com/open_api/v1.3/'));assert.equal(options.headers['Access-Token'],'access-private');assert.equal(options.redirect,'error');
  const u=new URL(url);
  if(u.pathname.endsWith('/advertiser/info/')){assert.deepEqual(JSON.parse(u.searchParams.get('advertiser_ids')),[id]);return json({code:0,data:{list:[{advertiser_id:id,name:'Link',currency:'SAR',timezone:'Asia/Riyadh'}]}});}
  return callback(u,options);
};}
test('TikTok reports selected advertiser only, inclusive dates and raw currency amounts with weighted ratios',async()=>{
  mock(u=>{const q=u.searchParams;assert.equal(q.get('advertiser_id'),id);assert.equal(q.get('data_level'),'AUCTION_ADVERTISER');assert.equal(q.get('start_date'),from);assert.equal(q.get('end_date'),to);assert.deepEqual(JSON.parse(q.get('dimensions')),['advertiser_id','stat_time_day']);assert.equal(q.has('query_lifetime'),false);return json({code:0,data:{list:[row(from),row(to,'50',{clicks:'0'})],page_info:{page:1,total_page:1}}});});
  const r=await reporting.report(from,to);assert.equal(r.status,'ready');assert.equal(r.totals.spend,150);assert.equal(r.totals.clicks,50);assert.equal(r.totals.ctr,2.5);assert.equal(r.totals.cpc,3);assert.equal(r.totals.purchases,4);assert.equal(r.totals.purchase_value,800);assert.equal(r.totals.roas,800/150);assert.equal(r.complete,true);assert.ok(!JSON.stringify(r).includes('private'));
});
test('purchase metric parameter rejection preserves basic metrics without inventing purchases',async()=>{
  let calls=0;mock(u=>{calls++;if(JSON.parse(u.searchParams.get('metrics')).includes('complete_payment'))return json({code:40002,message:'private error'});return json({code:0,data:{list:[row(from),row(to)],page_info:{page:1,total_page:1}}});});
  const r=await reporting.report(from,to);assert.equal(calls,2);assert.equal(r.totals.spend,200);assert.equal(r.totals.purchases,null);assert.equal(r.totals.roas,null);assert.equal(r.warnings.length,1);
});
test('zero, missing days, duplicate rows and wrong advertiser remain distinct',()=>{
  const zero=reporting.parse([row(from,'0',{impressions:'0',clicks:'0',complete_payment:'0',total_complete_payment_rate:'0'})],id,from,from);assert.equal(zero.totals.spend,0);assert.equal(zero.totals.purchases,0);assert.equal(zero.totals.roas,null);
  const missing=reporting.parse([row(from)],id,from,to);assert.equal(missing.totals.spend,null);assert.equal(missing.complete,false);
  assert.throws(()=>reporting.parse([row(from),row(from)],id,from,to));assert.throws(()=>reporting.parse([{...row(from),dimensions:{advertiser_id:'111',stat_time_day:from}}],id,from,to));
});
test('invalid dates stop before IO, missing selection is explicit and pagination is fixed and complete',async()=>{
  global.fetch=()=>{throw Error('No IO');};await assert.rejects(reporting.report('2026-02-30',to));
  global.fetch=async()=>json([{status:'connected',credentials_encrypted:tt.encrypt({...tokens,selected_account:null})}]);assert.equal((await reporting.report(from,to)).status,'select_account');
  const pages=[];mock(u=>{const page=Number(u.searchParams.get('page'));pages.push(page);return json({code:0,data:{list:[row(page===1?from:to)],page_info:{page,total_page:2},paging:{next:'https://evil.test'}}});});
  assert.equal((await reporting.report(from,to)).totals.spend,200);assert.deepEqual(pages,[1,2]);
  mock(()=>json({code:0,data:{list:[row(from)]}}));await assert.rejects(reporting.report(from,to));
});
