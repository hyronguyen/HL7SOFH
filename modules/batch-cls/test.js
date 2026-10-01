'use strict';

const $ = (id) => document.getElementById(id);
const state = { token: null, results: [], controller: null, lastMaHoSo: null };
const SETTINGS_KEY = 'qms-cls-test-console-settings-v2';

function numberValue(id) {
    const value = Number($(id).value);
    if (!Number.isFinite(value)) throw new Error(`Giá trị ${id} không hợp lệ`);
    return value;
}

function getSettings() {
    return {
        apiBase: $('apiBase').value.trim().replace(/\/$/, ''),
        roomId: numberValue('roomId'), serviceId: numberValue('serviceId'),
        doctorId: numberValue('doctorId'), configuredDeptId: numberValue('configuredDeptId'),
        otherDeptId: numberValue('otherDeptId'), receptionDeskId: numberValue('receptionDeskId'),
        patientTypeId: numberValue('patientTypeId'), delayMs: Math.max(0, numberValue('delayMs')),
        patientPrefix: $('patientPrefix').value.trim() || 'Test QMS CLS',
        splitPriority: $('splitPriority').checked
    };
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(getSettings()));
    notify('Đã lưu URL và các ID. Token/mật khẩu không được lưu.', 'success');
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        const map = { apiBase:'apiBase', roomId:'roomId', serviceId:'serviceId', doctorId:'doctorId', configuredDeptId:'configuredDeptId', otherDeptId:'otherDeptId', receptionDeskId:'receptionDeskId', patientTypeId:'patientTypeId', delayMs:'delayMs', patientPrefix:'patientPrefix' };
        Object.entries(map).forEach(([key,id]) => { if (saved[key] !== undefined) $(id).value = saved[key]; });
        if (saved.splitPriority !== undefined) $('splitPriority').checked = Boolean(saved.splitPriority);
    } catch (error) { console.warn('Không đọc được cấu hình cũ', error); }
}

