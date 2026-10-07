// Optional local bridge, no npm dependencies. Credentials are forwarded only in memory.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
function targetPolicy(raw,method,body){
 const u=new URL(raw);if(u.username||u.password||u.hash||u.search)throw Error('URL không được chứa tài khoản/query/hash.');
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('Chỉ HTTPS, hoặc HTTP localhost.');
 const p=u.pathname;
 const read=/\/api\/his\/v1\/nb-kham-ksk\/(?:phieu-ksk-dinh-ky\/)?[1-9]\d*$/.test(p);
 const login=/\/(?:api\/auth\/login|api\/his\/v1\/auth\/(?:login|refresh))$/.test(p);
 const push=p.endsWith('/api/platform/data-sync/push');
 const query=p.endsWith('/api/his/v1/dm-mau-du-lieu/db/query');
 if(method==='GET'&&read)return u;
 if(method==='POST'&&(login||push))return u;
 if(method==='POST'&&query){const q=JSON.parse(body);if(!Array.isArray(q)||q.length!==1||typeof q[0]!=='string'||!/^\s*SELECT\b/i.test(q[0])||/[;]|--|\/\*/.test(q[0])||/\b(insert|update|delete|merge|drop|alter|create|grant|copy|call|pg_sleep|pg_read_file|dblink)\b/i.test(q[0]))throw Error('Query phải là một SELECT chỉ đọc.');
 const tables=[...q[0].matchAll(/\b(?:FROM|JOIN)\s+([\w.]+)/gi)].map(x=>x[1].toLowerCase());if(!tables.length||tables.some(t=>!['nb_kham_ksk_dv_can_lam_sang','dm_benh_vien','dm_thiet_lap','dm_thiet_lap_chi_tiet'].includes(t)))throw Error('Query nằm ngoài dữ liệu KSK.');return u;}
 throw Error('Helper chỉ cho đọc phiếu/query KSK, đăng nhập và push bản tin.');
}
async function readBody(req){let n=0,chunks=[];for await(const c of req){n+=c.length;if(n>15*1024*1024)throw Error('Request quá lớn.');chunks.push(c);}return Buffer.concat(chunks).toString('utf8');}
function start(port=8766){const csrf=crypto.randomBytes(32).toString('hex');const host='127.0.0.1:'+port;const origin='http://'+host;
 const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 try{if(req.headers.host!==host&&req.headers.host!=='localhost:'+port){res.writeHead(403);return res.end('Host không hợp lệ.');}const pathname=new URL(req.url,origin).pathname;
 if(pathname==='/__ksk/session'&&req.method==='GET'){if(req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);return res.end();}res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({csrf}));}
 if(pathname==='/__ksk/proxy'&&req.method==='POST'){
  if(![origin,'http://localhost:'+port].includes(req.headers.origin)||req.headers['x-ksk-csrf']!==csrf){res.writeHead(403);return res.end('Phiên helper không hợp lệ.');}
  const input=JSON.parse(await readBody(req));const method=input.method||'GET',target=targetPolicy(input.url,method,input.body);const headers=new Headers();
  for(const [k,v] of Object.entries(input.headers||{}))if(['authorization','content-type','accept-language','service-type'].includes(k.toLowerCase()))headers.set(k,v);
  const remote=await fetch(target,{method,headers,body:method==='GET'?undefined:input.body,redirect:'error',signal:AbortSignal.timeout(60000)});
  res.statusCode=remote.status;res.setHeader('Content-Type',remote.headers.get('Content-Type')||'application/octet-stream');
  let size=0;for await(const chunk of remote.body||[]){size+=chunk.length;if(size>30*1024*1024)throw Error('Response quá lớn.');res.write(chunk);}return res.end();
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 let relative=decodeURIComponent(pathname).replace(/^\/+/, '')||'index.html';if(relative.endsWith('/'))relative+='index.html';
 if(relative.split(/[\\/]/).some(p=>p.startsWith('.'))||!['.html','.js','.css','.json'].includes(path.extname(relative))||!['index.html','main-menu.js'].includes(relative)&&!relative.startsWith('shared/')&&!relative.startsWith('modules/')){res.writeHead(404);return res.end('Không tìm thấy.');}
 const file=path.resolve(ROOT,relative),real=await fs.realpath(file);if(!real.startsWith(ROOT+path.sep))throw Error('Path nằm ngoài tool.');
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};res.setHeader('Content-Type',mime[path.extname(real)]+'; charset=utf-8');res.end(await fs.readFile(real));
 }catch(e){if(res.headersSent)return res.destroy();res.writeHead(e.code==='ENOENT'?404:400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.code==='ENOENT'?'Không tìm thấy file.':e.name==='TypeError'?'Không kết nối được upstream hoặc URL không hợp lệ.':e.message}));}});
 server.listen(port,'127.0.0.1',()=>console.log(`KSK tool: ${origin}/modules/ksk-gateway/`));return server;
}
module.exports={targetPolicy,start};if(require.main===module)start(Number(process.env.KSK_TOOL_PORT)||8766);
