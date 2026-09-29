// Names and variant labels are hints. An exact model must still be reviewed by the merchant.
function modelsIn(value) {
  const text = String(value || '').replace(/[–—ـ]/g, ' ').replace(/\s+/g, ' ');
  const out = new Set();
  const apple = /(?:iphone|ايفون|آيفون|الايفون)\s*(1[3-9])\s*(pro\s*max|برو\s*ماكس|pro|برو|plus|بلس|air|اير)?/gi;
  const galaxy = /(?:samsung\s*)?(?:galaxy\s*)?(?:سامسونج|سامسونغ|جالكسي)?\s*\b(?:z\s*)?(fold|flip|s|a)\s*(\d{1,2})\s*(ultra|الترا|ألترا|plus|بلس)?/gi;
  let m;
  while ((m = apple.exec(text))) {
    const suffix = (m[2] || '').toLowerCase();
    out.add(`iPhone ${m[1]}${/pro\s*max|برو\s*ماكس/.test(suffix)?' Pro Max':/pro|برو/.test(suffix)?' Pro':/plus|بلس/.test(suffix)?' Plus':/air|اير/.test(suffix)?' Air':''}`);
  }
  while ((m = galaxy.exec(text))) {
    const kind = m[1].toUpperCase(), suffix = (m[3] || '').toLowerCase();
    out.add(kind === 'FOLD' || kind === 'FLIP' ? `Samsung Galaxy ${kind==='FOLD'?'Fold':'Flip'} ${m[2]}` : `Samsung Galaxy ${kind}${m[2]}${/ultra|الترا|ألترا/.test(suffix)?' Ultra':/plus|بلس/.test(suffix)?' Plus':''}`);
  }
  return [...out];
}
function modelKey(value) {
  const matches=modelsIn(value);
  return matches.length===1 ? matches[0] : String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
}
module.exports = {modelsIn,modelKey};