function notify(message, type = 'info') {
    const holder = document.createElement('div');
    holder.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3 shadow`;
    holder.style.zIndex = '9999'; holder.textContent = message;
    document.body.appendChild(holder); setTimeout(() => holder.remove(), 3500);
}

function setConnection(ok, text) {
    $('connectionDot').className = `status-dot ${ok ? 'ok' : 'bad'}`;
    $('connectionText').textContent = text;
}

function assertTestEnvironment() {
    if (!$('confirmTestEnv').checked) throw new Error('Bạn chưa xác nhận môi trường test/dev');
    const host = new URL(getSettings().apiBase).hostname.toLowerCase();
    if (!/(test|dev|stg|stage|localhost|127\.0\.0\.1)/.test(host)) {
        throw new Error(`Từ chối tạo dữ liệu trên host không có dấu hiệu test/dev: ${host}`);
    }
}

async function login(force = false) {
    const manual = $('manualToken').value.trim().replace(/^Bearer\s+/i, '');
    if (manual) { state.token = manual; setConnection(true, 'Dùng token nhập tay'); return manual; }
    if (state.token && !force) return state.token;
    const taiKhoan = $('username').value.trim();
    const matKhau = $('password').value;
    if (!taiKhoan || !matKhau) throw new Error('Cần nhập tài khoản/mật khẩu hoặc Bearer token');
    const response = await fetch(`${getSettings().apiBase}/auth/login`, {
        method:'POST', headers:{'Content-Type':'application/json','Accept-Language':'vi'},
        body:JSON.stringify({taiKhoan, matKhau})
    });
    const payload = await readResponse(response);
    const token = payload?.data?.access_token;
    if (!response.ok || !token) throw new Error(errorMessage(payload, response.status));
    state.token = token; setConnection(true, `Đã đăng nhập: ${taiKhoan}`); return token;
}

async function readResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { raw:text }; }
}

function errorMessage(payload, status) {
    return payload?.message || payload?.error || payload?.raw || `HTTP ${status}`;
}

async function api(method, path, body, options = {}) {
    const token = await login();
    const headers = {'Accept-Language':'vi', Authorization:`Bearer ${token}`};
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
    const request = { method, headers, signal:options.signal };
    if (body !== undefined && body !== null) request.body = JSON.stringify(body);
    let response = await fetch(`${getSettings().apiBase}${path.startsWith('/') ? path : `/${path}`}`, request);
    if (response.status === 401 && !$('manualToken').value.trim()) {
        const refreshed = await login(true); request.headers.Authorization = `Bearer ${refreshed}`;
        response = await fetch(`${getSettings().apiBase}${path.startsWith('/') ? path : `/${path}`}`, request);
    }
    const payload = await readResponse(response);
    if (!response.ok || (payload?.code !== undefined && payload.code !== 0)) {
        throw new Error(errorMessage(payload, response.status));
    }
    return payload;
}

function parseJson(id, label) {
    try { return JSON.parse($(id).value || 'null'); }
    catch (error) { throw new Error(`${label} không phải JSON hợp lệ: ${error.message}`); }
}

function validateRoomConfig(config) {
    if (!Array.isArray(config)) return ['Cấu hình phải là một mảng'];
    const errors = [];
    config.forEach((item, index) => {
        const prefix = `Dòng ${index + 1}`;
        if (!Number.isFinite(Number(item.khoaChiDinhId))) errors.push(`${prefix}: thiếu khoaChiDinhId`);
        if (![10,20,30,'THUONG','UU_TIEN','THUONG_VA_UU_TIEN'].includes(item.loaiStt)) errors.push(`${prefix}: loaiStt không hợp lệ`);
        if (!Number.isInteger(Number(item.tuStt)) || Number(item.tuStt) < 1) errors.push(`${prefix}: tuStt phải >= 1`);
        if (!Number.isInteger(Number(item.denStt)) || Number(item.denStt) < Number(item.tuStt)) errors.push(`${prefix}: denStt phải >= tuStt`);
    });
    const active = config.filter(x => x.active !== false);
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
        const overlap = Number(active[i].tuStt) <= Number(active[j].denStt) && Number(active[j].tuStt) <= Number(active[i].denStt);
        if (overlap) errors.push(`Dải ${active[i].tuStt}–${active[i].denStt} giao dải ${active[j].tuStt}–${active[j].denStt}`);
    }
    return errors;
}

function showRoomValidation() {
    try {
        const errors = validateRoomConfig(parseJson('roomConfig', 'Cấu hình phòng'));
        $('roomValidation').className = errors.length ? 'text-danger mt-2 small' : 'text-success mt-2 small';
        $('roomValidation').textContent = errors.length ? errors.join(' · ') : 'Cấu hình hợp lệ ở phía công cụ';
        return errors;
    } catch (error) {
        $('roomValidation').className = 'text-danger mt-2 small'; $('roomValidation').textContent = error.message; return [error.message];
    }
}

async function loadRoom() {
    const payload = await api('GET', `/dm-phong/${numberValue('roomId')}`);
    $('roomConfig').value = JSON.stringify(payload?.data?.dsSttKhoaChiDinh || [], null, 2);
    showRoomValidation(); notify('Đã tải cấu hình phòng', 'success');
}

async function saveRoom() {
    assertTestEnvironment();
    const config = parseJson('roomConfig', 'Cấu hình phòng');
    const errors = validateRoomConfig(config);
    if (errors.length) throw new Error(errors.join('; '));
    if (!confirm(`Ghi đè toàn bộ dsSttKhoaChiDinh của phòng ${numberValue('roomId')}?`)) return;
    await api('PATCH', `/dm-phong/${numberValue('roomId')}`, {dsSttKhoaChiDinh:config});
    notify('Đã lưu cấu hình phòng', 'success'); await loadRoom();
}

function setRoomPreset(name) {
    const khoa = numberValue('configuredDeptId');
    const presets = {
        priority:[{khoaChiDinhId:khoa,loaiStt:20,tuStt:1,denStt:3,active:true}],
        both:[{khoaChiDinhId:khoa,loaiStt:30,tuStt:1,denStt:3,active:true}],
        separate:[
            {khoaChiDinhId:khoa,loaiStt:10,tuStt:1,denStt:3,active:true},
            {khoaChiDinhId:khoa,loaiStt:20,tuStt:11,denStt:13,active:true}
        ]
    };
    $('roomConfig').value = JSON.stringify(presets[name], null, 2); showRoomValidation();
}

function setScenarioPreset(name) {
    const a = numberValue('configuredDeptId'), b = numberValue('otherDeptId');
    const presets = {
        prioritySplit:[
            {label:'A ưu tiên #1',khoaChiDinhId:a,uuTien:true,expectedStt:1},
            {label:'A thường #1',khoaChiDinhId:a,uuTien:false,expectedStt:4},
            {label:'A ưu tiên #2',khoaChiDinhId:a,uuTien:true,expectedStt:2},
            {label:'A thường #2',khoaChiDinhId:a,uuTien:false,expectedStt:5},
            {label:'B ưu tiên',khoaChiDinhId:b,uuTien:true,expectedStt:4},
            {label:'B thường',khoaChiDinhId:b,uuTien:false,expectedStt:6}
        ],
        bothSplit:[
            {label:'A thường #1',khoaChiDinhId:a,uuTien:false,expectedStt:1},
            {label:'A ưu tiên #1',khoaChiDinhId:a,uuTien:true,expectedStt:1},
            {label:'A thường #2',khoaChiDinhId:a,uuTien:false,expectedStt:2},
            {label:'A ưu tiên #2',khoaChiDinhId:a,uuTien:true,expectedStt:2},
            {label:'B thường',khoaChiDinhId:b,uuTien:false,expectedStt:4},
            {label:'B ưu tiên',khoaChiDinhId:b,uuTien:true,expectedStt:4}
        ],
        separateSplit:[
            {label:'A thường #1',khoaChiDinhId:a,uuTien:false,expectedStt:1},
            {label:'A ưu tiên #1',khoaChiDinhId:a,uuTien:true,expectedStt:11},
            {label:'A thường #2',khoaChiDinhId:a,uuTien:false,expectedStt:2},
            {label:'A ưu tiên #2',khoaChiDinhId:a,uuTien:true,expectedStt:12}
        ],
        shared:[
            {label:'A thường #1',khoaChiDinhId:a,uuTien:false,expectedStt:1},
            {label:'A ưu tiên #1',khoaChiDinhId:a,uuTien:true,expectedStt:2},
            {label:'A thường #2',khoaChiDinhId:a,uuTien:false,expectedStt:3},
            {label:'A ưu tiên ngoài dải',khoaChiDinhId:a,uuTien:true,expectedStt:4}
        ]
    };
    $('scenario').value = JSON.stringify(presets[name], null, 2);
}

function expandedScenario() {
    const scenario = parseJson('scenario', 'Kịch bản');
    if (!Array.isArray(scenario) || !scenario.length) throw new Error('Kịch bản phải là mảng có ít nhất một dòng');
    const output = [];
    scenario.forEach((step, index) => {
        if (!Number.isFinite(Number(step.khoaChiDinhId))) throw new Error(`Dòng ${index + 1} thiếu khoaChiDinhId`);
        const count = Math.max(1, Number(step.count || 1));
        for (let i = 0; i < count; i++) output.push({...step,label:count > 1 ? `${step.label || `Dòng ${index + 1}`} (${i + 1}/${count})` : step.label || `Dòng ${index + 1}`});
    });
    return output;
}

function previewScenario() {
    const rows = expandedScenario();
    notify(`Kịch bản hợp lệ: ${rows.length} lượt, chạy tuần tự`, 'success');
}

function patientPayload(step, index) {
    const s = getSettings();
    const stamp = new Date().toISOString().replace(/[.:]/g, '-');
    return {
        tenNb:`${s.patientPrefix} ${stamp} ${index}`,
        gioiTinh:1, ngaySinh:'2000-01-01 00:00:00', soDienThoai:'', quocTichId:1,
        doiTuong:1, loaiDoiTuongId:s.patientTypeId,
        nbDiaChi:{quocGiaId:1,tinhThanhPhoId:35,maTinhThanhPho:'79',quanHuyenId:null,xaPhuongId:10252,diaChi:'Nhị Bình, Hồ Chí Minh',noiSinh:'',noiDkKhaiSinh:''},
        quayTiepDonId:s.receptionDeskId, khoaId:Number(step.khoaChiDinhId), hienTrangCongDan:1,
        uuTien:Boolean(step.uuTien), danTocId:2, chiNamSinh:true, tuoi:26, boQuaChuaThanhToan:true
    };
}

async function createPatient(step, index, signal) {
    const payload = await api('POST', '/nb-dot-dieu-tri', patientPayload(step,index), {signal});
    const patient = payload?.data;
    if (!patient?.id) throw new Error('API tạo NB không trả id');
    state.lastMaHoSo = patient.maHoSo || state.lastMaHoSo;
    return patient;
}

function servicePayload(step, patientId) {
    const s = getSettings();
    return [{
        nbDotDieuTriId:patientId, bacSiKhamId:null,
        nbDichVu:{dichVuId:s.serviceId,soLuong:1,chiDinhTuDichVuId:patientId,chiDinhTuLoaiDichVu:200,loaiDichVu:30,khoaChiDinhId:Number(step.khoaChiDinhId),loaiHinhThanhToanId:null,ghiChu:'',nguonKhacId:null,bacSiChiDinhId:s.doctorId,thoiGianThucHien:new Date().toISOString()},
        nbDvKyThuat:{phongThucHienId:s.roomId}, benhPhamId:null, phongLayMauId:null
    }];
}

function extractServiceData(payload) {
    const item = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
    return {
        raw:item,
        id:item?.id ?? item?.nbDvKyThuat?.id ?? item?.nbDichVu?.id ?? null,
        stt:item?.nbDvKyThuat?.stt ?? item?.stt ?? null,
        stt2:item?.nbDvKyThuat?.stt2 ?? item?.stt2 ?? null,
        serviceName:item?.nbDichVu?.dichVu?.ten ?? item?.nbDichVu?.tenDichVu ?? ''
    };
}

async function createService(step, patientId, signal) {
    const payload = await api('POST','/nb-dv-cdha-tdcn-pt-tt',servicePayload(step,patientId),{signal});
    let info = extractServiceData(payload);
    if (info.id && info.stt === null) {
        try {
            const refreshed = await api('GET',`/nb-dv-cdha-tdcn-pt-tt/tong-hop/${info.id}`,null,{signal});
            const data = extractServiceData(refreshed); info = {...info,...data,raw:refreshed?.data};
        } catch (error) { info.refreshError = error.message; }
    }
    return info;
}

function resultStatus(expected, actual, error) {
    if (error) return 'FAIL';
    if (expected === null || expected === undefined || expected === '') return 'SKIP';
    return String(expected) === String(actual) ? 'PASS' : 'FAIL';
}

function renderResults() {
    const body = $('resultBody');
    if (!state.results.length) { body.innerHTML='<tr><td colspan="10" class="text-center text-muted py-4">Chưa có dữ liệu</td></tr>'; $('summary').textContent='Chưa chạy'; return; }
    body.innerHTML = state.results.map((r,i) => `<tr>
        <td>${i+1}</td><td>${escapeHtml(r.label)}</td><td>${r.khoaChiDinhId}</td><td>${r.uuTien?'Ưu tiên':'Thường'}</td>
        <td>${escapeHtml(r.maHoSo || String(r.patientId || ''))}</td><td>${escapeHtml(String(r.serviceId || ''))}</td>
        <td><strong>${escapeHtml(String(r.stt ?? '—'))}</strong>${r.stt2 ? `<div class="small-muted">${escapeHtml(r.stt2)}</div>`:''}</td>
        <td>${escapeHtml(String(r.expectedStt ?? '—'))}</td>
        <td><span class="badge ${r.status==='PASS'?'badge-pass':r.status==='FAIL'?'badge-fail':'badge-skip'}">${r.status}</span>${r.error?`<div class="text-danger small">${escapeHtml(r.error)}</div>`:''}</td>
        <td>${escapeHtml(r.elapsedMs ? `${r.elapsedMs} ms` : '')}</td></tr>`).join('');
    const counts = state.results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
    $('summary').textContent=`${state.results.length} lượt · PASS ${counts.PASS||0} · FAIL ${counts.FAIL||0} · chưa chấm ${counts.SKIP||0}`;
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
const sleep = (ms,signal) => new Promise((resolve,reject)=>{ const id=setTimeout(resolve,ms); signal?.addEventListener('abort',()=>{clearTimeout(id);reject(new DOMException('Đã dừng','AbortError'));},{once:true}); });

async function runScenario() {
    assertTestEnvironment(); const steps = expandedScenario();
    state.controller = new AbortController(); $('btnRun').disabled=true; $('btnStop').disabled=false;
    try {
        await login();
        for (let i=0;i<steps.length;i++) {
            const step=steps[i], started=performance.now();
            try {
                const patient=await createPatient(step,i+1,state.controller.signal);
                const service=await createService(step,patient.id,state.controller.signal);
                const result={label:step.label,khoaChiDinhId:Number(step.khoaChiDinhId),uuTien:Boolean(step.uuTien),expectedStt:step.expectedStt,patientId:patient.id,maHoSo:patient.maHoSo,serviceId:service.id,serviceName:service.serviceName,stt:service.stt,stt2:service.stt2,elapsedMs:Math.round(performance.now()-started)};
                result.status=resultStatus(result.expectedStt,result.stt); state.results.push(result);
            } catch(error) {
                if (error.name==='AbortError') throw error;
                state.results.push({label:step.label,khoaChiDinhId:Number(step.khoaChiDinhId),uuTien:Boolean(step.uuTien),expectedStt:step.expectedStt,status:'FAIL',error:error.message,elapsedMs:Math.round(performance.now()-started)});
            }
            renderResults(); if(i<steps.length-1) await sleep(getSettings().delayMs,state.controller.signal);
        }
        notify('Đã chạy xong kịch bản','success');
    } catch(error) {
        notify(error.name==='AbortError'?'Đã dừng theo yêu cầu':error.message,error.name==='AbortError'?'warning':'danger');
    } finally { state.controller=null; $('btnRun').disabled=false; $('btnStop').disabled=true; }
}

async function checkKiosk() {
    const maHoSo=$('kioskMaHoSo').value.trim()||state.lastMaHoSo;
    if(!maHoSo) throw new Error('Chưa có mã hồ sơ để kiểm tra Kiosk 2');
    const payload=await api('GET',`/kiosk2/stt?maHoSo=${encodeURIComponent(maHoSo)}`);
    $('kioskOutput').textContent=JSON.stringify(payload,null,2);
}

async function rawRequest() {
    const method=$('rawMethod').value, path=$('rawPath').value.trim();
    const body=['GET','DELETE'].includes(method)||!$('rawBody').value.trim()?null:parseJson('rawBody','Body');
    const payload=await api(method,path,body); $('rawOutput').textContent=JSON.stringify(payload,null,2);
}

function download(name,content,type) {
    const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g,'""')}"`; }
