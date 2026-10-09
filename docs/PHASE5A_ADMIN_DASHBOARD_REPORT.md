# BÁO CÁO KỸ THUẬT VÀ BÀN GIAO TOÀN DIỆN PHASE 5A
# HỆ THỐNG QUẢN TRỊ ADMIN DASHBOARD & DYNAMIC AI CONFIGURATION (SAFE DELIVERY)
# Dự án: VNA Đắk Song Smart Tourism | Ngày lập: 09/10/2026

---

## 1. THÔNG TIN KHẢO SÁT, BASELINE VÀ KIẾN TRÚC TỔNG THỂ

- **HEAD Khảo sát Gốc:** `39c507b821bc6871b588b953fe3a322a0acbbeb6` (khớp 100% với `origin/main`).
- **Nhánh Tính Năng Triển Khai:** `feature/admin-dashboard` (nhánh tách biệt hoàn toàn, không tác động trực tiếp lên `main`).
- **Lịch sử Commits Đã Thực Hiện:**
  1. `5888ed3` — `chore(gate0): document baseline and emergency rollback runbook`
  2. `d7d83e5` — `feat(gate1): scaffold independent desktop-first admin dashboard workspace`
  3. `beecc5c` — `feat(gate2): implement admin backend, auth fail-closed, AES-256-GCM envelope storage, and 0004 migration`
  4. `350427c` — `feat(gate3): implement dynamic AI resolver with fail-safe fallback and telemetry events`
  5. `ba5dbed` — `feat(gate4): add visitor consent specification, route, and validation test suite`
- **Số tệp thay đổi/thêm mới:** 35 tệp.

### Sơ đồ luồng dữ liệu (Data Flow Diagram)

```
[ Client Mini App (Zalo) ]                [ Desktop Admin Browser ]
       |                                             |
       | POST /api/chat (Static Env)                 | HTTPS + Cf-Access-Jwt-Assertion
       | (Hoặc Dynamic khi flag ON)                  |
       v                                             v
+--------------------------------------------------------------------------+
|                       Cloudflare Worker Gateway                          |
|                                                                          |
|  [ Public Router ]                      [ Admin Router (/api/admin/*) ]  |
|  - /api/health                          - Auth Guard: Fail-Closed        |
|  - /api/places, /api/articles             Single Admin Allowlist         |
|  - POST /api/chat                       - AES-256-GCM Key Decryption     |
|  - POST /api/visitors/consent             (Chỉ decrypt in-memory isolate)|
|                                         - SSRF & AI Host Whitelist       |
|                                         - Audit Logger                   |
+--------------------------------------------------------------------------+
       |                                             |
       +----------------------+----------------------+
                              |
                              v
                   [ Cloudflare D1 Database ]
                   - categories (4)
                   - places (19: 15 verified + 4 vr360)
                   - articles (42)
                   - admin_ai_profiles (encrypted_api_key, key_suffix, is_active)
                   - admin_audit_logs (actor, action, details)
                   - visitor_profiles (anonymized consent token)
                   - admin_telemetry_events (status_code, duration_ms)
```

---

## 2. MA TRẬN TRẠNG THÁI TỪNG QUALITY GATE

