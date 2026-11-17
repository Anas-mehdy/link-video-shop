const {test}=require('node:test'),assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://storage.example';process.env.SUPABASE_SERVICE_ROLE_KEY='server-only-test';
const media=require('../lib/video-media');
const merchant=1829345766,path=merchant+'/12345678-1234-4234-8234-123456789abc.mp4';
test('upload grants are restricted to allowed MIME, size and unique merchant paths',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async(url,opts)=>{calls++;assert.match(url,/object\/upload\/sign\/video-shop-media\/1829345766\//);assert.equal(opts.method,'POST');return {ok:true,json:async()=>({url:'/object/upload/sign/video-shop-media/test?token=temporary'})};};
 try{
  await assert.rejects(media.signUpload({type:'text/html',size:5},merchant));
  await assert.rejects(media.signUpload({type:'video/mp4',size:media.MAX_BYTES+1},merchant));
  assert.equal(calls,0);
  const a=await media.signUpload({type:'video/mp4',size:100},merchant),b=await media.signUpload({type:'video/mp4',size:100},merchant);
  assert.notEqual(a.path,b.path);assert.equal(media.validPath(a.path,merchant),true);
  assert.equal(a.upload_url,'https://storage.example/storage/v1/object/upload/sign/video-shop-media/test?token=temporary');
  assert.equal(JSON.stringify(a).includes('server-only-test'),false);
 }finally{global.fetch=original;}
});
test('saving only accepts uploaded merchant objects with matching MIME and size',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return {ok:true,json:async()=>({metadata:{size:100,mimetype:'video/mp4'}})}};
 try{
  await assert.rejects(media.verifiedMedia('../other.mp4',merchant));
  await assert.rejects(media.verifiedMedia('1/'+path.split('/')[1],merchant));
  assert.equal(calls,0);assert.match(await media.verifiedMedia(path,merchant),/object\/public\/video-shop-media/);
  global.fetch=async()=>({ok:true,json:async()=>({metadata:{size:100,mimetype:'text/html'}})});
  await assert.rejects(media.verifiedMedia(path,merchant));
 }finally{global.fetch=original;}
});
test('unauthorized admins cannot mint upload grants; replacement keeps products when omitted',async()=>{
 const sp=require.resolve('../lib/supabase'),ap=require.resolve('../api/video-shop-admin');
 let allowed=false,writes=[],reads=[];
 require.cache[sp]={id:sp,filename:sp,loaded:true,exports:{MERCHANT_ID:merchant,cors:()=>{},requireAdmin:async()=>{if(!allowed)throw Object.assign(Error('Unauthorized'),{statusCode:401});},sb:async(p,o)=>{if(o)writes.push([p,o]);else reads.push(p);return [{id:'12345678-1234-4234-8234-123456789abc'}];},json:(r,status,data)=>{r.status=status;r.data=data;}}};
 delete require.cache[ap];const handler=require(ap),r={};
 await handler({method:'POST',body:{action:'upload',type:'video/mp4',size:100}},r);
 assert.equal(r.status,401);assert.equal(writes.length,0);
 allowed=true;const original=global.fetch;
 global.fetch=async()=>({ok:true,json:async()=>({metadata:{size:100,mimetype:'video/mp4'}})});
 try{
 await handler({method:'PATCH',body:{id:'12345678-1234-4234-8234-123456789abc',media_path:path}},r);
 assert.equal(r.status,200);assert.equal(writes.length,1);assert.equal(writes[0][1].method,'PATCH');
 assert.equal(JSON.parse(writes[0][1].body).media_path,path);
 assert.equal(writes.some(([p])=>p.startsWith('video_shop_video_products')),false);
 }finally{global.fetch=original;}
});