function exportCsv() {
    const keys=['label','khoaChiDinhId','uuTien','patientId','maHoSo','serviceId','stt','stt2','expectedStt','status','error','elapsedMs'];
    const csv='\ufeff'+[keys.join(','),...state.results.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n'); download('SAKURA-115216-results.csv',csv,'text/csv;charset=utf-8');
}
function reportText() {
    const lines=[`SAKURA-115216 - ${new Date().toLocaleString('vi-VN')}`,$('summary').textContent,''];
    state.results.forEach((r,i)=>lines.push(`${i+1}. ${r.status} | ${r.label} | khoa ${r.khoaChiDinhId} | ${r.uuTien?'ưu tiên':'thường'} | STT ${r.stt??'N/A'} | kỳ vọng ${r.expectedStt??'không chấm'}${r.error?` | ${r.error}`:''}`)); return lines.join('\n');
}

function bind(id,event,handler) { $(id).addEventListener(event, async (...args)=>{ try { await handler(...args); } catch(error) { setConnection(false,'Có lỗi'); notify(error.message,'danger'); console.error(error); } }); }

loadSettings(); setRoomPreset('both'); setScenarioPreset('bothSplit'); renderResults();
bind('btnLogin','click',async()=>{await login(true);notify('Xác thực thành công','success');});
bind('btnClearSecrets','click',()=>{$('manualToken').value='';$('password').value='';state.token=null;setConnection(false,'Đã xóa thông tin xác thực');});
bind('btnSaveSettings','click',saveSettings); bind('btnLoadRoom','click',loadRoom); bind('btnValidateRoom','click',showRoomValidation); bind('btnSaveRoom','click',saveRoom);
document.querySelectorAll('.preset-room').forEach(button=>button.addEventListener('click',()=>setRoomPreset(button.dataset.preset)));
document.querySelectorAll('.preset-scenario').forEach(button=>button.addEventListener('click',()=>setScenarioPreset(button.dataset.preset)));
bind('btnPreview','click',previewScenario); bind('btnRun','click',runScenario); bind('btnStop','click',()=>state.controller?.abort());
bind('btnCheckKiosk','click',checkKiosk); bind('btnRawRequest','click',rawRequest);
bind('btnExportJson','click',()=>download('SAKURA-115216-results.json',JSON.stringify({settings:{...getSettings(),apiBase:getSettings().apiBase},results:state.results},null,2),'application/json'));
bind('btnExportCsv','click',exportCsv); bind('btnCopyReport','click',async()=>{await navigator.clipboard.writeText(reportText());notify('Đã copy báo cáo','success');});
bind('btnClearResults','click',()=>{state.results=[];renderResults();});
