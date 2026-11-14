// Local review server. Never deploy this server; it only serves synthetic fixtures.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const fixture=require('../tests/fixtures/service-monitor'),insights=require('../tests/fixtures/service-insights');
const root=path.resolve(__dirname,'..'),base='97ac65bb12fb28c612d78b6f8202acbdd95d9dfd';
const saved=new Map();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){
  res.setHeader('Content-Type',types['.html']);res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>معاينة خدمة العملاء</title><style>body{background:#0e111a;color:#f0edf6;font:18px system-ui;max-width:850px;margin:70px auto;padding:24px;line-height:2}a{color:#c5a0ff;display:block;margin:20px 0;padding:20px;border:1px solid #303446;border-radius:12px}small{color:#adb0c2}</style><h1>خدمة العملاء · قبل وبعد</h1><p>معاينة محلية ببيانات وهمية فقط. لا يوجد اتصال بسلة أو واتساب أو OpenAI.</p><a href="/before/dashboard#staffsales">قبل التحسين ←</a><a href="/after/dashboard#staffsales">بعد التحسين ←</a><small>جرّب الفلاتر، التنقل بين المحادثات، تحليل الرحلة والانتقال للرسالة المرجعية. المحادثة #3 تعرض مطابقة ملتبسة و#4 تعذّر بيانات سلة.</small></html>');return;
 }
 const before=url.pathname.startsWith('/before/'),prefix=before?'/before':'/after',pathname=url.pathname.replace(/^\/(before|after)/,'');
 if(pathname.startsWith('/api/')){
  const resource=url.searchParams.get('resource'),id=url.searchParams.get('conversation');
  let data;
  if(resource==='auth')data=url.searchParams.get('action')==='config'?{ok:true,mode:'supabase'}:{ok:true,user:{email:'manager@example.test'}};
  else if(resource==='staff-sales')data=fixture.sales;
  else if(resource==='service-monitor'&&req.method==='POST'){
   await new Promise(resolve=>setTimeout(resolve,1000));saved.set(id,fixture.analysis);data={ok:true,analysis:fixture.analysis};
  }else if(resource==='service-monitor'&&url.searchParams.get('view')==='insights'){try{data=insights.report(Object.fromEntries(url.searchParams));}catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:error.message}));return;}}
  else if(resource==='service-monitor'&&id){data=insights.journey(id);data.outcome=insights.report().conversations.find(c=>c.id===id)?.outcome;if(saved.has(id))data.analysis={...data.analysis,analysis:saved.get(id),state:'complete'};await new Promise(resolve=>setTimeout(resolve,350));}
  else if(resource==='service-monitor')data={...fixture.overview,today:{...fixture.overview.today,contacts:18},month:{...fixture.overview.month,contacts:18}};
  else{res.writeHead(404);res.end('{"ok":false,"error":"مسار خارج نطاق المعاينة"}');return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
 }
 let file=pathname==='/dashboard'?'dashboard.html':pathname.slice(1);
 const full=path.resolve(root,'public',file);
 if(!full.startsWith(path.join(root,'public')+path.sep)){res.writeHead(404).end();return;}
 try{
  let data=before?execFileSync('git',['show',base+':public/'+file],{cwd:root,stdio:['ignore','pipe','ignore']}):fs.readFileSync(full);
  if(/\.(html|js)$/.test(file))data=data.toString().replaceAll('src="/','src="'+prefix+'/').replaceAll('href="/','href="'+prefix+'/').replaceAll("'/api/","'"+prefix+"/api/").replaceAll('`/api/','`'+prefix+'/api/');
  res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.setHeader('Cache-Control','no-store');res.end(data);
 }catch{res.writeHead(404).end();}
});
if(require.main===module)server.listen(Number(process.env.PORT||3100),'127.0.0.1',()=>console.log('Synthetic before/after preview: http://127.0.0.1:'+(process.env.PORT||3100)));
module.exports=server;
