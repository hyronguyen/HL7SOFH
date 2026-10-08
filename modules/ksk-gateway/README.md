# KSK — XML nháp và gửi trực tiếp BYT

Mở `modules/ksk-gateway/index.html` từ trang chính ISOFH Tools. Dùng phiên HIS chung để đọc phiếu và tự query dữ liệu CLS. Không cần JDBC.

## Cách dùng

1. Đăng nhập HIS ở trang chính. Tài khoản cần quyền xem phiếu KSK và chạy `/dm-mau-du-lieu/db/query`.
2. Nhập ID phiếu KSK. Tool đọc `/nb-kham-ksk/{id}`, `/nb-kham-ksk/phieu-ksk-dinh-ky/{id}` và query view `nb_kham_ksk_dv_can_lam_sang`. Sinh XML đủ 18 tuổi EMR_BA970 với 8 FILEHOSO (XML1/2/7/8/9/10/11/12).
3. Mặc định chọn **Thử ánh xạ mã LIS → mã tương đương + đơn vị DM**: lấy CLS mới từ view, đọc mã LIS gốc từ `nb_dv_xet_nghiem_chi_so_con.ma_chi_so_con` qua `nb_chi_so_con_id`, rồi so khớp `dm_chi_so_con.ma_ket_noi` trong cùng `dich_vu_id`. Chỉ dùng danh mục đang sử dụng, khớp mã chính xác có bỏ khoảng trắng đầu/cuối, giữ phân biệt hoa/thường. Với một dòng DM khớp, lấy `ma_tuong_duong` cho MA_CHI_SO và `don_vi` cho DON_VI_DO. Đơn vị DM trống được đưa vào XML trống. Thiếu mã tương đương thì giữ mã trước ánh xạ và đánh dấu; không khớp/trùng mã/thiếu mã LIS gốc thì giữ cả mã và đơn vị gốc, không nhân bản dòng. Không ánh xạ theo tên hoặc tìm mã trên dịch vụ khác. Tool sử dụng mã tương đương bạn khai báo, chưa xác minh từng mã có thực sự thuộc PL11.

   Bảng hiển thị mã LIS gốc, mã trước ánh xạ, mã/đơn vị gửi XML và trạng thái DM. JSON nguồn có `childCatalogRows`, `clsMode`, `selectedCls` cùng thông tin đối chiếu. Query lại sau mỗi lần sửa danh mục; JSON cũ thiếu danh mục không dùng được chế độ ánh xạ. Có thể chọn **Theo HIS** để ưu tiên CLS đã lưu, hoặc **Lấy lại CLS từ query hiện tại** để giữ cách lấy mã và đơn vị của view. Chuyển nguồn sẽ tạo lại XML nháp và hủy bản tin đã chuẩn bị.

   **Giá trị kết quả được giữ nguyên, chưa quy đổi theo đơn vị mới.** Ví dụ LIS gửi Creatinin 0.68 mg/dL, khai báo DM µmol/L sẽ đổi nhãn đơn vị nhưng giá trị vẫn 0.68; cần chỉnh giá trị/đơn vị phù hợp trước khi gửi. Bảng hiển thị thêm đơn vị LIS nếu có.

   Mã DM dịch vụ lấy từ `dm_dich_vu.ma` qua `dich_vu_id`, chỉ để đối chiếu, không thay MA_DICH_VU trong XML. Khi CLS đã lưu thiếu ID và mã tương đương trùng nhiều danh mục, hiển thị tất cả mã tương ứng.
4. Xem/sửa XML. Tải XML nháp hoặc nhập XML đã ký từ HIS. Tool không tự tải XML lịch sử ký hoặc private key bệnh viện. Ảnh CKDT bác sĩ để trống nếu chưa có trong nguồn JSON; có thể nhập qua `signatures` hoặc dùng XML đã ký gốc.
5. Nhập base URL cổng, tài khoản/mật khẩu (hoặc token), GLN, receiver, version và RSA private key đã được đăng ký với cổng. Key hỗ trợ PEM PKCS#8 hoặc PKCS#1 không mã hóa. WebCrypto ký bản tin tại trình duyệt.
6. “Tạo bản tin để xem” chỉ ký envelope và preview. “Đẩy bản tin này lên cổng” mới đăng nhập và POST `/api/platform/data-sync/push`. Không tự gửi/retry push. Nếu login trả version khác, tool yêu cầu tạo lại envelope.

   Login cần HTTP thành công, `header.success = true` và token truy cập trong `data.token` hoặc `data.access_token`. Phản hồi `CM_SUCCESS` nhưng chỉ có `refresh_token` chưa đủ để push; tool báo rõ thiếu token truy cập và dừng trước khi gọi API đẩy. Kiểm tra tài khoản API do cổng cấp hoặc nhập token truy cập có sẵn. Không dùng refresh token thay cho access token.

## Chữ ký và cấu hình

- `data` = Base64 UTF-8 của nguyên XML trong editor.
- `signature` = RSA SHA256 ký chuỗi `SHA256_HEX_UPPER(JSON.stringify(header)) + '.' + SHA256_HEX_UPPER(data.trim())`, theo luồng local HIS. Thứ tự header được cố định.
- Chữ ký bản tin khác chữ ký XML của người kết luận/bệnh viện. Draft mới chưa ký tài liệu; cổng có thể từ chối. Tool không giả lập chữ ký XML. Nhập XML đã ký nếu cổng yêu cầu; XML có chữ ký bị sửa sẽ bị chặn cho đến khi nhập lại bản đã ký hoặc bỏ chữ ký tạo draft và ký lại bên ngoài.
- Chế độ thử ánh xạ chỉ dùng mã gửi LIS trong DM bạn đã khai báo, không tự suy luận mã PL11. Các cảnh báo XML không thay thế validation schema/nghiệp vụ của cổng.
- Gửi trực tiếp không cập nhật HIS. Endpoint mặc định sandbox, không xác nhận môi trường CR đang dùng.
- Password, token cổng và private key không lưu local/session storage, không nằm trong JSON nguồn hoặc bản tin. Có nút xóa secrets. JSON/XML tải xuống chứa dữ liệu hồ sơ; giữ tại thiết bị của người kiểm thử, không commit vào repo.

## Chạy khi cổng không cho CORS

Yêu cầu Node.js 20+ (không cài npm packages):

```powershell
node modules/ksk-gateway/server.cjs
```

Mở `http://127.0.0.1:8766`, đăng nhập HIS, mở module KSK và chọn qua helper localhost. Helper chỉ bind 127.0.0.1; có kiểm tra Host, Origin, CSRF, whitelist endpoint, chặn redirect và giới hạn response. Helper chỉ chuyển tiếp key không bao giờ ra khỏi trình duyệt; chỉ password/token đăng nhập cổng được gửi đến đúng endpoint bạn chọn. Nếu login HIS trực tiếp bị CORS, có thể dùng Bearer token có sẵn tại trang chính. API query qua helper được hỗ trợ trong module.

## Giới hạn kiểm chứng

Whitelist 132 trường người lớn lấy từ `KskXmlBuilder` trong workspace Sakura tại thời điểm xây dựng tool. Runtime HIS có thể dùng phiên bản khác. Tool tạo bản nháp từ API form + query, không cam kết đồng nhất byte với XML lịch sử đã ký (HIS có thể dùng lại bản đã ký). Loại dưới 18 tuổi không tự sinh sai mẫu; nhập XML sẵn để test gửi cổng.

Kiểm thử không cần server/credentials:

```powershell
node --test modules/ksk-gateway/tests/*.test.js
```
