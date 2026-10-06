// VPS runtime for the same handlers used by Vercel Functions.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');
const publicDir = path.join(__dirname, 'public');
const aliases = { '/':'dashboard.html', '/dashboard':'dashboard.html', '/video-shop-admin':'admin.html', '/protection-admin':'protection-admin.html' };
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.webp':'image/webp', '.mp4':'video/mp4', '.txt':'text/plain; charset=utf-8' };
const handlers = Object.fromEntries(fs.readdirSync(path.join(__dirname,'api')).filter(f=>f.endsWith('.js')).map(f=>[f.slice(0,-3),require(`./api/${f}`)]));
function reject(res, status, message) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({ok:false,error:message})); }
const server = http.createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  try {
    const url = new URL(req.url,'http://localhost');
    req.query = Object.fromEntries(url.searchParams);
    if(url.pathname.startsWith('/api/')) {
      const handler = handlers[url.pathname.slice(5)];
      if(!handler)return reject(res,404,'Not found');
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>512*1024)return reject(res,413,'Payload too large');chunks.push(chunk);}
      if(chunks.length){try{req.body=JSON.parse(Buffer.concat(chunks).toString());}catch{return reject(res,400,'Invalid JSON');}}
      return await handler(req,res);
    }
    if(!['GET','HEAD'].includes(req.method))return reject(res,405,'Method not allowed');
    const file=path.resolve(publicDir, aliases[url.pathname]||'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(publicDir+path.sep))return reject(res,404,'Not found');
    const stat=await fs.promises.stat(file).catch(()=>null);
    if(!stat?.isFile())return reject(res,404,'Not found');
    let start=0,end=stat.size-1;
    if(req.headers.range){
      const match=String(req.headers.range).match(/^bytes=(\d+)-(\d*)$/);
      if(!match)return reject(res,416,'Invalid range');
      start=Number(match[1]);end=match[2]?Number(match[2]):end;
      if(start>end||end>=stat.size)return reject(res,416,'Invalid range');
      res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);
    }
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',end-start+1);
    res.setHeader('Cache-Control',path.extname(file)==='.html'?'no-cache':'public, max-age=300');
    if(req.method==='HEAD')return res.end();
    pipeline(fs.createReadStream(file,{start,end}),res,()=>{});
  } catch { if(!res.headersSent)reject(res,500,'Internal server error');else res.destroy(); }
});
if(require.main===module)server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Link dashboard listening on port ${process.env.PORT||3000}`));
module.exports=server;
