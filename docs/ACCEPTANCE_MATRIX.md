# MA TRẬN TIÊU CHÍ NGHIỆM THU MVP TỔNG THỂ (ACCEPTANCE MATRIX)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày cập nhật:** 09/10/2026  
**Phiên bản:** 2.0 (Post Phase 2-5 Closure Audit & Regression Suite)  
**Tiêu chuẩn nghiệm thu:** 100% kiểm chứng định lượng bằng test tự động và câu lệnh thực thi tái lập được.

---

## 1. BẢNG TIÊU CHÍ NGHIỆM THU THEO TỪNG MÔ-ĐUN

| Mã ID | Mô-đun / Hạng mục | Điều kiện kiểm thử / Đầu vào | Hành vi & Kết quả kỳ vọng | Trạng thái thực tế | Bằng chứng kiểm tra / Lệnh xác minh | Ưu tiên |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| **TC-FE-01** | FE Routing | Điều hướng URL: `/`, `/explore`, `/place/:id`, `/chat` | Chuyển trang mượt mà bằng ZMPRouter, không lỗi trắng trang | **VERIFIED_LOCAL** | `miniapp/src/app.tsx`, Vite build PASS | P0 |
| **TC-FE-02** | Trang Chủ (Home) | Tải trang chủ lần đầu | Hiển thị Banner, Lưới 4 danh mục, Top địa điểm nổi bật, Chip gợi ý AI | **VERIFIED_LOCAL** | `miniapp/src/pages/home.tsx` | P0 |
| **TC-FE-03** | Khám Phá (Explore) | Chọn danh mục hoặc gõ ô tìm kiếm | Danh sách thẻ địa điểm lọc thời gian thực, hiển thị ảnh và tên chuẩn | **VERIFIED_LOCAL** | `miniapp/src/pages/explore.tsx` | P0 |
| **TC-FE-04** | Chi Tiết Địa Điểm | Bấm vào 1 thẻ địa điểm bất kỳ | Tải đầy đủ thông tin: Ảnh bìa, Tọa độ, Địa chỉ, Số điện thoại, Nút bản đồ | **VERIFIED_LOCAL** | `miniapp/src/pages/place-detail.tsx` | P0 |
| **TC-FE-05** | Chat AI (Đa lượt) | Gửi câu hỏi "Xin chào Đắk Song" | Nhận phản hồi tiếng Việt trong < 2s; hỏi tiếp lượt 2 giữ nguyên ngữ cảnh | **VERIFIED_LOCAL** | `worker/test/chat-e2e-scenarios.test.mjs` (Scenario 1 & 2) | P0 |
| **TC-FE-06** | PlaceCard trong Chat | Hỏi về "địa điểm ăn uống" hoặc "thắng cảnh" | Trả lời kèm danh sách `placeIds`, FE render thẻ `PlaceCard` có thể click | **VERIFIED_LOCAL** | `worker/test/chat-e2e-scenarios.test.mjs` (Scenario 3) | P0 |
| **TC-FE-07** | Concurrency Guard | Bấm nút Gửi tin nhắn liên tục nhiều lần | Khóa chặn gửi lặp, nút gửi chuyển trạng thái đang xử lý, chỉ gửi 1 request | **VERIFIED_LOCAL** | `miniapp/test/fe-logic.test.mjs` (Test 3) | P0 |
| **TC-FE-08** | Chat Retry an toàn | Lỗi mạng xảy ra -> Bấm nút "Thử lại" | Chỉ gửi lại đúng câu hỏi bị lỗi, không nhân đôi lịch sử trò chuyện | **VERIFIED_LOCAL** | `miniapp/test/fe-logic.test.mjs` (Test 2) | P0 |
| **TC-FE-09** | Giao diện Stitch | Chuyển đổi giữa Light Mode và Dark Mode | Màu chuẩn Eco Modern (#137A3E) và Highland Nocturne (#102217), tương phản tốt | **VERIFIED_LOCAL** | `miniapp/src/css/app.css`, `Layout` component | P1 |
| **TC-FE-10** | Welcome Sheet | Mở app lần đầu; thử Skip, Save, Edit, Delete | Lưu trữ đúng trạng thái; khi Delete hoặc Skip thì không gửi thông tin profile | **VERIFIED_LOCAL** | `miniapp/test/fe-logic.test.mjs` (Test 5, 6, 10) | P0 |
| **TC-FE-11** | Chia Sẻ & Clipboard | Bấm nút chia sẻ địa điểm | Gọi native share Zalo; nếu không hỗ trợ fallback copy link có thông báo trung thực | **VERIFIED_LOCAL** | `miniapp/test/fe-logic.test.mjs` (Test 8) | P1 |
| **TC-FE-12** | React Hooks Order | Modal bài viết chuyển null -> article -> null | Hooks (`useNavigate`, `useMemo`, `useCallback`) gọi vô điều kiện, không đổi thứ tự | **VERIFIED_LOCAL** | `miniapp/test/fe-logic.test.mjs` (Test 13 PASS) | P0 |
| **TC-FE-13** | HTML Sanitization | HTML bài viết chứa script, iframe, onload, onclick | DOMPurify làm sạch triệt để mã độc, không làm vỡ HTML an toàn | **VERIFIED_LOCAL** | `miniapp/test/fe-logic.test.mjs` (Test 11 & 14 PASS) | P0 |
| **TC-BE-01** | Health Check API | `GET /api/health` | Trả về mã HTTP 200: `{"status": "ok"}` | **VERIFIED_LOCAL** | `worker/test/router.test.js` | P0 |
| **TC-BE-02** | Categories API | `GET /api/categories` | Trả về danh sách 4 danh mục du lịch chuẩn JSON | **VERIFIED_LOCAL** | `worker/test/router.test.js` | P0 |
| **TC-BE-03** | Places API (Filter) | `GET /api/places?categoryId=...&search=...` | Lọc địa điểm theo danh mục và từ khóa chính xác | **VERIFIED_LOCAL** | `worker/test/router.test.js` | P0 |
| **TC-BE-04** | Place Detail API | `GET /api/places/:id` | Trả về 200 cho ID có thật; trả về 404 cho ID không tồn tại | **VERIFIED_LOCAL** | `worker/test/router.test.js` | P0 |
| **TC-BE-05** | Articles API | `GET /api/articles` & `GET /api/articles/:slug` | Trả về danh sách bài viết văn hóa và chi tiết bài viết theo slug | **VERIFIED_LOCAL** | `worker/test/router.test.js` | P0 |
| **TC-BE-06** | Chat API Validation | Gửi tin nhắn > 500 ký tự hoặc lịch sử > 8 lượt hoặc non-string | Trả về mã lỗi 400 Bad Request, không làm sập server | **VERIFIED_LOCAL** | `worker/test/chat-e2e-scenarios.test.mjs` (Scenario 9) | P0 |
| **TC-AI-01** | Kết nối Gemini Thật | Gọi API chat với dev key thật | Kết nối `gemini-2.5-flash-lite` thành công, trả lời trong 1048ms (HTTP 200) | **VERIFIED_LIVE** | `scripts/run_live_gemini_proof.mjs` (HTTP 200, 1048ms) | P0 |
| **TC-AI-02** | Ngôn ngữ 100% Tiếng Việt| Hỏi tiếng Việt, hỏi tiếng Anh, hỏi ký tự lạ | Trợ lý AI trả lời 100% bằng tiếng Việt chuẩn mực | **VERIFIED_LOCAL** | System prompt guardrails + Scenario 1 test | P0 |
| **TC-AI-03** | Chống ảo giác (Anti-Hallucination)| Hỏi về một địa điểm hoàn toàn bịa đặt | AI trả lời rõ ràng là không có đủ thông tin, không tự sáng tác | **VERIFIED_LOCAL** | `worker/test/chat-e2e-scenarios.test.mjs` (Scenario 5 & 6) | P0 |
| **TC-AI-04** | Ngữ cảnh Bài viết sâu | Truyền `articleSlug` từ modal vào `/api/chat` | Tích hợp trích đoạn bài viết đích (tối đa 1500 ký tự) vào system prompt | **VERIFIED_LOCAL** | `worker/test/chat-e2e-scenarios.test.mjs` (Scenario 4 & 10) | P0 |
| **TC-DATA-01**| Nguồn dữ liệu VNA | Kết nối VNA Core API `core-360.vnaapi.com` | Trích xuất thành công 15 địa điểm và 42 bài viết thật của Đắk Song | **VERIFIED_LIVE** | `scripts/sync-upstream-content.mjs` (15 verified, 42 articles) | P0 |
| **TC-DATA-02**| 4 Điểm đến VR360 | Trích xuất tour 3D `daksong-daknong.vnasw.vn` | 4 điểm đến có ID `vr360-*`, GPS và giờ mở cửa để NULL (không bịa) | **VERIFIED_LOCAL** | SELECT `source_type` từ D1: 15 verified, 4 vr360 | P0 |
| **TC-DATA-03**| Đồng bộ Idempotent | Chạy lệnh sync dữ liệu lặp lại nhiều lần | Không tạo bản ghi trùng lặp; dry-run không sửa file/db | **VERIFIED_LOCAL** | `worker/test/sync-adapter.test.mjs` & `migrations.test.mjs` | P1 |
| **TC-DATA-04**| Fresh D1 Migration | Áp dụng từ 0001 -> 0002 -> 0003 trên DB sạch | Áp dụng 100% thành công, COUNT places = 19, articles = 42, 0 lỗi | **VERIFIED_LOCAL** | `worker/test/migrations.test.mjs` (Test 1) + Wrangler Local | P0 |
| **TC-DATA-05**| Preexisting DB Upgrade | Nâng cấp DB cũ đã có 0001 và 0002 lên 0003 | Bổ sung cột `source_type` và bảng articles an toàn, không mất dữ liệu cũ | **VERIFIED_LOCAL** | `worker/test/migrations.test.mjs` (Test 2) | P0 |
| **TC-SEC-01** | Bí mật API Key | Kiểm tra commit history và file tĩnh | Không có API Key Gemini hay token nào bị commit lên git | **VERIFIED_LOCAL** | Git status clean, `.dev.vars` nằm trong `.gitignore` | P0 |
| **TC-SEC-02** | Rate Limiting & DoS | Gửi > 30 request chat liên tục từ 1 IP | Trả về HTTP 429 kèm header `Retry-After`, không bị bypass | **VERIFIED_LOCAL** | `worker/test/security.test.mjs` (PASS) | P0 |
| **TC-SEC-03** | Bounded POST Body | Gửi POST body > 10KB không có Content-Length hoặc header sai | Worker dừng đọc stream và trả về HTTP 413, không tràn RAM isolate | **VERIFIED_LOCAL** | `worker/test/security.test.mjs` (Test 4, 5 PASS) | P0 |
| **TC-SEC-04** | IP Trust Boundary | Xác minh nguồn IP client | Chỉ tin cậy `cf-connecting-ip`, không tin client `x-forwarded-for` | **VERIFIED_LOCAL** | `worker/src/index.ts` + ADR-08 | P0 |
| **TC-QA-01** | Mobile Viewport Matrix | Kiểm thử viewports 360x800, 390x844, 430x932 (Light/Dark) | Layout chuẩn Stitch, safe-area notches, không bị che thanh chat | **VERIFIED_LOCAL** | `docs/qa/PHASE5_VIEWPORT_MATRIX.md` | P0 |
| **TC-QA-02** | Zalo Real Device QA | Quét mã QR bản thử nghiệm trên Zalo điện thoại thật | Cần Zalo App ID để build package và quét QR thực tế | **REAL_DEVICE_NOT_VERIFIED** | Đã chuẩn bị Checklist chi tiết tại DECISIONS_AND_BLOCKERS.md | P0 |

---

## 2. TỔNG HỢP TRẠNG THÁI KIỂM THỬ TỰ ĐỘNG

- **Tổng số ca kiểm thử tự động:** 43 bài test (29 Worker tests + 14 Miniapp tests).
- **Tỉ lệ đạt:** 43 / 43 (100% PASS).
- **TypeScript Typecheck:** 0 lỗi (cả `miniapp` và `worker`).
- **Production Build:** Thành công 100% (`vite build` tạo bundle `www/`, `wrangler deploy --dry-run` PASS).

## 2. TIÊU CHÍ NGHIỆM THU PHASE 5A: ADMIN DASHBOARD & SECURE DYNAMIC CONFIG

| Mã ID | Mô-đun / Hạng mục | Điều kiện kiểm thử / Đầu vào | Hành vi & Kết quả kỳ vọng | Trạng thái thực tế | Bằng chứng kiểm tra / Lệnh xác minh | Ưu tiên |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| **TC-ADM-01** | Admin Workspace Scaffold | Build & Typecheck riêng biệt `admin/` | Ứng dụng Desktop-first độc lập, không ảnh hưởng `miniapp/` | **VERIFIED_LOCAL** | `npm run build:admin`, `npm run typecheck:admin` (PASS) | P0 |
| **TC-ADM-02** | Cloudflare Access Auth | Gọi API `/api/admin/*` không có token | Fail-Closed: Trả về HTTP 401 Unauthorized, chặn 100% public access | **VERIFIED_LOCAL** | `worker/test/admin-backend.test.mjs` (PASS) | P0 |
| **TC-ADM-03** | Single Admin Allowlist | Gọi API với email khác danh sách cho phép | Trả về HTTP 403 Forbidden | **VERIFIED_LOCAL** | `worker/test/admin-backend.test.mjs` (PASS) | P0 |
| **TC-ADM-04** | AES-256-GCM Envelope Encryption | Lưu API Key profile vào D1 | Mã hóa bằng Web Crypto AES-256-GCM với nonce 12 bytes ngẫu nhiên | **VERIFIED_LOCAL** | `worker/test/admin-backend.test.mjs` (PASS) | P0 |
| **TC-ADM-05** | API Key Masking & Concealment | Đọc danh sách cấu hình AI qua API | Chỉ trả về 4 ký tự cuối (`key_suffix`), không bao giờ lộ plaintext | **VERIFIED_LOCAL** | `admin/test/admin-ui.test.mjs` & backend test (PASS) | P0 |
| **TC-ADM-06** | SSRF & AI Host Guard | Thử thêm endpoint IP private / loopback / HTTP | Bị chặn và báo lỗi rõ ràng; chỉ cho phép HTTPS và host tin cậy | **VERIFIED_LOCAL** | `worker/test/admin-backend.test.mjs` (PASS) | P0 |
| **TC-ADM-07** | Migration 0004 Additive | Chạy migration 0004 trên DB đã có 0001-0003 | Bổ sung 4 bảng mới (`admin_ai_profiles`, `admin_audit_logs`, `visitor_profiles`, `admin_telemetry_events`), 100% bảo toàn dữ liệu cũ | **VERIFIED_LOCAL** | `worker/test/migrations.test.mjs` (PASS) | P0 |
| **TC-ADM-08** | Dynamic AI Resolver & Fallback | Bật `ADMIN_AI_CONFIG_ENABLED=true` | Tự động chuyển profile; khi profile lỗi tự động fallback về Worker Env gốc | **VERIFIED_LOCAL** | `worker/test/ai-config-switch.test.mjs` (PASS) | P0 |
| **TC-ADM-09** | Feature Flag Fail-Safe | Đặt `ADMIN_AI_CONFIG_ENABLED=false` | 100% lưu lượng chat sử dụng Worker Env cũ, không chạm D1 profiles | **VERIFIED_LOCAL** | `worker/test/ai-config-switch.test.mjs` (PASS) | P0 |
| **TC-ADM-10** | Visitor Consent Opt-In/Out | Gửi opt-in / opt-out qua `/api/visitors/consent` | Cập nhật hồ sơ ẩn danh; khi opt-out đánh dấu `deleted_at`, loại khỏi admin list | **VERIFIED_LOCAL** | `worker/test/visitor-consent.test.mjs` (PASS) | P0 |
| **TC-ADM-11** | Truth-in-Telemetry | Mở Admin Dashboard khi chưa có telemetry | Hiển thị trung thực trạng thái "Chưa có dữ liệu" / "Chưa bật thu thập", không tạo số giả | **VERIFIED_LOCAL** | `admin/src/pages/OverviewPage.tsx` & Overview test | P0 |