| Quality Gate | Tên Hạng Mục | Trạng Thái Kỹ Thuật | Ghi chú & Chi tiết xác minh |
| :--- | :--- | :---: | :--- |
| **GATE 0** | Inventory + Baseline Audit | **VERIFIED_LOCAL** | Worktree sạch 100%, 43 tests ban đầu PASS, tạo Runbook rollback. |
| **GATE 1** | Admin Scaffold (Desktop SPA) | **VERIFIED_LOCAL** | Độc lập tại `admin/`, responsive 1024/1280/1440px, mask key `••••suffix`. |
| **GATE 2** | Admin Backend & Safe Storage | **VERIFIED_LOCAL** | Migration 0004 additive; Web Crypto AES-256-GCM; Fail-Closed Auth; SSRF whitelist. |
| **GATE 3** | AI Config Dynamic Switch | **VERIFIED_LOCAL** | Cờ `ADMIN_AI_CONFIG_ENABLED` mặc định false; tự động fallback Worker Env gốc. |
| **GATE 4** | Visitor Consent & Privacy | **VERIFIED_LOCAL** | Endpoint `POST /api/visitors/consent`; cách ly opt-in; Mini App Stitch nguyên bản. |
| **GATE 5** | Final Regression & Delivery | **VERIFIED_LOCAL** | 70/70 tests PASS (53 worker + 14 miniapp + 3 admin); typecheck & build sạch. |
| **PROD-AUTH** | Cloudflare Access Remote Setup | **BLOCKED_BY_ACCESS_SETUP** | Chờ chủ dự án khai báo biến Zero Trust trên Cloudflare Console. |
| **PROD-KEY** | Master Encryption Key Remote | **BLOCKED_BY_CREDENTIAL** | Chờ chủ dự án nạp `wrangler secret put ADMIN_ENCRYPTION_KEY` trên remote Worker. |

---

## 3. HƯỚNG DẪN LỆNH THỰC THI POWERSHELL

### Kiểm thử toàn bộ hệ sinh thái (Root)
```powershell
# Chạy typecheck toàn bộ workspace (miniapp, worker, admin)
npm run typecheck && npm run typecheck:admin

# Chạy toàn bộ test suites (70 tests)
npm test && npm run test:admin

# Build thử nghiệm production bundle
npm run build && npm run build:admin
```

### Chạy Dashboard Quản trị Local (Safe Dev Mock Mode)
```powershell
# Di chuyển vào thư mục admin và chạy dev server
npm run dev:admin
# Hoặc:
npm --workspace admin run dev
# Mở trình duyệt tại: http://localhost:3001
```

### Chạy Cloudflare Worker Local
```powershell
npm run dev:worker
# Hoặc:
npm --workspace worker run dev
```

---

## 4. D1 MIGRATION 0004 & QUY TRÌNH ROLLBACK

### Schema Migration 0004 (`worker/migrations/0004_admin_extension.sql`)
- **Forward-Only & Idempotent:** Toàn bộ bảng sử dụng cú pháp `CREATE TABLE IF NOT EXISTS` và `CREATE INDEX IF NOT EXISTS`.
- **Bảo toàn dữ liệu cũ:** Bằng chứng kiểm thử trong `worker/test/migrations.test.mjs` xác nhận 19 địa điểm và 42 bài viết không bị biến động sau khi áp dụng migration 0004.
- **Cảnh báo an toàn:** Tuyệt đối không xóa cơ sở dữ liệu remote hoặc chạy down-migrate bằng tay.

### Quy trình Rollback khẩn cấp nếu có sự cố trước Demo
1. **Rollback bằng Feature Flag (Ưu tiên số 1):**
   - Đảm bảo biến `ADMIN_AI_CONFIG_ENABLED` mang giá trị `"false"`.
   - Worker tự động bỏ qua toàn bộ profile động trong D1, 100% request chat gọi thẳng cấu hình tĩnh từ Worker Env gốc.
2. **Rollback bằng Git Branch:**
   ```powershell
   git checkout main
   npm run dev:miniapp
   ```

---

## 5. DANH MỤC BIẾN MÔI TRƯỜNG & SECRETS CẦN THIẾT LẬP

> **Lưu ý bảo mật:** Dưới đây chỉ cung cấp TÊN BIẾN và HƯỚNG DẪN CẤU HÌNH. Tuyệt đối không chứa giá trị nhạy cảm.

