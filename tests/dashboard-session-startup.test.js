const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const html=fs.readFileSync(require.resolve('../public/dashboard.html'),'utf8');
const script=fs.readFileSync(require.resolve('../public/dashboard.js'),'utf8');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

for(const scenario of ['valid','expired','unavailable']){
 test('Dashboard reload stays out of login pending session: '+scenario,async()=>{
  const {window,document}=parseHTML(html);
  const config=defer(),session=defer(),data=defer(),requests=[];
  const location=new URL('https://dashboard.example.test/dashboard#orders');
  const sessionStorage={getItem(){return null;},removeItem(){}};
  window.matchMedia=()=>({matches:false,addEventListener(){}});
  window.LinkAuth={mode:'supabase',init:()=>config.promise,session:()=>session.promise,fetch:url=>{requests.push(url);return data.promise;}};
  const hidden=id=>document.getElementById(id).hidden;
  assert.equal(hidden('login'),true);
  vm.runInNewContext(script,{window,document,location,sessionStorage,URLSearchParams,setTimeout,clearTimeout,Intl,Date});
  assert.equal(hidden('login'),true);
  assert.equal(hidden('app'),true);
  config.resolve('supabase');await flush();
  assert.equal(hidden('login'),true);
  assert.equal(hidden('auth-startup'),false);
  if(scenario==='valid'){
   session.resolve({user:{email:'demo@example.com'}});await flush();
   assert.equal(hidden('app'),false);
   assert.equal(hidden('login'),true);
   assert.equal(hidden('auth-startup'),true);
   assert.equal(location.hash,'#orders');
   assert.deepEqual(requests,['/api/crm-admin?resource=orders&page=1&search=']);
   data.resolve(new Response(JSON.stringify({ok:true,records:[],page:1})));await flush();
   assert.equal(document.querySelector('#retry-page'),null);
   assert.equal(document.querySelector('#content').getAttribute('aria-busy'),'false');
  }else{
   session.reject(Object.assign(Error('test'),{status:scenario==='expired'?401:503}));await flush();
   assert.equal(hidden('app'),true);
   assert.equal(hidden('login'),scenario!=='expired');
   assert.equal(hidden('auth-retry'),scenario==='expired');
   assert.deepEqual(requests,[]);
  }
 });
}
