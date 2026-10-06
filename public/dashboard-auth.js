(() => {
'use strict';
let mode='legacy',initializing=null,refreshing=null;
async function request(action,options={}){const response=await fetch('/api/crm-admin?resource=auth&action='+action,{...options,headers:{'Content-Type':'application/json',...options.headers},credentials:'same-origin',cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok){const error=new Error(data.error||'تعذر الاتصال بخدمة الدخول');error.status=response.status;throw error;}return data;}
function init(){return initializing||(initializing=request('config').then(data=>{mode=data.mode;if(mode==='supabase')sessionStorage.removeItem('lvs_admin');return mode;}));}
function session(){return refreshing||(refreshing=request('session').finally(()=>refreshing=null));}
async function authenticatedFetch(url,options={}){await init();const headers=new Headers(options.headers||{});if(mode==='supabase')headers.delete('Authorization');else if(!headers.has('Authorization'))headers.set('Authorization','Bearer '+(sessionStorage.getItem('lvs_admin')||''));const args={...options,headers,credentials:'same-origin'};let response=await fetch(url,args);if(response.status===401&&mode==='supabase'){try{await session();response=await fetch(url,args);}catch(e){if(e.status===401)window.dispatchEvent(new Event('link-auth-expired'));throw e;}}return response;}
async function logout(){await init();if(mode==='supabase')await request('logout',{method:'POST'});sessionStorage.removeItem('lvs_admin');localStorage.setItem('link_auth_logout',String(Date.now()));}
window.addEventListener('storage',e=>{if(e.key==='link_auth_logout')location.reload();});
window.LinkAuth={init,get mode(){return mode;},session,fetch:authenticatedFetch,login:(email,password)=>request('login',{method:'POST',body:JSON.stringify({email,password})}),logout};
})();
