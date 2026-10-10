const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('CRM route awaits postpurchase errors so they reach the response handler',async()=>{
 const crm={noCache:()=>{},requireAdmin:async()=>{},errorResponse:(res)=>{res.status=503;res.body={ok:false,error:'Safe failure'};}};
 const context={module:{exports:{}},require:path=>path==='../lib/crm'?crm:path==='../lib/crm-records'?{resources:{}}:path==='../lib/postpurchase'?{admin:async()=>{throw Error('private database payload');}}:assert.fail('Unexpected dependency '+path)};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../api/crm-admin.js','utf8'),context);const res={};await context.module.exports({query:{resource:'postpurchase'},method:'POST'},res);assert.equal(res.status,503);assert.equal(res.body.ok,false);assert.equal(res.body.error,'Safe failure');
});
