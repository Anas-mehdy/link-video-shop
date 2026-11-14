const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.LINK_PLAYWRIGHT_MODULE||'playwright');
const server=require('../scripts/service-monitor-preview'),fixture=require('./fixtures/service-insights');
const out=path.resolve(__dirname,'../artifacts/service-insights-simple');fs.mkdirSync(out,{recursive:true});
const show=(p,s)=>p.locator(s).first().waitFor({state:'visible'});
test('26 conversations and 3 legacy analyses explain the result and the next manual step',async t=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];let analyses=0;
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('action=analyze'))analyses++;assert.ok(!/api\.openai\.com|api\.salla\./.test(r.url()));});
 const go=async(mode='after')=>{await page.goto(origin+'/'+mode+'/dashboard?scenario=legacy&qa='+Date.now()+'#staffsales');await show(page,'.service-case');await page.locator('#service-insights>summary').click();await show(page,'.service-coverage');await page.evaluate(()=>document.fonts.ready);};
 try{
  await t.test('before and after use identical accounting inputs',async()=>{
   const data=fixture.legacyReport();assert.deepEqual([data.coverage.total,data.coverage.analyzed,data.coverage.legacy,data.coverage.classified,data.coverage.percent],[26,3,3,0,12]);
   assert.equal(data.improvements.length,0);assert.equal(data.outcomes.find(r=>r.code==='uncertain').count,26);
   await go('before');await page.locator('#service-insights').screenshot({path:out+'/before-desktop.png'});
   await page.setViewportSize({width:390,height:844});await page.locator('#service-insights').screenshot({path:out+'/before-mobile.png'});
   await page.setViewportSize({width:1440,height:1050});await go();
  });
  await t.test('two-line summary states 3 of 26 and offers one manual action',async()=>{
   assert.equal(await page.locator('.service-insights-overview>p').count(),2);
   assert.equal(await page.locator('.service-insights-overview strong').textContent(),'3 محادثات محلّلة من أصل 26، ولم تظهر أنماط قابلة للمراجعة بعد.');
   assert.match(await page.locator('.service-insights-overview>p').last().textContent(),/افتح محادثة غير محلّلة/);
   assert.equal(await page.locator('[data-insight-group="coverage:manual"]').count(),1);
   assert.equal(await page.locator('.service-improvements').count(),0);
   assert.equal(await page.locator('#service-insights .panel,#service-insights .metric').count(),0);
   const visible=await page.locator('#service-insights').innerText();
   assert.ok(!visible.includes('5,000'));assert.ok(!visible.includes('ذات تصنيف مرجعي'));assert.ok(!visible.includes('نسبة الجودة'));
   assert.equal(await page.locator('#service-insights-method').evaluate(el=>el.open),false);
   await page.locator('#service-insights').screenshot({path:out+'/after-desktop.png'});
  });
  await t.test('conversation and order counts have separate columns and unknown orders stay unknown',async()=>{
   const row=page.locator('[data-insight-group="outcomes:uncertain"]');
   assert.equal(await row.locator('.service-outcome-name').textContent(),'ما قدرنا نربطها بطلب');
   assert.equal(await row.locator('.service-outcome-conversations').textContent(),'26');
   assert.equal(await row.locator('.service-outcome-orders').textContent(),'غير معروف');
   assert.deepEqual(await page.locator('.service-outcome-head>span').allTextContents(),['نتيجة الرحلة','المحادثات','الطلبات']);
   assert.ok(!(await page.locator('#service-insights').innerText()).includes('نتيجة غير مؤكدة'));
   await page.locator('#service-insights-method>summary').click();
   assert.match(await page.locator('#service-insights-method').innerText(),/12%/);
   assert.match(await page.locator('#service-insights-method').innerText(),/لا تُوزّع بالتخمين/);
   await page.locator('#service-insights-method>summary').click();
  });
  await t.test('manual action opens 23 unanalysed conversations and restores the original list and filter',async()=>{
   await page.locator('#service-insights>summary').click();await page.locator('[data-service-filter="review"]').click();
   await page.locator('.service-case-list').evaluate(el=>{el.scrollTop=100;});const scroll=await page.locator('.service-case-list').evaluate(el=>el.scrollTop);
   await page.locator('#service-insights>summary').click();await page.locator('[data-insight-group="coverage:manual"]').click();
   assert.equal(await page.locator('.service-case:visible').count(),23);
   for(const id of ['1','2','3'])assert.equal(await page.locator('[data-service-conversation="'+id+'"]').count(),0);
   assert.match(await page.locator('.service-supporting').textContent(),/23 محادثات للتحليل اليدوي/);
   await page.locator('[data-service-conversation="4"]').click();await show(page,'.service-timeline');
   await page.locator('.service-ai>summary').click();assert.equal(await page.locator('#service-analyze').isEnabled(),true);assert.equal(analyses,0);
   await page.locator('[data-service-back]').click();await page.locator('[data-service-restore]').click();
   assert.equal(await page.locator('.service-case:visible').count(),26);
   assert.equal(await page.locator('[data-service-filter="review"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.service-case-list').evaluate(el=>el.scrollTop),scroll);
  });
  await t.test('mobile keeps summary and action visible, preserves browser back, and does not overflow',async()=>{
   await page.setViewportSize({width:390,height:844});await go();
   await page.locator('#service-insights').screenshot({path:out+'/after-mobile.png'});
   await page.locator('#service-insights').evaluate(el=>{el.scrollIntoView({block:'start'});scrollBy(0,-80);});await page.screenshot({path:out+'/mobile-first-look.png'});
   for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);}
   await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
   await page.locator('[data-insight-group="coverage:manual"]').click();await page.locator('[data-service-conversation="4"]').click();await show(page,'.service-timeline');
   assert.equal(await page.locator('#service-journey').getAttribute('aria-modal'),'true');
   await page.screenshot({path:out+'/manual-journey-mobile.png'});
   await page.goBack();await show(page,'[data-service-restore]');assert.equal(await page.locator('.service-case:visible').count(),23);
   await page.locator('[data-service-restore]').click();assert.equal(await page.locator('.service-case:visible').count(),26);assert.equal(analyses,0);
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
