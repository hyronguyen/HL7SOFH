'use strict';
const $ = id => document.getElementById(id);
const key = 'isofh-warehouse-support-v1';
const fields = ['warehouse','service','lot','quantity','issued','cutoff','department','source'];
let rows = [];
let workbookSheets = [], lastWorkbook = null;
function idValue(name, required = false) {
  const s = $(name).value.trim();
  if (!s && !required) return 'NULL';
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || (required && Number(s) === 0)) throw Error(`ID ${name} không hợp lệ`);
  return String(Number(s));
}
function time(name) {
  const s = $(name).value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) || !Number.isFinite(Date.parse(s))) throw Error(`Thời gian ${name} không hợp lệ`);
  return s.replace('T',' ') + (s.length === 16 ? ':00' : '');
}
function params() {
  const qty = Number($('quantity').value);
  if (!(qty > 0) || !Number.isFinite(qty)) throw Error('Số lượng cần đổi phải > 0');
  const issued = time('issued'), cutoff = time('cutoff');
  if (issued >= cutoff) throw Error('Mốc báo cáo phải sau thời điểm xuất');
  return { kho:idValue('warehouse',true), dv:idValue('service'), lo:idValue('lot'), dept:idValue('department'), source:idValue('source'), qty, issued, cutoff };
}
function scopes(p, alias) {
  return `(${p.dept}::bigint IS NULL OR ${alias}.kho_tai_khoa_id = ${p.dept}::bigint OR (${p.dept}::bigint = 0 AND ${alias}.kho_tai_khoa_id IS NULL))
    AND (${p.source}::bigint IS NULL OR ${alias}.nguon_su_dung_kho_id = ${p.source}::bigint OR (${p.source}::bigint = 0 AND ${alias}.nguon_su_dung_kho_id IS NULL))`;
}
function history(p, allLots = false) {
  return `WITH giao_dich AS (
  SELECT x.*, CASE WHEN x.nhap_kho THEN x.so_luong ELSE -x.so_luong END AS bien_dong
  FROM kho_nhap_xuat_tong_hop x
  LEFT JOIN nb_phieu_thu pt ON pt.id = x.phieu_thu_id
  LEFT JOIN nb_phieu_doi_tra dt ON dt.id = x.phieu_doi_tra_id
  WHERE x.kho_id = ${p.kho} AND (${p.dv}::bigint IS NULL OR x.dich_vu_id = ${p.dv}::bigint)
    ${allLots ? '' : `AND (${p.lo}::bigint IS NULL OR x.lo_nhap_id = ${p.lo}::bigint)`}
    AND ${scopes(p,'x')}
    AND x.trang_thai = 30 AND x.thoi_gian_duyet < TIMESTAMP '${p.cutoff}'
    AND (x.trang_thai_hoan IN (0,10,20)
      OR (x.loai_nhap_xuat = 120 AND pt.phieu_doi_tra_id IS NULL)
      OR (x.trang_thai_hoan = 30 AND x.loai_nhap_xuat = 115 AND dt.loai = 10))
)`;
}
function ledger(p, allLots = false) {
  return history(p,allLots) + `, luy_ke AS (
  SELECT g.*, SUM(bien_dong) OVER (
    PARTITION BY kho_id,dich_vu_id,lo_nhap_id,kho_tai_khoa_id,nguon_su_dung_kho_id
    ORDER BY thoi_gian_duyet,id,phieu_nhap_xuat_id ROWS UNBOUNDED PRECEDING) AS ton_sau,
    COUNT(*) OVER (PARTITION BY kho_id,dich_vu_id,lo_nhap_id,kho_tai_khoa_id,nguon_su_dung_kho_id,thoi_gian_duyet) AS so_dong_cung_thoi_diem
  FROM giao_dich g
)`;
}
function buildQuery(type, p) {
  if (type === 'schema') return `SELECT table_schema,table_name,column_name,data_type FROM information_schema.columns
WHERE table_name IN ('kho_nhap_xuat_tong_hop','kho_lo_nhap','kho_ton_kho','nb_dv_kho','kho_phieu_nhap_xuat_chi_tiet')
ORDER BY table_schema,table_name,ordinal_position;`;
  if (type === 'functions') return `SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proname LIKE 'kho_ton_kho_theo_thoi_gian%';`;
  if (type === 'ledger') return ledger(p) + `
SELECT id AS dong_giao_dich_id,nb_dich_vu_id,phieu_nhap_xuat_id,so_phieu,kho_id,dich_vu_id,lo_nhap_id,
 kho_tai_khoa_id,nguon_su_dung_kho_id,loai_nhap_xuat,nhap_kho,so_luong,bien_dong,thoi_gian_duyet,
 trang_thai_hoan,thanh_toan,ton_sau-bien_dong AS ton_truoc,ton_sau,so_dong_cung_thoi_diem,
 CASE WHEN bien_dong < 0 AND ton_sau < 0 AND ton_sau-bien_dong >= 0 THEN 'GIAO_DICH_LAM_TON_AM'
      WHEN bien_dong < 0 AND ton_sau < 0 THEN 'XUAT_KHI_TON_DA_AM' ELSE '' END AS nhan_dinh
FROM luy_ke ORDER BY thoi_gian_duyet,id,phieu_nhap_xuat_id;`;
  if (type === 'balance') return history(p) + `, h AS (
 SELECT kho_id,dich_vu_id,lo_nhap_id,kho_tai_khoa_id,nguon_su_dung_kho_id,
 SUM(CASE WHEN nhap_kho THEN so_luong ELSE 0 END) AS tong_nhap,
 SUM(CASE WHEN NOT nhap_kho THEN so_luong ELSE 0 END) AS tong_xuat,SUM(bien_dong) AS ton_lich_su
 FROM giao_dich GROUP BY 1,2,3,4,5
), s AS (
 SELECT kho_id,dich_vu_id,lo_nhap_id,kho_tai_khoa_id,nguon_su_dung_kho_id,
 SUM(so_luong) AS ton_luu_hien_tai,SUM(so_luong_dat_truoc) AS dat_truoc_hien_tai
 FROM kho_ton_kho t WHERE kho_id=${p.kho} AND (${p.dv}::bigint IS NULL OR dich_vu_id=${p.dv}::bigint)
 AND (${p.lo}::bigint IS NULL OR lo_nhap_id=${p.lo}::bigint) AND ${scopes(p,'t')} GROUP BY 1,2,3,4,5
)
SELECT COALESCE(h.dich_vu_id,s.dich_vu_id) AS dich_vu_id,COALESCE(h.lo_nhap_id,s.lo_nhap_id) AS lo_nhap_id,
 COALESCE(h.kho_tai_khoa_id,s.kho_tai_khoa_id) AS kho_tai_khoa_id,
 COALESCE(h.nguon_su_dung_kho_id,s.nguon_su_dung_kho_id) AS nguon_su_dung_kho_id,
 l.so_lo,l.ngay_han_su_dung,h.tong_nhap,h.tong_xuat,COALESCE(h.ton_lich_su,0) AS ton_lich_su,
 s.ton_luu_hien_tai,s.dat_truoc_hien_tai,
 s.ton_luu_hien_tai-COALESCE(h.ton_lich_su,0) AS lech_hien_tai_voi_moc_bao_cao
FROM h FULL JOIN s ON h.kho_id=s.kho_id AND h.dich_vu_id=s.dich_vu_id
 AND h.lo_nhap_id IS NOT DISTINCT FROM s.lo_nhap_id
 AND h.kho_tai_khoa_id IS NOT DISTINCT FROM s.kho_tai_khoa_id
 AND h.nguon_su_dung_kho_id IS NOT DISTINCT FROM s.nguon_su_dung_kho_id
LEFT JOIN kho_lo_nhap l ON l.id=COALESCE(h.lo_nhap_id,s.lo_nhap_id)
ORDER BY ton_lich_su,lo_nhap_id;
-- Chênh lệch với tồn hiện tại chỉ là lỗi khi mốc báo cáo đã bao gồm mọi giao dịch hiện tại.`;
  if (p.dv === 'NULL' || p.lo === 'NULL') throw Error('Chức năng này cần dịch vụ ID và lô ID');
  if (type === 'lots') return `WITH truoc AS (
 SELECT * FROM kho_ton_kho_theo_thoi_gian(${p.kho}::bigint,TIMESTAMP '${p.issued}',${p.dv}::bigint,NULL::bigint,${p.dept}::bigint,true,NULL::bigint)
), hien_tai AS (
 SELECT * FROM kho_ton_kho_theo_thoi_gian(${p.kho}::bigint,NULL::timestamp,${p.dv}::bigint,NULL::bigint,${p.dept}::bigint,true,NULL::bigint)
), ung_vien AS (
 SELECT h.lo_nhap_id,h.kho_tai_khoa_id,h.nguon_su_dung_kho_id,l.so_lo,l.ngay_han_su_dung,
 COALESCE(t.so_luong_ton,0) AS ton_luc_xuat,COALESCE(t.so_luong_dat_truoc,0) AS dat_truoc_luc_xuat,
 h.so_luong_ton AS ton_hien_tai,h.so_luong_dat_truoc AS dat_truoc_hien_tai
 FROM hien_tai h LEFT JOIN truoc t ON t.lo_nhap_id=h.lo_nhap_id
 AND t.kho_tai_khoa_id IS NOT DISTINCT FROM h.kho_tai_khoa_id
 AND t.nguon_su_dung_kho_id IS NOT DISTINCT FROM h.nguon_su_dung_kho_id
 JOIN kho_lo_nhap l ON l.id=h.lo_nhap_id WHERE ${scopes(p,'h')}
), bien_dong AS (
 SELECT x.* FROM kho_nhap_xuat_tong_hop x LEFT JOIN nb_phieu_thu pt ON pt.id=x.phieu_thu_id
 LEFT JOIN nb_phieu_doi_tra dt ON dt.id=x.phieu_doi_tra_id
 WHERE x.kho_id=${p.kho} AND x.dich_vu_id=${p.dv} AND x.trang_thai=30
 AND x.thoi_gian_duyet >= TIMESTAMP '${p.issued}'
 AND (x.trang_thai_hoan IN (0,10,20) OR (x.loai_nhap_xuat=120 AND pt.phieu_doi_tra_id IS NULL)
 OR (x.trang_thai_hoan=30 AND x.loai_nhap_xuat=115 AND dt.loai=10))
), sau_xuat AS (
 SELECT b.*,u.ton_luc_xuat + SUM(CASE WHEN b.nhap_kho THEN b.so_luong ELSE -b.so_luong END)
 OVER (PARTITION BY b.lo_nhap_id,b.kho_tai_khoa_id,b.nguon_su_dung_kho_id ORDER BY b.thoi_gian_duyet,b.id,b.phieu_nhap_xuat_id ROWS UNBOUNDED PRECEDING) AS ton
 FROM bien_dong b JOIN ung_vien u ON u.lo_nhap_id=b.lo_nhap_id
 AND u.kho_tai_khoa_id IS NOT DISTINCT FROM b.kho_tai_khoa_id
 AND u.nguon_su_dung_kho_id IS NOT DISTINCT FROM b.nguon_su_dung_kho_id
), danh_gia AS (
 SELECT u.*,LEAST(u.ton_luc_xuat,COALESCE(m.ton_min,u.ton_luc_xuat)) AS ton_thap_nhat_sau_xuat
 FROM ung_vien u LEFT JOIN (
 SELECT lo_nhap_id,kho_tai_khoa_id,nguon_su_dung_kho_id,MIN(ton) AS ton_min FROM sau_xuat GROUP BY 1,2,3
 ) m ON m.lo_nhap_id=u.lo_nhap_id AND m.kho_tai_khoa_id IS NOT DISTINCT FROM u.kho_tai_khoa_id
 AND m.nguon_su_dung_kho_id IS NOT DISTINCT FROM u.nguon_su_dung_kho_id
)
SELECT *,ton_luc_xuat-dat_truoc_luc_xuat AS kha_dung_luc_xuat,
 ton_hien_tai-dat_truoc_hien_tai AS kha_dung_hien_tai,
 CASE WHEN lo_nhap_id=${p.lo} THEN 'LO_CU'
 WHEN ngay_han_su_dung IS NULL THEN 'CAN_XAC_MINH_HSD'
 WHEN ngay_han_su_dung < DATE '${p.issued.slice(0,10)}' THEN 'HET_HAN_LUC_XUAT'
 WHEN ton_luc_xuat-dat_truoc_luc_xuat < ${p.qty} THEN 'THIEU_TON_LUC_XUAT'
 WHEN ton_hien_tai-dat_truoc_hien_tai < ${p.qty} THEN 'THIEU_TON_HIEN_TAI'
 WHEN ton_thap_nhat_sau_xuat < ${p.qty} THEN 'DOI_LO_SE_LAM_AM_LICH_SU'
 ELSE 'UNG_VIEN_CAN_KIEM_TRA_NGHIEP_VU' END AS ket_luan
FROM danh_gia ORDER BY ngay_han_su_dung,lo_nhap_id;
-- Đánh giá riêng từng phạm vi. Nhiều dòng đổi vào cùng lô phải cộng tổng nhu cầu.
-- Đặt trước lịch sử và thứ tự giao dịch cùng timestamp cần đối chiếu thêm.`;
  if (type === 'receipts') return `SELECT CASE WHEN p.id=l.phieu_nhap_id THEN 'PHIEU_TAO_LO'
 WHEN p.kho_id=${p.kho} THEN 'NHAP_VAO_KHO_CAN_CHECK' ELSE 'NHAP_KHO_KHAC' END AS vai_tro,
 l.id AS lo_nhap_id,l.so_lo,l.phieu_nhap_id AS phieu_tao_lo_id,
 p.id AS phieu_nhap_xuat_id,p.so_phieu,p.kho_id,p.kho_doi_ung_id,p.loai_nhap_xuat,p.trang_thai,
 p.thoi_gian_duyet,p.so_hoa_don,p.ngay_hoa_don,p.ghi_chu,p.ly_do,
 c.id AS ds_nhap_xuat_chi_tiet_id,c.dich_vu_id,c.so_luong_yeu_cau,c.so_luong,c.phieu_doi_ung_id AS chi_tiet_doi_ung_id
FROM kho_lo_nhap l JOIN kho_phieu_nhap_xuat_chi_tiet c ON c.lo_nhap_id=l.id
JOIN kho_phieu_nhap_xuat p ON p.id=c.phieu_nhap_xuat_id
WHERE l.id=${p.lo} AND c.dich_vu_id=${p.dv} AND p.nhap_kho=true
ORDER BY p.thoi_gian_duyet,p.id,c.id;`;
  if (type === 'patient') return `SELECT n.id AS nb_dich_vu_id,d.dich_vu_id,n.lo_nhap_id,n.so_luong,n.so_luong_tra,
 d.thanh_toan,d.trang_thai_hoan,d.thoi_gian_chi_dinh,p.id AS phieu_nhap_xuat_id,p.so_phieu,
 p.kho_id,p.loai_nhap_xuat,p.trang_thai,p.thoi_gian_duyet,n.kho_tai_khoa_id,n.nguon_su_dung_kho_id
FROM nb_dv_kho n JOIN nb_dich_vu d ON d.id=n.id
JOIN kho_phieu_nhap_xuat p ON p.id=n.phieu_nhap_xuat_id
WHERE p.kho_id=${p.kho} AND d.dich_vu_id=${p.dv} AND n.lo_nhap_id=${p.lo}
 AND ${scopes(p,'n')} ORDER BY d.thoi_gian_chi_dinh,n.id;`;
  throw Error('Loại query không hỗ trợ');
}
function status(s) { $('status').textContent=s; }
function safe(action) { return async () => { try { await action(); } catch(e) { status(e.message); } }; }
function download(name,text,mime='text/plain') {
  const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function analyze(value) {
  if (value && !Array.isArray(value) && value.code !== undefined && value.code !== 0) throw Error(value.message || `API code ${value.code}`);
  const data=Array.isArray(value)?value:value?.data;
  if (!Array.isArray(data)) throw Error('Cần mảng JSON hoặc response có data là mảng');
  if (data.some(r=>!r || typeof r!=='object' || Array.isArray(r))) throw Error('Mỗi dòng phải là object');
  rows=data;
  const notes=[];let negatives=0;
  const stockKeys=['soLuongDung','ton_lich_su','ton_sau','so_luong_ton'];
  for(const r of rows) {
    const k=stockKeys.find(k=>r[k]!==undefined && r[k]!==null);
    if(k && Number(r[k])<0) negatives++;
    if(r.soLuongDung!==undefined && Number(r.soLuongDung)<0) notes.push(`Lô ${r.loNhapId}: soLuongDung=${r.soLuongDung}; nhập đúng ${r.soLuongNhapDung ?? '?'}, xuất đúng ${r.soLuongXuatDung ?? '?'}. soLuongSauCapNhat=${r.soLuongSauCapNhat ?? '?'} không chứng minh lịch sử đã hết âm.`);
    if(r.nhan_dinh==='GIAO_DICH_LAM_TON_AM') notes.push(`Dòng ${r.dong_giao_dich_id}, phiếu ${r.phieu_nhap_xuat_id}: ${r.ton_truoc} → ${r.ton_sau}. Đây là dấu vết lũy kế tính lại; cần kiểm tra log/audit để kết luận nguyên nhân duyệt vượt tồn.`);
  }
  const candidates=rows.filter(r=>r.ket_luan==='UNG_VIEN_CAN_KIEM_TRA_NGHIEP_VU');
  if(rows.some(r=>r.ket_luan)) notes.push(`${candidates.length} dòng ứng viên thay thế. Phải kiểm tra phạm vi, tổng lượng đổi, giá/thầu và điều kiện nghiệp vụ trước khi đổi.`);
  $('findings').textContent=rows.length?`${rows.length} dòng; ${negatives} dòng có tồn âm.\n${notes.join('\n')}`:'Không có dữ liệu. Chưa thể kết luận tồn bằng 0; kiểm tra kho/dịch vụ/lô, phạm vi, mốc thời gian và nguồn API.';
  $('findings').style.whiteSpace='pre-wrap';
  const table=document.createElement('table'), head=document.createElement('thead'), body=document.createElement('tbody');
  const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];const tr=document.createElement('tr');
  cols.forEach(k=>{const th=document.createElement('th');th.textContent=k;tr.append(th);});head.append(tr);
  rows.forEach(r=>{const tr=document.createElement('tr');cols.forEach(k=>{const td=document.createElement('td');td.textContent=r[k]===null?'NULL':typeof r[k]==='object'?JSON.stringify(r[k]):String(r[k]??'');if(stockKeys.includes(k)&&Number(r[k])<0)td.className='negative';tr.append(td);});body.append(tr);});
  table.append(head,body);$('table').replaceChildren(table);status('Đã phân tích dữ liệu.');
}
function apiPreview() {
  const p=params();const base=IsofhApp.session()?.base || '<base-url>/api/his/v1';
  const q=new URLSearchParams({khoId:p.kho,thoiGian:time('cutoff').replace(' ','T')+'+07:00',tachLo:'true'});
  if(p.dv!=='NULL')q.set('dichVuId',p.dv);if(p.lo!=='NULL')q.set('loNhapId',p.lo);
  const apiPath=`/${$('endpoint').value}/ton-kho-theo-thoi-gian?${q}`;
  $('apiPreview').textContent=`GET ${base}${apiPath}\n\nMẫu cập nhật tồn (có thay đổi dữ liệu, chạy thủ công nếu được phép):\nPOST ${base}/kho-ton-kho/cap-nhat-sl-ton\n${JSON.stringify({dsKhoId:[Number(p.kho)],...(p.dv==='NULL'?{}:{dichVuId:Number(p.dv)})},null,2)}`;return apiPath;
}
$('generate').onclick=safe(()=>{$('sql').value=buildQuery($('queryType').value,params());status('Đã sinh SQL; chưa chạy DB.');});
$('copySql').onclick=safe(async()=>{await navigator.clipboard.writeText($('sql').value);status('Đã copy SQL.');});
$('downloadSql').onclick=()=>download('ho-tro-kho.sql',$('sql').value);
$('save').onclick=safe(()=>{localStorage.setItem(key,JSON.stringify(Object.fromEntries(fields.map(k=>[k,$(k).value]))));status('Đã lưu case, không lưu token.');});
$('example').onclick=()=>{Object.entries({warehouse:'613',service:'28017',lot:'79144',quantity:'3',issued:'2025-09-26T09:49:20',cutoff:'2026-10-02T00:00:00',department:'',source:''}).forEach(([k,v])=>$(k).value=v);};
$('analyze').onclick=safe(()=>analyze(JSON.parse($('payload').value)));
$('exportJson').onclick=()=>download('ket-qua-kho.json',JSON.stringify(rows,null,2),'application/json');
$('exportCsv').onclick=()=>{const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];const cell=v=>{let s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);if(/^[=+@-]/.test(s)&&typeof v!=='number')s="'"+s;return '"'+s.replaceAll('"','""')+'"';};download('ket-qua-kho.csv','\uFEFF'+[cols.map(cell).join(','),...rows.map(r=>cols.map(k=>cell(r[k])).join(','))].join('\r\n'),'text/csv;charset=utf-8');};
$('exportReport').onclick=()=>download('case-kho.txt',`Hỗ trợ Kho\n${new Date().toISOString()}\n${JSON.stringify(Object.fromEntries(fields.filter(k=>k!=='server').map(k=>[k,$(k).value])),null,2)}\n\n${$('findings').textContent}\n\n${$('sql').value}\n\n${JSON.stringify(rows,null,2)}`);
$('previewApi').onclick=safe(apiPreview);
$('fetchApi').onclick=safe(async()=>{const session=IsofhApp.requireSession();$('fetchApi').disabled=true;status('Đang tra tồn bằng GET trên '+session.base);try{const payload=await IsofhApp.json(apiPreview());$('payload').value=JSON.stringify(payload,null,2);analyze(payload);}finally{$('fetchApi').disabled=false;}});
function generatedReadQuery() {
  const expected=buildQuery($('queryType').value,params());
  if($('sql').value!==expected)throw Error('Thông tin case hoặc loại query đã thay đổi. Sinh lại SQL trước khi chạy.');
  // Chỉ chạy mẫu đọc đã sinh, không nhận SQL tùy ý hoặc nhiều statement.
  const sql=expected.replace(/--[^\n]*/g,'').trim().replace(/;\s*$/,'');
  if(sql.includes(';')||!/^\s*(SELECT|WITH)\b/i.test(sql))throw Error('Chỉ cho phép một query SELECT/WITH.');
  return sql;
}
function showWorkbookSheet() {
 const sheet=workbookSheets[Number($('sheetSelect').value)];if(!sheet)return;
 $('payload').value=JSON.stringify(sheet.rows,null,2);analyze(sheet.rows);
}
$('runQuery').onclick=safe(async()=>{
 const session=IsofhApp.requireSession();const sql=generatedReadQuery();$('runQuery').disabled=true;
 status('Đang chạy query trên '+session.base+' · '+session.account+'…');
 try {
  const response=await IsofhApp.request('/dm-mau-du-lieu/db/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([sql])});
  if(!response.ok){const raw=await response.text();let message=raw;try{message=JSON.parse(raw).message||raw;}catch{}throw Error(`Query HTTP ${response.status}: ${message.slice(0,800)}`);}
  const buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);
  if(bytes[0]!==0x50||bytes[1]!==0x4b){const text=new TextDecoder().decode(buffer);let payload;try{payload=JSON.parse(text);}catch{throw Error('API không trả XLSX hoặc JSON.');}analyze(payload);$('payload').value=JSON.stringify(payload,null,2);lastWorkbook=null;workbookSheets=[];$('workbookTools').hidden=true;return;}
  lastWorkbook=buffer;$('workbookTools').hidden=false;$('sheetSelect').replaceChildren();
  try{workbookSheets=await IsofhXlsx.readWorkbook(buffer);}catch(e){workbookSheets=[];throw Error('Đã nhận file Excel. Chọn Tải Excel để xem; chưa đọc được trên trình duyệt: '+e.message);}
  workbookSheets.forEach((sheet,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${sheet.name} (${sheet.rows.length} dòng)`;$('sheetSelect').append(option);});
  $('sheetSelect').value='0';showWorkbookSheet();status('Query xong trên '+session.base+' · '+workbookSheets.length+' sheet.');
 }finally{$('runQuery').disabled=false;}
});
$('sheetSelect').onchange=safe(showWorkbookSheet);
$('downloadWorkbook').onclick=()=>{if(lastWorkbook)download('Query-kho.xlsx',lastWorkbook,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');};
window.addEventListener('isofh-session-change',()=>{rows=[];workbookSheets=[];lastWorkbook=null;$('table').replaceChildren();$('payload').value='';$('findings').textContent='Phiên đã thay đổi; chạy lại query trên server mới.';$('workbookTools').hidden=true;apiPreview();});
try{const saved=JSON.parse(localStorage.getItem(key)||'{}');fields.forEach(k=>{if(saved[k]!==undefined)$(k).value=saved[k];});}catch{/* Cấu hình hỏng không chặn module. */}
$('generate').click();
