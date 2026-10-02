# API LIS chuẩn

Dùng phiên đăng nhập chung trên header. Áp dụng `/lis`, HL7 2.5; không áp dụng tự động cho endpoint riêng của đối tác.

1. Nhập `soPhieu`, `maHoSo` hoặc `sid`, bấm **Lấy chỉ định API**. GET này có thể đánh dấu đã gửi LIS trong HIS.
2. Chọn bản tin nếu API trả nhiều phiếu; bấm **Lấy danh sách dịch vụ từ đầu vào**.
3. Tiếp nhận: chọn trạng thái OE ở checker, nhập mã nhân viên HIS và thời điểm. Kết quả: chọn Trả kết quả, điền JSON từng dịch vụ. Không đổi ID/mã kết nối.
4. Tạo payload, đọc server/tài khoản/hồ sơ/DTO/cảnh báo, tích xác nhận rồi gửi.

Body chuẩn `{ "data": "HL7" }`. POST `/lis/trang-thai` hoặc `/lis/ket-qua`. Có thể dùng HL7 đầu vào hoặc sửa payload thủ công; gửi luôn kiểm tra lại bản tin. Kết quả phải do người test nhập, không lấy demo làm dữ liệu thật. Đổi thao tác hoặc phiên đăng nhập cần tạo/xem lại payload.

Mapping chính: PID-2 mã NB, PV1-19 hồ sơ, MSH-10 số phiếu, OBR-2 ID/ID con. ORC-15/19 lấy mẫu; ORC-16/10 tiếp nhận mẫu. LIS đọc OBX đầu tiên mỗi OBR. OBX-14 thời gian kết quả; OBR-44 quy trình, OBX-17.5 cảnh báo, OBR-11 số GPB.

ACK CA và code 0 được hiển thị thành công; code lỗi/ACK CR, AE, AR không coi là thành công. Luôn đối chiếu lại kết quả trên HIS sau khi gửi. Kiểm thử tự động dùng API giả lập, không xác nhận tương thích triển khai trên từng server.
