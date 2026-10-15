# BÁO CÁO TOÀN DIỆN PHASE 8.1: NỀN TẢNG ĐỊNH DANH VÀ XÁC THỰC NGƯỜI DÙNG
(PHASE 8.1 IDENTITY & FOUNDATION COMPLETION REPORT)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày hoàn tất:** 12/10/2026  
**Nhánh Git:** \`feature/phase8-identity-foundation\`  
**Base commit:** \`c2d7673\` (\`main\` - MVP v1.0.0-mvp)  
**Trạng thái kiểm thử:** 84 / 84 PASS (100% kiểm thử tự động, 0 lỗi TypeScript, build thành công)

---

## 1. TỔNG QUAN KẾT QUẢ TRIỂN KHAI

Phase 8.1 đã hoàn thành trọn vẹn nền tảng định danh người dùng nội bộ VNA, phục vụ các tính năng mở rộng tiếp theo (Lập lịch trình AI, Đặt tour & Báo giá, Đố vui du lịch, Vòng quay may mắn và Ví voucher):

1. **Bảo toàn 100% tính năng MVP cũ:**
   - Người dùng vãng lai vẫn tra cứu 19 địa điểm du lịch, xem tour VR360, đọc 42 bài viết văn hóa và trò chuyện với Trợ lý AI hoàn toàn bình thường mà không bị ép buộc đăng nhập.
   - Cơ chế cá nhân hóa cục bộ (\`AppContext\`, \`visitor_profiles\`, \`consentToken\`) giữ nguyên độc lập, không bị biến dạng.
2. **Kiến trúc xác thực đa kênh an toàn:**
   - **Zalo Mini App:** Xác thực thông qua Zalo SDK (\`getAccessToken()\`), backend Worker gửi yêu cầu xác minh trực tiếp với máy chủ Zalo (\`https://graph.zalo.me/v2.0/me\`), không tin tưởng \`userId\` do client tự khai báo.
   - **Website (Web Browser):** Xác thực Email OTP 6 chữ số có giới hạn thời gian (10 phút), giới hạn số lần thử (3 lần), rate limit (5 lần/10 phút). Không lưu mã OTP dạng văn bản thuần (plaintext) trong database, chỉ lưu mã băm SHA-256 (\`Web Crypto API\`).
   - **Dịch vụ Email giao dịch (Transactional Email):** Đóng gói qua \`EmailSenderService\`, hỗ trợ Resend / Postmark / Test adapter. Khi chưa cấu hình provider trên production, hệ thống từ chối theo nguyên tắc **Fail-Closed (HTTP 503)**, tuyệt đối không tạo cửa sau (mock bypass) trên môi trường công khai.
3. **Quản trị phiên làm việc (Session Management):**
   - Cấp phát Session Token bảo mật cao 32 bytes ngẫu nhiên (\`crypto.getRandomValues\`).
   - Cơ sở dữ liệu chỉ lưu trữ chuỗi băm SHA-256 (\`token_hash\`).
   - Hỗ trợ kiểm tra thời hạn (30 ngày), thu hồi phiên làm việc tức thì khi đăng xuất (\`revoked_at\`), kiểm tra trạng thái khóa tài khoản (\`status = 'active'\`).
4. **Phân lập dữ liệu tuyệt đối (Data Isolation):**
   - Tài khoản người dùng được định danh độc lập (\`users.id\`).
   - Hai tài khoản khác nhau không thể xem, sử dụng hoặc thu hồi phiên làm việc của nhau.

---

## 2. DANH SÁCH TỆP THAY ĐỔI VÀ TẠO MỚI

### A. Cơ sở dữ liệu (Database Migrations)
- \`worker/migrations/0005_identity.sql\` (Tạo mới):
  - Bảng \`users\`: Tài khoản nội bộ VNA.
  - Bảng \`auth_identities\`: Định danh đa kênh (\`zalo\`, \`email\`) với ràng buộc duy nhất \`UNIQUE(provider, provider_user_id)\`.
  - Bảng \`auth_sessions\`: Quản lý phiên đăng nhập với \`token_hash\`, thời hạn và trạng thái thu hồi.
  - Bảng \`auth_challenges\`: Lưu trữ thử thách xác thực Email OTP với \`code_hash\`, số lần thử và thời hạn.

### B. Backend Cloudflare Worker
- \`worker/src/types/index.ts\`: Bổ sung cấu hình Env (\`ZALO_APP_ID\`, \`ZALO_APP_SECRET\`, \`EMAIL_PROVIDER\`, \`EMAIL_API_KEY\`, \`EMAIL_FROM\`) và các interface \`UserRow\`, \`AuthIdentityRow\`, \`AuthSessionRow\`, \`AuthChallengeRow\`, \`AuthUser\`.
- \`worker/src/utils/errors.ts\`: Bổ sung mã trạng thái \`statusCode\` cho \`ValidationError\`.
- \`worker/src/utils/rate-limiter.ts\`: Bổ sung \`authRateLimiter\` (tối đa 20 request/phút/IP).
- \`worker/src/services/email-sender.service.ts\` (Tạo mới): Trình điều hợp gửi email Resend/Postmark/Test an toàn.
- \`worker/src/services/identity.service.ts\` (Tạo mới): Nghiệp vụ xác thực Zalo, cấp phát OTP email, xác thực OTP, tạo người dùng, quản lý phiên và thu hồi phiên.
- \`worker/src/services/user-auth.service.ts\` (Tạo mới): Middleware xác thực Bearer token cho người dùng.
- \`worker/src/services/admin-auth.service.ts\`: Gia cố bảo mật, chặn triệt để \`ADMIN_DEV_MOCK_AUTH\` khi chạy trên môi trường \`production\`.
- \`worker/src/routes/auth.ts\` (Tạo mới): Khai báo 5 route \`/api/auth/zalo\`, \`/api/auth/email/request\`, \`/api/auth/email/verify\`, \`/api/me\`, \`/api/auth/logout\`.
- \`worker/src/index.ts\`: Tích hợp các route xác thực mới vào Router và bổ sung rate limiter cho \`/api/auth/*\`.

### C. Frontend Miniapp
- \`miniapp/src/types/index.ts\`: Khai báo kiểu \`AuthUser\`, \`AuthState\`.
- \`miniapp/src/constants/index.ts\`: Bổ sung \`STORAGE_KEY_AUTH_TOKEN\`.
- \`miniapp/src/services/storage.ts\`: Hỗ trợ lưu trữ phiên làm việc an toàn.
- \`miniapp/src/services/api.ts\`: Tự động gắn \`Authorization: Bearer <token>\` khi đã đăng nhập và thêm các hàm API xác thực.
- \`miniapp/src/services/auth.ts\` (Tạo mới): Trình phát hiện môi trường Zalo (\`isZaloEnvironment\`), lấy access token qua \`zmp-sdk\` động, quản lý vòng đời token.
- \`miniapp/src/context/AuthContext.tsx\` (Tạo mới): Context độc lập cung cấp trạng thái đăng nhập người dùng cho toàn ứng dụng.
- \`miniapp/src/components/auth-modal.tsx\` (Tạo mới): Giao diện Bottom Sheet đăng nhập Zalo / Email OTP và hiển thị thông tin tài khoản người dùng chuẩn Stitch.
- \`miniapp/src/components/layout.tsx\`: Bổ sung nút biểu tượng tài khoản trên thanh tiêu đề kèm chấm trạng thái đăng nhập.
- \`miniapp/src/app.tsx\`: Bọc \`AuthProvider\` vào cây component.

### D. Kiểm thử tự động (Automated Test Suite)
- \`worker/test/identity-auth.test.mjs\` (Tạo mới, 9 ca kiểm thử chuyên sâu).
- \`worker/test/migrations.test.mjs\` (Cập nhật kiểm tra migration 0005).
- \`miniapp/test/fe-auth.test.mjs\` (Tạo mới, 4 ca kiểm thử giao diện & storage).

---

## 3. CÁC ENDPOINT API MỚI VÀ HỢP ĐỒNG DỮ LIỆU

| Phương thức | Đường dẫn API | Xác thực | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| \`POST\` | \`/api/auth/zalo\` | Công khai | Nhận \`accessToken\` từ Zalo SDK, xác minh với Zalo Graph API, tạo/tìm user và trả về \`sessionToken\`. |
| \`POST\` | \`/api/auth/email/request\` | Công khai | Nhận \`email\`, tạo mã OTP 6 số, băm SHA-256 lưu \`auth_challenges\`, gửi email xác thực. |
| \`POST\` | \`/api/auth/email/verify\` | Công khai | Nhận \`email\` và \`code\`, kiểm tra băm, tiêu hủy thử thách (chống replay), trả về \`sessionToken\`. |
| \`GET\` | \`/api/me\` | Bearer Session | Trả về thông tin người dùng hiện tại (\`id\`, \`email\`, \`displayName\`, \`avatarUrl\`, \`providers\`). |
| \`POST\` | \`/api/auth/logout\` | Bearer Session | Đánh dấu \`revoked_at = datetime('now')\` cho phiên làm việc, vô hiệu hóa ngay lập tức. |

---

## 4. BẰNG CHỨNG KIỂM CHỨNG ĐỊNH LƯỢNG (TEST RESULTS)

Tổng cộng: 84 / 84 ca kiểm thử tự động PASS (100%).
- Worker: 63 / 63 PASS.
- Miniapp: 18 / 18 PASS.
- Admin: 3 / 3 PASS.
- TypeScript typecheck: 0 lỗi.
- Production Build: miniapp www/ và worker/ dry-run PASS.

---

## 5. BẢO MẬT & CẤU HÌNH BIẾN MÔI TRƯỜNG CẦN THIẾT (KHI DEPLOY)

Khi sẵn sàng đưa Phase 8.1 lên Cloudflare Worker thật, chỉ cần thiết lập các biến sau:
1. \`EMAIL_PROVIDER\`: Tên dịch vụ gửi email (\`resend\` hoặc \`postmark\`).
2. \`EMAIL_API_KEY\`: Khóa API của dịch vụ gửi email (Cloudflare secret: \`wrangler secret put EMAIL_API_KEY\`).
3. \`EMAIL_FROM\`: Tên và địa chỉ người gửi (ví dụ: \`Du Lịch Đắk Song <noreply@daksong.vn>\`).
4. \`ZALO_APP_ID\` & \`ZALO_APP_SECRET\` (Tùy chọn khi kích hoạt chữ ký bảo mật nâng cao từ Zalo).

*Lưu ý bảo mật:* Tại môi trường local hiện tại, hệ thống sử dụng trình giả lập in-memory test adapter an toàn, không cần cung cấp bất kỳ khóa bí mật bên ngoài nào.

---

## 6. CHIẾN LƯỢC QUAY LUI (ROLLBACK STRATEGY)

Nếu cần quay lui về bản MVP v1.0.0 trước đó:
\`\`\`bash
git checkout main
\`\`\`
Trong cơ sở dữ liệu Cloudflare D1: Migration 0005 hoàn toàn độc lập và có tính chất bổ sung (additive). Chỉ cần chạy lệnh:
\`\`\`sql
DROP TABLE IF EXISTS auth_challenges;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS auth_identities;
DROP TABLE IF EXISTS users;
\`\`\`
Toàn bộ dữ liệu 19 địa điểm, 42 bài viết, 4 bảng admin và visitor profiles hoàn toàn nguyên vẹn 100%.

---

## 7. MỨC ĐỘ SẴN SÀNG CHO PHASE 8.2 (AI TRAVEL PLANNER)

- Người dùng đã có định danh nội bộ ổn định (\`user.id\`).
- Phiên đăng nhập Bearer token đã hoạt động trên cả Zalo Mini App và Web.
- Cơ sở dữ liệu và Worker đã sẵn sàng liên kết các bảng lịch trình có cấu trúc (\`itineraries\`, \`itinerary_days\`, \`itinerary_places\`) vào tài khoản người dùng ở Phase 8.2.
