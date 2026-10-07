const tt=require('../lib/tiktok');
module.exports=async function tiktokCallback(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');res.statusCode=405;return res.end();}
  let result='failed';
  try{
    tt.config();const state=tt.validateState(req);
    res.setHeader('Set-Cookie',tt.cookieHeader('',0));
    await tt.claimState(state);
    if(req.query?.error)result='cancelled';
    else{
      const code=req.query?.auth_code;
      if(typeof code!=='string'||!code||code.length>2048)throw Error('Missing authorization code');
      await tt.save(await tt.exchange(code));result='success';
    }
  }catch{/* Never expose authorization parameters or raw provider/database errors. */}
  res.statusCode=303;res.setHeader('Location',`/dashboard?connection=tiktok&result=${result}#integrations`);return res.end();
};
