const {fail}=require('./crm');
const OFFER_ID='387390654',MODEL='عرض LUX';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim().slice(0,100);
function payload(customerName,purchasedName,phone){
 if(!/^[1-9]\d{7,14}$/.test(phone||'')||!clean(purchasedName))throw fail(400,'بيانات قالب LUX غير مكتملة');
 const name=clean(customerName)||'عميل لنك',bought=clean(purchasedName);
 return {inbox_id:40,type:'whatsapp_template',contact:{name,phone_number:'+'+phone},message:{
  content:`السلام عليكم ${name} 💜، معك أنس من شركة لنك، عساك متهني بطلبك! بما إنك أخذت ${bought}، اخترنالك حامل سيارة يناسب كفر جوالك: لنك LUX🔥. قرّب جوالك من الحامل ويثبت مغناطيسيًا، بدون ما تفك الكفر ومع دوران 360 درجة بكل الاتجاهات والتصاق متين جداً 🔥🔥 شوف كيف يتركّب ويثبت الجوال على الواقع 👇`,
  whatsapp_template:{name:'link_postpurchase_lux_ar',language:{code:'ar'},components:[
   {type:'body',parameters:[name,bought].map(text=>({type:'text',text}))},
   {type:'button',sub_type:'quick_reply',index:'0',parameters:[{type:'payload',payload:'unsubscribe'}]}
  ]}
 }};
}
module.exports={OFFER_ID,MODEL,payload};
