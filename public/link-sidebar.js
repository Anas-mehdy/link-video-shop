/* LINK_PREORDER_BOOTSTRAP_START */
/* Link Store: shared preorder startup, included by the installed sidebar asset. */
(function(scope,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory;else factory(scope);
})(typeof window==='object'?window:globalThis,function(w){
 'use strict';const d=w.document,url=new URL(w.location.href);
 if(!(['linkstore-sa.com','www.linkstore-sa.com'].includes(url.hostname)||url.hostname==='salla.sa'&&/^\/linkstore122(?:\/|$)/.test(url.pathname)))return;
 if(/(?:^|\/)(?:cart|checkout)(?:\/|$)/.test(url.pathname)||w.__linkPreorderBootstrap)return;
 const state={ready:false,error:false};w.__linkPreorderBootstrap=state;
 const previous=w.LinkPreorderCheckItems;let resolve,reject,timeout;
 const waiting=new Promise((a,b)=>{resolve=a;reject=b;});waiting.catch(()=>{});
 const stub=async(...args)=>{await waiting;const check=w.LinkPreorderCheckItems;if(typeof check!=='function'||check===stub)throw Error('preorder_guard_unavailable');return check(...args);};
 if(typeof previous!=='function')w.LinkPreorderCheckItems=stub;
 const selector='salla-add-product-button,salla-quick-buy,salla-mini-checkout-widget,.s-add-product-button-buy-now,.s-fast-checkout-button';
 function capture(e){
  if(w.LinkPreorderBeforeAddStatus?.ready){finish();return;}
  const path=e.composedPath?.()||[e.target];if(!path.some(n=>n?.matches?.(selector))&&!e.target?.closest?.(selector))return;
  e.preventDefault();e.stopImmediatePropagation();
  w.salla?.notify?.error?.(state.error?'تعذر تجهيز معلومات الحجز. حدّث الصفحة قبل الإضافة.':'لحظة، نجهّز معلومات الطلب. اضغط الإضافة مجدداً بعد لحظات.');
 }
 function finish(){
  if(!w.LinkPreorderBeforeAddStatus?.ready||typeof w.LinkPreorderCheckItems!=='function'||w.LinkPreorderCheckItems===stub)return;
  state.ready=true;w.clearTimeout(timeout);d.removeEventListener('click',capture,true);d.removeEventListener('link:preorders-ready',finish);resolve();
 }
 function failed(){if(state.ready)return;state.error=true;w.clearTimeout(timeout);reject(Error('preorder_guard_unavailable'));}
 d.addEventListener('click',capture,true);d.addEventListener('link:preorders-ready',finish);
 timeout=w.setTimeout(failed,20000);
 if(w.LinkPreorderBeforeAddStatus?.ready){finish();return;}
 let script=d.getElementById('link-preorder-before-add-loader');
 if(!script){
  script=d.createElement('script');script.id='link-preorder-before-add-loader';
  script.src='https://link-video-shop.vercel.app/preorder-before-add.js?v=20261016-15';script.dataset.beforeAdd='1';script.async=true;
  script.addEventListener('load',finish,{once:true});script.addEventListener('error',failed,{once:true});d.head.appendChild(script);
 }else{script.addEventListener('load',finish,{once:true});script.addEventListener('error',failed,{once:true});}
});
/* LINK_PREORDER_BOOTSTRAP_END */
/* Link Store — Malak navigation · preorder runtime enabled 2026-10-15
 * Navigation with preorder bootstrap; native cart writes remain in Salla.
 * Installed on main Malak (603175051) and Malak Trials (1409940314).
 * Remove its loader to disable immediately.
 */
