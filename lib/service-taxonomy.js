// Stable codes. Free-text legacy analyses are never classified by keyword matching.
const topics={
 fit:'التوافق والمقاس',product:'مواصفات المنتج',price:'السعر والعروض',checkout:'الدفع وإتمام الطلب',shipping:'التوصيل والشحن',order:'متابعة طلب',returns:'الاستبدال والاسترجاع',stock:'التوفر والحجز',other:'موضوع آخر موثّق'
};
const barriers={
 fit_unclear:{label:'توافق غير واضح',area:'store',action:'وضّح الأجهزة والمقاسات المتوافقة في صفحة المنتج'},
 product_missing:{label:'معلومة منتج ناقصة',area:'store',action:'أكمل المعلومات الناقصة في وصف المنتج'},
 checkout_failed:{label:'تعذّر إتمام الطلب أو الدفع',area:'store',action:'راجع خطوات الدفع ورسائل أخطاء إتمام الطلب'},
 price_objection:{label:'اعتراض صريح على السعر',area:'store',action:'راجع توضيح قيمة المنتج وتكلفته النهائية'},
 stock_missing:{label:'منتج غير متوفر',area:'store',action:'وضّح التوفر وموعد الحجز والبدائل'},
 shipping_delayed:{label:'تأخر التجهيز أو الشحن',area:'operations',action:'راجع مدة التجهيز ومسار متابعة الشحن'},
 shipping_unclear:{label:'موعد أو تكلفة شحن غير واضحة',area:'operations',action:'وضّح موعد الشحن وتكلفته قبل إتمام الطلب'},
 return_blocked:{label:'تعثر استبدال أو استرجاع',area:'operations',action:'راجع خطوات الاستبدال والاسترجاع ووضوحها'}
};
const coaching={
 incomplete:{label:'سؤال لم يعالجه الرد',area:'training',action:'راجع مع الموظف اكتمال الإجابة عن أسئلة العميل'},
 vague:{label:'رد يحتاج توضيحًا أدق',area:'training',action:'درّب الموظف على إجابة محددة وخطوة تالية واضحة'},
 followup:{label:'متابعة تحتاج مراجعة',area:'training',action:'راجع مع الموظف الالتزام بخطوة المتابعة المذكورة'}
};
const areas={store:'مشكلة بالمتجر',operations:'تشغيل أو شحن',training:'تدريب الموظف'};
const taxonomy={version:1,topics,barriers,coaching,areas};
function itemSchema(codes){return {type:'array',maxItems:2,items:{type:'object',additionalProperties:false,required:['code','ref'],properties:{code:{type:'string',enum:Object.keys(codes)},ref:{type:'integer'}}}};}
const schema={type:'object',additionalProperties:false,required:['topics','barriers','coaching'],properties:{topics:itemSchema(topics),barriers:itemSchema(barriers),coaching:itemSchema(coaching)}};
function normalize(value,rows,journey){
 if(!value||['topics','barriers','coaching'].some(k=>!Array.isArray(value[k])||value[k].length>2))return null;
 const result={version:1};
 for(const [kind,codes] of Object.entries({topics,barriers,coaching})){
  const accepted=new Map();
  for(const entry of value[kind]){
   const row=rows.find(r=>r.ref===entry.ref),message=journey.messages[entry.ref-1];
   if(!Object.hasOwn(codes,entry.code)||!row||!message?.message_id||!Number.isFinite(Date.parse(message.occurred_at)))continue;
   // Customer-reported topics/barriers and verified employee replies are different evidence.
   if(row.role!==(kind==='coaching'?'employee':'customer'))continue;
   accepted.set(entry.code,{code:entry.code,message_id:String(message.message_id),at:message.occurred_at,actor:row.role,excerpt:row.text});
  }
  result[kind]=[...accepted.values()];
 }
 return result;
}
module.exports={...taxonomy,taxonomy,schema,normalize};