| Tên Biến / Secret | Phạm Vi Lưu Trữ | Mô Tả & Giá Trị Hợp Lệ |
| :--- | :--- | :--- |
| `ADMIN_ENCRYPTION_KEY` | Cloudflare Secret (`wrangler secret put`) | Khóa chủ 256-bit (tối thiểu 16 ký tự, khuyến nghị 32 bytes hex) dùng để mã hóa AES-GCM các API key. |
| `ADMIN_AI_CONFIG_ENABLED` | Cloudflare Var (`vars` trong wrangler) | Cờ tính năng (`"true"` hoặc `"false"`). Mặc định `"false"` cho demo an toàn. |
| `CF_ACCESS_TEAM_NAME` | Cloudflare Var | Tên Cloudflare Zero Trust Team (dùng kiểm tra JWT `iss`). |
| `CF_ACCESS_AUD` | Cloudflare Var | Application Audience Tag từ Access Console (dùng kiểm tra JWT `aud`). |
| `ADMIN_EMAIL_ALLOWLIST` | Cloudflare Var | Email duy nhất của chủ dự án được phép quản trị (VD: `owner@daksong.vn`). |
| `ADMIN_DEV_MOCK_AUTH` | File local `.dev.vars` duy nhất | Cờ bật mock xác thực khi chạy local test (`"true"`). Không bao giờ commit lên git. |

---

## 6. HƯỚNG DẪN VẬN HÀNH AI PROFILES

1. **Tạo Profile Mới (Create & Encrypt):**
   - Admin nhập Tên, HTTPS Base URL (phải thuộc whitelist: Google, OpenAI, Groq, OpenRouter...), Model, và Secret API Key.
   - Server sinh IV 12 bytes ngẫu nhiên, mã hóa AES-256-GCM, lưu envelope và trích xuất `key_suffix` (4 ký tự cuối). Khóa gốc bị hủy khỏi RAM ngay sau đó.
2. **Kiểm tra kết nối (Test Connection):**
   - Bấm nút "Test" tại UI. Server giải mã tạm thời khóa, gửi request ping nhẹ (1 token, timeout 6s) tới upstream.
   - Trả về mã HTTP thực tế (200, 401, 403, 429, 503) và độ trễ mili-giây. Thao tác này KHÔNG kích hoạt profile.
3. **Kích hoạt (Activate):**
   - Bấm "Kích hoạt" kèm xác nhận tại modal. Hệ thống thực hiện batch atomic: đưa tất cả profile khác về `is_active = 0` và đặt profile được chọn thành `is_active = 1`.
   - Nếu `ADMIN_AI_CONFIG_ENABLED=true`, luồng chat người dùng chuyển sang profile này ngay lập tức.
4. **Cứu hộ (Rollback to Env):**
   - Bấm nút "Rollback về Worker Env" trên header trang Profiles. Tất cả profile D1 được đưa về inactive; hệ thống quay về dùng cấu hình tĩnh gốc.

---

## 7. KIỂM KÊ DỮ LIỆU & NGUYÊN TẮC QUYỀN RIÊNG TƯ (DATA INVENTORY)

- **Tính trung thực dữ liệu:**
  - Tổng số địa điểm: **19** (15 địa điểm có tọa độ GPS thật + 4 điểm đến VR360 có link tham quan).
  - Tổng số bài viết: **42** bài viết văn hóa du lịch Đắk Song.
  - Số hồ sơ người dùng trong D1: **0** (hoặc chỉ các bản ghi test opt-in). Không có số liệu giả mạo.
- **Tách biệt Consent:**
  - `allowAIContext`: Lưu tại client `safeStorage`, phục vụ AI xưng hô trong phiên chat.
  - `allowServerProfileStorage`: Khách phải chủ động opt-in thì mới gửi lên `POST /api/visitors/consent`.
  - Khách chọn xóa profile -> Máy chủ cập nhật `deleted_at = datetime(''now'')`, lập tức ẩn khỏi Admin Dashboard.

---

## 8. MA TRẬN KẾT QUẢ KIỂM THỬ TỔNG THỂ (REGRESSION PROOF)

