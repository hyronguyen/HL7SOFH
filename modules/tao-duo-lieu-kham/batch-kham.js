
const DEFAULTS = {
    coSoKcbId: 1,
    khoaId: 52,
    bacSiId: 14402,
    quayTiepDonId: 3002,
    nhaThuNganId: 1,
    quayThuNganId: 2402,
    caLamViecId: 602,
    cdhaDichVuId: 10152,
    cdhaPhongId: 798,
    thuocDichVuId: 6961,
    thuocKhoId: 302
};



const els = {
    searchInput: document.getElementById('dichVuKhamSearch'),
    dropdown: document.getElementById('dichVuKhamDropdown'),
    phongSelect: document.getElementById('phongKhamSelect'),
    loopCount: document.getElementById('loopCount'),
    clsCheckBox: document.getElementById('clsCheckBox'),
    baoHiemCheckBox: document.getElementById('baoHiemCheckBox'),
    keThuocCheckBox: document.getElementById('keThuocCheckBox'),
    output: document.getElementById('output')
};

let searchTimer;
let cachedToken;

document.addEventListener('DOMContentLoaded', () => {
    els.loopCount.value ||= 1;
});

els.searchInput.addEventListener('input', () => {
    const keyword = els.searchInput.value.trim();
    clearTimeout(searchTimer);

    if (!keyword) {
        hideDropdown();
        resetPhongKham();
        delete els.searchInput.dataset.id;
        return;
    }

    searchTimer = setTimeout(async () => {
        const data = await fetchDichVuKham(keyword);
        renderDropdown(data);
    }, 300);
});

document.addEventListener('click', (event) => {
    if (!els.searchInput.contains(event.target) && !els.dropdown.contains(event.target)) {
        hideDropdown();
    }
});

async function runLoop() {
    const loopCount = Number.parseInt(els.loopCount.value, 10);

    if (!Number.isInteger(loopCount) || loopCount < 1) {
        alert('Nhap so lan hop le');
        return;
    }

    if (!els.searchInput.dataset.id) {
        alert('Vui long chon dich vu kham');
        return;
    }

    if (!els.phongSelect.value) {
        alert('Vui long chon phong kham');
        return;
    }

    try {
        const token = await getToken(true);
        log(`Bat dau tao ${loopCount} benh nhan`);

        for (let i = 1; i <= loopCount; i += 1) {
            await runOnePatient(token, i);
        }

        log('Hoan tat batch');
    } catch (error) {
        logError('Loi he thong', error);
    }
}

async function runOnePatient(token, index) {
    try {
        log(`\n===== BAT DAU BN ${index} =====`);

        const patient = await taoDotDieuTri(token, index);
        const dvKham = await keDichVuKham(token, patient);

        if (els.clsCheckBox.checked) {
            await keNhieuDichVuCdha(token, patient, dvKham.id, [
                {
                    dichVuId: DEFAULTS.cdhaDichVuId,
                    phongThucHienId: DEFAULTS.cdhaPhongId
                }
            ]);
        }

        if (els.keThuocCheckBox.checked) {
            await keThuoc(token, patient.id, dvKham.id);
        }

        // Mo comment neu can thanh toan tu dong sau khi tao dich vu.
        // const chiPhi = await checkChiPhi(token, patient.id);
        // await thanhToan(token, chiPhi, dvKham.nbDichVu.phieuThuId);

        log(`OK BN ${index} - nbDotDieuTriId=${patient.id}`);
    } catch (error) {
        logError(`FAIL BN ${index}`, error);
    }
}

async function fetchDichVuKham(keyword) {
    try {
        const response = await apiGet('/dm-dv-ky-thuat/tong-hop', {
            page: 0,
            size: 10,
            active: true,
            timKiem: keyword,
            dsCoSoKcbId: DEFAULTS.coSoKcbId,
            loaiDichVu: 10
        });

        return response.data.data || [];
    } catch (error) {
        logError('Loi lay danh sach dich vu kham', error);
        return [];
    }
}

function renderDropdown(items) {
    els.dropdown.innerHTML = '';

    if (!items.length) {
        hideDropdown();
        return;
    }

    items.forEach((item) => {
        const option = document.createElement('li');
        option.classList.add('list-group-item', 'list-group-item-action');
        option.textContent = item.ten;
        option.dataset.id = item.dichVuId;
        option.dataset.dsPhongThucHien = JSON.stringify(item.dsPhongThucHien || []);
        option.addEventListener('click', () => selectDichVuKham(item, option));
        els.dropdown.appendChild(option);
    });

    els.dropdown.style.display = 'block';
}

function selectDichVuKham(item, option) {
    els.searchInput.value = item.ten;
    els.searchInput.dataset.id = item.dichVuId;
    fillPhongKham(JSON.parse(option.dataset.dsPhongThucHien));
    hideDropdown();
}

function fillPhongKham(dsPhong) {
    resetPhongKham();

    dsPhong.forEach((phong) => {
        const option = document.createElement('option');
        option.value = phong.phongId;
        option.textContent = phong.ten;
        els.phongSelect.appendChild(option);
    });
}

