# Hỗ trợ Kho

Mở index.html từ menu ISOFH Tools. Module không cần build, không dùng thư viện ngoài.

1. Nhập kho, dịch vụ, lô, lượng cần đổi, thời điểm xuất và mốc báo cáo.
2. Chọn query, sinh SQL, copy sang công cụ PostgreSQL của HIS.
3. Xuất kết quả dạng JSON rồi dán vào ô phân tích. Có thể dán response API cập nhật tồn để kiểm tra `soLuongDung`.
4. API tra tồn là GET. Server và Bearer token nhập riêng; token không lưu vào localStorage hoặc báo cáo.

SQL dựa trên schema Sakura: `kho_nhap_xuat_tong_hop`, `kho_ton_kho`, `kho_lo_nhap`, `kho_phieu_nhap_xuat`, `kho_phieu_nhap_xuat_chi_tiet`, `nb_dv_kho`, `nb_dich_vu`, `nb_phieu_thu`, `nb_phieu_doi_tra`. Query lô thay thế gọi hàm `kho_ton_kho_theo_thoi_gian` với đủ 7 tham số, không coi tên hàm là bảng. Có query kiểm tra schema nếu môi trường khác phiên bản.

Tồn âm và dòng gây âm được tính lại từ lịch sử hiện tại. Cần audit/log để xác nhận trạng thái dữ liệu tại thời điểm duyệt. Thứ tự cùng timestamp dùng ID để kết quả ổn định, không phải bằng chứng về thứ tự thực tế.

Ứng viên lô thay thế được kiểm tra tồn trừ đặt trước lúc xuất/hiện tại, hạn dùng lúc xuất và mức tồn thấp nhất sau xuất. Phân tích riêng theo kho tại khoa và nguồn sử dụng. Phải kiểm tra thêm giao dịch cùng timestamp, đặt trước lịch sử, giá/thầu, quy đổi, nghiệp vụ, nhiều dòng cùng đổi vào một lô; không tự động đổi lô.

Module không chạy SQL trực tiếp và không có nút cập nhật tồn/phiếu. POST `cap-nhat-sl-ton` chỉ là mẫu để chạy thủ công theo quyền nghiệp vụ. Không tăng nhập chỉ để bù tồn âm; điều chuyển phải đối chiếu kho nguồn.
