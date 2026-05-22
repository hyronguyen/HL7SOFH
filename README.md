# ISOFH Testing Tool (ITT) 🔧

Bộ công cụ kiểm thử tự động dành cho hệ thống HIS ISOFH, cung cấp các module hỗ trợ tạo dữ liệu test, chuyển đổi định dạng, và quản lý biên bản công việc.

## 📋 Cấu trúc Dự án

```
/
├── index.html                    # Trang chủ (entry point)
├── README.md                     # Tài liệu này
├── assets/
│   ├── css/                      # CSS chung
│   └── js/                       # JavaScript chung
└── modules/                      # Các module chức năng
    ├── batch-cls/                # Tạo dữ liệu QMS CLS
    │   ├── index.html
    │   └── test.js
    ├── lis-oru/                  # OML to ORU Converter
    │   ├── index.html
    │   ├── oml-to-oru.js
    │   └── oml-to-oru.css
    ├── tao-duo-lieu-kham/        # Tạo dữ liệu Khám
    │   ├── index.html
    │   └── batch-kham.js
    └── tao-bien-ban/             # Tạo Biên Bản Công Việc
        └── index.html
```

## 🚀 Các Module

### 1. 📊 Batch CLS - Tạo dữ liệu QMS CLS
- **Mô tả**: Công cụ tạo dữ liệu kiểm xét lâm sàng hàng loạt cho hệ thống QMS
- **Link**: `modules/batch-cls/`
- **Tính năng**:
  - Tạo bệnh nhân hàng loạt
  - Kê dịch vụ CDHA
  - Tự động hóa quy trình test

### 2. 🔬 LIS ORU - OML to ORU Converter
- **Mô tả**: Chuyển đổi định dạng OML sang ORU theo chuẩn HL7
- **Link**: `modules/lis-oru/`
- **Tính năng**:
  - Parse định dạng OML (JSON)
  - Convert sang ORU
  - Hiển thị phân tích kết quả
  - Copy kết quả dễ dàng

### 3. 👨‍⚕️ Batch Khám - Tạo dữ liệu Khám
- **Mô tả**: Tool tạo dữ liệu khám bệnh hàng loạt với các tùy chọn linh hoạt
- **Link**: `modules/tao-duo-lieu-kham/`
- **Tính năng**:
  - Tạo đợt điều trị
  - Kê dịch vụ khám
  - Hỗ trợ kê CLS, kê thuốc, bảo hiểm
  - Thanh toán tự động

### 4. 📝 Biên Bản Công Việc - Tạo Biên Bản từ Jira
- **Mô tả**: Tự động gen biên bản công việc từ dữ liệu CSV (export từ Jira)
- **Link**: `modules/tao-bien-ban/`
- **Tính năng**:
  - Upload file CSV
  - Hỗ trợ định dạng Jira Markup (**bold**, *italic*, `code`, etc.)
  - Sắp xếp theo ngày tự động
  - Copy bảng cho Word
