const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.LINK_PLAYWRIGHT_MODULE||'playwright');
const server=require('../scripts/service-monitor-preview'),fixture=require('./fixtures/service-insights');
const out=path.resolve(__dirname,'../artifacts/service-insights');fs.mkdirSync(out,{recursive:true});
const show=(p,s)=>p.locator(s).first().waitFor({state:'visible'});
test('saved insights lead to supporting cases without losing the review workspace',async t=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 let reportRequests=0,analysisRequests=0;
 page.on('request',r=>{if(r.url().includes('view=insights'))reportRequests++;if(r.method()==='POST'&&r.url().includes('action=analyze'))analysisRequests++;assert.ok(!/api\.openai\.com|api\.salla\./.test(r.url()));});
 const go=async()=>{await page.goto(origin+'/after/dashboard?qa='+Date.now()+'#staffsales');await show(page,'.service-case');};
 const open=async()=>{if(!await page.locator('#service-insights').evaluate(el=>el.open))await page.locator('#service-insights>summary').click();await show(page,'.service-coverage');};
 try{
  await t.test('loads local aggregation only on request; separates topics, barriers and order facts',async()=>{
   await go();assert.equal(reportRequests,0);await open();assert.equal(reportRequests,1);
   assert.match(await page.locator('.service-coverage').textContent(),/56%/);
   assert.equal(await page.locator('.service-improvements>li').count(),3);
   assert.match(await page.locator('.service-improvements>li').first().textContent(),/المقاسات المتوافقة/);
   assert.equal(await page.locator('[data-insight-group="outcomes:tracked"] span').textContent(),'1');
   assert.equal(await page.locator('[data-insight-group="outcomes:phone_after"] span').textContent(),'3');
   await page.locator('.service-insight-details').first().locator('summary').click();
   await page.locator('.service-insight-details').last().locator('summary').click();
   assert.equal(await page.locator('[data-insight-group="topics:price"] span').textContent(),'1');
   assert.equal(await page.locator('[data-insight-group="barriers:price_objection"]').count(),0);
   await page.evaluate(()=>{scrollTo(0,0);document.activeElement?.blur();});await page.screenshot({path:out+'/insights-desktop.png',fullPage:true});
   await page.locator('.service-insight-details').first().locator('summary').click();await page.locator('.service-insight-details').last().locator('summary').click();
   await page.locator('#service-insights').screenshot({path:out+'/insights-summary-desktop.png'});
  });
  await t.test('supporting list restores the original filter and scroll; stable evidence opens the correct message',async()=>{
   await page.locator('#service-insights>summary').click();await page.locator('[data-service-filter="review"]').click();
   await page.locator('.service-case-list').evaluate(el=>{el.scrollTop=75;});
   const position=await page.locator('.service-case-list').evaluate(el=>el.scrollTop);
   await open();await page.locator('[data-insight-group="improvements:fit_unclear"]').click();
   assert.equal(await page.locator('.service-case:visible').count(),3);assert.equal(await page.locator('.service-review .service-count').textContent(),'3');assert.equal(await page.locator('[data-service-filter="all"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-service-conversation="2"]').click();await show(page,'.service-timeline');
   assert.match(await page.locator('.service-outcome-note h4').textContent(),/بتطابق الهاتف/);
   await page.locator('.service-saved-evidence [data-service-evidence-id="2-101"]').click();
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.serviceMessageId),'2-101');
   await page.screenshot({path:out+'/supporting-journey-desktop.png',fullPage:true});
   await page.locator('[data-service-back]').click();await page.locator('[data-service-restore]').click();
   assert.equal(await page.locator('[data-service-filter="review"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.service-case-list').evaluate(el=>el.scrollTop),position);
   assert.equal(await page.locator('.service-case:visible').count(),4);
  });
  await t.test('old analyses are visible without guessed categories, auto-analysis or invalid reference jumps',async()=>{
   await open();await page.locator('[data-insight-group="coverage:legacy"]').click();
   assert.equal(await page.locator('.service-case:visible').count(),2);
   await page.locator('[data-service-conversation="11"]').click();await show(page,'.service-timeline');
   assert.match(await page.locator('.service-saved-evidence').textContent(),/لا ننسب أرقام رسائله القديمة/);
   assert.equal(await page.locator('[data-service-evidence-id]').count(),0);
   assert.equal(analysisRequests,0);await page.locator('[data-service-back]').click();await page.locator('[data-service-restore]').click();
  });
  await t.test('missing archived evidence is reported rather than scrolling to the wrong numbered message',async()=>{
   await open();await page.locator('[data-insight-group="improvements:fit_unclear"]').click();
   await page.route('**/*conversation=2',route=>{const d=fixture.journey('2');d.messages=d.messages.slice(1);return route.fulfill({json:d});});
   await page.locator('[data-service-conversation="2"]').click();await show(page,'.service-timeline');
   await page.locator('.service-saved-evidence [data-service-evidence-id="2-101"]').click();
   assert.match(await page.locator('.service-saved-evidence .service-evidence-status').textContent(),/غير موجودة/);
   assert.equal(await page.locator('.service-evidence-selected').count(),0);
   await page.unroute('**/*conversation=2');await page.locator('[data-service-back]').click();await page.locator('[data-service-restore]').click();
  });
  await t.test('chosen period changes coverage; empty ranges have no invented percentage',async()=>{
   await open();await page.locator('#service-insights-from').fill('2026-11-13');await page.locator('#service-insights-to').fill('2026-11-13');
   await page.locator('.service-insights-period button').click();await show(page,'.service-insight-empty');
   assert.match(await page.locator('.service-coverage').textContent(),/النسبة غير معروفة/);
   assert.ok(!(await page.locator('#service-insights-result').textContent()).includes('NaN'));
   await page.locator('#service-insights-from').fill('2026-11-14');await page.locator('#service-insights-to').fill('2026-11-14');
   await page.locator('.service-insights-period button').click();await show(page,'.service-improvements');
  });
  await t.test('report errors recover and provider outages remain unknown',async()=>{
   await page.route('**/*view=insights*',route=>route.fulfill({status:503,json:{ok:false,error:'تعذر تحميل السجل المحلي'}}));
   await page.locator('.service-insights-period button').click();await show(page,'[data-insights-retry]');
   assert.equal(await page.locator('.service-case').count(),18);await page.unroute('**/*view=insights*');
   await page.locator('[data-insights-retry]').click();await show(page,'.service-coverage');
   await page.route('**/*view=insights*',route=>{const d=fixture.report();d.store_unavailable=true;return route.fulfill({json:d});});
   await page.locator('.service-insights-period button').click();await show(page,'.service-coverage');
   assert.match(await page.locator('#service-insights-result').textContent(),/بيانات سلة المحلية/);
   assert.match(await page.locator('.service-outcomes').textContent(),/الطلبات غير مؤكدة/);await page.unroute('**/*view=insights*');
  });
  await t.test('mobile supports category → case → evidence → browser back → original filtered list',async()=>{
   await page.setViewportSize({width:390,height:844});await go();await page.locator('[data-service-filter="waiting"]').click();
   await open();await page.screenshot({path:out+'/insights-mobile.png',fullPage:true});
   for(const width of [360,390,768,1024,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);}
   await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
   await page.locator('.service-insight-details').last().locator('summary').click();
   await page.locator('[data-insight-group="outcomes:tracked"]').click();await page.locator('[data-service-conversation="1"]').click();await show(page,'.service-timeline');
   assert.equal(await page.locator('#service-journey').getAttribute('aria-modal'),'true');assert.equal((await page.locator('#service-journey').boundingBox()).y,0);
   await page.screenshot({path:out+'/supporting-journey-mobile.png'});
   await page.locator('.service-outcome-note [data-service-evidence-id]').first().click();assert.ok((await page.evaluate(()=>document.activeElement.dataset.serviceMessageId)).startsWith('1-'));
   await page.goBack();await show(page,'[data-service-restore]');assert.equal(await page.locator('.service-case:visible').count(),1);
   await page.locator('[data-service-restore]').click();assert.equal(await page.locator('[data-service-filter="waiting"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.service-case:visible').count(),8);assert.equal(analysisRequests,0);
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
