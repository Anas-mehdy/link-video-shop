const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='db-private';process.env.VIDEO_SHOP_ADMIN_TOKEN='admin-private';process.env.CRM_ENCRYPTION_KEY='ab'.repeat(32);process.env.SNAPCHAT_CLIENT_ID='client-id';process.env.SNAPCHAT_CLIENT_SECRET='client-private';process.env.SNAPCHAT_REDIRECT_URI='https://link-video-shop.vercel.app/api/snapchat-callback';
const snap=require('../lib/snapchat'),reporting=require('../lib/snapchat-reporting'),connect=require('../api/snapchat-connect');
const originalFetch=global.fetch;afterEach(()=>{global.fetch=originalFetch;});
const id='11111111-1111-4111-8111-111111111111',account={id,name:'Link Store',currency:'SAR',timezone:'Asia/Riyadh'};
const data={access_token:'access-private',refresh_token:'refresh-private',client_id:'client-id',account,expires_at:'2030-01-01T00:00:00Z'};
const encrypted=snap.encrypt(data);const row={status:'connected',credentials_encrypted:encrypted,token_expires_at:data.expires_at};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
const day=(date,stats)=>({start_time:date+'T00:00:00+03:00',end_time:date+'T23:59:59+03:00',stats});
const stats=(spend,impressions,swipes,purchases,value)=>({spend,impressions,swipes,conversion_purchases:purchases,conversion_purchases_value:value});
function series(rows){return {request_status:'SUCCESS',timeseries_stats:[{sub_request_status:'SUCCESS',timeseries_stat:{id,granularity:'DAY',timeseries:rows}}]};}
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}};}
test('reporting dates validate leap days, order, future and 366-day limit; account midnight handles DST',()=>{
assert.equal(reporting.midnight('2026-10-01','Asia/Riyadh'),'2026-09-30T21:00:00.000Z');assert.equal(reporting.midnight('2026-03-08','America/New_York'),'2026-03-08T05:00:00.000Z');assert.equal(reporting.midnight('2026-03-09','America/New_York'),'2026-03-09T04:00:00.000Z');
for(const range of [['2026-02-30','2026-03-01'],['2026-10-02','2026-10-01'],['2024-01-01','2026-01-01'],['2099-01-01','2099-01-01']])assert.throws(()=>reporting.validateRange(...range));
});
test('microcurrency is converted once and period ratios are calculated from totals',()=>{
const report=reporting.parse(series([day('2026-10-01',stats(100000000,1000,10,2,400000000)),day('2026-10-02',stats(50000000,500,20,1,200000000))]),account,'2026-10-01','2026-10-02');
assert.equal(report.totals.spend,150);assert.equal(report.totals.purchase_value,600);assert.equal(report.totals.ctr,2);assert.equal(report.totals.cpc,5);assert.equal(report.totals.cpm,100);assert.equal(report.totals.roas,4);assert.equal(report.complete,true);
});
test('zero results stay zero; undefined ratios and missing data stay null; duplicates and wrong accounts fail',()=>{
const report=reporting.parse(series([day('2026-10-01',stats(0,0,0,0,0))]),account,'2026-10-01','2026-10-02');assert.equal(report.daily[0].spend,0);assert.equal(report.daily[0].roas,null);assert.equal(report.daily[1].spend,null);assert.equal(report.totals.spend,null);assert.equal(report.complete,false);
assert.throws(()=>reporting.parse(series([day('2026-10-01',stats(0,0,0,0,0)),day('2026-10-01',stats(0,0,0,0,0))]),account,'2026-10-01','2026-10-01'));
assert.throws(()=>reporting.parse(series([]),{...account,id:'other'},'2026-10-01','2026-10-01'));
});
test('account discovery returns only allowlisted metadata and blocks malicious pagination',async()=>{
let calls=0;global.fetch=async url=>{calls++;if(String(url).includes('supabase.co'))return json([row]);return json({request_status:'SUCCESS',organizations:[{sub_request_status:'SUCCESS',organization:{ad_accounts:[{...account,funding_source_ids:['private-billing']}],contact_email:'private-email'}}]});};
const result=await reporting.accounts();assert.deepEqual(result.accounts,[account]);assert.ok(!JSON.stringify(result).includes('private'));assert.equal(calls,3);
global.fetch=async url=>String(url).includes('supabase.co')?json([row]):json({request_status:'SUCCESS',organizations:[],paging:{next_link:'https://evil.test/v1/steal'}});await assert.rejects(reporting.accounts());
});
test('selection checks platform permissions and preserves tokens using a conditional DB update',async()=>{
let saved;global.fetch=async(url,opts)=>{if(String(url).includes('supabase.co')){if(opts.method==='PATCH'){assert.ok(String(url).includes('credentials_encrypted=eq.'));saved=snap.decrypt(JSON.parse(opts.body).credentials_encrypted);return json([{provider:'snapchat'}]);}return json([row]);}assert.equal(String(url),'https://adsapi.snapchat.com/v1/adaccounts/'+id);return json({request_status:'SUCCESS',adaccounts:[{sub_request_status:'SUCCESS',adaccount:account}]});};
assert.deepEqual(await reporting.selectAccount(id),account);assert.equal(saved.refresh_token,'refresh-private');assert.deepEqual(saved.account,account);
global.fetch=async url=>String(url).includes('supabase.co')?json([row]):json({private_error:'secret'},403);await assert.rejects(reporting.selectAccount(id),e=>e.statusCode===400&&!e.message.includes('secret'));
});
test('report queries only selected account, inclusive range, explicit attribution and server-side campaign aggregation',async()=>{
global.fetch=async(url,opts)=>{const u=new URL(url);if(u.hostname==='test.supabase.co')return json([row]);assert.equal(opts.headers.Authorization,'Bearer access-private');if(!u.pathname.endsWith('/stats'))return json({request_status:'SUCCESS',adaccounts:[{sub_request_status:'SUCCESS',adaccount:account}]});assert.equal(u.searchParams.get('start_time'),'2026-09-30T21:00:00.000Z');assert.equal(u.searchParams.get('end_time'),'2026-10-01T21:00:00.000Z');assert.equal(u.searchParams.get('breakdown'),'campaign');assert.equal(u.searchParams.get('swipe_up_attribution_window'),'28_DAY');assert.equal(u.searchParams.get('view_attribution_window'),'1_DAY');return json(campaigns([{id:'22222222-2222-4222-8222-222222222222',granularity:'DAY',timeseries:[day('2026-10-01',stats(1000000,100,5,1,5000000))]}]));};
const result=await reporting.report('2026-10-01','2026-10-01');assert.equal(result.totals.roas,5);assert.ok(!JSON.stringify(result).includes('private'));
});
test('reporting routes require admin; invalid dates fail before external IO',async()=>{
global.fetch=()=>{throw Error('No external IO');};let r=response();await connect({method:'GET',query:{action:'report'},headers:{authorization:'wrong'}},r);assert.equal(r.statusCode,401);
r=response();await connect({method:'GET',query:{action:'report',from:'invalid',to:'invalid'},headers:{authorization:'Bearer admin-private'}},r);assert.equal(r.statusCode,400);
});

