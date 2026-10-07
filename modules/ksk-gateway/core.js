import {adultBlocks} from './mapping.js';
export const blank=v=>v==null||String(v).trim()==='';
export const first=(...v)=>v.find(x=>!blank(x))??'';
export function validId(raw){const s=String(raw).trim();if(!/^[1-9]\d*$/.test(s)||!Number.isSafeInteger(Number(s)))throw Error('ID phiếu phải là số nguyên dương.');return s;}
export function dateText(value,length=8){
 if(!value)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value.replaceAll('-','')+(length===12?'0000':'');
 const d=new Date(value);if(!Number.isFinite(d.getTime()))throw Error('Ngày giờ trên phiếu không hợp lệ.');
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));
 return (p.year+p.month+p.day+p.hour+p.minute).slice(0,length);
}
export function truncateBytes(value,size){let out='',n=0;for(const char of String(value??'')){const len=new TextEncoder().encode(char).length;if(n+len>size)break;out+=char;n+=len;}return out;}
export function normalizeCls(rows,clean){return rows.map(r=>{
 const result=clean(r.ket_qua??'');let conclusion=Number(r.nhom_chi_phi_bh)===8?r.phuong_phap_can_thiep:r.ket_luan;
 if(Number(r.nhom_chi_phi_bh)===2&&blank(conclusion))conclusion=r.ket_qua;
 return {maDichVu:r.ma_dich_vu,tenDichVu:r.ten_dich_vu,maChiSo:r.ma_chi_so,tenChiSo:r.ten_chi_so,
 giaTri:Number(r.nhom_chi_phi_bh)===1?truncateBytes(result,255):'',donViDo:r.don_vi_do,
 moTa:truncateBytes(result,4000),ketLuan:truncateBytes(clean(blank(conclusion)?'.':conclusion),4000)};
});}
export function selectCls(dto,live,mode='saved'){
 const saved=dto.khamCanLamSang?.dsCls;
 return mode==='saved'&&saved?.length?structuredClone(saved):structuredClone(live);
}
export function buildAdult(dto,bv,entity,cls,signatures={}){
 if(Number(entity.loai)!==30)throw Error('Sinh XML hiện hỗ trợ phiếu đủ 18 tuổi (EMR_BA970). Có thể nhập XML sẵn cho mẫu khác.');
 const blood=['','O','A','B','AB','O_','A_','B_','AB_','CHUA_XAC_DINH','A_O','A_O_','B_O','B_O_','AB_O','AB_O_','AB_A','AB_A_','AB_B','AB_B_','O_A','O_A_','O_B','O_B_','O_AB','O_AB_','PHAT_THEO_NHOM_MAU_NB','KHONG_AP_DUNG'];
 const h={giaTriXmlKskNguoiLon:v=>v??'',dinhDangNgaySinhXmlKsk:(v,year)=>year===true&&v?dateText(v).slice(0,4)+'01010000':dateText(v,12),dinhDangNgayXmlKsk:v=>dateText(v),dinhDangNgayGioXmlKsk:v=>dateText(v,12),
 firstNonBlank:first,maNgheNghiepCap2DayCongVneid:v=>blank(v)?v:String(v).slice(0,2),bloodName:v=>typeof v==='number'?blood[v]??'':v,
 maCskcbXmlKsk:v=>v?.ma??'',maGlnXmlKsk:(d,v)=>first(d.maGln,v?.maGln),giaTriXmlDsDoiTuongKsk:v=>(v?.length?v:[16]).filter(x=>x!=null).map(x=>[17,18,19,20].includes(Number(x))?16:x).sort((a,b)=>a-b),
 maLoaiKcbKskDinhKy:()=> '15',thoiGianVaoXmlKsk:d=>d.thoiGianKetLuanKhamGanNhat??d.thoiGianVaoVien,
 giaTriHuyetApXmlKsk:(a,b)=>a==null&&b==null?'':`${a??''}/${b??''}`,chuKyDienTuBacSi:id=>signatures[id]??'',
 giaTriThiLucDayByt:v=>/^\d+\.\d+$/.test(String(v))&&Number(v)>=.1&&Number(v)<=1?String(Number((Number(v)*10).toFixed(10))):v,isBlank:blank};
 const blocks=adultBlocks(dto,bv,entity,h);
 blocks.XML11={tag:'KHAM_CAN_LAM_SANG',data:{CHI_TIET_CLS:cls.map(c=>({MA_DICH_VU:c.maDichVu??'',MA_CHI_SO:c.maChiSo??'',GIA_TRI:c.giaTri??'',DON_VI_DO:c.donViDo??'',MO_TA:c.moTa??'',KET_LUAN:c.ketLuan??'',CKDT_KET_QUA_CLS:dto.khamCanLamSang?.ckdtKetQuaCls??''}))}};
 const files=['XML1','XML2','XML7','XML8','XML9','XML10','XML11','XML12'].map(id=>({LOAIHOSO:id,NOIDUNGFILE:{[blocks[id].tag]:blocks[id].data}}));
 return {THONGTINDONVI:{MACSKCB:h.maGlnXmlKsk(dto,bv)},THONGTINHOSO:{NGAYLAP:dateText(dto.thoiGianTao||new Date().toISOString()),SOLUONGHOSO:1,DANHSACHHOSO:{HOSO:{FILEHOSO:files}}},CHUKYDONVI:{CKS_NGUOI_KET_LUAN:'',CKS_BENH_VIEN:''}};
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function element(tag,value,depth){const pad='  '.repeat(depth);if(Array.isArray(value))return value.map(x=>element(tag,x,depth)).join('');
 if(value&&typeof value==='object')return `${pad}<${tag}>\n${Object.entries(value).map(([k,v])=>element(k,v,depth+1)).join('')}${pad}</${tag}>\n`;
 return value==null||value===''?`${pad}<${tag}/>\n`:`${pad}<${tag}>${escape(value)}</${tag}>\n`;
}
export function xmlString(data){return '<?xml version="1.0" encoding="UTF-8"?>\n'+element('KHAMSUCKHOE',data,0);}
export function clsQuery(id){return `SELECT nb_dich_vu_id, nb_chi_so_con_id, ma_dich_vu, ten_dich_vu, ma_chi_so, ten_chi_so,
 bytea_to_string(ket_qua) AS ket_qua, don_vi_do, bytea_to_string(ket_luan) AS ket_luan,
 bytea_to_string(phuong_phap_can_thiep) AS phuong_phap_can_thiep, nhom_chi_phi_bh
 FROM nb_kham_ksk_dv_can_lam_sang WHERE nb_dot_dieu_tri_id = ${validId(id)}
 ORDER BY ma_dich_vu, nb_dich_vu_id, nb_chi_so_con_id`;}
export function hospitalQuery(branch){const id=branch==null?'NULL':validId(branch);return `SELECT bv.ma, bv.ten, bv.ma_gln
 FROM dm_benh_vien bv WHERE bv.ma = (
 SELECT COALESCE(NULLIF(TRIM(tl.gia_tri), ''), bytea_to_string(tl.gia_tri2))
 FROM dm_thiet_lap tl WHERE tl.ma = 'MA_BENH_VIEN' AND tl.co_so_kcb_id = ${id}
 FETCH FIRST 1 ROW ONLY)`;}
export function gatewayBase(raw){const u=new URL(String(raw).trim());if(u.username||u.password||u.search||u.hash||u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('URL cổng phải dùng HTTPS (HTTP chỉ cho localhost), không chứa tài khoản/query.');return u.href.replace(/\/+$/,'');}
export function bytesBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export const xmlBase64=xml=>bytesBase64(new TextEncoder().encode(xml));
export async function sha256Hex(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}
function der(tag,body){let size=body.length,ls=[];while(size){ls.unshift(size&255);size>>>=8;}return new Uint8Array([tag,...(body.length<128?[body.length]:[128+ls.length,...ls]),...body]);}
export function pkcs8Bytes(pem){const rsa=pem.includes('BEGIN RSA PRIVATE KEY');if(pem.includes('ENCRYPTED')||pem.includes('BEGIN')&&!rsa&&!pem.includes('BEGIN PRIVATE KEY'))throw Error('Cần RSA private key PEM hoặc Base64 PKCS#8 không mã hóa mật khẩu.');const body=pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');let data;try{data=Uint8Array.from(atob(body),c=>c.charCodeAt(0));}catch{throw Error('Private key không hợp lệ.');}if(!rsa)return data;
 return der(48,new Uint8Array([2,1,0,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,...der(4,data)]));}
export async function envelope(xml,options,pem){
 const header={version:options.version||'1.0.6',sender_id:options.sender,receiver_id:options.receiver||'TDLBYT',txn_type:'sync_checkup',msg_type:'101',data_type:'xml/base64',send_datetime:Date.now(),msg_id:options.sender+dateText(new Date().toISOString()).slice(2)+crypto.randomUUID().replaceAll('-','')};
 if(blank(header.sender_id))throw Error('Thiếu mã GLN người gửi.');const data=xmlBase64(xml);
 const input=await sha256Hex(JSON.stringify(header))+'.'+await sha256Hex(data.trim());
 const key=await crypto.subtle.importKey('pkcs8',pkcs8Bytes(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=bytesBase64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(input))));
 return {header,data,signature};
}
