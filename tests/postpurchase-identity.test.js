const {test}=require('node:test'),assert=require('node:assert/strict');const {identityReason}=require('../lib/postpurchase-identity');
test('snapshot phone identity normalizes formatting and explicit dial codes only',()=>{
 for(const customer of [{mobile:'+966 555 000 111'},{mobile:'00966555000111'},{mobile:'0555000111',mobile_code:'+966'}])assert.equal(identityReason({source_payload:{customer}},'966555000111'),null);
 assert.equal(identityReason({source_payload:{customer:{mobile:'+966555000112'}}},'966555000111'),'order_phone_mismatch');
 assert.equal(identityReason({},'966555000111'),'order_phone_missing');
});
