/* Standard LIS v2.5 / PACS v2.7 controllers only. No VietRad/Minh Tam fallback. */
function hl7CurrentIssues(p, mode, kind) {
  const issues = [], add = (level, message) => issues.push({level, message});
  if (!p.data.startsWith('MSH|^~\\&|')) add('error', 'Checker chỉ hỗ trợ dấu phân cách HL7 chuẩn | và ^~\\&.');
  if (mode !== 'status' && mode !== 'result') return issues;
  const type = mode === 'result' ? 'ORU^R01^ORU_R01' : kind === 'lis' ? 'OML^O21^OML_O21' : 'OMI^O23^OMI_O23';
  if (getValue(p.msh, 9) !== type) add('error', `API yêu cầu MSH-9=${type}.`);
  if (getValue(p.msh, 12, 1) !== (kind === 'lis' ? '2.5' : '2.7')) add('error', `API ${kind.toUpperCase()} yêu cầu HL7 ${kind === 'lis' ? '2.5' : '2.7'}.`);
  const receipt = kind === 'pacs' && mode === 'result' ? getValue(first(p.byName.ORC), 2, 1) : getValue(p.msh, 10);
  if (!/^\d+$/.test(receipt)) add('error', 'Số phiếu phải là số nguyên theo controller chuẩn.');
  if (!getValue(kind === 'lis' ? p.pv1 : p.pid, kind === 'lis' ? 19 : 3, 1)) add('error', 'Thiếu mã hồ sơ BE dùng đối chiếu.');
  if (!p.orders.length) add('error', 'Không có dòng dịch vụ OBR.');
  p.orders.forEach((g,i) => {
    const id = getValue(g.obr, 2, 1);
    if (!(kind === 'lis' ? /^\d+(?:-\d+)?$/ : /^\d+$/).test(id)) add('error', `Dòng ${i+1}: OBR-2 không hợp lệ, BE có thể bỏ qua dòng này.`);
    if (!g.orc) add('error', `Dòng ${i+1}: thiếu ORC.`);
    if (kind === 'pacs' && mode === 'status' && getValue(g.orc,1)==='XO' && !getValue(g.tq1,7)) add('error', `Dòng ${i+1}: XO cần TQ1-7 thời gian hẹn.`);
    if (kind === 'lis' && mode === 'result' && g.obx.length > 1) add('warn', `Dòng ${i+1}: BE LIS chỉ đọc OBX đầu tiên dưới mỗi OBR.`);
    if (kind === 'pacs' && mode === 'result' && !g.obx.some(x=>getValue(x,2)==='TX' && /^[1-6]$/.test(getValue(x,1)))) add('error', `Dòng ${i+1}: BE PACS chỉ đọc OBX kiểu TX với OBX-1 từ 1 đến 6.`);
  });
  if (kind === 'pacs' && getValue(p.pid,18)) add('warn','PID-18 chứa tài khoản/mật khẩu PACS; BE có thể lưu thông tin này.');
  return issues;
}

