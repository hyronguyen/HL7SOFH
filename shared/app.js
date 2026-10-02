(function(){
 'use strict';
 const KEY='isofh-tools-session-v1';
 const script=document.currentScript;
 const home=new URL('../index.html',script.src).href;
 let current=null;
 function normalizeBase(input){
  const url=new URL(input.trim());
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Base URL phải là HTTP/HTTPS, không chứa tài khoản, query hoặc #.');
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Dùng HTTPS để bảo vệ thông tin đăng nhập.');
  let path=url.pathname.replace(/\/+$/,'');
  if(!path.endsWith('/api/his/v1'))path+='/api/his/v1';
  return url.origin+path;
 }
 function isSafeBase(base){
  const host=new URL(base).hostname.toLowerCase();
  return /^(?:api-)?sakura-(?:test|stable)\.isofh\.vn$/.test(host);
 }
 function expiry(token){try{const claim=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return typeof claim.exp==='number'?claim.exp*1000:null;}catch{return null;}}
 function read(){try{const s=JSON.parse(sessionStorage.getItem(KEY)||'null');if(s&&s.base&&s.token&&s.account){normalizeBase(s.base);return s;}}catch{}return null;}
 current=read();
 function session(){return current?{...current}:null;}
 function requireSession(){const s=session();if(!s)throw Error('Chưa đăng nhập. Về trang chính để chọn server và tài khoản.');if(s.expiresAt&&s.expiresAt<=Date.now())throw Error('Phiên đăng nhập đã hết hạn. Về trang chính để đăng nhập lại.');return s;}
 function render(){
  const h=document.getElementById('appHeader');if(!h)return;
  const s=session();h.dataset.risk=String(Boolean(s&&!isSafeBase(s.base)));
  document.getElementById('appServer').textContent=s?s.base:'Chưa chọn server';
  document.getElementById('appAccount').textContent=s?`Tài khoản: ${s.account}${s.expiresAt&&s.expiresAt<=Date.now()?' · Hết hạn':''}`:'Chưa đăng nhập';
  document.getElementById('appWarning').hidden=!(s&&!isSafeBase(s.base));
  document.getElementById('appLogout').hidden=!s;
 }
 function store(s){sessionStorage.setItem(KEY,JSON.stringify(s));current=s;render();window.dispatchEvent(new CustomEvent('isofh-session-change'));}
 function logout(){current=null;sessionStorage.removeItem(KEY);localStorage.removeItem('token');render();window.dispatchEvent(new CustomEvent('isofh-session-change'));}
 async function login(base,account,password){
  const normalized=normalizeBase(base);if(!account.trim()||!password)throw Error('Nhập tài khoản và mật khẩu / mã băm đăng nhập HIS.');
  const response=await fetch(normalized+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json','Accept-Language':'vi'},body:JSON.stringify({taiKhoan:account.trim(),matKhau:password}),signal:AbortSignal.timeout(30000)});
  const payload=await response.json();const token=payload?.data?.access_token;
  if(!response.ok||(payload.code!==undefined&&payload.code!==0)||!token)throw Error(payload.message||`Đăng nhập thất bại (HTTP ${response.status}).`);
  store({base:normalized,account:account.trim(),token,expiresAt:expiry(token)});return session();
 }
 function useToken(base,account,token){const raw=token.trim().replace(/^Bearer\s+/i,'');if(!raw||!account.trim())throw Error('Nhập token và tên tài khoản để nhận diện phiên.');const end=expiry(raw);if(end&&end<=Date.now())throw Error('Token đã hết hạn.');store({base:normalizeBase(base),account:account.trim(),token:raw,expiresAt:end});return session();}
 async function request(path,options={}){
  const s=requireSession();if(!path.startsWith('/')||path.startsWith('//')||/[\\]/.test(path)||path.split('?')[0].split('/').some(x=>x==='..'||x==='.'))throw Error('API path không hợp lệ.');
  const url=new URL(s.base+path);if(!url.href.startsWith(s.base+'/'))throw Error('API nằm ngoài base URL đang đăng nhập.');
  const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${s.token}`);headers.set('Accept-Language','vi');
  const response=await fetch(url,{...options,headers,signal:options.signal||AbortSignal.timeout(60000),redirect:'error'});
  const active=session();if(!active||active.base!==s.base||active.token!==s.token)throw Error('Phiên đã thay đổi khi đang gọi API. Chạy lại thao tác trên phiên mới.');
  if(response.status===401)throw Error('Phiên không hợp lệ/hết hạn. Đăng nhập lại ở trang chính.');
  return response;
 }
 async function json(path,options={}){
  const response=await request(path,options);const raw=await response.text();let value;try{value=JSON.parse(raw);}catch{throw Error(`Response không phải JSON (HTTP ${response.status}).`);}
  if(!response.ok||(value?.code!==undefined&&value.code!==0))throw Error(value?.message||`HTTP ${response.status}`);return value;
 }
 window.IsofhApp={session,requireSession,normalizeBase,isSafeBase,login,useToken,logout,request,json,home};
 const header=document.createElement('header');header.id='appHeader';
 header.innerHTML='<div class="app-header-row"><div><a class="app-brand" id="appHome">ISOFH Tools</a><div class="app-title" id="appModuleTitle"></div></div><div class="app-session"><span class="app-server" id="appServer"></span><span id="appAccount"></span><a class="app-login-link" id="appLoginLink">Đổi server / đăng nhập</a><button id="appLogout" type="button">Đăng xuất</button></div></div><div class="app-warning" id="appWarning" hidden>⚠ Bạn đang trên server thật</div>';
 document.body.prepend(header);document.getElementById('appHome').href=home;document.getElementById('appLoginLink').href=home+'#login';document.getElementById('appModuleTitle').textContent=document.title;document.getElementById('appLogout').onclick=logout;render();
 document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('appLoginForm');if(!form)return;
  const base=document.getElementById('loginBase'),account=document.getElementById('loginAccount');if(current){base.value=current.base;account.value=current.account;}
  const feedback=document.getElementById('loginFeedback');const pass=document.getElementById('loginPassword');const token=document.getElementById('loginToken');
  function showRisk(){try{const risk=!isSafeBase(normalizeBase(base.value));document.getElementById('loginRisk').hidden=!risk;}catch{document.getElementById('loginRisk').hidden=true;}}
  base.addEventListener('input',showRisk);showRisk();
  document.getElementById('serverPreset').onchange=e=>{if(e.target.value){base.value=e.target.value;showRisk();}};
  form.onsubmit=async e=>{e.preventDefault();const btn=document.getElementById('loginSubmit');btn.disabled=true;feedback.textContent='Đang đăng nhập…';feedback.className='app-feedback';try{if(token.value.trim())useToken(base.value,account.value,token.value);else await login(base.value,account.value,pass.value);pass.value='';token.value='';feedback.textContent='Đã đăng nhập. Chọn module để bắt đầu.';feedback.className='app-feedback success';}catch(e){feedback.textContent=e.message;feedback.className='app-feedback error';}finally{btn.disabled=false;}};
 });
})();