function resetPhongKham() {
    els.phongSelect.innerHTML = '<option value="">-- Chon phong --</option>';
}

function hideDropdown() {
    els.dropdown.style.display = 'none';
}

async function getToken() {return IsofhApp.requireSession().token;}

async function taoDotDieuTri(token, index) {
    try {
        const now = new Date();
        const payload = {
            tenNb: `${Date.now()} Ngoc Huy Test`,
            gioiTinh: 1,
            ngaySinh: '2000-01-01 00:00:00',
            quocTichId: 1,
            doiTuong: 1,
            loaiDoiTuongId: 1052,
            nbDiaChi: {
                quocGiaId: 1,
                tinhThanhPhoId: 35,
                maTinhThanhPho: '79',
                xaPhuongId: 10252,
                diaChi: 'Nhi Binh, Ho Chi Minh'
            },
            quayTiepDonId: DEFAULTS.quayTiepDonId,
            khoaId: DEFAULTS.khoaId,
            hienTrangCongDan: 1,
            uuTien: Math.random() < 0.2,
            danTocId: 2,
            chiNamSinh: true,
            tuoi: 26,
            boQuaChuaThanhToan: true
        };

        if (els.baoHiemCheckBox.checked) {
            Object.assign(payload, buildThongTinBaoHiem(now));
        }

        const response = await apiPost('/nb-dot-dieu-tri', payload, token);
        const patient = response.data.data;

        log(`BN ${index} - ID=${patient.id} - MHS=${patient.maHoSo || ''}`);
        return patient;
    } catch (error) {
        logError(`Loi tao BN ${index}`, error);
        throw error;
    }
}

function buildThongTinBaoHiem(now) {
    const future = new Date(now);
    future.setDate(future.getDate() + 30);

    const tuNgay = toDateOnly(now);
    const denNgay = toDateOnly(future);

    return {
        tenNb: `${Date.now()} Ngoc Huy Test BH`,
        nbTheBaoHiem: {
            maThe: `DN4${Date.now().toString().slice(-9)}`,
            mucHuong: 80,
            khongApTran: false,
            khongGioiHanMucThanhToan: false,
            dangGiuThe: true,
            tuNgay,
            tuNgayApDung: `${tuNgay} 00:00:00`,
            denNgay,
            denNgayApDung: `${denNgay} 23:59:59`,
            noiDangKyId: 18203,
            ignoreCheckNoiGioiThieu: false,
            noiGioiThieuId: 18808,
            boQuaTheLoi: true,
            khuVuc: null,
            boQuaTiepDonTrongNgay: false
        }
    };
}

async function keDichVuKham(token, patient) {
    try {
        const payload = [{
            nbDotDieuTriId: patient.id,
            nbDichVu: {
                dichVuId: Number.parseInt(els.searchInput.dataset.id, 10),
                soLuong: 1,
                chiDinhTuDichVuId: patient.id,
                chiDinhTuLoaiDichVu: 200,
                loaiDichVu: 10,
                khoaChiDinhId: DEFAULTS.khoaId,
                bacSiChiDinhId: DEFAULTS.bacSiId,
                thoiGianThucHien: buildServiceTime(patient, 1)
            },
            nbDvKyThuat: {
                phongThucHienId: Number.parseInt(els.phongSelect.value, 10)
            }
        }];

        const response = await apiPost('/nb-dv-kham', payload, token);
        const dv = response.data.data[0];

        log(`Ke DV kham OK - ID=${dv.id}`);
        return dv;
    } catch (error) {
        logError('Loi ke DV kham', error);
        throw error;
    }
}

async function keNhieuDichVuCdha(token, patient, dvKhamId, danhSachDichVu) {
    for (const item of danhSachDichVu) {
        try {
            const payload = [{
                nbDotDieuTriId: patient.id,
                bacSiKhamId: null,
                nbDichVu: {
                    dichVuId: item.dichVuId,
                    soLuong: 1,
                    chiDinhTuDichVuId: dvKhamId,
                    chiDinhTuLoaiDichVu: 10,
                    loaiDichVu: 30,
                    khoaChiDinhId: DEFAULTS.khoaId,
                    loaiHinhThanhToanId: null,
                    ghiChu: '',
                    nguonKhacId: null,
                    bacSiChiDinhId: DEFAULTS.bacSiId,
                    thoiGianThucHien: buildServiceTime(patient, 2)
                },
                nbDvKyThuat: {
                    phongThucHienId: item.phongThucHienId
                },
                benhPhamId: null,
                phongLayMauId: null
            }];

            const response = await apiPost('/nb-dv-cdha-tdcn-pt-tt', payload, token);
            const tenDichVu = response.data.data[0]?.nbDichVu?.dichVu?.ten || item.dichVuId;
            log(`Ke CLS OK - ${tenDichVu}`);
        } catch (error) {
            logError(`Loi ke dich vu CLS ${item.dichVuId}`, error);
        }
    }
}

