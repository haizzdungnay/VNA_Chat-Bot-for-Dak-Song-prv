# QUY CHUẨN BẢO VỆ DỮ LIỆU CÁ NHÂN & CHÍNH SÁCH ĐỒNG Ý (CONSENT SPECIFICATION)
# Dự án: VNA Đắk Song Smart Tourism
# Phiên bản: 1.0 (Phase 5A) | Ngày có hiệu lực: 09/10/2026

---

## 1. NGUYÊN TẮC BẤT DI BẤT DỊCH (PRIVACY-BY-DESIGN)

1. **Không thu thập dữ liệu nhạy cảm ngoài phạm vi:**
   - Tuyệt đối không thu thập: Số điện thoại, định vị GPS tọa độ thời gian thực, danh bạ, tài khoản ngân hàng, hoặc Zalo User ID thật khi chưa có cơ chế OAuth/Zalo Access Token xác thực từ server.
   - Tuyệt đối không lưu toàn bộ nội dung hội thoại chat của khách du lịch vào cơ sở dữ liệu hoặc hệ thống telemetry.

2. **Tách bạch hoàn toàn hai quyền đồng ý (Dual-Consent Isolation):**
   - **Tùy chọn A (`allowAIContext`):** Cho phép trợ lý AI cá nhân hóa câu trả lời trong phiên duyệt. Dữ liệu này **CHỈ LƯU TẠI BỘ NHỚ TRÌNH DUYỆT (safeStorage client)**, mặc định là `false`. AI prompt chỉ nhận ngữ cảnh này trong phiên gửi yêu cầu.
   - **Tùy chọn B (`allowServerProfileStorage`):** Người dùng chủ động đồng ý gửi tên hiển thị, cách xưng hô và nhóm tuổi lên máy chủ để cơ quan quản trị du lịch thống kê cơ cấu khách thăm quan. Mặc định là `false`.

3. **Mã định danh ẩn danh (Anonymized Consent Token):**
   - Máy chủ quản lý hồ sơ theo mã token ngẫu nhiên do client sinh ra (`UUID v4`), không gắn với ID Zalo thật.
   - Nghiêm cấm nhận tin cậy `userId` tùy ý do phía client tự gửi nhằm chống giả mạo hoặc ghi đè hồ sơ người khác.

---

## 2. HỢP ĐỒNG API ĐỒNG BỘ ĐỒNG Ý (`POST /api/visitors/consent`)

### Cấu trúc gửi lên:
```json
{
  "consentToken": "anon-d4e5f6-789a-bcde",
  "displayName": "Tuấn",
  "addressAs": "anh",
  "ageGroup": "25-34",
  "consentVersion": "1.0",
  "optIn": true
}
```

### Rút lại đồng ý / Xóa dữ liệu (Right to be Forgotten):
Khi người dùng chọn Xóa hồ sơ trên ứng dụng hoặc từ chối đồng bộ:
```json
{
  "consentToken": "anon-d4e5f6-789a-bcde",
  "optIn": false
}
```
Máy chủ đánh dấu `deleted_at = datetime('now')` và loại bỏ hồ sơ khỏi danh sách hiển thị trên Admin Dashboard ngay lập tức.

---

## 3. TRẠNG THÁI HIỆN TẠI VÀ CHỐNG PHÁ DEMO CHIỀU NAY

- **Mini App Client:** Giữ nguyên 100% thiết kế giao diện Stitch, cấu hình `safeStorage` và flow Onboarding chào mừng ban đầu.
- **Tính năng đồng bộ server phía Mini App:** Đang đặt ở trạng thái chờ kiểm thử thực tế trên thiết bị Zalo (Zalo real-device verification).
- **Admin Dashboard:** Mục Visitors hiển thị bảng trắng (`Chưa có người dùng đồng ý lưu hồ sơ lên máy chủ`), trung thực với hiện trạng hệ thống, không hiển thị dữ liệu ảo.

