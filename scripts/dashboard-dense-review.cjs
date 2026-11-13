// Run against npm start. Only explicit local static assets reach the server.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const f=require('../tests/fixtures/dashboard-review/data.cjs');
const out=process.env.REVIEW_OUTPUT||'/workspace/link-ui-review/dense';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],headless:true});
 const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[],requests=[],blocked=[],audits=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin!=='http://127.0.0.1:3000'){blocked.push(u.origin);return route.abort();}
  if(!u.pathname.startsWith('/api/')){
   if(u.pathname==='/dashboard'||/^\/dashboard(?:-[a-z-]+)?\.(js|css)$/.test(u.pathname))return route.continue();
   return route.abort();
  }
  const resource=u.searchParams.get('resource');const body=req.postDataJSON()||{};requests.push({resource,path:u.pathname,method:req.method(),body,query:u.search});
  let data;
  const paginate=(rows)=>{const search=u.searchParams.get('search');const n=Number(u.searchParams.get('page')||1);const filtered=search?rows.filter(r=>JSON.stringify(r).includes(search)):rows;return {records:filtered.slice((n-1)*25,n*25),page:n,has_more:n*25<filtered.length};};
  switch(resource){
   case 'auth':data={mode:'legacy'};break;
   case 'overview':data={unavailable:[],data:{orders:98765,customers:76543,carts:12345,products:4321,videos:420,rules:[],connections:[{provider:'salla',status:'connected'}],events:[]}};break;
   case 'orders':data=paginate(f.orders);break;
   case 'customers':data=paginate(f.customers);break;
   case 'rules':data={rules:[]};break;
   case 'cart-human':if(body.id){const r=f.human.queue.find(r=>r.id===body.id);if(r)r.feedback={...body,updated_at:f.time};}data=f.human;break;
   case 'whatsapp-delivery':if(req.method()==='PUT')Object.assign(f.delivery.configuration,body);data=f.delivery;break;
   case 'whatsapp-second':if(req.method()==='PUT')Object.assign(f.second.configuration,body);data=f.second;break;
   case 'cart-followup':data=f.followup;break;
   case 'coupon-replies':if(req.method()==='PUT')Object.assign(f.coupons.configuration,body);data=f.coupons;break;
   case 'postpurchase':
    if(body.action==='delivery-state')data=f.ppDelivery;
    else if(body.action==='eligibility-review')data=f.eligibility;
    else {if(body.action==='settings')Object.assign(f.pp.settings,body);data=f.pp;}break;
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
 async function shot(id){const anchor={'preorder-editor':'#preorder-form','preorder-receipt':'#preorder-receipt','postpurchase-settings':'#pp-settings','postpurchase-product':'#pp-product','automation-settings':'#delivery-form','ads-daily':'.ads-chart-svg'}[id];if(anchor){await page.locator(anchor).first().evaluate(el=>{el.scrollIntoView({behavior:'instant',block:'start'});window.scrollBy(0,-90);});await page.waitForTimeout(100);}await page.screenshot({path:path.join(out,`${id}-${page.viewportSize().width}.png`),fullPage:!/(editor|receipt|settings|product|feedback|daily|scrolled)/.test(id),timeout:90000});}
 async function fit(id){if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)){console.log(await page.evaluate(()=>[...document.querySelectorAll('#content *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1||el.getBoundingClientRect().left< -1).slice(0,14).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,70),w:el.getBoundingClientRect().width}))));await shot('overflow-'+id);}assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow: ${id}`);}
 async function openAncestor(selector){await page.locator(selector).first().evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
 async function save(form){const waiting=page.waitForRequest(r=>r.url().includes('/api/')&&['PUT','POST','PATCH'].includes(r.method()));await page.locator(form+' button[type=submit], '+form+' button.primary').first().click();await waiting;await page.waitForTimeout(200);}
 for(const width of (process.env.REVIEW_WIDTHS||'1440,390').split(',').map(Number)){
  await page.setViewportSize({width,height:1000});
  for(const id of (process.env.REVIEW_ONLY?process.env.REVIEW_ONLY.split(','):['orders','customers','automations','postpurchase','coupons','ads','preorders'])){
   console.log('review',width,id);await go(id);await fit(id);if(process.env.REVIEW_AXE&&width===390){const Axe=require(process.env.AXE_MODULE||'@axe-core/playwright').default;const a=await new Axe({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();audits.push({id,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});}
   // Keep the first several rows legible; full-page image retained as evidence.
   await shot(id);await page.screenshot({path:path.join(out,`${id}-${width}-viewport.png`),timeout:90000});
   const detail={automations:'#delivery-form',postpurchase:'#pp-eligibility-status',coupons:'#coupon-settings',ads:'.ads-metrics',preorders:'#preorder-filter'}[id];
   if(detail){await page.locator(detail).first().waitFor({state:'attached'});await page.locator(detail).first().evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-90));await page.screenshot({path:path.join(out,`${id}-${width}-detail.png`)});}
   const wraps=page.locator('.table-wrap');for(let i=0;i<await wraps.count();i++){const w=wraps.nth(i);if(await w.isVisible())assert.ok(await w.evaluate(el=>el.scrollWidth>=el.clientWidth));}
  }
  if(!process.env.REVIEW_ONLY||process.env.REVIEW_ONLY.split(',').includes('automations')){
   await page.goto('http://127.0.0.1:3000/dashboard#carthuman');
   await page.waitForFunction(()=>location.hash==='#automations'&&document.querySelector('#content')?.getAttribute('aria-busy')==='false');
   assert.equal(await page.locator('#nav [data-page=carthuman]').count(),0);
   assert.ok(!requests.some(r=>r.resource==='cart-human'));
  }
  if(process.env.REVIEW_ONLY)continue;
  await go('customers');await page.locator('#search-term').fill('example.test');await page.locator('#records-search button[type=submit]').click();await page.waitForTimeout(150);await page.locator('#records-next').click();await page.waitForFunction(()=>document.querySelector('.records-pagination')?.textContent.includes('2'));await page.locator('#clear-search').click();
  if(width===390){await go('orders');const table=page.locator('.table-wrap').first();await table.evaluate(el=>el.scrollLeft=-300);assert.ok(await table.evaluate(el=>el.scrollLeft<0));await table.scrollIntoViewIfNeeded();await shot('orders-scrolled');}

  await go('orders');await page.locator('#records-next').click();await page.waitForFunction(()=>document.querySelector('.records-pagination')?.textContent.includes('2'));await go('customers');await go('orders');assert.match(await page.locator('.records-pagination').textContent(),/2/);
  await page.locator('#search-term').fill('TEST-LINK-2026-10040');await page.locator('#records-search button[type=submit]').click();await page.waitForTimeout(100);assert.equal(await page.locator('tbody tr').count(),1);await page.locator('#clear-search').click();await page.waitForTimeout(100);
  await go('automations');await page.locator('#delivery-delay').fill('100');await save('#delivery-form');assert.equal(f.delivery.configuration.delay_minutes,100);assert.equal(await page.locator('#delivery-form').isVisible(),true);assert.equal(await page.locator('#second-form').isVisible(),true);await shot('automation-settings');
  await go('postpurchase');assert.equal(await page.locator('#pp-settings').isVisible(),true);await openAncestor('#pp-settings');await page.locator('#pp-settings [name=delay_days]').fill('9');await shot('postpurchase-settings');await save('#pp-settings');assert.equal(f.pp.settings.delay_days,9);await page.locator('#pp-manual').evaluate(el=>el.open=false);await page.locator('#pp-manual > summary').click();await page.locator('[data-pp-edit]').first().click();await page.locator('#pp-product [name=name]').scrollIntoViewIfNeeded();await shot('postpurchase-product');
  await go('coupons');await page.locator('#coupon-message').fill('رسالة اختبار كثيفة محفوظة محليًا فقط؛ لا تُرسل إلى أي عميل.');await save('#coupon-settings');assert.match(f.coupons.configuration.message,/محليًا/);
  await go('ads');await page.locator('#ads-preset').selectOption('last30');await page.locator('#ads-filters button[type=submit]').click();await page.waitForTimeout(150);await page.locator('[data-ads-chart=roas]').click();await page.waitForTimeout(100);await page.locator('summary').filter({hasText:'التفصيل اليومي'}).click();await shot('ads-daily');
  await go('preorders');await page.locator('[data-po-edit]').first().click();await shot('preorder-editor');await page.locator('#preorder-close-form').click();assert.equal(await page.locator('#preorder-form').count(),0);await page.locator('[data-po-edit]').first().click();await page.locator('#po-name').fill('دفعة اختبار معدّلة — الحماية الكاملة والإطار البرغندي');await save('#preorder-form');assert.match(f.preorders.batches[0].name,/معدّلة/);
  await page.locator('[data-po-receive]').first().click();await shot('preorder-receipt');await page.locator('#po-receipt-cancel').click();assert.equal(await page.locator('#preorder-receipt').count(),0);await page.locator('#preorder-filter').selectOption('');await page.waitForTimeout(200);await page.locator('#preorder-next').click();await page.waitForTimeout(150);await page.locator('#preorder-filter').selectOption('batch-1');await page.waitForTimeout(150);await fit('preorder-filtered');assert.equal(await page.locator('tbody tr').count(),15);
 }
 assert.deepEqual(errors,[]);assert.equal(requests.some(r=>['sync','send','test-send','import','stock-check'].includes(r.body.action)),false);
 fs.writeFileSync(path.join(out,process.env.REVIEW_ONLY?'results-layout.json':'results.json'),JSON.stringify({audits,errors,blocked:[...new Set(blocked)],requests:requests.length,mutations:requests.filter(r=>r.method!=='GET'),viewports:[390,1440]},null,2));
 console.log('PASS dense workflows; '+requests.length+' mocked requests; external destinations blocked:',[...new Set(blocked)]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
