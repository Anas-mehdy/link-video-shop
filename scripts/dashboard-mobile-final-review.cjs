// Run against npm start. Only explicit local static assets reach the server.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const f=require('../tests/fixtures/dashboard-review/data.cjs');
f.preorders.reservations[0].quantity=3;f.preorders.reservations[0].allocated_quantity=2;f.preorders.order_plans['TEST-ORDER-0']={hold_full_order:true,schedule_delayed:true};
const out=process.env.REVIEW_OUTPUT||'/workspace/link-ui-review/final-mobile';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],headless:true});
 const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[],requests=[],blocked=[],audits=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin!=='http://127.0.0.1:3000'){blocked.push(u.origin);return route.abort();}
  if(!u.pathname.startsWith('/api/')){
   if(u.pathname==='/dashboard'||/^\/dashboard(?:-[a-z-]+)?\.(js|css)$/.test(u.pathname)){if(process.env.REVIEW_PHASE==='before'){const file=u.pathname==='/dashboard'?'dashboard.html':u.pathname.slice(1);return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript',body:require('node:child_process').execFileSync('git',['show',`${process.env.REVIEW_BASE_REF||'d8474c1'}:public/${file}`],{cwd:path.resolve(__dirname,'..')})});}return route.continue();}
   return route.abort();
  }
  const resource=u.searchParams.get('resource');const body=req.postDataJSON()||{};requests.push({resource,path:u.pathname,method:req.method(),body,query:u.search});
  let data;
  const paginate=(rows)=>{const search=u.searchParams.get('search');const n=Number(u.searchParams.get('page')||1);const filtered=search?rows.filter(r=>JSON.stringify(r).includes(search)):rows;return {records:filtered.slice((n-1)*25,n*25),page:n,has_more:n*25<filtered.length};};
  switch(resource){
   case 'auth':data={mode:'legacy'};break;
   case 'overview':data={unavailable:[],data:{orders:98765,customers:76543,carts:12345,products:4321,videos:420,rules:[],connections:[{provider:'salla',status:'connected'}],events:[]}};break;
   case 'preorders':{
    if(body.action==='save'){const batch=f.preorders.batches.find(b=>b.id===body.id);if(batch)Object.assign(batch,body);}
    const n=Number(u.searchParams.get('page')||1),id=u.searchParams.get('batch_id');const rows=f.preorders.reservations.filter(r=>!id||r.batch_id===id);
    data={...f.preorders,reservations:rows.slice((n-1)*25,n*25),page:n,has_more:n*25<rows.length};break;
   }
   case 'tiktok':data=f.ads(u);break;
   default:if(u.pathname==='/api/snapchat-connect')data=f.ads(u);else throw new Error('Unhandled mock request '+req.url());
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,...data})});
 });
 await page.addInitScript(()=>sessionStorage.setItem('lvs_admin','synthetic-local-test'));
 async function go(id){await page.goto('http://127.0.0.1:3000/dashboard#'+id);await page.waitForFunction(id=>document.querySelector('#nav [aria-current=page]')?.dataset.page===id,id);await page.locator('#content[aria-busy=false]').waitFor();assert.equal(await page.locator('#retry-page').count(),0,`Rendering failed: ${id}`);await page.waitForTimeout(120);}
 async function shot(id){const anchor={'preorder-editor':'#preorder-form','preorder-receipt':'#preorder-receipt','postpurchase-settings':'#pp-settings','postpurchase-product':'#pp-product','automation-settings':'#delivery-form','carthuman-feedback':'[data-human-feedback]','ads-daily':'.ads-chart-svg'}[id];if(anchor){await page.locator(anchor).first().evaluate(el=>{el.scrollIntoView({behavior:'instant',block:'start'});window.scrollBy(0,-90);});await page.waitForTimeout(100);}await page.screenshot({path:path.join(out,`${id}-${page.viewportSize().width}.png`),fullPage:!/(editor|receipt|settings|product|feedback|daily|scrolled)/.test(id),timeout:90000});}
 async function fit(id){if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)){console.log(await page.evaluate(()=>[...document.querySelectorAll('#content *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1||el.getBoundingClientRect().left< -1).slice(0,14).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,70),w:el.getBoundingClientRect().width}))));await shot('overflow-'+id);}assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow: ${id}`);}
 async function openAncestor(selector){await page.locator(selector).first().evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
 async function save(form){const waiting=page.waitForRequest(r=>r.url().includes('/api/')&&['PUT','POST','PATCH'].includes(r.method()));await page.locator(form+' button[type=submit], '+form+' button.primary').first().click();await waiting;await page.waitForTimeout(200);}
 const phase=process.env.REVIEW_PHASE||'before';const positions=[];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  await go('ads');positions.push({width,metricsTop:await page.locator('.ads-metrics').evaluate(el=>el.getBoundingClientRect().top+scrollY)});await page.screenshot({path:path.join(out,`${phase}-ads-${width}.png`)});
  await go('preorders');await page.locator('#preorder-filter').evaluate(el=>{window.scrollTo(0,el.closest('.panel').getBoundingClientRect().top+scrollY-90)});await page.screenshot({path:path.join(out,`${phase}-preorders-${width}.png`)});
 }
 fs.writeFileSync(path.join(out,`${phase}-positions.json`),JSON.stringify(positions));
 if(phase==='after'&&!process.env.REVIEW_CAPTURE_ONLY){
  const reportRequests=()=>requests.filter(r=>r.query.includes('action=report'));
  const checks=[];
  for(const width of [360,390,430]){
   await page.setViewportSize({width,height:1000});await go('preorders');
   assert.equal(await page.locator('.reservation-desktop-table').isVisible(),false);
   const card=page.locator('.reservation-card').first();
   assert.match(await card.locator('.reservation-quantity').textContent(),/2 من 3/);
   assert.match(await card.locator('.reservation-alert').allTextContents().then(x=>x.join(' ')),/الحجوزات لم تجهز/);
   await card.locator('summary').first().focus();await page.keyboard.press('Enter');assert.equal(await card.locator('details').first().getAttribute('open'),'');if(width===390){await card.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-90));await page.screenshot({path:path.join(out,'after-details-390.png')});}
   await fit('reservation-details-'+width);await page.keyboard.press('Space');assert.equal(await card.locator('details').first().getAttribute('open'),null);
   assert.equal(await page.locator('#preorder-filter').inputValue(),'');
   await page.locator('#preorder-next').click();await page.waitForFunction(()=>document.querySelector('#preorder-prev')?.disabled===false);
   const beforeOpen=requests.length;const nextCard=page.locator('.reservation-card').first();await nextCard.locator('summary').first().click();await nextCard.locator('summary').first().click();assert.equal(requests.length,beforeOpen);assert.equal(await page.locator('#preorder-prev').isEnabled(),true);
   await page.locator('#preorder-filter').selectOption('batch-1');await page.waitForTimeout(150);const selected=await page.locator('#preorder-filter').inputValue();await page.locator('.reservation-card summary').first().click();await fit('filtered-detail-'+width);await page.locator('.reservation-card summary').first().click();assert.equal(await page.locator('#preorder-filter').inputValue(),selected);await page.locator('#preorder-filter').selectOption('');await page.waitForTimeout(150);
   await go('ads');
   const preset=page.locator('#ads-preset'),from=page.locator('#ads-from'),to=page.locator('#ads-to');
   const beforeToggle=reportRequests().length;await preset.selectOption('custom');assert.equal(await from.isVisible(),true);assert.equal(reportRequests().length,beforeToggle);
   await from.fill('2026-10-20');await to.fill('2026-10-01');await page.locator('#ads-filters button').click();assert.equal(await page.locator('#ads-filter-error').isVisible(),true);assert.equal(reportRequests().length,beforeToggle);
   await preset.selectOption('last30');assert.equal(await from.isVisible(),false);assert.equal(await from.isDisabled(),true);assert.equal(reportRequests().length,beforeToggle);
   const expected=await page.evaluate(()=>{const to=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const start=new Date(to+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-29);return {from:start.toISOString().slice(0,10),to};});
   assert.equal(await from.inputValue(),expected.from);assert.equal(await to.inputValue(),expected.to);
   // Clear report cache only in the harness to inspect a fresh request at every width.
   await page.evaluate(()=>window.LinkAds.invalidate());const request=page.waitForRequest(r=>r.url().includes('action=report'));await page.locator('#ads-filters button').click();const sent=new URL((await request).url());assert.equal(sent.searchParams.get('from'),expected.from);assert.equal(sent.searchParams.get('to'),expected.to);await page.locator('#content[aria-busy=false]').waitFor();
   await preset.selectOption('custom');await from.fill('2099-01-01');await to.fill('');await preset.selectOption('today');assert.equal(await from.isDisabled(),true);assert.equal(await to.inputValue(),expected.to);await page.evaluate(()=>window.LinkAds.invalidate());const todayRequest=page.waitForRequest(r=>r.url().includes('action=report'));await page.locator('#ads-filters button').click();const todaySent=new URL((await todayRequest).url());assert.equal(todaySent.searchParams.get('from'),expected.to);assert.equal(todaySent.searchParams.get('to'),expected.to);await page.locator('#content[aria-busy=false]').waitFor();await fit('ads-'+width);
   checks.push({width,cards:true,keyboard:true,filterAndPageRetained:true,dateRangeRequests:true});
  }
  await page.setViewportSize({width:1440,height:1000});await go('ads');assert.equal(await page.locator('#ads-from').isVisible(),true);assert.equal(await page.locator('#ads-from').isDisabled(),false);await go('preorders');assert.equal(await page.locator('.reservation-desktop-table').isVisible(),true);assert.equal(await page.locator('.reservation-mobile-list').isVisible(),false);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors,blocked:[...new Set(blocked)],requests:requests.length},null,2));console.log('PASS',JSON.stringify(checks));
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
