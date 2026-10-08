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
 return {nbDichVuId:r.nb_dich_vu_id,nbChiSoConId:r.nb_chi_so_con_id,dichVuId:r.dich_vu_id,maDmDichVu:r.ma_dm_dich_vu,maDichVu:r.ma_dich_vu,tenDichVu:r.ten_dich_vu,maChiSo:r.ma_chi_so,tenChiSo:r.ten_chi_so,maLis:r.ma_lis,donViLis:r.don_vi_lis,
 giaTri:Number(r.nhom_chi_phi_bh)===1?truncateBytes(result,255):'',donViDo:r.don_vi_do,
 moTa:truncateBytes(result,4000),ketLuan:truncateBytes(clean(blank(conclusion)?'.':conclusion),4000)};
});}
export function mapLisCls(live,catalog){
 if(!Array.isArray(catalog))throw Error('Nguồn chưa có danh mục chỉ số con. Query lại phiếu để ánh xạ LIS.');
 const index=new Map();
 for(const dm of catalog){
  if(![true,1,'true','TRUE','1'].includes(dm.active)||blank(dm.dich_vu_id)||blank(dm.ma_ket_noi))continue;
  const key=JSON.stringify([String(dm.dich_vu_id),String(dm.ma_ket_noi).trim()]);
  const entries=index.get(key)||[];entries.push(dm);index.set(key,entries);
 }
 return live.map(original=>{
  const c=structuredClone(original);
  const mapping={originalCode:c.maChiSo??'',originalUnit:c.donViDo??'',status:'not-child',label:'Không có chỉ số con',candidates:[]};
  c.mapping=mapping;
  if(blank(c.nbChiSoConId))return c;
  if(blank(c.maLis)||blank(c.dichVuId)){mapping.status='missing-source';mapping.label='Thiếu mã LIS gốc hoặc ID dịch vụ; giữ nguyên';return c;}
  const matches=index.get(JSON.stringify([String(c.dichVuId),String(c.maLis).trim()]))||[];
  mapping.candidates=matches.map(dm=>({id:dm.id,ma:dm.ma,maKetNoi:dm.ma_ket_noi,maTuongDuong:dm.ma_tuong_duong,donVi:dm.don_vi}));
  if(matches.length!==1){mapping.status=matches.length?'ambiguous':'unmatched';mapping.label=matches.length?`Trùng ${matches.length} chỉ số DM đang dùng; giữ nguyên`:'Không khớp mã gửi LIS trong DM đang dùng; giữ nguyên';return c;}
  const dm=matches[0];mapping.catalogId=dm.id;
  c.donViDo=dm.don_vi??'';
  if(blank(dm.ma_tuong_duong)){mapping.status='missing-equivalent';mapping.label='Khớp DM; thiếu mã tương đương, giữ mã cũ';}
  else{c.maChiSo=String(dm.ma_tuong_duong).trim();mapping.status='mapped';mapping.label='Đã ánh xạ mã + đơn vị';}
  if(blank(c.donViDo))mapping.label+='; đơn vị DM trống';
  mapping.unitChanged=String(c.donViDo)!==String(mapping.originalUnit);
  return c;
 });
}
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
export function catalogServiceCodes(cls,rows){
 const candidates=cls.nbDichVuId!=null?rows.filter(r=>String(r.nb_dich_vu_id)===String(cls.nbDichVuId)):
 cls.dichVuId!=null?rows.filter(r=>String(r.dich_vu_id)===String(cls.dichVuId)):
 blank(cls.maDichVu)?[]:rows.filter(r=>r.ma_dich_vu===cls.maDichVu);
 return [...new Set(candidates.map(r=>r.ma_dm_dich_vu).filter(v=>!blank(v)))].sort();
}
export function clsQuery(id){return `SELECT cls.nb_dich_vu_id, cls.nb_chi_so_con_id, cls.dich_vu_id,
 dv.ma AS ma_dm_dich_vu, cls.ma_dich_vu, cls.ten_dich_vu, cls.ma_chi_so, cls.ten_chi_so,
 lis.ma_chi_so_con AS ma_lis, lis.don_vi AS don_vi_lis,
 bytea_to_string(cls.ket_qua) AS ket_qua, cls.don_vi_do, bytea_to_string(cls.ket_luan) AS ket_luan,
 bytea_to_string(cls.phuong_phap_can_thiep) AS phuong_phap_can_thiep, cls.nhom_chi_phi_bh
 FROM nb_kham_ksk_dv_can_lam_sang cls
 LEFT JOIN dm_dich_vu dv ON dv.id = cls.dich_vu_id
 LEFT JOIN nb_dv_xet_nghiem_chi_so_con lis ON lis.id = cls.nb_chi_so_con_id
 WHERE cls.nb_dot_dieu_tri_id = ${validId(id)}
 ORDER BY cls.ma_dich_vu, cls.nb_dich_vu_id, cls.nb_chi_so_con_id`;}
export function childCatalogQuery(id){return `SELECT dm.id, dm.dich_vu_id, dm.ma, dm.ten, dm.ma_ket_noi,
 dm.ma_tuong_duong, dm.ten_tuong_duong, dm.don_vi, dm.active
 FROM dm_chi_so_con dm
 WHERE dm.active = true_() AND EXISTS (
 SELECT 1 FROM nb_kham_ksk_dv_can_lam_sang cls
 JOIN nb_dv_xet_nghiem_chi_so_con lis ON lis.id = cls.nb_chi_so_con_id
 WHERE cls.nb_dot_dieu_tri_id = ${validId(id)} AND cls.dich_vu_id = dm.dich_vu_id
 AND TRIM(lis.ma_chi_so_con) = TRIM(dm.ma_ket_noi))
 ORDER BY dm.dich_vu_id, dm.ma_ket_noi, dm.id`;}
export function hospitalQuery(branch){const id=branch==null?'NULL':validId(branch);return `SELECT bv.ma, bv.ten, bv.ma_gln
 FROM dm_benh_vien bv WHERE bv.ma = (
 SELECT COALESCE(NULLIF(TRIM(tl.gia_tri), ''), bytea_to_string(tl.gia_tri2))
 FROM dm_thiet_lap tl WHERE tl.ma = 'MA_BENH_VIEN' AND tl.co_so_kcb_id = ${id}
 FETCH FIRST 1 ROW ONLY)`;}
export function gatewayBase(raw){const u=new URL(String(raw).trim());if(u.username||u.password||u.search||u.hash||u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('URL cổng phải dùng HTTPS (HTTP chỉ cho localhost), không chứa tài khoản/query.');return u.href.replace(/\/+$/,'');}
export function gatewayLoginToken(auth){
 const header=auth.json?.header,data=auth.json?.data;
 if(!auth.ok||header?.success!==true)throw Error(`Đăng nhập cổng thất bại (HTTP ${auth.http}): ${header?.res_msg||header?.res_code||'Cổng không xác nhận đăng nhập thành công.'}`);
 const value=[data?.token,data?.access_token].map(v=>typeof v==='string'?v.trim().replace(/^Bearer\s+/i,'').trim():'').find(v=>!blank(v)&&v.toLowerCase()!=='bearer');
 if(!value)throw Error('Cổng xác nhận đăng nhập thành công nhưng không trả token truy cập (data.token hoặc data.access_token)'+(!blank(data?.refresh_token)?'; chỉ có refresh_token.':'.')+' Chưa gọi API đẩy. Kiểm tra tài khoản API do cổng cấp hoặc nhập token truy cập vào ô “Token có sẵn”.');
 return value;
}
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
