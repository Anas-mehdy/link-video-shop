const {chromium}=require("playwright");
const fs=require("fs");
const url=process.env.PREVIEW_URL||"http://127.0.0.1:8765/protection-lab/";
(async()=>{
  const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader"]});
  const errors=[];
  fs.mkdirSync("prototype/web/screenshots",{recursive:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
    const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});
    try{await page.locator("#loading.hidden").waitFor({timeout:30000})}
    catch(e){errors.push("Model load timeout: "+await page.locator("#loading").textContent())}
    await page.screenshot({path:"prototype/web/screenshots/before.png",fullPage:true,timeout:15000});
    await page.locator("#case-toggle").click({timeout:10000});
    await page.waitForTimeout(1800);
    await page.screenshot({path:"prototype/web/screenshots/after.png",fullPage:true,timeout:15000});
    const result={url,status:response.status(),title:await page.title(),selected:await page.locator("#case-toggle").getAttribute("aria-pressed"),count:await page.locator("#count").textContent(),canvas:await page.locator("#scene canvas").count(),errors};
    fs.writeFileSync("prototype/web/screenshots/verification.json",JSON.stringify(result,null,2));
    console.log(result);
    if(result.selected!=="true"||result.count!=="2"||errors.length)process.exitCode=1;
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
