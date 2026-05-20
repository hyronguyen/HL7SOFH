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

## 🛠 Hướng dẫn Sử dụng

### Chạy Locally
1. Clone hoặc download repository
2. Mở `index.html` bằng trình duyệt
3. Chọn module cần sử dụng

### Deploy lên GitHub Pages
1. Push code lên GitHub repository
2. Vào **Settings** → **Pages**
3. Chọn source: `main branch` hoặc `main/docs folder`
4. Trang sẽ tự động publish tại: `https://<username>.github.io/<repository>`

## 📦 Yêu cầu Hệ thống

- Modern browser (Chrome, Firefox, Edge, Safari)
- JavaScript enabled
- Internet connection (cho API calls)

## 🔐 API & Credentials

Các module sử dụng API từ:
- **Endpoint**: `https://api-sakura-test.isofh.vn`
- **Default Account**: 
  - Username: `huynhn`
  - Password: `4151ef7ec1ffad5415dd59b2b59d8e04`

⚠️ **Lưu ý**: Cần cập nhật credentials cho environment production.

## 📝 Định Dạng CSV cho Biên Bản

Khi export từ Jira, đảm bảo file CSV có các cột:
- **Date**: Ngày làm việc (định dạng: `dd/MM` hoặc `dd/MM/yyyy`)
- **Summary**: Tiêu đề công việc
- **Issue key**: Mã Jira (VD: `JIRA-123`)
- **Description**: Chi tiết công việc (hỗ trợ Jira Markup)

### Hỗ trợ Jira Markup trong Description
```
**bold text**        → In đậm
*italic text*        → In nghiêng
`code`               → Mã inline
```code block```     → Khối code
h1. Heading          → Tiêu đề h1
h2. Heading          → Tiêu đề h2
[text|url]           → Link
```

## 📊 Công Nghệ Sử Dụng

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Framework**: Bootstrap 5.3
- **Libraries**:
  - [PapaParse](https://www.papaparse.com/) - CSV parsing
  - [Axios](https://axios-http.com/) - HTTP client
  - [HL7](https://www.hl7.org/) - Medical data format

## 🤝 Đóng Góp

Để đóng góp:
1. Fork repository
2. Tạo branch feature (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -m 'Add your feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Mở Pull Request

## 📄 License

MIT License - Xem [LICENSE](LICENSE) file cho chi tiết

## 📧 Liên Hệ

- **Email**: support@isofh.vn
- **Issues**: GitHub Issues
- **Documentation**: Tham khảo README của từng module

## 🎯 Roadmap

- [ ] Thêm unit tests
- [ ] Hỗ trợ multiple languages
- [ ] Cải thiện error handling
- [ ] Thêm export PDF
- [ ] Intergration với Jira API trực tiếp
- [ ] Offline mode support

## 📅 Changelog

### v1.0.0 (2026-05-20)
- ✅ Initial release
- ✅ 4 modules chính
- ✅ GitHub Pages ready
- ✅ Jira Markup support

---

**Last Updated**: 20/05/2026  
**Version**: 1.0.0  
**Maintained by**: ISOFH Team 👨‍💻
