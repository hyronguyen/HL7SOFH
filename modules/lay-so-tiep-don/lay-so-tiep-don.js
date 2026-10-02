const loopCountInput = document.getElementById('loopCount');

/* ====================== CONFIG & SETUP ====================== */
document.addEventListener('DOMContentLoaded', function () {

});

/* ====================== AUTH ====================== */
async function getToken() {return IsofhApp.requireSession().token;}

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

        if (token !== IsofhApp.requireSession().token) throw new Error('Phiên đã thay đổi. Dừng lượt lấy số.');
        const result = await IsofhApp.json('/nb-lay-so-tiep-don', {
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
        });
        const data = result.data;
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
