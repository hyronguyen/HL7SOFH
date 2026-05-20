# ⚡ Quick Start - Bắt Đầu Nhanh

## 🎯 Bước 1: Truy Cập Trang

### Locally (máy tính)
```bash
# Cách 1: Mở trực tiếp
Kích đúp vào file: index.html

# Cách 2: Dùng live server
cd đến folder project
python -m http.server 8000
# Truy cập: http://localhost:8000
```

### GitHub Pages (online)
```
https://your-username.github.io/your-repo/
```

## 📋 Bước 2: Chọn Module

Trên trang chủ, bạn sẽ thấy 4 module:

### 1️⃣ Batch CLS
- Tạo dữ liệu QMS hàng loạt
- Input: Số lần chạy
- Output: Log tạo bệnh nhân

### 2️⃣ LIS ORU
- Convert OML → ORU format
- Input: Dữ liệu OML (JSON)
- Output: Dữ liệu ORU + phân tích

### 3️⃣ Batch Khám
- Tạo dữ liệu khám bệnh
- Input: Số lần, dịch vụ, phòng khám
- Output: Log thực hiện

### 4️⃣ Biên Bản Công Việc
- Gen biên bản từ CSV (Jira)
- Input: File CSV
- Output: Bảng công việc, link Jira

## 🚀 Module: Batch CLS (Ví dụ)

```
1. Click "Mở Module" ở Batch CLS
2. Nhập: Số lần = 5
3. Click: "Bắt đầu"
4. Chờ log hiển thị kết quả
```

## 📊 Module: Biên Bản Công Việc (Ví dụ)

### Chuẩn Bị File CSV
Export từ Jira với cột:
```csv
Date,Summary,Issue key,Description
20/05,Bug fix login,JIRA-123,"**Fixed** login issue"
20/05,Refactor API,JIRA-124,"Updated API endpoints"
```

### Sử Dụng
```
1. Click "Mở Module" ở Biên Bản Công Việc
2. Click "Chọn file CSV"
3. Chọn file CSV đã export
4. Click "Copy Bảng"
5. Paste vào Word
```

## 🔧 Cấu Hình API

Mỗi module có credentials mặc định:
- **User**: huynhn
- **Pass**: 4151ef7ec1ffad5415dd59b2b59d8e04

⚠️ Để sử dụng với account khác, sửa trong file JS:
```javascript
// Tìm hàm getToken() 
// Đổi taiKhoan và matKhau
```

## 💾 Lưu Dữ Liệu

### Copy từ Bảng
- Click button "Copy"
- Paste (Ctrl+V) vào Word/Excel

### Export Kết Quả
- Biên Bản: Copy HTML, paste vào Word
- OML/ORU: Copy JSON từ textarea

## 🐛 Lỗi Thường Gặp

### "Cannot GET /" (Localhost)
```bash
# Chạy live server
python -m http.server 8000
```

### API Error
- Kiểm tra internet connection
- Kiểm tra server đang hoạt động
- Xem console (F12) để lỗi chi tiết

### CSV không parse được
- Đảm bảo file là `.csv` (không `.xlsx`)
- Kiểm tra encoding: UTF-8
- Đảm bảo header đúng: Date, Summary, Issue key, Description

### Copy không hoạt động
- Dùng Ctrl+A để select all
- Copy thủ công (Ctrl+C)
- Paste (Ctrl+V)

## 📚 Tài Liệu Chi Tiết

- **README.md** - Mô tả đầy đủ
- **DEPLOYMENT.md** - Hướng dẫn deploy GitHub Pages
- **Mỗi module** - Xem file `index.html` của module

## 🔗 Links

- **Trang chủ**: `index.html`
- **Batch CLS**: `modules/batch-cls/`
- **LIS ORU**: `modules/lis-oru/`
- **Batch Khám**: `modules/tao-duo-lieu-kham/`
- **Biên Bản**: `modules/tao-bien-ban/`

## ⌨️ Phím Tắt

```
F12              - Mở Developer Tools
Ctrl+A           - Select All
Ctrl+C           - Copy
Ctrl+V           - Paste
Ctrl+Shift+I     - Inspect Element
Ctrl+Shift+J     - Console
```

## 🎨 Giao Diện

- **Header**: Tên module + nút Quay lại
- **Form**: Input, select, button
- **Output**: Log, bảng, kết quả
- **Responsive**: Tương thích mobile/tablet

## 🆘 Cần Giúp?

1. Xem file `README.md`
2. Xem `DEPLOYMENT.md` (nếu deploy)
3. Mở console (F12) xem lỗi
4. Contact: support@isofh.vn

---

**Version**: 1.0.0  
**Last Updated**: 20/05/2026

Chúc bạn sử dụng vui vẻ! 🚀
