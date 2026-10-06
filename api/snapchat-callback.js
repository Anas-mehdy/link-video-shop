const snap = require('../lib/snapchat');
module.exports = async function snapchatCallback(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end();
  }
  let result='failed';
  try {
    snap.config();
    const state=snap.validateState(req);
    res.setHeader('Set-Cookie',snap.cookieHeader('',0));
    await snap.claimState(state);
    if (req.query?.error) result='cancelled';
    else {
      const code=req.query?.code;
      if (typeof code!=='string'||!code||code.length>2048) throw new Error('Missing code');
      await snap.save(await snap.exchange({grant_type:'authorization_code',code}));
      result='success';
    }
  } catch { /* No raw provider/DB errors or authorization parameters in responses/logs. */ }
  res.statusCode=303;
  res.setHeader('Location',`/dashboard?connection=snapchat&result=${result}#integrations`);
  return res.end();
};