(function () {
  'use strict';
  if (window.__LINK_SIDEBAR_V1__) return;
  window.__LINK_SIDEBAR_V1__ = true;
  var HOST = 'https://linkstore-sa.com';
  var PAGE = '/pages/lp1304367330/';
  var categories = [
    // model discovery: old/pre-existing category IDs confirmed from live Salla tree
    [1035289395,0,'أجهزة آيفون'],[261251644,0,'أجهزة السامسونغ'],
    [634749937,1035289395,'iPhone 18 pro max'],[1486436379,1035289395,'iPhone 18 pro'],
    [379699538,1035289395,'iPhone Duo'],
    [1970961949,1035289395,'iPhone 17 pro max'],[463298332,1035289395,'iPhone 17 pro'],[39079987,1035289395,'iPhone 17 Air'],[725983294,1035289395,'iPhone 17'],
    [532996019,1035289395,'iPhone 16 pro max'],[1308602546,1035289395,'iPhone 16 pro'],[815755608,1035289395,'iPhone 16 Plus'],[86167359,1035289395,'iPhone 16'],
    [1981367175,1035289395,'iPhone 15 pro max'],[607921286,1035289395,'iPhone 15 pro'],[1496277473,1035289395,'iPhone 15 Plus'],[1460661816,1035289395,'iPhone 15'],
    [506153704,1035289395,'iPhone 14 Pro Max'],[545582573,1035289395,'iPhone 14 Pro'],[720732386,1035289395,'iPhone 14 Plus'],[1285442363,1035289395,'iPhone 14'],
    [1392932811,1035289395,'iPhone 13 Pro Max'],[20539594,1035289395,'iPhone 13 Pro'],[1749125381,1035289395,'iPhone 13'],
    [985390771,1035289395,'iPhone 12 pro max'],[1759428530,1035289395,'iPhone 12 pro'],[990476058,1035289395,'iPhone 12'],
    [486304081,261251644,'Z Fold 8'],[1576546904,261251644,'Z Fold 8 Ultra'],
    [856197501,261251644,'Z Fold 7'],
    [1782629414,261251644,'Galaxy S26 Ultra'],[1319011876,261251644,'Galaxy S26 Plus'],[2096263166,261251644,'Galaxy S26'],
    [585849050,261251644,'Galaxy S25 Ultra'],[160611805,261251644,'Galaxy S25 Plus'],[336312071,261251644,'Galaxy S25'],
    [1844412371,261251644,'Galaxy S24 Ultra'],[1951929040,261251644,'Galaxy S24 Plus'],[1641076224,261251644,'Galaxy S24'],
    [443806679,261251644,'Galaxy S23 Ultra'],[2127148501,261251644,'Galaxy S23 Plus'],[868087041,261251644,'Galaxy S23'],[1600598787,261251644,'Galaxy S22'],
    [2028174838,261251644,'Galaxy fold 6'],[613858288,261251644,'Galaxy fold 5'],
    // cases
    [940923412,0,'كفرات آيفون'],[368212245,0,'كفرات سامسونج'],
    [1208968432,940923412,'كفرات iPhone 18'],[58902032,940923412,'كفرات iPhone 17'],[1258177052,940923412,'كفرات iPhone 16'],[618357021,940923412,'كفرات iPhone 15'],[1990295582,940923412,'كفرات iPhone 14'],[309055000,940923412,'كفرات iPhone 13'],
    [1989306597,368212245,'كفرات Galaxy S26'],[1042091034,368212245,'كفرات Galaxy S25'],[200944411,368212245,'كفرات Galaxy S24'],[934046053,368212245,'كفرات Galaxy S23'],[1398249319,368212245,'كفرات Galaxy S22'],
    // DriB
    [1912068484,0,'iPhone 18'],[1138555013,0,'iPhone 17'],[976694776,0,'iPhone 16'],
    [962807168,1912068484,'18 برو ماكس'],[189293697,1912068484,'18 برو'],
    [1695974274,1138555013,'17 برو ماكس'],[921936515,1138555013,'17 برو'],[1648432161,1138555013,'17 اير'],
    [337399033,976694776,'16 برو ماكس'],[868715259,976694776,'16 برو'],
    // screen protectors
    [2132399457,0,'استيكرات آيفون'],[1223095394,0,'استيكرات سامسونج'],
    [1957180012,2132399457,'استيكرات iPhone 17'],[1182093677,2132399457,'استيكرات iPhone 16'],[1647877999,2132399457,'استيكرات iPhone 15'],[1007009384,2132399457,'استيكرات iPhone 14'],[1540357226,2132399457,'استيكرات iPhone 13'],
    [615860708,1223095394,'استيكرات Galaxy S26'],[1365137781,1223095394,'استيكرات Galaxy S25'],[591100022,1223095394,'استيكرات Galaxy S24'],[2097252215,1223095394,'استيكرات Galaxy S23'],[1324263024,1223095394,'استيكرات Galaxy S22'],
    // lenses
    [416007537,0,'عدسات آيفون'],[1787880562,0,'عدسات سامسونج'],
    [1383598069,416007537,'عدسات iPhone 18'],[1149043571,416007537,'عدسات iPhone 17'],[375005820,416007537,'عدسات iPhone 16'],[1613185405,416007537,'عدسات iPhone 15'],[839671934,416007537,'عدسات iPhone 14'],[267030399,416007537,'عدسات iPhone 13'],[1939671838,416007537,'عدسات iPhone 12'],
    [2030242714,1787880562,'عدسات Galaxy S26'],[1505209976,1787880562,'عدسات Galaxy S25'],[731696505,1787880562,'عدسات Galaxy S24'],[91876474,1787880562,'عدسات Galaxy S23'],[1464208251,1787880562,'عدسات Galaxy S22'],[1564033012,1787880562,'عدسات Galaxy fold 6'],[788946677,1787880562,'عدسات Galaxy fold 5'],
    // camera plates, protection and accessories
    [1929922885,0,'مسطح حماية آيفون'],[2008195826,1929922885,'مسطح حماية iPhone 18'],[1289054278,1929922885,'مسطح حماية iPhone 17'],
    [1754830400,0,'أنظمة حماية الآيفون'],[249491693,0,'أنظمة حماية سامسونج'],
    [1094017293,1754830400,'أنظمة حماية iPhone 18'],[979744065,1754830400,'أنظمة حماية iPhone 17'],[339924034,1754830400,'أنظمة حماية iPhone 16'],[649419780,1754830400,'أنظمة حماية iPhone 15'],[226275647,1754830400,'أنظمة حماية iPhone 14'],[1599721528,1754830400,'أنظمة حماية iPhone 13'],[1764517913,1754830400,'أنظمة حماية iPhone 12'],
    [470719684,0,'باور بنك'],[1406794263,0,'حامل الجوال'],[1048613060,0,'شواحن'],[141410245,0,'سماعات']
  ];
  var byId = new Map(categories.map(function (x) { return [x[0], x]; }));
  function slug(str) { return String(str).toLowerCase().trim().replace(/\s+/g,'-').replace(/[^\p{L}\p{N}-]/gu,''); }
  function catUrl(id, title) { return HOST + '/' + slug(title || (byId.get(id)||[])[2] || '') + '/c' + id; }
  function page(id) { return HOST + PAGE + id; }
  function leaf(title, href, children) { return {title:title,href:href||'',children:children||[]}; }
  function cat(id, title, nested) {
    var row = byId.get(id); if (!row) throw new Error('Unknown Salla category ID: ' + id);
    var sub = nested ? categories.filter(function(x){return x[1]===id;}).map(function(x){return cat(x[0],x[2],nested>1?nested-1:0);}) : [];
    return leaf(title||row[2],catUrl(id,row[2]),sub);
  }
  var nav = [
    {title:'تسوّق حسب جوالك',desc:'آيفون · سامسونج',icon:'phone',href:catUrl(369296689,'حسب الجوال'),children:[cat(1035289395,'أجهزة آيفون',1),cat(261251644,'أجهزة سامسونج',1)]},
    {title:'البكجات والعروض',desc:'حماية متكاملة وتوفير',icon:'gift',children:[
      leaf('باكجات آيفون 18 برو وبرو ماكس',page(1951574082)),leaf('باكج آيفون 17 برو وبرو ماكس',page(1068764295)),leaf('باكجات سامسونج Ultra',page(241461890)),
      leaf('كل باكجات الآيفون',catUrl(1484759120,'باكدجات الايفون')),leaf('كل باكجات سامسونج',catUrl(709152593,'باكدجات السامسونج')),
      leaf('باكجات متنوعة',catUrl(69332562,'باكدجات متنوعه')),leaf('عروض الكاميرات',catUrl(1153411103,'عروض الكاميرات'))
    ]},
    {title:'الكفرات',desc:'آيفون · سامسونج · دريب لنك',icon:'case',href:catUrl(1143399984,'الكفرات'),children:[
      cat(940923412,'كفرات آيفون',1),cat(368212245,'كفرات سامسونج',1),
      leaf('كفرات دريب لنك',catUrl(144895241,'كفرات درب لنك'),[cat(1912068484,'دريب لنك iPhone 18',1),cat(1138555013,'دريب لنك iPhone 17',1),cat(976694776,'دريب لنك iPhone 16',1)]),
      leaf('كفرات الكاربون فايبر',page(35113314))
    ]},
    {title:'حماية الشاشة والكاميرا',desc:'استيكرات · عدسات · إطارات',icon:'shield',children:[
      leaf('استيكرات الشاشة',catUrl(1784268599,'الاستيكرات'),[cat(2132399457,'استيكرات آيفون',1),cat(1223095394,'استيكرات سامسونج',1)]),
      leaf('عدسات الكاميرا',catUrl(410826806,'عدسات الحماية'),[cat(416007537,'عدسات آيفون',1),cat(1787880562,'عدسات سامسونج',1)]),
      leaf('مسطحات الحماية',catUrl(1318558005,'مسطح الحماية'),[cat(1929922885,'مسطح حماية آيفون',1)]),
      leaf('أنظمة الحماية',catUrl(585915179,'أنظمة الحماية'),[cat(1754830400,'أنظمة حماية الآيفون',1),cat(249491693,'أنظمة حماية سامسونج')]),
      leaf('إطار لنك',catUrl(933487024,'إطار لنك'))
    ]},
    {title:'الإكسسوارات',desc:'شواحن · حوامل الجوال · باور بنك',icon:'plug',href:catUrl(1359428650,'الإكسسوارات'),children:[cat(470719684),cat(1406794263),cat(1048613060),cat(141410245),leaf('إكسسوارات آيفون 18',catUrl(1546866787,'اكسسوارات ايفون 18'))]},
    {title:'تغليف لنك',desc:'اختَر جهازك وباقة التغليف',icon:'sparkles',href:page(1157532109),children:[leaf('خدمة تغليف Link',page(1157532109)),leaf('التغليف الحراري',catUrl(496766540,'التغليف الحراري'))]},
    {title:'الحجز المسبق',desc:'احجز منتجك قبل وصوله',icon:'clock',href:HOST+'/الحجز-المسبق/c12775313'}
  ];
  var extra = [leaf('جديد المتجر',catUrl(755663023,'جديد المتجر')),leaf('من نحن',HOST+'/redirect/pages/1910305404'),leaf('الاستبدال والاسترجاع',HOST+'/redirect/pages/1602767696'),leaf('الشروط والأحكام',HOST+'/redirect/pages/1868783487')];
  var ICONS = {
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',close:'<path d="M5 5l14 14M19 5L5 19"/>',back:'<path d="m15 18-6-6 6-6"/>',next:'<path d="m15 18-6-6 6-6"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    gift:'<rect x="3" y="10" width="18" height="11" rx="2"/><path d="M3 14h18M12 10v11M12 10c-4-1-7-4-5-6s5 1 5 6Zm0 0c4-1 7-4 5-6s-5 1-5 6Z"/>',
    case:'<rect x="5" y="2.5" width="14" height="19" rx="3"/><rect x="8" y="5" width="4" height="4" rx="1"/><path d="M12 18h1"/>',
    shield:'<path d="m12 2 8 4v5c0 5-3.1 8.2-8 11-4.9-2.8-8-6-8-11V6l8-4Z"/><path d="m9 12 2 2 4-4"/>',
    plug:'<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v4"/>',
    sparkles:'<path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2ZM19 18l.7 1.3L21 20l-1.3.7L19 22l-.7-1.3L17 20l1.3-.7L19 18Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    home:'<path d="m3 11 9-8 9 8v9H3v-9ZM9 20v-6h6v6"/>',tick:'<path d="m5 12 4 4 10-10"/>'
  };
  function svg(n, size) { return '<svg aria-hidden="true" width="'+(size||20)+'" height="'+(size||20)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[n]||ICONS.next)+'</svg>'; }
  function el(tag, cls, text) { var node=document.createElement(tag); if(cls)node.className=cls; if(text!==undefined)node.textContent=text; return node; }
  var root,overlay,panel,content,titleBar,searchBox,backBtn,closeBtn,stack=[],open=false,lastFocus=null,oldOverflow='';
  function norm(t) {return String(t||'').toLowerCase().normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064b-\u065f]/g,'').trim();}
  function addStyle(){if(document.getElementById('link-sidebar-style'))return;var s=el('style');s.id='link-sidebar-style';s.textContent=String.raw`
#link-sidebar-root{font-family:inherit;direction:rtl}#link-sidebar-root *,#link-sidebar-root *:before,#link-sidebar-root *:after{box-sizing:border-box}
#link-sidebar-root .ls-backdrop{position:fixed;inset:0;background:rgba(14,11,25,.55);z-index:2147483100;opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s;backdrop-filter:blur(2px)}
#link-sidebar-root .ls-panel{position:fixed;top:0;bottom:0;right:0;width:min(390px,94vw);max-width:100%;background:#fff;z-index:2147483101;transform:translateX(105%);transition:transform .28s cubic-bezier(.22,1,.36,1);display:flex;flex-direction:column;box-shadow:-12px 0 48px #160a2a29;color:#23212b;text-align:right;overscroll-behavior:contain}
#link-sidebar-root.is-open .ls-panel{transform:translateX(0)}#link-sidebar-root.is-open .ls-backdrop{visibility:visible;opacity:1}
#link-sidebar-root .ls-top{flex:none;background:linear-gradient(125deg,#641a89,#500076);color:white;padding:21px 20px 16px}
#link-sidebar-root .ls-head{display:flex;align-items:center;gap:9px}#link-sidebar-root .ls-brand{font-size:22px;font-weight:850;letter-spacing:-.5px;flex:1}#link-sidebar-root .ls-tag{background:#ffffff30;border:1px solid #ffffff3b;border-radius:100px;font-size:10px;padding:5px 8px;font-weight:700}
#link-sidebar-root button{font:inherit;cursor:pointer}#link-sidebar-root .ls-iconbtn{border:1px solid #ffffff45;background:#ffffff22;color:inherit;border-radius:11px;display:flex;align-items:center;justify-content:center;width:37px;height:37px;flex:none}
#link-sidebar-root .ls-tagline{font-size:12px;opacity:.86;margin:7px 0 0}#link-sidebar-root .ls-search{margin-top:18px;position:relative;display:flex;align-items:center;gap:9px;background:#fff;color:#77728a;border-radius:13px;padding:0 12px;height:46px;box-shadow:0 2px 6px #28083a24}
#link-sidebar-root .ls-search input{outline:0;border:0;background:transparent;color:#23212b;width:100%;height:100%;text-align:right;font:inherit;font-size:13px;min-width:0}#link-sidebar-root .ls-search input::placeholder{color:#938c9d}
#link-sidebar-root .ls-sectionhead{display:flex;align-items:center;gap:10px;padding:17px 20px 12px;background:#fff;position:sticky;top:0;z-index:1;border-bottom:1px solid #f2eff4;min-height:58px}
#link-sidebar-root .ls-title{font-size:15px;font-weight:800;flex:1;margin:0}#link-sidebar-root .ls-back{color:#5f277d;background:#f5eff8;border:0;border-radius:9px;display:flex;align-items:center;justify-content:center;width:33px;height:33px}
#link-sidebar-root .ls-scroll{overflow-y:auto;overscroll-behavior:contain;flex:1;padding:10px 12px 24px;scrollbar-width:thin;scrollbar-color:#dbcbe7 transparent}
#link-sidebar-root .ls-row{display:flex;align-items:center;gap:11px;text-decoration:none!important;color:#26202d!important;border:1px solid #f0eaf2;background:#fff;width:100%;min-height:59px;border-radius:14px;margin:0 0 8px;padding:10px 12px;text-align:right;transition:background .16s,border-color .16s}
#link-sidebar-root .ls-row:focus-visible,#link-sidebar-root .ls-iconbtn:focus-visible,#link-sidebar-root .ls-row:hover{outline:0;border-color:#cfb6dd;background:#fcf9fe}
#link-sidebar-root .ls-row-icon{width:38px;height:38px;border-radius:11px;background:#f4eafa;color:#6b1f91;display:flex;align-items:center;justify-content:center;flex:none}
#link-sidebar-root .ls-info{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}#link-sidebar-root .ls-name{font-size:13.5px;font-weight:760;line-height:1.45}#link-sidebar-root .ls-desc{font-size:11.2px;line-height:1.4;color:#817b89}#link-sidebar-root .ls-chevron{color:#ad9eb6;display:flex;align-items:center}
#link-sidebar-root .ls-row:not(.ls-main){min-height:49px;border:0;border-bottom:1px solid #f2eff3;border-radius:0;margin:0;padding:11px 7px}
#link-sidebar-root .ls-row:not(.ls-main) .ls-name{font-size:13px;font-weight:650}
#link-sidebar-root .ls-smallhead{font-size:11px;color:#857589;font-weight:700;margin:20px 8px 10px}#link-sidebar-root .ls-footer{display:flex;flex-wrap:wrap;gap:8px;padding:12px 7px;border-top:1px solid #eee}
#link-sidebar-root .ls-footer a{color:#64447a;text-decoration:none!important;font-size:11px}#link-sidebar-root .ls-footer a:not(:last-child):after{content:' ·';color:#c1b8c7;margin:0 5px}
#link-sidebar-root .ls-all{display:block;background:#f4eaf9;color:#611984!important;text-decoration:none!important;font-size:12px;font-weight:800;padding:12px 14px;margin:0 0 10px;border-radius:11px}
#link-sidebar-root .ls-empty{text-align:center;color:#8e8796;font-size:13px;padding:36px 15px}#link-sidebar-root .ls-count{background:#f4edfa;color:#6b1f91;padding:3px 8px;border-radius:100px;font-size:10px;font-weight:700}
#link-sidebar-root .ls-corner{font-size:10px;color:#9d91a6;text-align:center;padding:11px 8px 15px}
#link-sidebar-fallback{position:fixed;right:12px;bottom:100px;z-index:2147483090;background:#621c86;color:white;border:1px solid #ffffff88;border-radius:14px;box-shadow:0 5px 22px #2b173d36;padding:12px 13px;display:flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:700}
@media (prefers-reduced-motion:reduce){#link-sidebar-root .ls-panel,#link-sidebar-root .ls-backdrop{transition:none}}
`;document.head.appendChild(s);}
  function iconButton(name,label,cls){var b=el('button',cls);b.type='button';b.setAttribute('aria-label',label);b.innerHTML=svg(name);return b;}
  function init(){if(root||!document.body)return;addStyle();root=el('div');root.id='link-sidebar-root';overlay=el('div','ls-backdrop');panel=el('aside','ls-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','قائمة لنك');panel.setAttribute('dir','rtl');panel.tabIndex=-1;
    var top=el('div','ls-top'),head=el('div','ls-head');head.appendChild(el('div','ls-brand','LINK | لنك'));head.appendChild(el('span','ls-tag','تسوق بسهولة'));closeBtn=iconButton('close','إغلاق القائمة','ls-iconbtn');closeBtn.addEventListener('click',closeMenu);head.appendChild(closeBtn);top.appendChild(head);top.appendChild(el('p','ls-tagline','وش جوالك؟ خلك على راحتك واختر الحماية المناسبة.'));
    var search=el('label','ls-search');search.innerHTML=svg('search');searchBox=el('input');searchBox.type='search';searchBox.placeholder='ابحث عن موديل أو نوع حماية...';searchBox.autocomplete='off';searchBox.setAttribute('aria-label','بحث في أقسام المتجر');searchBox.addEventListener('input',render);search.appendChild(searchBox);top.appendChild(search);
    var section=el('div','ls-sectionhead');backBtn=iconButton('back','الرجوع','ls-back');backBtn.addEventListener('click',goBack);titleBar=el('h2','ls-title','تسوق حسب احتياجك');section.appendChild(backBtn);section.appendChild(titleBar);
    content=el('div','ls-scroll');panel.appendChild(top);panel.appendChild(section);panel.appendChild(content);root.appendChild(overlay);root.appendChild(panel);document.body.appendChild(root);
    overlay.addEventListener('click',closeMenu);document.addEventListener('keydown',onKeydown);render();
  }
  function openMenu(){init();if(!root||open)return;lastFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';stack=[];searchBox.value='';open=true;root.classList.add('is-open');render();setTimeout(function(){closeBtn.focus({preventScroll:true});},50);}
  function closeMenu(){if(!open)return;open=false;root.classList.remove('is-open');document.body.style.overflow=oldOverflow;if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});}
  function onKeydown(e){if(!open)return;if(e.key==='Escape'){e.preventDefault();closeMenu();return;}if(e.key!=='Tab')return;var focusable=panel.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]');var items=Array.from(focusable).filter(function(x){return x.getClientRects().length;});if(!items.length)return;var first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  function navigateTo(node){stack.push(node);searchBox.value='';render();content.scrollTop=0;}
  function goBack(){if(stack.length){stack.pop();searchBox.value='';render();content.scrollTop=0;}}
  function row(node,main,ico){var hasKids=node.children&&node.children.length>0;var item=el(hasKids?'button':'a','ls-row'+(main?' ls-main':''));if(hasKids){item.type='button';item.addEventListener('click',function(){navigateTo(node);});}else{item.href=node.href||HOST+'/';item.addEventListener('click',closeMenu);}
    if(ico){var icoEl=el('span','ls-row-icon');icoEl.innerHTML=svg(ico);item.appendChild(icoEl);}var info=el('span','ls-info');info.appendChild(el('span','ls-name',node.title));if(main&&node.desc)info.appendChild(el('span','ls-desc',node.desc));item.appendChild(info);
    if(hasKids){var arr=el('span','ls-chevron');arr.innerHTML=svg('next',16);item.appendChild(arr);}return item;}
  var searchItems=[];function indexTree(items){for(var i=0;i<items.length;i++){var x=items[i];if(x.href)searchItems.push({title:x.title,href:x.href});if(x.children&&x.children.length)indexTree(x.children);}}indexTree(nav);indexTree(extra);
  function render(){if(!content)return;var q=norm(searchBox.value);content.replaceChildren();backBtn.style.visibility=stack.length&&!q?'visible':'hidden';if(q){titleBar.textContent='نتائج البحث';var seen=new Set();var matches=searchItems.filter(function(x){if(seen.has(x.href))return false;seen.add(x.href);return norm(x.title).includes(q);}).slice(0,45);var meta=el('div','ls-smallhead','نتائج مطابقة');meta.appendChild(el('span','ls-count',String(matches.length)));content.appendChild(meta);matches.forEach(function(x){content.appendChild(row(x,false));});if(!matches.length)content.appendChild(el('div','ls-empty','ما لقينا نتائج. جرّب موديل ثاني.'));return;}
    var node=stack.length?stack[stack.length-1]:null;titleBar.textContent=node?node.title:'تسوق حسب احتياجك';var list=node?node.children:nav;
    if(node&&node.href){var all=el('a','ls-all','عرض جميع منتجات '+node.title+' ←');all.href=node.href;all.addEventListener('click',closeMenu);content.appendChild(all);}
    list.forEach(function(x){content.appendChild(row(x,!node,node?null:x.icon));});if(!node){content.appendChild(el('div','ls-smallhead','اكتشف المزيد'));content.appendChild(row(extra[0],false));var footer=el('div','ls-footer');extra.slice(1).forEach(function(x){var a=el('a',null,x.title);a.href=x.href;footer.appendChild(a);});content.appendChild(footer);content.appendChild(el('p','ls-corner','لنك ستور · اختياراتك تبدأ من هنا'));}
  }
  function findOriginalToggle(){var selectors=[
    'header .menu-toggle','header .mobile-menu-toggle','header .menu-trigger','header .header-menu-toggle','header .navbar-toggler',
    'header button[aria-controls*="menu" i]','header button[aria-label*="menu" i]','header button[aria-label*="القائمة"]',
    '.site-header button[aria-label*="menu" i]','.site-header .menu-trigger','[data-mobile-menu-trigger]',
    'header .sicon-menu','header .sicon-menu-2','header .sicon-bars','header .fa-bars','header [class*="hamburger"]',
    'header button:has(.sicon-menu)','header a:has(.sicon-menu)'
    ];for(var i=0;i<selectors.length;i++){try{var e=document.querySelector(selectors[i]);if(e&&e.getClientRects().length){return e.closest('button,a,[role="button"],label')||e;}}catch(e){}}return null;}
  var nativeToggle=null,fallback=null;
  function interceptNative(e){if(!nativeToggle||!nativeToggle.isConnected)return;if(root&&root.contains(e.target))return;
    if(!nativeToggle.contains(e.target)&&e.target!==nativeToggle)return;
    e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();openMenu();}
  function wireToggle(){init();var candidate=findOriginalToggle();if(candidate){nativeToggle=candidate;if(fallback){fallback.remove();fallback=null;}return true;}
    if(!fallback&&document.body){fallback=el('button');fallback.id='link-sidebar-fallback';fallback.type='button';fallback.innerHTML=svg('menu',18)+' <span>القائمة الجديدة</span>';fallback.addEventListener('click',openMenu);document.body.appendChild(fallback);}return false;}
  document.addEventListener('click',interceptNative,true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){wireToggle();});else wireToggle();
  var count=0;var watcher=new MutationObserver(function(){if(nativeToggle&&nativeToggle.isConnected){watcher.disconnect();return;}if(wireToggle()||++count>120)watcher.disconnect();});
  if(document.body)watcher.observe(document.body,{childList:true,subtree:true});
  else document.addEventListener('DOMContentLoaded',function(){watcher.observe(document.body,{childList:true,subtree:true});});
  window.LinkSidebar={open:openMenu,close:closeMenu,version:'2026-10-12-test',canonicalCategoryCount:130,ignoredDuplicates:89};
})();

