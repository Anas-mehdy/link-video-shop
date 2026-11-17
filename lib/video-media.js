const { randomUUID } = require('node:crypto');
const BUCKET='video-shop-media', MAX_BYTES=50*1024*1024;
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
function validPath(path,merchant){return typeof path==='string' && new RegExp('^'+merchant+'/[0-9a-f-]{36}\\.(mp4|webm|jpg|webp)$').test(path);}
async function storage(path,options={}){
  const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key)throw fail(503,'إعداد تخزين الفيديو غير مكتمل');
  const r=await fetch(base+'/storage/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw fail(502,'تعذر الوصول لتخزين الفيديو. تأكد من تهيئة Supabase Storage.');
  return data;
}
function publicURL(path){return process.env.SUPABASE_URL+'/storage/v1/object/public/'+BUCKET+'/'+path;}
async function signUpload(body,merchant){
  const types={'video/mp4':'mp4','video/webm':'webm','image/jpeg':'jpg','image/webp':'webp'};
  const ext=types[body.type],size=Number(body.size),max=String(body.type).startsWith('image/')?2*1024*1024:MAX_BYTES;
  if(!ext||!Number.isSafeInteger(size)||size<=0||size>max)throw fail(400,'الملف غير مدعوم أو يتجاوز الحد: 50 MB للفيديو و2 MB للغلاف');
  const path=merchant+'/'+randomUUID()+'.'+ext;
  const data=await storage('object/upload/sign/'+BUCKET+'/'+path,{method:'POST',body:'{}'});
  const u=new URL(data.url,process.env.SUPABASE_URL+'/storage/v1/');
  if(u.pathname.startsWith('/object/'))u.pathname='/storage/v1'+u.pathname;
  if(u.origin!==new URL(process.env.SUPABASE_URL).origin)throw fail(502,'رابط رفع غير صالح');
  return {path,upload_url:u.href,public_url:publicURL(path)};
}
async function verifiedMedia(path,merchant,image=false){
  if(!validPath(path,merchant)||!(image?/\.(jpg|webp)$/:/\.(mp4|webm)$/).test(path))throw fail(400,'مسار ملف غير صالح');
  const info=await storage('object/info/'+BUCKET+'/'+path),meta=info.metadata||info;
  const size=Number(meta.size??info.size),mime=meta.mimetype||meta.contentType||info.contentType;
  if(!(size>0&&size<=(image?2*1024*1024:MAX_BYTES))||!(image?/^image\/(jpeg|webp)$/:/^video\/(mp4|webm)$/).test(mime||''))throw fail(400,'ملف الرفع غير مكتمل أو نوعه غير مدعوم');
  return publicURL(path);
}
module.exports={BUCKET,MAX_BYTES,signUpload,verifiedMedia,validPath,publicURL};