async function keThuoc(token, patientId, dvKhamId) {
    try {
        const now = new Date();
        const denNgay = new Date(now);
        denNgay.setDate(denNgay.getDate() + 1);

        const payload = [{
            nbDotDieuTriId: patientId,
            chiDinhTuDichVuId: dvKhamId,
            chiDinhTuLoaiDichVu: 10,
            soNgay: 2,
            soLan1Ngay: null,
            soLuong1Lan: 0,
            lieuDungId: null,
            duongDungId: 52,
            nguonKhacId: null,
            cachDung: null,
            dotDung: '111',
            ngayThucHienTu: toDateOnly(now),
            ngayThucHienDen: toDateOnly(denNgay),
            slSang: 0,
            slChieu: 0,
            slToi: 0,
            slDem: 0,
            tocDoTruyen: null,
            donViTocDoTruyen: null,
            soGiot: null,
            nbDichVu: {
                dichVuId: DEFAULTS.thuocDichVuId,
                soLuong: 1,
                chiDinhTuDichVuId: dvKhamId,
                chiDinhTuLoaiDichVu: 10,
                khoaChiDinhId: DEFAULTS.khoaId,
                loaiDichVu: 90,
                tuTra: null,
                khongTinhTien: false,
                nguonKhacId: null,
                chiDinhDichVuKemTheo: true
            },
            nbDvKho: {
                khoId: DEFAULTS.thuocKhoId,
                soLuongHuy: 0,
                soLuongHaoHut: 0,
                loaiChiDinh: 0
            },
            dsMucDich: null,
            tachDon: false,
            loaiDonThuoc: 10,
            thoiGianBatDau: null
        }];

        const response = await apiPost('/nb-dv-thuoc', payload, token);
        log(`Ke thuoc OK - ID=${response.data.data[0]?.id || ''}`);
    } catch (error) {
        logError('Loi ke thuoc', error);
        throw error;
    }
}

async function thanhToan(token, chiPhi, phieuThuId) {
    const tongTien = Math.abs(Number(chiPhi || 0));

    if (!phieuThuId || tongTien <= 0) {
        log(`Bo qua thanh toan - phieuThuId=${phieuThuId || ''}, tongTien=${tongTien}`);
        return;
    }

    try {
        await apiPost(`/nb-phieu-thu/thanh-toan/${phieuThuId}`, {
            dsPhuongThucTt: [{ phuongThucTtId: 1, tongTien }],
            nhaThuNganId: DEFAULTS.nhaThuNganId,
            quayId: DEFAULTS.quayThuNganId,
            caLamViecId: DEFAULTS.caLamViecId,
            hoanUng: false,
            nbLaySoId: null,
            boQuaChuaKetLuanKham: false,
            boQuaTheLoi: true,
            sinhPhieuThuTamUng: false,
            tienNbDua: tongTien,
            isIn2LinePhieuThu: true,
            chuyenDon: true
        }, token);

        log(`Thanh toan OK - phieuThuId=${phieuThuId}`);
    } catch (error) {
        logError('Loi thanh toan', error);
        throw error;
    }
}

async function checkChiPhi(token, patientId) {
    try {
        const response = await apiGet(`/nb-dot-dieu-tri/tong-hop/${patientId}`, {
            dsCoSoKcbId: DEFAULTS.coSoKcbId
        }, token);

        return response.data.data.tienConLai;
    } catch (error) {
        logError('Loi check chi phi', error);
        throw error;
    }
}

async function apiGet(path, params = {}, token = null) {
    const current = IsofhApp.requireSession();
    if (token && current.token !== token) throw new Error('Phiên đã thay đổi. Dừng lượt tạo dữ liệu.');
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => { if (v !== null && v !== undefined) query.set(k,String(v)); });
    return {data:await IsofhApp.json(path + (query.size ? '?' + query : ''))};
}

async function apiPost(path, payload, token = null) {
    const current = IsofhApp.requireSession();
    if (token && current.token !== token) throw new Error('Phiên đã thay đổi. Dừng lượt tạo dữ liệu.');
    return {data:await IsofhApp.json(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})};
}

function buildHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'vi'
    };
}

function buildServiceTime(patient, plusMinutes = 1) {
    const baseTime = patient?.thoiGianVaoVien
        || patient?.thoiGianTiepDon
        || patient?.createdAt
        || new Date().toISOString();

    const date = new Date(baseTime);
    if (Number.isNaN(date.getTime())) {
        return new Date(Date.now() + plusMinutes * 60 * 1000).toISOString();
    }

    date.setMinutes(date.getMinutes() + plusMinutes);
    return date.toISOString();
}

function toDateOnly(date) {
    return date.toISOString().slice(0, 10);
}

function extractError(error) {
    return error.response?.data?.message
        || error.response?.data?.data?.[0]?.message
        || error.response?.data?.data?.message
        || error.message
        || String(error);
}

function logError(prefix, error) {
    const message = extractError(error);
    log(`${prefix}: ${message}`);
    console.error(prefix, error.response?.data || error);
}

function log(message) {
    els.output.value += `${message}\n`;
    els.output.scrollTop = els.output.scrollHeight;
}
