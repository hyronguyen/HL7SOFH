# API PACS chuẩn

Dùng phiên đăng nhập chung trên header. Áp dụng `/pacs`, HL7 2.7; không tự chuyển sang VietRad hoặc endpoint đối tác.

1. Tìm chỉ định bằng ID dịch vụ NB, số phiếu hoặc số kết nối. Thao tác lấy chỉ định có thể thay đổi cờ đã gửi trên HIS.
2. Đặt checkbox PACS_MA_NB và PACS_THOI_GIAN_TIEP_NHAN_OBR_7 theo cấu hình server (chỉ ảnh hưởng DTO preview, không tự cập nhật server).
3. Lấy danh sách dịch vụ, chọn trạng thái SC để tiếp nhận; nhập mã nhân viên HIS và thời điểm. Với trả kết quả, điền kết quả/kết luận theo từng ID trong JSON.
4. Tạo payload, kiểm tra đích/hồ sơ/dịch vụ, tích xác nhận và gửi. Đổi thao tác hoặc phiên đăng nhập cần tạo/xem lại payload.

Body `{ "Hl7Data": "HL7" }`. Trạng thái: POST `/pacs/trang-thai` dùng OMI_O23; không dùng OML_O21. Kết quả: POST `/pacs/ket-qua` dùng ORU_R01. PID-3.1 hồ sơ; PID-3.2 mã NB, có thể bị bỏ hai ký tự đầu theo thiết lập. Số phiếu trạng thái lấy MSH-10; kết quả lấy ORC-2. OBR-2 phải là số kết nối hợp lệ.

OBX kết quả phải kiểu TX; OBX-1 từ 1–6 lần lượt là kết quả, kết luận, phiếu, ảnh, cảnh báo, ảnh bổ sung. Mã máy đọc ở OBX 1/2. XO hẹn thực hiện cần TQ1-7; chuẩn bị HL7 đầu vào/payload có thời điểm hẹn. Trạng thái XN và CDHA có thể khác nhau cho cùng mã OR/SC/BX. PID-18 có thể chứa tài khoản/mật khẩu PACS được BE lưu; không chia sẻ payload này.

Hiển thị HTTP/code/ACK/response đầy đủ. Không coi code lỗi là thành công dù ACK có CA. Sau gửi, kiểm tra lại HIS. Kiểm thử tự động dùng mock API, chưa gửi dữ liệu HIS thật.
