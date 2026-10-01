const loopCountInput = document.getElementById('loopCount');

/* ====================== CONFIG & SETUP ====================== */
document.addEventListener('DOMContentLoaded', function () {

});

/* ====================== AUTH ====================== */
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

/* ====================== GENERATOR FUNCTIONS ====================== */

// Generate maSoGiayToTuyThan: 12 ký tự từ thời gian
function generateMaSoGiayToTuyThan() {
    // Lấy 12 ký tự cuối cùng của timestamp (milliseconds)
    return Date.now().toString().slice(-12);
}

// Generate tenNb: thời gian + "Ngọc Huy test"
function generateTenNb() {
    return `${Date.now()} Ngọc Huy test`;
}

/* ====================== MAIN FUNCTIONS ====================== */

async function laySoTiepDon(token, index) {
    try {
        const now = new Date();
        const ngaySinh = now.toISOString().slice(0, 19).replace('T', ' ');

        const payload = {
            isAddressSelected: true,
            tenNb: generateTenNb(),
            ngaySinh: ngaySinh,
            gioiTinh: 1,
            soDienThoai: "0888399940",
            maSoGiayToTuyThan: generateMaSoGiayToTuyThan(),
            quocGiaId: 1,
            tinhThanhPhoId: 35,
            xaPhuongId: 5925,
            uuTien: Math.random() < 0.5,
            taiKham: false,
            khuVucId: 2152,
            doiTuong: 1,
            loaiGiayTo: 1
        };

        const res = await axios.post(
            'https://api-sakura-test.isofh.vn/api/his/v1/nb-lay-so-tiep-don',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = res.data.data;
        log(`✅ BN ${index} - Stt: ${data.stt} - Mã: ${data.maLaySo} - Ưu tiên: ${data.uuTien ? 'Có' : 'Không'}`);
        return data;

    } catch (error) {
        console.error(`❌ Lỗi lấy stt BN ${index}:`, error.response?.data || error.message);
        throw error;
    }
}

async function runLoop() {
    const loopCount = parseInt(loopCountInput.value, 10);

    if (!loopCount || loopCount < 1) {
        alert('Nhập số lần chạy hợp lệ');
        return;
    }

    try {
        const token = await getToken();
        log(`\n===== BẮT ĐẦU LẤY SỐ TIẾP ĐÓN =====`);

        for (let i = 1; i <= loopCount; i++) {
            try {
                log(`\n--- Thao tác ${i} ---`);
                await laySoTiepDon(token, i);
            } catch (err) {
                log(`❌ THẤT BẠI - Thao tác ${i}`);
                console.error(err);
            }
        }

        log(`\n===== HOÀN TẤT =====`);

    } catch (error) {
        console.error('❌ Lỗi hệ thống:', error.message);
        log(`❌ Lỗi hệ thống: ${error.message}`);
    }
}

/* ====================== UTILITY FUNCTIONS ====================== */

function log(message) {
    const outputElement = document.getElementById('output');
    outputElement.value += message + '\n';
    // Auto scroll to bottom
    outputElement.scrollTop = outputElement.scrollHeight;
}