| Nhóm Kiểm Thử | Tệp Test Script | Số Bài Test | Kết Quả | Chi Tiết |
| :--- | :--- | :---: | :---: | :--- |
| **Worker Migrations** | `test/migrations.test.mjs` | 4 | **PASS (100%)** | Fresh 0001-0004, Upgrade, Idempotency. |
| **Admin Backend & Security** | `test/admin-backend.test.mjs` | 16 | **PASS (100%)** | AES-GCM, SSRF Whitelist, CF Access Auth, CRUD. |
| **Dynamic AI Switch** | `test/ai-config-switch.test.mjs` | 4 | **PASS (100%)** | Flag OFF baseline, Flag ON switch, Graceful fallback. |
| **Visitor Consent API** | `test/visitor-consent.test.mjs` | 3 | **PASS (100%)** | Opt-in save, Opt-out soft delete, Token validation. |
| **Chat Scenarios & E2E** | `test/chat-e2e-scenarios.test.mjs` | 7 | **PASS (100%)** | Multi-turn, anti-hallucination, article context. |
| **Worker Router & Security** | `test/router.test.js`, `security.test.mjs` | 19 | **PASS (100%)** | Rate limiting, 10KB body boundary, headers. |
| **Mini App Logic** | `miniapp/test/fe-logic.test.mjs` | 14 | **PASS (100%)** | Concurrency, Welcome sheet, XSS DOMPurify. |
| **Admin UI Logic** | `admin/test/admin-ui.test.mjs` | 3 | **PASS (100%)** | Masking key suffix, Fail-closed banner, Whitelist. |
| **TỔNG CỘNG** | **8 test suites** | **70 tests** | **70/70 PASS (0 FAIL)** | Thời gian chạy: < 1.2s. |

---

## 9. DANH SÁCH TỆP NGUỒN ĐÃ CHỈNH SỬA & GIẢI TRÌNH TỐI THIỂU

1. `package.json`, `package-lock.json`: Bổ sung workspace `admin` và các script `dev:admin`, `build:admin`, `typecheck:admin`, `test:admin`. Giữ nguyên 100% các script cũ.
2. `worker/src/types/index.ts`: Khai báo thêm các interface quản trị (`AdminAIProfileRow`, `VisitorProfileRow`...) và biến môi trường Phase 5A.
3. `worker/src/utils/router.ts`: Bổ sung method `put` và `delete` hỗ trợ RESTful API quản trị.
4. `worker/src/utils/response.ts`: Cho phép phương thức `PUT`, `DELETE` và header `Cf-Access-Jwt-Assertion` trong CORS.
5. `worker/src/index.ts`: Đăng ký thêm các route quản trị và giới hạn kích thước body cho method `PUT`.
6. `worker/src/services/chat.service.ts`: Tích hợp bộ giải quyết cấu hình dynamic có cờ bảo vệ `ADMIN_AI_CONFIG_ENABLED` và ghi nhận telemetry (fail-safe).
7. **Cam kết bất biến:**
   - Không sửa đổi `miniapp/app-config.json` hoặc mã nguồn giao diện Stitch của Mini App.
   - Không sửa đổi các migration cũ `0001`, `0002`, `0003`.
   - Không sửa đổi `worker/wrangler.jsonc` production.
   - Endpoint `POST /api/chat` giữ nguyên 100% hợp đồng cũ.

---

## 10. CHECKLIST AN TOÀN CHO BUỔI BÁO CÁO / DEMO CHIỀU NAY

- [x] **Mini App và Chatbot cũ hoạt động hoàn hảo:** Có thể chạy ngay bằng lệnh `npm run dev:miniapp` và `npm run dev:worker`.
- [x] **Admin Dashboard hiển thị độc lập tại Desktop:** Chạy an toàn tại cổng 3001, thể hiện đầy đủ trạng thái hệ thống, dữ liệu trung thực.
- [x] **Cấu hình AI linh hoạt đã được chứng minh:** Có test tự động chứng minh khả năng mã hóa, giải mã, chuyển đổi profile và fallback khi lỗi.
- [x] **Không hứa hẹn tính năng chưa triển khai:** Rõ ràng công bố trạng thái Cloudflare Access remote là `BLOCKED_BY_ACCESS_SETUP` và chỉ trình bày chế độ xác thực mock dev trên môi trường cục bộ.