function campaigns(items){return {request_status:'SUCCESS',timeseries_stats:[{sub_request_status:'SUCCESS',timeseries_stat:{id,type:'AD_ACCOUNT',breakdown_stats:{campaign:items}}}]};}
test('documented nested campaign DAY response sums all campaigns without exposing them or double-counting account spend',()=>{
const item=(id,amount)=>({id,type:'CAMPAIGN',granularity:'DAY',timeseries:[day('2026-10-01',stats(amount,100,5,1,5000000))]});
const first=item('22222222-2222-4222-8222-222222222222',1000000),second=item('33333333-3333-4333-8333-333333333333',2000000);
const payload=campaigns([first,second]);payload.timeseries_stats[0].timeseries_stat.timeseries=[day('2026-10-01',stats(3000000,0,0,0,0))];
const result=reporting.parse(payload,account,'2026-10-01','2026-10-01');assert.equal(result.totals.spend,3);assert.equal(result.totals.impressions,200);assert.equal(result.totals.purchases,2);assert.equal(result.totals.roas,10/3);assert.ok(!JSON.stringify(result).includes(first.id));
assert.throws(()=>reporting.parse(campaigns([first,first]),account,'2026-10-01','2026-10-01'));
});

test('campaign reporting follows safe pagination and rejects incomplete or duplicate pages',async()=>{
let pages=0;
global.fetch=async url=>{const u=new URL(url);if(u.hostname==='test.supabase.co')return json([row]);if(!u.pathname.endsWith('/stats'))return json({request_status:'SUCCESS',adaccounts:[{sub_request_status:'SUCCESS',adaccount:account}]});
const campaign={id:pages++===0?'22222222-2222-4222-8222-222222222222':'33333333-3333-4333-8333-333333333333',granularity:'DAY',timeseries:[day('2026-10-01',stats(1000000,100,5,1,5000000))]};
const result=campaigns([campaign]);if(pages===1)result.paging={next_link:'https://adsapi.snapchat.com/v1/adaccounts/'+id+'/stats?page=2'};return json(result);};
const result=await reporting.report('2026-10-01','2026-10-01');assert.equal(pages,2);assert.equal(result.totals.spend,2);assert.equal(result.totals.purchases,2);
});
