const {test}=require('node:test');const assert=require('node:assert/strict');
const {inferPurchased}=require('../lib/postpurchase-preview');
const item={name:'كفر دريب لنك – 18 برو ماكس | MagSafe',options:[]};
test('mislabelled colour option does not hide an explicit phone model',()=>{
 const result=inferPurchased(item,null,{has_skus:false,options:[{name:'موديل الجوال',values:['عنابي','سماوي','اسود','برتقالي','كحلي'].map(name=>({name}))}]});
 assert.equal(result.model,'iPhone 18 Pro Max');assert.equal(result.component,'case');assert.equal(result.reason,undefined);
});
test('real, unknown and conflicting model choices still fail closed',()=>{
 for(const values of [[{name:'iPhone 18 Pro'},{name:'iPhone 18 Pro Max'}],[],[{name:'اختيار غير معروف'}]])assert.equal(inferPurchased(item,null,{options:[{name:'موديل الجوال',values}]}).reason,'model_selection_unknown');
 assert.equal(inferPurchased({...item,options:[{name:'موديل الجوال',value:'iPhone 18 Pro'}]},null,{}).reason,'model_conflict');
});
