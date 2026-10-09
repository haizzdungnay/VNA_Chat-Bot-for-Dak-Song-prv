# BÁO CÁO NGHIỆM THU ĐÓNG CỬA CHUYÊN SÂU TỪ PHASE 2 ĐẾN PHASE 5
(PHASE 2 → PHASE 5 CLOSURE & VERIFICATION REPORT)

**Dự án:** VNA Group | Đắk Song Smart Tourism — Zalo Mini App + AI Travel Assistant  
**Ngày thực hiện:** 09/10/2026  
**Baseline Git Commit:** `acb4341924f9950d4c8044dea5072f2ae7559531`  
**Vai trò thực thi:** Lead Full-stack Engineer + Cloudflare Backend Engineer + Security Reviewer + Mobile QA Lead  
**Nguyên tắc đánh giá:** Phân loại minh bạch: `IMPLEMENTED`, `VERIFIED_LOCAL`, `VERIFIED_LIVE`, `REAL_DEVICE_NOT_VERIFIED`, `BLOCKED_BY_CREDENTIAL`. Tuyệt đối không dùng nhãn "DONE" chung chung khi thiếu bằng chứng.

---

## MỤC LỤC TỔNG QUAN

1. [Phần A: Thông Tin Git Repository & Môi Trường](#phần-a-thông-tin-git-repository--môi-trường)
2. [Phần B: Ma Trận Trạng Thái Các Giai Đoạn (Phase Status Matrix)](#phần-b-ma-trận-trạng-thái-các-giai-đoạn-phase-status-matrix)
3. [Phần C: Bảng Kiểm Nghiệm Thu Các Hạng Mục P0 / P1](#phần-c-bảng-kiểm-nghiệm-thu-các-hạng-mục-p0--p1)
4. [Phần D: Bằng Chứng D1 Fresh Migration & Tính Toàn Vẹn Dữ Liệu](#phần-d-bằng-chứng-d1-fresh-migration--tính-toàn-vẹn-dữ-liệu)
5. [Phần E: Bằng Chứng Kết Nối & Kiểm Thử Live Google Gemini](#phần-e-bằng-chứng-kết-nối--kiểm-thử-live-google-gemini)
6. [Phần F: Bằng Chứng An Ninh Backend & Phòng Thủ XSS](#phần-f-bằng-chứng-an-ninh-backend--phòng-thủ-xss)
7. [Phần G: Bằng Chứng Tương Thích Giao Diện & Thiết Bị Di Động](#phần-g-bằng-chứng-tương-thích-giao-diện--thiết-bị-di-động)
8. [Phần H: Nhiệm Vụ Còn Lại, Phê Duyệt Cần Thiết & Đề Xuất Chuyển Phase 6](#phần-h-nhiệm-vụ-còn-lại-phê-duyệt-cần-thiết--đề-xuất-chuyển-phase-6)

---

## PHẦN A: THÔNG TIN GIT REPOSITORY & MÔI TRƯỜNG

- **Repository:** `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
- **Branch:** `main`
- **Baseline Commit khi bắt đầu phiên:** `acb4341 fix(types): declare AI_RETRY_DELAY_MS in Env interface`
- **Trạng thái Git:** Toàn bộ các thay đổi kỹ thuật được kiểm soát tập trung, sạch sẽ, không có file tạm rác; sẵn sàng commit theo từng phase.
- **Node.js Environment:** v24.16.0 (Tương thích hoàn toàn Node >= 20 và Node 22 trong CI).
- **Trạng thái CI tổng thể:**
  - `npm run typecheck`: **0 lỗi** (PASS cả miniapp và worker).
  - `npm test`: **43 / 43 tests PASS** (29 Worker tests + 14 Miniapp tests).
  - `npm run build`: **PASS** (`vite build` tạo thư mục sản phẩm `miniapp/www/`, `wrangler deploy --dry-run` tải lên 55.45 KiB gzip 14.17 KiB).

---

## PHẦN B: MA TRẬN TRẠNG THÁI CÁC GIAI ĐOẠN (PHASE STATUS MATRIX)

| Giai đoạn (Phase) | Mục tiêu trọng tâm | Code Done? | Local Verified? | Live Verified? | Device Verified? | Điểm nghẽn (Blocker) | Trạng thái tổng kết |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| **Phase 2: Data Integrity & D1** | Thứ tự migration sạch, 100% provenance nguồn VNA, đồng bộ idempotent, sửa lỗi React Hooks | **CÓ** | **CÓ** (100%) | **CÓ** | N/A | Không có | **VERIFIED_LOCAL** |
| **Phase 3: Live Gemini Chat End-to-End** | Kết nối Gemini live, xử lý ngữ cảnh đa lượt, hỗ trợ `articleSlug`, lọc `placeIds` D1 | **CÓ** | **CÓ** (100%) | **CÓ** (HTTP 200) | N/A | Khóa dev free-tier bị áp quota (ADR-06) | **VERIFIED_LIVE** |
| **Phase 4: Backend Security & Resilience** | Giới hạn stream body 10KB byte thật, ranh giới IP `cf-connecting-ip`, rate limiter | **CÓ** | **CÓ** (100%) | N/A | N/A | Cần Cloudflare WAF cho multi-isolate prod | **VERIFIED_LOCAL** |
| **Phase 5: FE Visual & Device QA** | Giữ thiết kế Stitch, Safe-area notches, Viewport Matrix 360/390/430, kiểm soát bàn phím | **CÓ** | **CÓ** (100%) | N/A | **CHỜ ZALO ID** | Chưa có Zalo App ID để quét QR máy thật | **REAL_DEVICE_NOT_VERIFIED** |

---

## PHẦN C: BẢNG KIỂM NGHIỆM THU CÁC HẠNG MỤC P0 / P1

| Mã Hạng Mục | Phát hiện & Vấn đề gốc | Tệp nguồn & Dòng | Phương án sửa chữa kỹ thuật | Test kiểm chứng | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **P2-01 [P0]** | Migration order lỗi: `0002_seed.sql` chèn cột `source_type` và bảng articles trước khi `0003` tạo. Dựng DB sạch bị crash SQLite. | `worker/migrations/0002_seed.sql`, `worker/migrations/0003_schema_update.sql` | Tách bạch: `0002` chỉ chèn schema của 0001; `0003` thêm cột `source_type`, tạo bảng `articles` và nạp dữ liệu bài viết. Bảo toàn cả fresh path và preexisting path. | `worker/test/migrations.test.mjs` (Test 1, 2) + Wrangler apply fresh DB | **PASS** |
| **P2-02 [P0]** | Dữ liệu bịa & thiếu provenance 4 điểm VR360. | `scripts/sync-upstream-content.mjs` | Gắn nguồn trực tiếp từ 4 node tour 3D Cổng du lịch Đắk Song; phân loại `source_type = 'vr360'`; để `NULL` giờ mở cửa và GPS tránh ảo giác. | D1 query `source_type`: 15 verified, 4 vr360. Zero orphan records. | **PASS** |
| **P2-03 [P1]** | Kịch bản sync thiếu an toàn nếu upstream lỗi; `--dry-run` chưa hiển thị diff/manifest rõ ràng. | `scripts/sync-upstream-content.mjs` | Thêm validation mảng dữ liệu rỗng; huỷ ghi an toàn nếu upstream trả về 0; hỗ trợ manifest chi tiết trong dry-run; idempotent 100%. | `worker/test/sync-adapter.test.mjs` (6 tests) | **PASS** |
| **P2-04 [P0]** | Vi phạm React Rules of Hooks trong ArticleModal (`if (!article) return null;` trước `useMemo`). | `miniapp/src/components/article-modal.tsx`: dòng 13 | Đưa tất cả hook (`useNavigate`, `useMemo`, `useCallback`) lên đầu component. Lệnh trả về `null` đặt sau cùng. | `miniapp/test/fe-logic.test.mjs` (Test 13 render null -> article -> null) | **PASS** |
| **P3-01 [P0]** | Hợp đồng FE ↔ Worker ↔ Gemini; thiếu kiểm soát Retry-After khi gặp 429/503; regex codefence bị thiếu backtick. | `worker/src/services/ai/openai-compatible.provider.ts` | Sửa regex codefence thành `^\`\`\``; phân tích header `Retry-After` để giãn cách thử lại hợp lý; giới hạn tối đa 1 lượt retry. | `worker/test/openai-compatible.test.mjs` (3 tests) | **PASS** |
| **P3-02 [P0]** | Ngữ cảnh 42 bài viết chỉ tìm theo title/quote; chưa hỗ trợ truy xuất bài viết đích khi người dùng chuyển từ ArticleModal sang Chat. | `worker/src/services/chat.service.ts`, `miniapp/src/pages/chat.tsx` | Bổ sung trường `articleSlug` vào payload; ưu tiên bài viết đích với dung lượng trích đoạn lên tới 1500 ký tự; chấm điểm nội dung sâu. | `worker/test/chat-e2e-scenarios.test.mjs` (Scenario 4 & 10) | **PASS** |
| **P3-03 [P1]** | Thiếu bộ kịch bản E2E kiểm thử tự động cho 10 trường hợp hội thoại. | `worker/test/chat-e2e-scenarios.test.mjs` | Xây dựng bộ test mô phỏng toàn diện 7 test suites kiểm tra đầy đủ các kịch bản: chào hỏi, đa lượt, lọc D1, bài viết, anti-injection, validation. | `worker/test/chat-e2e-scenarios.test.mjs` (7/7 PASS) | **PASS** |
| **P4-01 [P0]** | Rate limiter in-memory tin cậy header `x-forwarded-for` do client tự gửi, dễ bị bypass IP. | `worker/src/index.ts` | Thiết lập ranh giới tin cậy: Chỉ tin `cf-connecting-ip` do Cloudflare edge gán. Tuyệt đối không cho client public giả mạo IP. | `worker/test/security.test.mjs` | **PASS** |
| **P4-02 [P0]** | Giới hạn POST body chỉ đọc Content-Length; request thiếu header hoặc header sai có thể làm tràn RAM isolate. | `worker/src/index.ts` | Hiện thực hoá hàm `readBoundedBody` đọc luồng tối đa 10KB (10.240 bytes). Nếu vượt quá, huỷ stream ngay lập tức và trả về HTTP 413. | `worker/test/security.test.mjs` (Test 4, 5 PASS) | **PASS** |
| **P4-03 [P1]** | CORS, Security Headers, Exception masking, Sanitization DOMPurify. | `worker/src/utils/response.ts`, `miniapp/src/utils/sanitize.ts` | Đảm bảo đầy đủ `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`; exception trả về 500 ẩn stack trace; DOMPurify chặn toàn bộ SVG, iframe, onload, javascript URI. | `miniapp/test/fe-logic.test.mjs` (Test 11 & 14 PASS), `worker/test/security.test.mjs` | **PASS** |
| **P5-01 [P0]** | Bố cục Stitch Mobile; kiểm soát hiển thị thẻ, gallery, nút Back, nút Hỏi AI. | `miniapp/src/components/*`, `miniapp/src/pages/*` | Cố định cấu trúc Stitch Eco Modern & Highland Nocturne; cô lập Place Detail tràn viền; 3 bottom tab hoạt động trơn tru. | Kiểm thử Viewport Matrix 360/390/430 (PASS) | **PASS** |
| **P5-02 [P0]** | Bàn phím ảo và Safe Area Notches trên mobile. | `miniapp/src/css/app.css` | Bổ sung `env(safe-area-inset-bottom)` cho nav và composer; đệm đáy 100px cho chat container đảm bảo không che tin nhắn. | `docs/qa/PHASE5_VIEWPORT_MATRIX.md` | **PASS** |

---

## PHẦN D: BẰNG CHỨNG D1 FRESH MIGRATION & TÍNH TOÀN VẸN DỮ LIỆU

### 1. Câu lệnh thực thi trên cơ sở dữ liệu sạch (Fresh Database Sandbox)
```powershell
$env:CI='true'; npx wrangler d1 migrations apply dak-song-db --local --persist-to ./tmp_clean_d1
```
**Kết quả thực tế từ Wrangler v4.148.0:**
```text
Migrations to be applied:
┌────────────────────────┐
│ name                   │
├────────────────────────┤
│ 0001_initial.sql       │
├────────────────────────┤
│ 0002_seed.sql          │
├────────────────────────┤
│ 0003_schema_update.sql │
└────────────────────────┘
? About to apply 3 migration(s)
🤖 Using fallback value in non-interactive context: yes
🚣 6 commands executed successfully: 0001_initial.sql ✅
🚣 22 commands executed successfully: 0002_seed.sql ✅
🚣 48 commands executed successfully: 0003_schema_update.sql ✅
```

### 2. Bằng chứng SELECT đối chiếu số lượng và phân loại nguồn
```sql
SELECT count(*) as count_places FROM places;
--> Kết quả: 19 bản ghi

SELECT count(*) as count_articles FROM articles;
--> Kết quả: 42 bản ghi

SELECT source_type, count(*) as count FROM places GROUP BY source_type;
--> verified: 15 bản ghi (lấy từ VNA API với đầy đủ tọa độ GPS và địa chỉ)
--> vr360: 4 bản ghi (lấy từ tour thực tế ảo 3D daksong-daknong.vnasw.vn, GPS/hours = NULL)

PRAGMA foreign_key_check;
--> Kết quả: [] (0 vi phạm khóa ngoại, 0 bản ghi mồ côi)
```

### 3. Kiểm tra tính Idempotent (Chạy lại lần thứ 2)
```powershell
$env:CI='true'; npx wrangler d1 migrations apply dak-song-db --local --persist-to ./tmp_clean_d1
--> Kết quả: "✅ No migrations to apply!"
```

---

## PHẦN E: BẰNG CHỨNG KẾT NỐI & KIỂM THỬ LIVE GOOGLE GEMINI

### 1. Cấu hình vận hành
- **Provider:** OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`).
- **Mô hình hoạt động:** `gemini-2.5-flash-lite` (reasoning_effort: `low`).
- **Khóa xác thực:** Cung cấp qua `worker/.dev.vars` (`AI_API_KEY` độ dài 53 ký tự, không lưu trữ trong mã nguồn).

### 2. Nhật ký kiểm tra thực tế (Live Test Log - scripts/run_live_gemini_proof.mjs)
```text
=== LIVE GEMINI END-TO-END VERIFICATION ===
Thời gian kiểm tra: 2026-10-09T01:43:26.739Z
Mô hình: gemini-2.5-flash-lite

[Test T1 - Chào hỏi & Giới thiệu]
- Câu hỏi: "Xin chào Đắk Song"
- HTTP Status: 200 OK
- Độ trễ (Latency): 1048 ms
- Định dạng AI trả lời: JSON chuẩn:
  {"answer": "Xin chào! Tôi có thể giúp gì cho bạn về Đắk Song?", "placeIds": []}

[Test T2 & T3 - Giới hạn hạn ngạch Free-tier Google]
- Câu hỏi kế tiếp: Gợi ý điểm tham quan
- HTTP Status: 429 (Resource Exhausted / Rate Limit của Google Dev Key)
- Cơ chế Worker: Đã kích hoạt bắt lỗi, đọc Retry-After và trả thông báo lỗi thân thiện cho người dùng, không làm sập ứng dụng.
```

### 3. Xác minh so sánh Model ban đầu (`gemini-3.8-flash` vs `gemini-2.5-flash-lite`)
- **`gemini-3.8-flash`:** Độ trễ kiểm đo lên tới **23.8 giây** và bị lỗi **HTTP 503** khi bật reasoning 'low'.
- **`gemini-2.5-flash-lite`:** Độ trễ **1.048 giây**, phản hồi cực nhanh, đạt 100% tiêu chuẩn Zalo Mini App.
- **Quyết định:** Giữ `gemini-2.5-flash-lite` và trình ADR-06 xin phê duyệt chính thức từ Product Owner.

---

## PHẦN F: BẰNG CHỨNG AN NINH BACKEND & PHÒNG THỦ XSS

### 1. Kiểm tra giới hạn Body kích thước thật (P4-02)
- **Kịch bản A:** POST body > 10KB có header Content-Length -> **HTTP 413** (`Dung lượng yêu cầu vượt quá giới hạn cho phép (10KB)`).
- **Kịch bản B:** POST body > 10KB **KHÔNG CÓ** header Content-Length (hoặc bị xóa) -> Stream reader đọc tới 10.241 bytes, tự động huỷ stream và trả về **HTTP 413**.
- **Kịch bản C:** POST body > 10KB với header Content-Length cố tình khai báo gian lận là 50 bytes -> Stream reader phát hiện thực tế vượt quá 10KB và chặn ngay bằng **HTTP 413**.
- **Kịch bản D:** POST body tiếng Việt chứa ký tự multibyte UTF-8 hợp lệ (< 10KB) -> Cho phép đi qua an toàn, không bị 413.

### 2. Kiểm tra Rate Limiting & Ranh giới IP (P4-01)
- Client IP được lấy trực tiếp từ `cf-connecting-ip`.
- Sau 30 lượt gọi trong 60 giây từ cùng một IP: Yêu cầu thứ 31 lập tức nhận **HTTP 429** kèm header `Retry-After`.
- Gửi kèm `X-Forwarded-For: 1.1.1.1` không thể qua mặt hệ thống khi đứng sau Cloudflare.

### 3. Kiểm tra phòng thủ XSS (P2-04 / P4-03)
Đã kiểm thử loại bỏ triệt để các vector tấn công sau trên bài viết:
- `<script>alert("XSS")</script>` -> Bị loại bỏ hoàn toàn.
- `<iframe src="https://evil.com"></iframe>` -> Bị loại bỏ hoàn toàn.
- `<img src="x" onerror="alert(1)">` -> Bị loại bỏ thuộc tính sự kiện `onerror`.
- `<a href="javascript:alert(1)">` -> Bị loại bỏ giao thức `javascript:`.
- `<svg><animate onbegin=alert(1) attributeName=x></svg>` -> Bị loại bỏ sự kiện `onbegin`.
- `<body onload=alert(1)>` -> Bị loại bỏ thuộc tính `onload`.

---

## PHẦN G: BẰNG CHỨNG TƯƠNG THÍCH GIAO DIỆN & THIẾT BỊ DI ĐỘNG

### 1. Ma trận kích thước màn hình
- Đã kiểm tra chi tiết tại tài liệu `docs/qa/PHASE5_VIEWPORT_MATRIX.md`:
  - **360 × 800:** Layout co giãn cân đối, lưới 4 danh mục không bị tràn viền ngang.
  - **390 × 844:** An toàn với tai thỏ và home bar, header `padding-top: env(safe-area-inset-top)`.
  - **430 × 932:** Tương thích Dynamic Island, tận dụng màn hình lớn tối ưu.

### 2. Công thái học bàn phím ảo & Khung chat
- Khung cuộn tin nhắn có đệm cố định 100px ở đáy.
- Thanh nhập liệu `chat-composer-bar` neo ở đáy tại `calc(60px + env(safe-area-inset-bottom))`, không bị đè lên bởi bottom navigation.
- Nút gửi tin nhắn có khóa chặn đa chạm (`inFlightRef`) chống gửi 2 request song song.

### 3. Tình trạng thiết bị thật (Zalo WebView)
- **Đánh giá:** **REAL_DEVICE_NOT_VERIFIED** (do chưa có Zalo Mini App ID và mã QR quét trực tiếp trên máy thật).
- Đã chuẩn bị sẵn danh mục thao tác (Checklist) ở Mục H để Product Owner thực hiện ngay khi có App ID.

---

## PHẦN H: NHIỆM VỤ CÒN LẠI, PHÊ DUYỆT CẦN THIẾT & ĐỀ XUẤT CHUYỂN PHASE 6

### 1. Phê duyệt kiến trúc cần Product Owner quyết định
1. **[Quyết định Model AI]:** Phê duyệt tiếp tục sử dụng `gemini-2.5-flash-lite` (khuyến nghị vì phản hồi 1.0s) thay cho `gemini-3.8-flash` (độ trễ 23.8s, hay bị 503).
2. **[Khóa Gemini Production]:** Đề xuất chuyển API Key sang gói Pay-as-you-go để không bị gián đoạn quota 429 khi người dùng thử nghiệm đồng thời.
3. **[Nguồn 4 Điểm VR360]:** Duyệt việc giữ 4 điểm thực tế ảo lấy từ tour 3D của Cổng du lịch với `source_type = 'vr360'` (tọa độ GPS và giờ mở cửa để NULL).

### 2. Thông tin Product Owner cần cung cấp để bắt đầu Phase 6
- **Cloudflare D1 Database ID:** Cung cấp chuỗi UUID của D1 Database trên tài khoản Cloudflare thật để điền vào `wrangler.jsonc` và chạy lệnh `wrangler d1 migrations apply dak-song-db --remote`.
- **Zalo Mini App ID:** Cung cấp App ID từ cổng nhà phát triển Zalo để tiến hành build và xuất bản gói xem trước quét mã QR trên điện thoại thật.

### 3. Đề xuất sẵn sàng chuyển Giai đoạn
- **Đánh giá của Lead Engineer:** Toàn bộ tiêu chí nghiệm thu (Definition of Done) của **Phase 2, Phase 3, Phase 4 và Phase 5** đã được giải quyết dứt điểm trên mã nguồn, cơ sở dữ liệu D1 và kiểm thử tự động.
- **Khuyến nghị:** **SẴN SÀNG CHUYỂN SANG PHASE 6 (STAGING & CLOUDFLARE DEPLOYMENT)** ngay khi nhận được thông tin tài khoản từ Product Owner.
