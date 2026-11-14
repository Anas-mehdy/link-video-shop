// Synthetic browser QA. Set LINK_PLAYWRIGHT_MODULE to an installed Playwright package.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.LINK_PLAYWRIGHT_MODULE||'playwright');
const server=require('../scripts/service-monitor-preview'),fixture=require('./fixtures/service-monitor');
const out=path.resolve(__dirname,process.env.LINK_SERVICE_ARTIFACTS||'../artifacts/service-monitor');fs.mkdirSync(out,{recursive:true});
const shown=(page,selector)=>page.locator(selector).first().waitFor({state:'visible'});
test('customer service review on desktop and mobile',async t=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[],page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
 const go=async(mode='after')=>{await page.goto(origin+'/'+mode+'/dashboard?qa='+Date.now()+'#staffsales');await shown(page,'[data-service-conversation]');await page.evaluate(()=>document.fonts.ready);};
 try{
  await t.test('before screenshots use the unchanged baseline',async()=>{
   await go('before');await page.screenshot({path:out+'/before-desktop.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/before-mobile.png',fullPage:true});
  });
  await t.test('desktop summary, selection and filters',async()=>{
   await page.setViewportSize({width:1440,height:1050});await go();
   assert.deepEqual(await page.locator('.service-metrics strong').allTextContents(),['18','63','8']);
   await page.screenshot({path:out+'/after-desktop.png',fullPage:true});
   await page.locator('[data-service-filter="waiting"]').click();assert.equal(await page.locator('.service-case:visible').count(),8);
   await page.locator('[data-service-conversation="1"]').click();await shown(page,'.service-timeline');
   assert.equal(await page.locator('[data-service-filter="waiting"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-service-next]').click();await shown(page,'.service-timeline');assert.equal(await page.locator('#service-journey-title').textContent(),'محمد خالد');
   await page.locator('[data-service-prev]').click();await shown(page,'.service-timeline');
   await page.screenshot({path:out+'/after-desktop-journey.png',fullPage:true});
  });
  await t.test('one analysis request, case switching and evidence navigation',async()=>{
   let posts=0;page.on('request',req=>{if(req.method()==='POST'&&req.url().includes('action=analyze'))posts++;});
   await page.locator('.service-ai summary').click();
   await page.locator('#service-analyze').evaluate(button=>{button.click();button.click();});
   assert.equal(await page.locator('#service-analyze').isDisabled(),true);
   assert.match(await page.locator('#service-analysis-result').textContent(),/نراجع/);
   await page.locator('[data-service-next]').click();await shown(page,'.service-timeline');
   await page.locator('[data-service-prev]').click();await shown(page,'.service-timeline');
   await shown(page,'[data-journey-ref="5"]');assert.equal(posts,1);
   await page.locator('[data-journey-ref="5"]').click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'service-message-5');
   assert.equal(await page.locator('.service-evidence-selected').count(),1);
   await page.screenshot({path:out+'/after-desktop-evidence.png',fullPage:true});
   await page.locator('[data-service-back]').click();await shown(page,'.service-placeholder');
  });
  await t.test('mobile back preserves scroll and filter',async()=>{
   await page.setViewportSize({width:390,height:844});await go();
   await page.locator('[data-service-filter="review"]').click();
   await page.locator('.service-case-list').evaluate(el=>{el.scrollTop=100;});
   await page.locator('[data-service-conversation="10"]').scrollIntoViewIfNeeded();
   const scroll=await page.locator('.service-case-list').evaluate(el=>el.scrollTop),pageY=await page.evaluate(()=>scrollY);
   await page.locator('[data-service-conversation="10"]').click();await shown(page,'.service-timeline');
   assert.equal(await page.locator('#service-journey').getAttribute('aria-modal'),'true');
   assert.equal((await page.locator('#service-journey').boundingBox()).y,0);
   assert.equal(await page.locator('.service-queue').evaluate(el=>el.inert),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:out+'/after-mobile-journey.png',fullPage:false});
   await page.goBack();await shown(page,'[data-service-conversation="10"]');
   assert.equal(await page.locator('[data-service-filter="review"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('.service-case-list').evaluate(el=>el.scrollTop),scroll);
   assert.equal(await page.evaluate(()=>scrollY),pageY);
   assert.equal(await page.locator('.service-queue').evaluate(el=>el.inert),false);
   await page.locator('[data-service-conversation="10"]').click();await shown(page,'.service-timeline');
   await page.locator('[data-service-back]').click();await shown(page,'[data-service-conversation="10"]');
   await page.locator('[data-service-filter="all"]').click();await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:out+'/after-mobile.png',fullPage:true});
  });
  await t.test('ambiguous and missing Salla data is unknown',async()=>{
   await page.locator('[data-service-conversation="3"]').click();await shown(page,'.service-timeline');
   assert.match(await page.locator('.service-match').textContent(),/أكثر من عميل/);
   await page.locator('[data-service-next]').click();await shown(page,'.service-timeline');
   assert.match(await page.locator('.service-match').textContent(),/تعذّر تحميل بيانات سلة/);
   assert.match(await page.locator('.service-journey-body>.service-disclosure summary').textContent(),/البيانات غير متاحة/);
   await page.locator('[data-service-back]').click();await shown(page,'.service-case');
  });
  await t.test('empty, partial and disabled states',async()=>{
   let response={...fixture.overview,conversations:[],recorded_from:null,agent_configured:false,limited:true};
   await page.route('**/api/crm-admin?resource=service-monitor',route=>route.fulfill({json:response}));
   await page.goto(origin+'/after/dashboard?qa='+Date.now()+'#staffsales');await shown(page,'.service-summary');
   assert.deepEqual(await page.locator('.service-metrics strong').allTextContents(),['—','—','—']);
   assert.equal(await page.locator('#service-empty-filter').isVisible(),true);assert.match(await page.locator('.service-summary').textContent(),/بيانات جزئية/);
   response={ok:true,monitor_disabled:true};await page.reload();await page.locator('#content').getByText('بانتظار تسجيل المحادثات',{exact:true}).waitFor();
   await page.unroute('**/api/crm-admin?resource=service-monitor');
  });
  await t.test('late responses cannot replace selected journey',async()=>{
   await page.setViewportSize({width:1440,height:1050});await go();
   await page.route('**/*conversation=1',async route=>{await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({json:fixture.journey('1')});});
   await page.locator('[data-service-conversation="1"]').click();await page.locator('[data-service-conversation="2"]').click();
   await shown(page,'.service-timeline');await page.waitForTimeout(900);
   assert.equal(await page.locator('#service-journey-title').textContent(),'محمد خالد');
   assert.equal(await page.locator('[data-service-conversation="2"]').getAttribute('aria-pressed'),'true');await page.unroute('**/*conversation=1');
  });
  await t.test('journey and analysis errors recover without duplicate analysis',async()=>{
   await page.route('**/*conversation=3',route=>route.fulfill({status:503,json:{ok:false,error:'تعذر الاتصال'}}));
   await page.locator('[data-service-conversation="3"]').click();await shown(page,'[data-service-retry]');
   assert.match(await page.locator('.service-journey-content').textContent(),/قائمتك وفلترك محفوظان/);
   await page.unroute('**/*conversation=3');await page.locator('[data-service-retry]').click();await shown(page,'.service-timeline');
   await page.route('**/*action=analyze*',route=>route.fulfill({status:503,json:{ok:false,error:'تعذّر إكمال التحليل. لم تُعَد المحاولة تلقائيًا.'}}));
   await page.locator('.service-ai summary').click();await page.locator('#service-analyze').click();await shown(page,'[data-service-retry]');
   assert.equal(await page.locator('#service-analyze').count(),0);assert.match(await page.locator('#service-analysis-result').textContent(),/التحقق من الحالة/);
   await page.unroute('**/*action=analyze*');
  });
  await t.test('responsive widths, reduced motion and keyboard',async()=>{
   await go();for(const width of [360,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);
   }
   await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
   await page.locator('[data-service-conversation="2"]').click();await shown(page,'.service-timeline');
   await page.locator('.service-ai summary').click();await page.locator('#service-analyze').focus();await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-service-back')),true);
   await page.keyboard.press('Escape');await shown(page,'.service-case');
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.serviceConversation),'2');
  });
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
