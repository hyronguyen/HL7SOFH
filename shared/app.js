(function(){
 'use strict';
 const KEY='isofh-tools-session-v1';
 const PROFILE_KEY='isofh-tools-login-profile-v1';
 const script=document.currentScript;
 const home=new URL('../index.html',script.src).href;
 let current=null;
 let refreshPromise=null,refreshRetryAt=0,authVersion=0;
 function normalizeBase(input){
  const url=new URL(input.trim());
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Base URL phải là HTTP/HTTPS, không chứa tài khoản, query hoặc #.');
  let path=url.pathname.replace(/\/+$/,'');
  if(!path.endsWith('/api/his/v1'))path+='/api/his/v1';
  return url.origin+path;
 }
 function isSafeBase(base){
  const host=new URL(base).hostname.toLowerCase();
  return /^(?:api-)?sakura-(?:test|stable)\.isofh\.vn$/.test(host);
 }
 function confirmHttp(base){
  if(new URL(base).protocol==='http:'&&!window.confirm('Bạn đang kết nối qua HTTP: thông tin đăng nhập và token không được mã hóa khi truyền. Chỉ tiếp tục trên mạng tin cậy. Bạn có muốn tiếp tục?'))throw Error('Đã hủy kết nối HTTP.');
 }
 function expiry(token){try{const claim=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return typeof claim.exp==='number'?claim.exp*1000:null;}catch{return null;}}
 function read(){try{const s=JSON.parse(sessionStorage.getItem(KEY)||'null');if(s&&s.base&&s.token&&s.account){normalizeBase(s.base);return s;}}catch{}return null;}
 current=read();
 function session(){return current?{...current}:null;}
 function requireSession(){const s=session();if(!s)throw Error('Chưa đăng nhập. Về trang chính để chọn server và tài khoản.');if(s.expiresAt&&s.expiresAt<=Date.now()&&!s.refreshToken)throw Error('Phiên đăng nhập đã hết hạn. Về trang chính để đăng nhập lại.');return s;}
 async function refreshSession(){
  if(refreshPromise)return refreshPromise;const s=session(),version=authVersion;if(!s?.refreshToken)throw Error('Không có refresh token. Về trang chính để đăng nhập lại.');
  refreshPromise=(async()=>{try{const response=await fetch(s.base+'/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json','Accept-Language':'vi'},body:JSON.stringify({refreshToken:s.refreshToken}),signal:AbortSignal.timeout(30000),redirect:'error'});const payload=await response.json(),data=payload?.data;if(!response.ok||(payload.code!==undefined&&payload.code!==0)||!data?.access_token)throw Error('Không thể làm mới phiên. Về trang chính để đăng nhập lại.');if(version!==authVersion)throw Error('Phiên đã thay đổi trong khi làm mới token.');const next={...s,token:data.access_token,refreshToken:data.refresh_token||s.refreshToken,expiresAt:expiry(data.access_token)||(data.expires_in?Date.now()+Number(data.expires_in)*1000:null)};sessionStorage.setItem(KEY,JSON.stringify(next));current=next;refreshRetryAt=0;render();return session();}catch(e){if(version===authVersion)refreshRetryAt=Date.now()+60000;throw e;}finally{refreshPromise=null;}})();return refreshPromise;
 }
 async function readySession(){const s=requireSession();if(s.refreshToken&&s.expiresAt&&s.expiresAt<=Date.now()+60000)return refreshSession();return s;}
 function render(){
  const h=document.getElementById('appHeader');if(!h)return;
  const s=session();h.dataset.risk=String(Boolean(s&&!isSafeBase(s.base)));
  document.getElementById('appServer').textContent=s?s.base:'Chưa chọn server';
  document.getElementById('appAccount').textContent=s?`Tài khoản: ${s.account}${s.expiresAt&&s.expiresAt<=Date.now()?' · Hết hạn':''}`:'Chưa đăng nhập';
  document.getElementById('appWarning').hidden=!(s&&!isSafeBase(s.base));
  document.getElementById('appWarning').textContent=(s&&!isSafeBase(s.base)?'⚠ Bạn đang trên server thật':'')+(s&&new URL(s.base).protocol==='http:'?' · HTTP không mã hóa thông tin đăng nhập / token':'');
  if(s&&new URL(s.base).protocol==='http:'){document.getElementById('appWarning').hidden=false;h.dataset.risk='true';}
  document.getElementById('appLogout').hidden=!s;
 }
 function store(s){sessionStorage.setItem(KEY,JSON.stringify(s));current=s;authVersion++;refreshRetryAt=0;try{localStorage.setItem(PROFILE_KEY,JSON.stringify({base:s.base,account:s.account}));}catch{}render();window.dispatchEvent(new CustomEvent('isofh-session-change'));}
 function logout(){authVersion++;current=null;sessionStorage.removeItem(KEY);localStorage.removeItem('token');render();window.dispatchEvent(new CustomEvent('isofh-session-change'));}
 async function login(base,account,password){
  const normalized=normalizeBase(base);if(!account.trim()||!password)throw Error('Nhập tài khoản và mật khẩu / mã băm đăng nhập HIS.');
  confirmHttp(normalized);
  const response=await fetch(normalized+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json','Accept-Language':'vi'},body:JSON.stringify({taiKhoan:account.trim(),matKhau:password}),signal:AbortSignal.timeout(30000)});
  const payload=await response.json();const token=payload?.data?.access_token;
  if(!response.ok||(payload.code!==undefined&&payload.code!==0)||!token)throw Error(payload.message||`Đăng nhập thất bại (HTTP ${response.status}).`);
  store({base:normalized,account:account.trim(),token,refreshToken:payload.data.refresh_token||null,expiresAt:expiry(token)||(payload.data.expires_in?Date.now()+Number(payload.data.expires_in)*1000:null)});return session();
 }
 function useToken(base,account,token){const raw=token.trim().replace(/^Bearer\s+/i,'');if(!raw||!account.trim())throw Error('Nhập token và tên tài khoản để nhận diện phiên.');const end=expiry(raw);if(end&&end<=Date.now())throw Error('Token đã hết hạn.');const normalized=normalizeBase(base);confirmHttp(normalized);store({base:normalized,account:account.trim(),token:raw,expiresAt:end});return session();}
 async function request(path,options={}){
  const s=await readySession(),version=authVersion;if(!path.startsWith('/')||path.startsWith('//')||/[\\]/.test(path)||path.split('?')[0].split('/').some(x=>x==='..'||x==='.'))throw Error('API path không hợp lệ.');
  const url=new URL(s.base+path);if(!url.href.startsWith(s.base+'/'))throw Error('API nằm ngoài base URL đang đăng nhập.');
  const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${s.token}`);headers.set('Accept-Language','vi');
  const response=await fetch(url,{...options,headers,signal:options.signal||AbortSignal.timeout(60000),redirect:'error'});
  const active=session();if(!active||version!==authVersion||active.base!==s.base||active.account!==s.account)throw Error('Phiên đã thay đổi khi đang gọi API. Chạy lại thao tác trên phiên mới.');
  if(response.status===401)throw Error('Phiên không hợp lệ/hết hạn. Đăng nhập lại ở trang chính.');
  return response;
 }
 async function json(path,options={}){
  const response=await request(path,options);const raw=await response.text();let value;try{value=JSON.parse(raw);}catch{throw Error(`Response không phải JSON (HTTP ${response.status}).`);}
  if(!response.ok||(value?.code!==undefined&&value.code!==0))throw Error(value?.message||`HTTP ${response.status}`);return value;
 }
 window.IsofhApp={session,requireSession,readySession,refreshSession,normalizeBase,isSafeBase,login,useToken,logout,request,json,home};
 const header=document.createElement('header');header.id='appHeader';
 header.innerHTML='<div class="app-header-row"><div><a class="app-brand" id="appHome">ISOFH Tools</a><div class="app-title" id="appModuleTitle"></div></div><div class="app-session"><span class="app-server" id="appServer"></span><span id="appAccount"></span><a class="app-login-link" id="appLoginLink">Đổi server / đăng nhập</a><button id="appLogout" type="button">Đăng xuất</button></div></div><div class="app-warning" id="appWarning" hidden>⚠ Bạn đang trên server thật</div>';
 document.body.prepend(header);document.getElementById('appHome').href=home;document.getElementById('appLoginLink').href=home+'#login';document.getElementById('appModuleTitle').textContent=document.title;document.getElementById('appLogout').onclick=logout;render();
 document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('appLoginForm');if(!form)return;
  const base=document.getElementById('loginBase'),account=document.getElementById('loginAccount');let profile=null;try{profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');}catch{}if(current){base.value=current.base;account.value=current.account;}else if(profile?.base&&profile?.account){try{base.value=normalizeBase(profile.base);account.value=profile.account;}catch{}}
  const feedback=document.getElementById('loginFeedback');const pass=document.getElementById('loginPassword');const token=document.getElementById('loginToken');
  function showRisk(){try{const risk=!isSafeBase(normalizeBase(base.value));document.getElementById('loginRisk').hidden=!risk;}catch{document.getElementById('loginRisk').hidden=true;}}
  base.addEventListener('input',showRisk);showRisk();
  document.getElementById('serverPreset').onchange=e=>{if(e.target.value){base.value=e.target.value;showRisk();}};
  form.onsubmit=async e=>{e.preventDefault();const btn=document.getElementById('loginSubmit');btn.disabled=true;feedback.textContent='Đang đăng nhập…';feedback.className='app-feedback';try{if(token.value.trim())useToken(base.value,account.value,token.value);else await login(base.value,account.value,pass.value);pass.value='';token.value='';feedback.textContent='Đã đăng nhập. Chọn module để bắt đầu.';feedback.className='app-feedback success';}catch(e){feedback.textContent=e.message;feedback.className='app-feedback error';}finally{btn.disabled=false;}};
 });
 function autoRefresh(){render();if(current?.refreshToken&&current.expiresAt&&current.expiresAt<=Date.now()+60000&&Date.now()>=refreshRetryAt)refreshSession().catch(()=>{render();});}
 setInterval(autoRefresh,15000);window.addEventListener('focus',autoRefresh);autoRefresh();
})();
