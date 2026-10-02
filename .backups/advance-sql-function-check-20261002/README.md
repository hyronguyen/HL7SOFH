# ADVANCE SQL QUERY

Mở từ trang chính ISOFH Tools sau khi đăng nhập. Header hiển thị base URL và tài khoản dùng chung; server ngoài Sakura Test/Stable có cảnh báo đỏ và yêu cầu xác nhận trước khi chạy.

- Console có số dòng, Tab thụt dòng, Ctrl+Enter chạy, copy, mẫu SELECT/CTE.
- Mở `.sql`/`.txt`, lưu `.sql`; không tự thực thi file vừa mở.
- POST `/dm-mau-du-lieu/db/query`, body `["SELECT ..."]`, dùng Bearer token của phiên chung.
- Preview Excel theo sheet, lọc cục bộ và phân trang 100 dòng; tải Excel giữ nguyên response, xuất CSV của toàn sheet.
- Mở `.xlsx` cục bộ để preview không gọi API. Giới hạn file Excel 50 MB, SQL 200 KB.
- Dữ liệu chỉ giữ trong bộ nhớ tab. Đổi phiên/đăng xuất xóa kết quả; vẫn giữ SQL đang soạn. Token không được xuất trong SQL/Excel.
- Dừng chờ hủy request trình duyệt, không đảm bảo hủy query DB. Timeout chờ 60 giây.

Chỉ cho phép một SELECT hoặc WITH … SELECT. Bộ kiểm tra chặn câu lệnh thay đổi dữ liệu, nhiều câu, khóa bản ghi, dollar quotes, hàm không có trong danh sách chỉ đọc và hàm schema-qualified. Đây là kiểm tra bảo vệ UI, không phải SQL parser đầy đủ hay ranh giới bảo mật: sử dụng tài khoản DB chỉ đọc và áp dụng quyền/timeout phía server. Hàm tùy chỉnh phải được xác minh trước khi bổ sung vào validator.js. API có thể xuất sheet chứa lỗi SQL; đọc sheet lỗi trước khi kết luận query thành công.

File tải xuống nằm ở thư mục tải của trình duyệt hoặc vị trí người dùng chọn, không lưu vào thư mục backend của tools.
