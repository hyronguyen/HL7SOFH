const searchInput = document.getElementById('dichVuKhamSearch');
const dropdown = document.getElementById('dichVuKhamDropdown');
const phongSelect = document.getElementById('phongKhamSelect');
let timer;

/* ====================== CONFIG & SETUP ====================== */
document.addEventListener('DOMContentLoaded', function () {

});


async function fetchDichVuKham(keyword) {
    try {
        const token = await getToken();
        const res = await axios.get(
            'https://api-sakura-test.isofh.vn/api/his/v1/dm-dv-ky-thuat/tong-hop',
            {
                params: {
                    page: 0,
                    size: 10,
                    active: true,
                    timKiem: keyword,
                    dsCoSoKcbId: 1,
                    loaiDichVu: 10
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        return res.data.data || [];
    } catch (err) {
        console.error("Lỗi lấy danh sách dịch vụ:", err);
        return [];
    }
}
// Render dropdown dịch vụ khám
function renderDropdown(items) {
    dropdown.innerHTML = '';
    if (items.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    items.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('list-group-item', 'list-group-item-action');
        li.textContent = item.ten;
        li.dataset.id = item.dichVuId;
        li.dataset.dsPhongThucHien = JSON.stringify(item.dsPhongThucHien || []);
        li.addEventListener('click', () => {
            searchInput.value = item.ten;
            searchInput.dataset.id = item.dichVuId;
            fillPhongKham(JSON.parse(li.dataset.dsPhongThucHien));
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(li);
    });
    dropdown.style.display = 'block';
}
// Điền các phòng khám tương ứng vào select
function fillPhongKham(dsPhong) {
    phongSelect.innerHTML = `<option value="">-- Chọn phòng --</option>`;
    dsPhong.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.phongId;
        opt.textContent = p.ten;
        phongSelect.appendChild(opt);
    });
}

// Debounce input
searchInput.addEventListener('input', () => {
    const keyword = searchInput.value.trim();
    clearTimeout(timer);
    if (!keyword) {
        dropdown.style.display = 'none';
        phongSelect.innerHTML = `<option value="">-- Chọn phòng --</option>`;
        return;
    }
    timer = setTimeout(async () => {
        const data = await fetchDichVuKham(keyword);
        renderDropdown(data);
    }, 300);
});

// Ẩn dropdown khi click ra ngoài
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

async function getToken() {
    try {
        const response = await axios.post(
            'https://api-sakura-test.isofh.vn/api/his/v1/auth/login',
            {
                taiKhoan: 'huynhn',
                matKhau: '4151ef7ec1ffad5415dd59b2b59d8e04'
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Language': 'vi'
                }
            }
        );

        const token = response.data?.data?.access_token;

        if (!token) throw new Error("Token không tồn tại");
        localStorage.setItem('token', token);
        return token;
    } catch (error) {
        console.error('❌ Lỗi lấy token:', error.response?.data || error.message);
        throw error;
    }
}
/* ====================== MAIN FUNCTION ====================== */

async function runLoop() {
    const loopCount = parseInt(document.getElementById('loopCount').value, 10);
    const clsCheckBox = document.getElementById('clsCheckBox');

    if (!loopCount || loopCount < 1) {
        alert('Nhập số hợp lệ');
        return;
    }
    if (!searchInput.dataset.id) {
        alert('Vui lòng chọn dịch vụ khám');
        return;
    }
    if (!phongSelect.value) {
        alert('Vui lòng chọn phòng khám');
        return;
    }

    try {
        const token = await getToken();

        for (let i = 1; i <= loopCount; i++) {
            try {
                log(`\n===== BẮT ĐẦU BN ${i} =====`);
debugger
                const patientId = await taoDotDieuTri(token, i);
                const dv = await keDichVuKham(token, patientId);
                const dvid = dv.id;
                const phieuthuId = dv.nbDichVu.phieuThuId;
                //await khambenh(token, patientId, dvid);
                if (clsCheckBox.checked) {
                
                    const danhSachDichVu = [
                        
                        { dichVuId: 10152, phongThucHienId: 552 }
                    ];

                    await keNhieuDichVuCdha(token, patientId, dvid, danhSachDichVu);
                }


                //await keThuoc(token, patientId, dvid)
                //await ketLuanKham(token, dvid);
                const chiPhi = await checkChiPhi(token, patientId);
                await thanhToan(token, chiPhi, phieuthuId);
                log(`✅ HOÀN TẤT BN ${i}`);

            } catch (err) {
                log(`❌ FAIL BN ${i}`);
                console.error(err);
            }
        }

    } catch (error) {
        console.error('❌ Lỗi hệ thống:', error.message);
    }
}

/* ====================== Functions ====================== */

async function taoDotDieuTri(token, index) {

    try {
        const patientName = `${Date.now()} Ngọc Huy Test`;
        const now = new Date();

        // ===== base payload =====
        const payload = {
            tenNb: patientName,
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
                diaChi: 'Nhị Bình, Hồ Chí Minh'
            },

            quayTiepDonId: 3002,
            khoaId: 52,
            hienTrangCongDan: 1,
            uuTien: Math.random() < 0.2,
            danTocId: 2,
            chiNamSinh: true,
            tuoi: 26,
            boQuaChuaThanhToan: true
        };

        // ===== chỉ thêm bảo hiểm khi tick =====
        if (document.getElementById('baoHiemCheckBox').checked) {
            const maThe = `DN4${Date.now().toString().slice(-9)}`;

            const tuNgay = now.toISOString().slice(0, 10);
            const tuNgayApDung = now.toISOString().slice(0, 19).replace('T', ' ');

            const future = new Date(now);
            future.setDate(future.getDate() + 30);

            const denNgay = future.toISOString().slice(0, 10);
            const denNgayApDung = `${denNgay} 23:59:59`;

            payload.tenNb = `${Date.now()} Ngọc Huy Test `;;
            payload.nbTheBaoHiem = {
                maThe,
                mucHuong: 80,
                khongApTran: false,
                khongGioiHanMucThanhToan: false,
                dangGiuThe: true,
                tuNgay,
                tuNgayApDung,
                denNgay,
                denNgayApDung,
                noiDangKyId: 18203,
                ignoreCheckNoiGioiThieu: false,
                noiGioiThieuId: 18808,
                boQuaTheLoi: true,
                khuVuc: null,
                boQuaTiepDonTrongNgay: false
            };
        }

        // ===== call API =====
        const res = await axios.post(
            'https://api-sakura-test.isofh.vn/api/his/v1/nb-dot-dieu-tri',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = res.data.data;

        log(`🧑 BN ${index} ) - ID: ${data.id} - MHS: ${data.maHoSo}`);

        return data.id;

    } catch (error) {
        console.error(`❌ Lỗi create BN ${index}:`, error.response?.data || error.message);
        throw error;
    }
}

async function keDichVuKham(token, patientId) {
    try {
        const res = await axios.post(
            'https://api-sakura-test.isofh.vn/api/his/v1/nb-dv-kham',
            [{
                nbDotDieuTriId: patientId,
                nbDichVu: {
                    dichVuId: parseInt(searchInput.dataset.id, 10) || 3120,
                    soLuong: 1,
                    chiDinhTuDichVuId: patientId,
                    chiDinhTuLoaiDichVu: 200,
                    loaiDichVu: 10,
                    khoaChiDinhId: 52,
                    bacSiChiDinhId: 14402,
                    thoiGianThucHien: new Date(Date.now() + 5000).toISOString()
                },
                nbDvKyThuat: {
                    phongThucHienId: parseInt(phongSelect.value, 10) || null
                }
            }],
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const dv = res.data.data[0];

        log(`📋 Kê DV khám - ID: ${dv.id}`);

        return dv
    } catch (error) {
        console.error(`❌ Lỗi kê DV khám:`, error.response?.data || error.message);
        throw error;
    }
}

async function keNhieuDichVuCdha(token, patientId, dvId, danhSachDichVu) {
    for (const item of danhSachDichVu) {
        try {
            const response = await axios.post(
                'https://api-sakura-test.isofh.vn/api/his/v1/nb-dv-cdha-tdcn-pt-tt',
                [
                    {
                        nbDotDieuTriId: patientId,
                        bacSiKhamId: null,
                        nbDichVu: {
                            dichVuId: item.dichVuId,
                            soLuong: 1,
                            chiDinhTuDichVuId: dvId,
                            chiDinhTuLoaiDichVu: 10,
                            loaiDichVu: 30,
                            khoaChiDinhId: 52,
                            loaiHinhThanhToanId: null,
                            ghiChu: "",
                            nguonKhacId: null,
                            bacSiChiDinhId: 14402,
                            thoiGianThucHien: new Date(Date.now() + 5000).toISOString(),
                        },
                        nbDvKyThuat: {
                            phongThucHienId: item.phongThucHienId,
                        },
                        benhPhamId: null,
                        phongLayMauId: null,
                    },
                ],
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            document.getElementById('output').value +=
                `✔ Kê ${response.data.data[0].nbDichVu.dichVu.ten} - phòng ${item.phongThucHienId}\n`;

        } catch (error) {
            console.error(
                `❌ Lỗi kê dịch vụ ${item.dichVuId}:`,
                error.response?.data || error.message
            );
        }
    }
}

async function khambenh(token, patientId, dvid) {
    try {
        const res = await axios.put(
            `https://api-sakura-test.isofh.vn/api/his/v1/nb-dv-kham/kham-benh/${dvid}`,
            { tuanThai: null, choConBu: null, nbChanDoan: { cdSoBo: "Aceton niệu", dsCdChinhId: [8730], moTaChanDoan: { dsCdChinh: [{ id: 8730, tenChanDoan: "R82.4 - Aceton niệu", moTa: "", viTriThucHien: null }], dsCdKemTheo: [] }, dsCdChinh: [{ id: 8730, active: true, ma: "R82.4", ten: "Aceton niệu", doiTuongKhongBhyt: false, guiVitimes: true, benhAnDaiHan: false, chieuCao: false, maChuongBenh: "R00-R99", value: 8730, label: "R82.4 - Aceton niệu", uniqueText: "r82.4-acetonnieu", textNoMarkLowercase: "r82.4 - aceton nieu" }] }, dsChuyenKhoaId: null, nbHoiBenh: { tienSuGiaDinh: "không", tienSuTiemChung: "tiêm chủng không", tienSuBanThan: "không", diUngThuoc: "dị ứng không", diUngKhac: "dị ứng không", para: "0000" }, nbKhamXet: { toanThan: "Tình trạng dinh dưỡng: bình thường\nTổng trạng: bình thường", tim: "Không có dấu hiệu bất thường", phoi: "Không có dấu hiệu bất thường", bung: "Không có dấu hiệu bất thường", dienBien: "mặc định diễn biến", giaiDoanBenh: "mặc định giai đoạn bệnh", daNiem: "Hồng" }, nbTomTatCls: { nbDotDieuTriId: patientId, dsNbDichVuId: [], congThucMau: "", sinhHoaMau: "", giaiPhauBenh: "", viSinh: "", xetNghiemKhac: "", cdhaTdcn: "", cdhaTdcn2: "", dsDichVu: { anDsSinhHoaMau: true, dsCdhaTdcn2: [], dsViSinh: [], dsCdhaTdcn: [], anDsXetNghiemKhac: true, anDsGiaiPhauBenh: true, dsGiaiPhauBenh: [], anDsCdhaTdcn2: true, dsSinhHoaMau: [], anDsViSinh: true, anDsCdhaTdcn: true, dsTomTatCsc: [], dsCongThucMau: [], anDsTomTatCsc: true, dsXetNghiemKhac: [], anDsCongThucMau: true }, khac: null }, nbChiSoSong: { id: null, nbDotDieuTriId: null, nbThongTinId: null, doiTuongKcb: null, nhomMau: 2, phanLoaiTheLuc: null, mach: 70, nhietDo: 36, huyetApTamThu: 120, huyetApTamTruong: 70, nhipTho: 60, canNang: 50, chieuCao: null, spo2: null, bmi: null, phanLoaiBmiId: null, tenPhanLoaiBmi: null, moTaPhanLoaiBmi: null, thoiGianThucHien: new Date().toISOString(), nguoiThucHienId: null, tenNguoiThucHien: null, chiDinhTuDichVuId: dvid, chiDinhTuLoaiDichVu: 10, tenPtTt: null, tenBacSiPtTt: null, phuongPhapPtTt: null, tenDvKham: null, troTho: null, phanLoai: null, khoaChiDinhId: 52, tenKhoaChiDinh: null, thoiGianThucHienTheBh: null, maNguoiThucHienTheBh: null, tenNguoiThucHienTheBh: null, acvpu: null, glasgowMat: null, glasgowLoiNoi: null, glasgowVanDong: null, glasgow: null, canhBaoSom: null, thangDiemSpo2: null, rass: null, mucDoDau: null, ghiChu: null, dsViTriDau: null, dsChiSoSongKhac: null, thietLap: null }, nbKetLuan: { loiDan: "huong xtri & loi dan 12" } },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        log(`🩺 Khám bệnh OK - DV: ${dvid}`);

        return true;
    } catch (error) {
        console.error(`❌ Lỗi khám bệnh:`, error.response?.data || error.message);
        throw error;
    }
}
async function ketLuanKham(token, dvid) {
    try {

        /* ===== 2. ĐANG KẾT LUẬN ===== */
        await axios.post(
            `https://api-sakura-test.isofh.vn/api/his/v1/nb-dv-kham/dang-ket-luan/${dvid}`,
            {
                huongDieuTri: 10,
                ketQuaDieuTri: 1
            },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        log(`📌 Đã chuyển trạng thái kết luận - DV: ${dvid}`);


        /* ===== 3. KẾT LUẬN (ĐÓNG HỒ SƠ) ===== */
        await axios.post(
            `https://api-sakura-test.isofh.vn/api/his/v1/nb-dv-kham/ket-luan/${dvid}`,
            {

                bacSiKetLuanId: 14402,
                thoiGianKetLuan: new Date().toISOString()

            },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        log(`✅ Đóng hồ sơ OK - DV: ${dvid}`);

        return true;

    } catch (error) {
        console.error(`❌ Lỗi kết luận khám:`, error.response?.data || error.message);
        throw error;
    }
}

async function keThuoc(token, patientId, dvid) {
    try {

        if (document.getElementById('keThuocCheckBox').checked) {
            const now = new Date();
            const tuNgay = now.toISOString().slice(0, 10);
            const future = new Date(now);
            future.setDate(future.getDate() + 1);
            const denNgay = future.toISOString().slice(0, 10);

            if (document.getElementById('baoHiemCheckBox').checked) {
                const res = await axios.post(
                    'https://api-sakura-test.isofh.vn/api/his/v1/nb-dv-thuoc',
                    [{ nbDotDieuTriId: patientId, chiDinhTuDichVuId: dvid, chiDinhTuLoaiDichVu: 10, soNgay: 2, soLan1Ngay: null, soLuong1Lan: 0, lieuDungId: null, duongDungId: 52, nguonKhacId: null, cachDung: null, dotDung: "111", ngayThucHienTu: tuNgay, ngayThucHienDen: denNgay, slSang: 0, slChieu: 0, slToi: 0, slDem: 0, tocDoTruyen: null, donViTocDoTruyen: null, soGiot: null, nbDichVu: { dichVuId: 6961, soLuong: 1, chiDinhTuDichVuId: dvid, chiDinhTuLoaiDichVu: 10, khoaChiDinhId: 52, loaiDichVu: 90, tuTra: null, khongTinhTien: false, nguonKhacId: null, chiDinhDichVuKemTheo: true }, nbDvKho: { khoId: 302, soLuongHuy: 0, soLuongHaoHut: 0, loaiChiDinh: 0 }, dsMucDich: null, tachDon: false, loaiDonThuoc: 10, thoiGianBatDau: null }],
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );
            }
            else {
                const res = await axios.post(
                    'https://api-sakura-test.isofh.vn/api/his/v1/nb-dv-thuoc',
                    [{ nbDotDieuTriId: patientId, chiDinhTuDichVuId: dvid, chiDinhTuLoaiDichVu: 10, soNgay: 2, soLan1Ngay: null, soLuong1Lan: 0, lieuDungId: null, duongDungId: 52, nguonKhacId: null, cachDung: null, dotDung: "111", ngayThucHienTu: denNgay, ngayThucHienDen: tuNgay, slSang: 0, slChieu: 0, slToi: 0, slDem: 0, tocDoTruyen: null, donViTocDoTruyen: null, soGiot: null, nbDichVu: { dichVuId: 3111, soLuong: 1, chiDinhTuDichVuId: dvid, chiDinhTuLoaiDichVu: 10, khoaChiDinhId: 52, loaiDichVu: 90, tuTra: null, khongTinhTien: false, nguonKhacId: null, chiDinhDichVuKemTheo: true }, nbDvKho: { khoId: 352, soLuongHuy: 0, soLuongHaoHut: 0, loaiChiDinh: 0 }, dsMucDich: null, tachDon: false, loaiDonThuoc: 10, thoiGianBatDau: null }],
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );
            }
            //const phieuThuId = res.data.data[0].nbDichVu.phieuThuId;
            //await thanhToan(token, phieuThuId);
            log(`💊 Kê thuốc OK - DV: ${dvid}`);
        }
    } catch (error) {
        console.error(`❌ Lỗi kê thuốc:`, error.response?.data || error.message);
        throw error;
    }
}

async function thanhToan(token, chiPhi, phieuthuId) {
    debugger
    console.log("Chi phí còn lại: ", -chiPhi);
    try {
        await axios.post(
            `https://api-sakura-test.isofh.vn/api/his/v1/nb-phieu-thu/thanh-toan/${phieuthuId}`,
            {
                dsPhuongThucTt: [{ phuongThucTtId: 1, tongTien: -chiPhi }], nhaThuNganId: 1, quayId: 2402, caLamViecId: 602, hoanUng: false, nbLaySoId: null, boQuaChuaKetLuanKham: false, boQuaTheLoi: true, sinhPhieuThuTamUng: false, tienNbDua: -chiPhi, isIn2LinePhieuThu: true, chuyenDon: true
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        log(`💰 Thanh toán OK`);
    } catch (error) {
        console.error(`❌ Lỗi thanh toán:`, error.response?.data || error.message);
        throw error;
    }
}

async function checkChiPhi(token, patientId) {
    try {
        const res = await axios.get(
            `https://api-sakura-test.isofh.vn/api/his/v1/nb-dot-dieu-tri/tong-hop/${patientId}?dsCoSoKcbId=1`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        return res.data.data.tienConLai;
    } catch (error) {
        console.error(`❌ Lỗi check chi phí:`, error.response?.data || error.message);
        throw error;
    }
}


/* ====================== Etc  ====================== */
function log(message) {
    document.getElementById('output').value += message + '\n';
}