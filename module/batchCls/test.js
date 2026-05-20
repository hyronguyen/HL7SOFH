async function getToken() {

    try {
        const response = await axios.post('https://api-sakura-test.isofh.vn/api/his/v1/auth/login', {
            taiKhoan: 'huynhn',
            matKhau: '4151ef7ec1ffad5415dd59b2b59d8e04'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': 'vi'
            }
        });
        const token = response.data?.data?.access_token || null;

        if (!token) {
            console.error("Access token is missing or undefined");
        }
        return token;
    } catch (error) {
        console.error('Error retrieving token:', error.response?.data || error.message);
        throw error;
    }
}

async function createPatient(token, index) {
    try {
        const patientName = `Huy test QMS - ${new Date().toISOString()} - ${index}`;
        const response = await axios.post('https://api-sakura-test.isofh.vn/api/his/v1/nb-dot-dieu-tri', {
            tenNb: patientName,
            gioiTinh: 1,
            ngaySinh: '2000-01-01 00:00:00',
            soDienThoai: '',
            quocTichId: 1,
            doiTuong: 1,
            loaiDoiTuongId: 1052,
            nbDiaChi: {
                quocGiaId: 1,
                tinhThanhPhoId: 35,
                maTinhThanhPho: '79',
                quanHuyenId: null,
                xaPhuongId: 10252,
                diaChi: 'Nhị Bình, Hồ Chí Minh',
                noiSinh: '',
                noiDkKhaiSinh: ''
            },
            quayTiepDonId: 3002,
            khoaId: 52,
            hienTrangCongDan: 1,
            uuTien: false, 
            danTocId: 2,
            chiNamSinh: true,
            tuoi: 26,
            boQuaChuaThanhToan: true
        }, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        });

        const patientId = response.data.data.id;

        document.getElementById('output').value += `Bệnh nhân  ${index} ${response.data.data.uuTien ? 'Ưu tiên' : 'Không ưu tiên'} ID: ${patientId}\n`;
        return patientId;
    } catch (error) {
        console.error(`Error creating patient ${index}:`, error.response?.data || error.message);
        throw error;
    }
}

async function keDichVuCdha(token, patientId, index) {
    try {
        const response = await axios.post(
            'https://api-sakura-test.isofh.vn/api/his/v1/nb-dv-cdha-tdcn-pt-tt',
            [
                {
                    nbDotDieuTriId: patientId,
                    bacSiKhamId: null,
                    nbDichVu: {
                        dichVuId: 16652,
                        soLuong: 1,
                        chiDinhTuDichVuId: patientId,
                        chiDinhTuLoaiDichVu: 200,
                        loaiDichVu: 30,
                        khoaChiDinhId: 52,
                        loaiHinhThanhToanId: null,
                        ghiChu: "",
                        nguonKhacId: null,
                        bacSiChiDinhId: 14402,
                        thoiGianThucHien: new Date().toISOString(),
                    },
                    nbDvKyThuat: {
                        phongThucHienId: 252,
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
     
        document.getElementById('output').value += `Kê dịch vụ ${response.data.data[0].nbDichVu.dichVu.ten} thành công đợt điều trị ${response.data.data[0].id}\n`;
    } catch (error) {
        console.error(
            `Error scheduling examination for patient ${index}:`,
            error.response?.data || error.message
        );
        throw error;
    }
}

async function runLoop() {
    
    const loopCount = parseInt(document.getElementById('loopCount').value, 10);

    if (isNaN(loopCount) || loopCount < 1) {
        alert('Nhập vào số lần lặp hợp lệ (số nguyên dương).');
        return;
    }

    try {
        const token = await getToken();

        for (let i = 1; i <= loopCount; i++) {
            const patientId = await createPatient(token, i);
            await keDichVuCdha(token, patientId, i)
            await keDichVuCdha(token, patientId, i);
        }
    } catch (error) {
        console.error('Process failed:', error.message);
    }
}