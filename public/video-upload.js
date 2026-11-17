window.VideoUpload=(function(){
  let file=null,poster=null,current=null,pending={},objectURL=null,generation=0,checking=false,lastCover=null;
  const $=id=>document.getElementById(id);
  function clearPreview(){const v=$('mediaPreview');v.pause();v.removeAttribute('src');v.load();v.hidden=true;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;}
  function reset(){generation++;checking=false;file=poster=current=null;pending={};lastCover=null;clearPreview();$('mediaFile').value='';$('posterFile').value='';$('uploadStatus').textContent='';$('mediaProgress').hidden=true;}
  function fill(v){current=v;if(v.media_url){$('mediaPreview').src=v.media_url;$('mediaPreview').poster=v.thumbnail_url||'';$('mediaPreview').hidden=false;$('uploadStatus').textContent='فيديو مرفوع. اترك الملف كما هو أو اختر ملفًا لاستبداله.';}}
  async function choose(){
    const selected=$('mediaFile').files[0];if(!selected)return;
    const token=++generation;checking=true;file=null;pending={};poster=null;clearPreview();
    const status=$('uploadStatus');
    try{
      if(!['video/mp4','video/webm'].includes(selected.type)||selected.size>50*1024*1024)throw Error('اختر MP4 أو WebM لا يتجاوز 50 MB.');
      objectURL=URL.createObjectURL(selected);const v=$('mediaPreview');v.src=objectURL;v.hidden=false;
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('تعذّر فحص الفيديو. استخدم MP4 بترميز H.264.')),15000);function done(e){clearTimeout(timer);v.onloadeddata=v.onerror=null;e?reject(e):resolve();}v.onloadeddata=()=>done();v.onerror=()=>done(Error('المتصفح لا يدعم هذا الفيديو. استخدم MP4 بترميز H.264.'));v.load();});
      if(token!==generation)return;
      const canvas=document.createElement('canvas');canvas.width=360;canvas.height=Math.round(v.videoHeight*360/v.videoWidth);
      canvas.getContext('2d').drawImage(v,0,0,canvas.width,canvas.height);
      poster=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));
      if(token!==generation)return;
      file=selected;status.textContent='جاهز للرفع · '+(selected.size/1048576).toFixed(1)+' MB · '+Math.round(v.duration)+' ثانية. يبدأ الرفع عند حفظ الفيديو.';
    }catch(e){if(token===generation){status.textContent=e.message;clearPreview();}}
    finally{if(token===generation)checking=false;}
  }
  async function upload(blob,api,label){
    const signed=await api('/api/video-shop-admin',{method:'POST',body:JSON.stringify({action:'upload',type:blob.type,size:blob.size})});
    await new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('PUT',signed.upload_url);xhr.timeout=300000;
      xhr.setRequestHeader('Content-Type',blob.type);xhr.setRequestHeader('x-upsert','false');xhr.setRequestHeader('cache-control','max-age=31536000');
      $('mediaProgress').hidden=false;
      xhr.upload.onprogress=e=>{if(e.lengthComputable){$('mediaProgress').value=e.loaded/e.total*100;$('uploadStatus').textContent=label+' '+Math.round(e.loaded/e.total*100)+'%';}};
      xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(Error('فشل رفع الملف. لم يتم استبدال الفيديو الحالي.'));
      xhr.onerror=xhr.ontimeout=()=>reject(Error('انقطع رفع الملف. أعد المحاولة؛ الفيديو الحالي محفوظ.'));
      xhr.send(blob);
    });
    return signed.path;
  }
  async function prepare(api){
    if(checking)throw Error('انتظر اكتمال فحص الفيديو.');
    if($('mediaFile').files.length&&!file)throw Error('الملف المختار غير قابل للتشغيل. اختر MP4 بترميز H.264.');
    const cover=$('posterFile').files[0]||poster;
    if(cover&&(!['image/jpeg','image/webp'].includes(cover.type)||cover.size>2*1024*1024))throw Error('الغلاف يجب أن يكون JPG أو WebP بحجم لا يتجاوز 2 MB.');
    if(file&&!pending.media_path)pending.media_path=await upload(file,api,'رفع الفيديو');
    if(cover!==lastCover){delete pending.poster_path;lastCover=cover;}
    if(cover&&!pending.poster_path)pending.poster_path=await upload(cover,api,'رفع الغلاف');
    return {...pending};
  }
  return {reset,fill,choose,prepare,hasVideo:()=>!!(file||current?.media_url),checking:()=>checking};
})();
