(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LinkCompleteCart=api;})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 async function add(items,{addItem,getState,setState,timeoutMs=20000}){
  if(!Array.isArray(items)||!items.length||items.length>20)throw Error('اختر من 1 إلى 20 منتجًا');
  const ids=new Set();for(const x of items){if(!/^\d+$/.test(x.id)||!Number.isSafeInteger(Number(x.id))||Number(x.id)<1||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>10||ids.has(x.id))throw Error('اختيارات غير صالحة');ids.add(x.id);}
  const results=[];
  for(const x of items){
   const old=getState(x.id);if(['sending','unknown'].includes(old)){results.push({id:x.id,status:'unknown'});break;}if(old==='added'){results.push({id:x.id,status:'added'});continue;}
   // Persist before provider IO. A storage failure must prevent the mutation.
   setState(x.id,'sending');let status='unknown';
   try{let timer;const r=await Promise.race([Promise.resolve().then(()=>addItem({id:Number(x.id),quantity:x.quantity,...(x.options?{options:x.options}:{})})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),timeoutMs);})]).finally(()=>clearTimeout(timer));
    if(r?.success===true||(r?.status>=200&&r?.status<300&&r?.data!=null))status='added';else if(r?.success===false||r?.status>=400)status='failed';
   }catch(e){const code=e?.status??e?.response?.status;if(code>=400&&code<500)status='failed';}
   try{setState(x.id,status);}catch{status='unknown';}
   results.push({id:x.id,status});if(status==='unknown')break;
  }
  return {results,complete:results.length===items.length&&results.every(x=>x.status==='added')};
 }
 return {add};
});