document.addEventListener('DOMContentLoaded', () => {
  const kind = location.pathname.includes('pacs-checker') ? 'pacs' : 'lis';
  const key = kind === 'lis' ? 'data' : 'Hl7Data';
  if (kind === 'pacs') {
    document.getElementById('statusCode').add(new Option('XO - Hẹn thực hiện', 'XO'));
    document.getElementById('statusCode').value = 'SC';
  }
  const section = document.createElement('section'); section.className='hl7-api-panel';
  section.innerHTML=`<h2>API ${kind.toUpperCase()} · Tiếp nhận / trả kết quả</h2>
    <p>Dùng phiên đăng nhập trên header. Lấy chỉ định có thể đánh dấu đã gửi LIS/PACS trong HIS. Chỉ gửi khi bạn bấm xác nhận; dữ liệu kết quả không được tự tạo ngẫu nhiên.</p>
    <div class="hl7-api-row"><select id="apiLookup">${(kind==='lis'?['soPhieu','maHoSo','sid']:['id','soPhieu','soKetNoi']).map(x=>`<option>${x}</option>`).join('')}</select><input id="apiLookupValue" placeholder="Giá trị tìm chỉ định"><button id="apiLoad">Lấy chỉ định API</button><select id="apiOrderChoice" hidden></select></div>
    ${kind==='pacs'?'<p><label><input type="checkbox" id="pacsMaNbPrefix" checked> PACS_MA_NB=true: bỏ 2 ký tự đầu PID-3.2</label> · <label><input type="checkbox" id="pacsReceiptObr7"> PACS_THOI_GIAN_TIEP_NHAN_OBR_7=true</label> (chọn theo cấu hình server; không tự truy vấn)</p>':''}
    <div class="hl7-api-row"><label>Thao tác <select id="apiOperation"><option value="status">Tiếp nhận / trạng thái</option><option value="result">Trả kết quả</option></select></label><label>Mã nhân viên <input id="apiStaff" placeholder="Mã HIS, không phải tên đăng nhập"></label><label>Thời điểm <input id="apiTime" type="datetime-local" step="1"></label><button id="apiSkeleton">Lấy danh sách dịch vụ từ đầu vào</button></div>
    <p>Điền kết quả từng dòng trong JSON dưới đây, giữ nguyên id và mã kết nối. Chỉ các dòng đang có trong đầu vào được tạo payload.</p><textarea id="apiLines" rows="8" spellcheck="false" placeholder="Danh sách dịch vụ / kết quả"></textarea>
    <div class="hl7-api-row"><button id="apiPrepare">Tạo payload từ danh sách</button><button id="apiUseInput">Dùng HL7 đầu vào làm payload</button></div>
    <pre id="apiTarget">Chưa có payload</pre><textarea id="apiPayload" rows="9" spellcheck="false" aria-label="Payload gửi API"></textarea>
    <label><input id="apiConfirm" type="checkbox"> Tôi đã kiểm tra server, hồ sơ, dịch vụ và kết quả; đồng ý ghi dữ liệu HIS.</label><button id="apiSend">Gửi API</button><pre id="apiResponse" role="status"></pre>`;
  document.querySelector('main').append(section);
  const el=id=>document.getElementById(id), display=x=>el('apiResponse').textContent=x;
  let draftSession=null, busy=false, loaded=[];
  el('apiTime').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,19);
  const signature=s=>JSON.stringify([s.base,s.account,s.token]);
  const run=fn=>async()=>{if(busy)return;busy=true;for(const b of section.querySelectorAll('button'))b.disabled=true;try{await fn();}catch(e){display('Lỗi: '+e.message);}finally{busy=false;for(const b of section.querySelectorAll('button'))b.disabled=false;}};
  function publish(hl7){const s=IsofhApp.requireSession();draftSession=signature(s);el('apiPayload').value=JSON.stringify({[key]:hl7},null,2);el('apiConfirm').checked=false;validate();}
  function validate(){const body=JSON.parse(el('apiPayload').value);if(typeof body[key]!=='string')throw Error(`Body phải có ${key} dạng chuỗi HL7.`);const p=parseHl7(body[key]),mode=el('apiOperation').value,check=buildCheckResult(p,mode);el('apiTarget').textContent=JSON.stringify({server:IsofhApp.requireSession().base,account:IsofhApp.session().account,endpoint:`/${kind}/${mode==='status'?'trang-thai':'ket-qua'}`,dto:check.dto,issues:check.issues},null,2);const errors=check.issues.filter(x=>x.level==='error');if(errors.length)throw Error(errors.map(x=>x.message).join('\n'));return {[key]:p.data};}
  el('apiLoad').onclick=run(async()=>{const type=el('apiLookup').value,value=el('apiLookupValue').value.trim();if(!value)throw Error('Nhập giá trị tìm chỉ định.');const r=await IsofhApp.json(kind==='pacs'&&type==='id'?`/pacs/chi-dinh/${encodeURIComponent(value)}`:`/${kind}/chi-dinh?${type}=${encodeURIComponent(value)}`);loaded=(Array.isArray(r.data)?r.data:[r.data]).filter(x=>x&&typeof x[key]==='string');if(!loaded.length)throw Error('API không trả bản tin chỉ định.');el('apiOrderChoice').replaceChildren(...loaded.map((x,i)=>new Option(`${i+1} · ${x.orderCode||'Bản tin'}`,i)));el('apiOrderChoice').hidden=loaded.length<2;selectLoaded();display(`Đã lấy ${loaded.length} bản tin. Chưa gửi trạng thái/kết quả.`);});
  function selectLoaded(){el('inputData').value=JSON.stringify(loaded[Number(el('apiOrderChoice').value)||0],null,2);el('messageMode').value='order';checkMessage();el('apiPayload').value='';draftSession=null;el('apiLines').value='';}
  el('apiOrderChoice').onchange=selectLoaded;
  el('apiSkeleton').onclick=run(()=>{const p=parseHl7(readInputData());if(!p.orders.length)throw Error('Không có dịch vụ đầu vào.');el('apiLines').value=JSON.stringify(p.orders.map(g=>({id:getValue(g.obr,2,1),maKetNoi:getValue(g.obr,4,1),ten:getValue(g.obr,4,2),...(kind==='lis'?{ketQua:'',donVi:'',thamChieu:'',phanLoai:'N',maMay:''}:{ketQua:'',ketLuan:'',phieuKetQua:'',anhKetQua:'',canhBao:'',anhKetQua2:'',maMay:''})})),null,2);});
  function escapeValue(v){return String(v??'').replace(/\\/g,'\\E\\').replace(/\|/g,'\\F\\').replace(/\^/g,'\\S\\').replace(/~/g,'\\R\\').replace(/&/g,'\\T\\').replace(/\r\n|\r|\n/g,'\\.br\\');}
  function seg(name,values){const a=[name];for(const [n,v] of Object.entries(values))setValue(a,name,Number(n),v);return a.join('|');}
  el('apiPrepare').onclick=run(()=>{const p=parseHl7(readInputData()),lines=JSON.parse(el('apiLines').value),mode=el('apiOperation').value,time=el('apiTime').value.replace(/[-:T]/g,'');if(!/^\d{14}$/.test(time))throw Error('Nhập thời điểm đủ đến giây.');if(!Array.isArray(lines)||!lines.length)throw Error('Lấy và điền danh sách dịch vụ trước.');const seen=new Set(),staff=escapeValue(el('apiStaff').value.trim());if(mode==='status'&&!staff)throw Error('Nhập mã nhân viên tiếp nhận HIS.');
    const msh=[...p.msh.fields];setValue(msh,'MSH',7,time);setValue(msh,'MSH',9,mode==='result'?'ORU^R01^ORU_R01':kind==='lis'?'OML^O21^OML_O21':'OMI^O23^OMI_O23');setValue(msh,'MSH',12,kind==='lis'?'2.5':'2.7');const out=[msh.join('|'),p.pid?.raw,p.pv1?.raw].filter(Boolean);
    for(const row of lines){const g=p.orders.find(x=>getValue(x.obr,2,1)===String(row.id)&&getValue(x.obr,4,1)===row.maKetNoi);if(!g||seen.has(row.id))throw Error('ID/mã kết nối không khớp hoặc trùng: '+row.id);seen.add(row.id);if(!g.orc)throw Error('Thiếu ORC cho '+row.id);const orc=[...g.orc.fields],obr=[...g.obr.fields];setValue(orc,'ORC',1,mode==='status'?el('statusCode').value:'SC');if(kind==='lis'){if(mode==='status'){if (el('statusCode').value === 'OR') {setValue(orc,'ORC',15,time);setValue(orc,'ORC',19,staff);} else {setValue(orc,'ORC',16,time);setValue(orc,'ORC',10,staff);}}}else{setValue(orc,'ORC',15,time);if(mode==='status'){setValue(orc,'ORC',16,time);setValue(orc,'ORC',10,staff);}else{setValue(obr,'OBR',22,time);if(staff)setValue(obr,'OBR',32,staff);}}out.push(orc.join('|'));if(g.tq1)out.push(g.tq1.raw);out.push(obr.join('|'));
      if(mode==='result'){if(!String(row.ketQua||'').trim())throw Error('Thiếu kết quả thực nhập cho '+row.id);if(kind==='lis'){out.push(seg('OBX',{1:1,2:'ST',3:getValue(g.obr,4),5:escapeValue(row.ketQua),6:'^'+escapeValue(row.donVi),7:escapeValue(row.thamChieu),8:escapeValue(row.phanLoai||'N'),11:'F',14:time,16:staff,18:escapeValue(row.maMay)}));if(g.spm)out.push(g.spm.raw);}else{['ketQua','ketLuan','phieuKetQua','anhKetQua','canhBao','anhKetQua2'].forEach((k,i)=>{if(row[k])out.push(seg('OBX',{1:i+1,2:'TX',5:escapeValue(row[k]),11:'F',18:i<2?escapeValue(row.maMay):''}));});}}
    }publish(out.join('\r'));display('Payload đã tạo. Kiểm tra trước khi gửi.');});
  el('apiUseInput').onclick=run(()=>publish(readInputData()));
  el('apiOperation').onchange=()=>{el('apiConfirm').checked=false;draftSession=null;el('apiTarget').textContent='Thao tác đổi: tạo/xem lại payload trước khi gửi.';};
  el('apiPayload').oninput=()=>{el('apiConfirm').checked=false;};
  el('apiSend').onclick=run(async()=>{const s=IsofhApp.requireSession();if(!draftSession||draftSession!==signature(s))throw Error('Phiên đã đổi hoặc chưa tạo payload; hãy tạo/xem lại payload.');if(!el('apiConfirm').checked)throw Error('Cần xác nhận trước khi ghi HIS.');const body=validate();el('apiConfirm').checked=false;const r=await IsofhApp.request(`/${kind}/${el('apiOperation').value==='status'?'trang-thai':'ket-qua'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{}const ack=typeof data?.data==='string'?data.data.match(/(?:^|[\r\n])MSA\|([^|\r\n]+)/)?.[1]:null;display(`${r.ok&&data?.code===0&&ack!=='CR'&&ack!=='AE'&&ack!=='AR'?'API báo thành công':'API báo lỗi / cần kiểm tra'} · HTTP ${r.status} · ACK ${ack||'không có'}\n${raw}`);});
  window.addEventListener('isofh-session-change',()=>{draftSession=null;loaded=[];for(const id of ['apiPayload','apiLines','apiResponse'])el(id).value!==undefined?el(id).value='':el(id).textContent='';el('apiConfirm').checked=false;el('apiTarget').textContent='Phiên thay đổi. Hãy lấy/tạo lại payload.';});
});