/* LINK_HOME_DEVICE_CATEGORY_EXT_V1
 * Extend the existing Malak "اختر حسب جوالك" selector with two verified
 * active Salla categories. Do not replace the native widget or affect its
 * existing models. New selections use canonical Salla category URLs.
 */
(function () {
  'use strict';
  if (window.__linkHomeDeviceCategoryExtV1) return;
  window.__linkHomeDeviceCategoryExtV1 = true;
  var categories = {
    iphone: {value:'379699538', name:'iPhone Duo', url:'https://linkstore-sa.com/iphone-duo/c379699538'},
    samsung: {value:'856197501', name:'Samsung Z Fold 7', url:'https://linkstore-sa.com/z-fold-7/c856197501'}
  };
  function normalize(s) { return String(s||'').trim().toLowerCase(); }
  function getBrand(select) {
    if (!select) return '';
    var label = select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0].textContent : '';
    var value = normalize(select.value);
    var text = normalize(label)+' '+value;
    if (/iphone|apple|آيفون|ايفون|أجهزة آيفون/.test(text) || value === '1035289395') return 'iphone';
    if (/samsung|galaxy|سامسونج|سامسونغ|سامسونق/.test(text) || value === '261251644') return 'samsung';
    return '';
  }
  function findPicker() {
    var headings = document.querySelectorAll('h1,h2,h3,h4,h5');
    for (var i=0;i<headings.length;i++) {
      if (!/اختر حسب جوالك/.test(headings[i].textContent||'')) continue;
      var ancestor = headings[i].parentElement;
      for (var level=0;ancestor&&level<6;level++,ancestor=ancestor.parentElement) {
        var dropdowns = ancestor.querySelectorAll('select');
        if (dropdowns.length<2) continue;
        var actions = ancestor.querySelectorAll('button,input[type="submit"],a,[role="button"]');
        for (var j=0;j<actions.length;j++) {
          if (/عرض المنتجات/.test(actions[j].textContent||actions[j].value||'')) {
            return {root:ancestor,brand:dropdowns[0],model:dropdowns[1],button:actions[j]};
          }
        }
      }
    }
    return null;
  }
  function init(picker) {
    if (picker.root.dataset.linkDeviceCategoryExt === '1') return;
    picker.root.dataset.linkDeviceCategoryExt = '1';
    var type = picker.brand, model = picker.model, button = picker.button;
    function chosen() {
      var selected = model.selectedOptions && model.selectedOptions[0];
      if (!selected || !selected.dataset || !selected.dataset.linkCategoryTarget) return null;
      return Object.values(categories).find(function(x){ return x.value===selected.dataset.linkCategoryTarget; }) || null;
    }
    function sync() {
      var brand = getBrand(type), info = categories[brand];
      if (!info) return;
      var existing = Array.from(model.options).find(function(o){return normalize(o.textContent)===normalize(info.name);});
      if (!existing) {
        existing = document.createElement('option');
        existing.textContent = info.name;
        existing.value = info.value;
        existing.dataset.linkCategoryTarget = info.value;
        model.appendChild(existing);
      } else if (existing.value === info.value) {
        existing.dataset.linkCategoryTarget = info.value;
      }
    }
    function enableChoice() {
      if (!chosen()) return;
      button.disabled = false;
      button.removeAttribute('disabled');
      button.removeAttribute('aria-disabled');
    }
    var schedule = function(){ Promise.resolve().then(function(){sync();enableChoice();}); };
    type.addEventListener('change',schedule);
    model.addEventListener('change',function(){ schedule(); setTimeout(enableChoice,0); });
    new MutationObserver(schedule).observe(model,{childList:true});
    picker.root.addEventListener('click',function(event){
      if (!button.contains(event.target) && button !== event.target) return;
      var item=chosen();if (!item) return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      window.location.assign(item.url);
    },true);
    picker.root.addEventListener('submit',function(event){
      var item=chosen();if (!item) return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      window.location.assign(item.url);
    },true);
    schedule();
  }
  function scan(){var picker=findPicker();if(picker){init(picker);return true;}return false;}
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',scan,{once:true});
  else scan();
  var attempts=0,interval=setInterval(function(){if(scan()||++attempts>=12)clearInterval(interval);},1200);
})();
