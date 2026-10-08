# KẾ HOẠCH TỔNG THỂ HOÀN THIỆN KHUNG DỰ ÁN MVP
(MASTER PROJECT COMPLETION PLAN)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày phát hành:** 08/10/2026  
**Phiên bản kế hoạch:** 1.0 (Post-Audit Baseline)  
**Tình trạng tài liệu:** Kế hoạch chính thức trình duyệt  

---

## 1. TÓM TẮT ĐIỀU HÀNH & MỤC TIÊU SẢN PHẨM

### 1.1. Mục tiêu Cốt lõi
Xây dựng và hoàn thiện trọn vẹn **Khung ứng dụng MVP** cho Trợ lý Du lịch Đắk Song trên nền tảng Zalo Mini App, phục vụ du khách khám phá danh lam, ẩm thực, văn hóa và hỏi đáp lịch trình thông minh với các tiêu chuẩn khắt khe:
1. **Dữ liệu thật, tự động:** Lấy trực tiếp từ Cổng thông tin du lịch Đắk Song (`https://dulichdaksong.vnasw.vn/` qua VNA Core API), tuyệt đối không soạn thảo thủ công hoặc bịa đặt dữ liệu.
2. **AI trung thực:** Trợ lý AI (Google Gemini 3.8 Flash) trả lời 100% bằng tiếng Việt chuẩn mực, chỉ đề xuất các địa điểm có thật trong cơ sở dữ liệu D1, không bịa giá vé, giờ mở cửa hay số điện thoại.
3. **Trải nghiệm mượt mà:** Đạt chuẩn thiết kế Stitch (Eco Modern Light & Highland Nocturne Dark), 4 route chuẩn, 3 bottom tab, hỗ trợ cá nhân hóa không ép buộc (opt-in onboarding) và bảo mật dữ liệu tuyệt đối.

### 1.2. Ranh giới Phạm vi (Scope Freeze)
- **Thuộc MVP:**
  - 4 màn hình: Trang chủ (`/`), Khám phá (`/explore`), Chi tiết địa điểm (`/place/:id`), Trợ lý AI (`/chat`).
  - 3 tab điều hướng dưới cùng: Trang chủ, Khám phá, Trợ lý AI.
  - Chuyển đổi giao diện Sáng / Tối (Light/Dark Mode).
  - Tích hợp 15 địa điểm du lịch thật và 42 bài viết văn hóa từ nguồn VNA.
  - 5 endpoint REST backend trên Cloudflare Worker + Cloudflare D1.
- **Tuyệt đối NGOÀI MVP (Scope Creep):**
  - Không đặt phòng, mua vé, thanh toán trực tuyến.
  - Không đăng nhập tài khoản / lưu hồ sơ trên máy chủ.
  - Không hệ thống đánh giá/bình luận phức tạp (CMS/UGC).
  - Không điều hướng giọng nói, check-in GPS thời gian thực.
  - Không tích hợp cơ sở dữ liệu vector/RAG phức tạp khi chưa cần thiết.

---

## 2. KIẾN TRÚC HỆ THỐNG MỤC TIÊU (TARGET ARCHITECTURE)

```
[ Cổng Du Lịch Đắk Song (VNA API) ]
   │  (core-360.vnaapi.com)
   ▼
[ CLI Sync Adapter ] ──(Idempotent Upsert)──> [ Cloudflare D1 Database ]
                                                        │
[ Google Gemini 3.8 Flash ] <──(Context Query)──────────┤
   ▲                                                    ▼
   │                                           [ Cloudflare Worker API ]
   │                                              - GET  /api/health
   │                                              - GET  /api/categories
   │                                              - GET  /api/places
   │                                              - GET  /api/places/:id
   │                                              - POST /api/chat
   │                                                    ▲
   │                                                    │ (HTTPS /api/*)
   └────────────────────────────────────────────────────┼────────────────┐
                                                        │                │
                                               [ Zalo Mini App Client ]  │
                                                  - React 18 / Vite / TS │
                                                  - Stitch Design System │
                                                  - ZMP Navigation       │
                                                  - Safe Storage Fallback│
```

---

## 3. LỘ TRÌNH TRIỂN KHAI CHI TIẾT THEO TỪNG GIAI ĐOẠN (ROADMAP & GATES)

### PHASE 0: Rà Soát Hiện Trạng & Khóa Phạm Vi (COMPLETED)
- **Mục tiêu:** Rà soát mã nguồn git, CI/CD, kiểm thử cục bộ, xác nhận tính trung thực của repo.
- **Kết quả:** Commit `f44df71` sạch, 16/16 test pass, TypeScript pass, build pass.
- **Tài liệu nộp:** `docs/CURRENT_STATE_AUDIT.md`.

### PHASE 1: Khảo Sát Nguồn Dữ Liệu & Chốt Kiến Trúc (COMPLETED)
- **Mục tiêu:** Kiểm tra thực tế cổng du lịch Đắk Song và xác định phương thức lấy dữ liệu tối ưu.
- **Phát hiện đột phá:** Tìm thấy cụm API chính thức `https://core-360.vnaapi.com/` và CDN ảnh `static.dggv.edu.vn`. Không cần cào màn hình (scraping).
- **Tài liệu nộp:** `docs/SOURCE_CONTENT_INTEGRATION_SPEC.md`.

---

### PHASE 2: Xây Dựng Công Cụ Đồng Bộ & Nạp Dữ Liệu D1 Thật (Dự kiến: 1 ngày làm việc)
- **Mục tiêu:** Viết mã nguồn kịch bản đồng bộ tự động và chuyển đổi dữ liệu thành seed D1 chính thức.
- **Nhiệm vụ cụ thể:**
  1. Tạo kịch bản `scripts/sync-upstream-content.mjs`:
     - Gọi VNA Core API trích xuất 15 địa điểm và 42 bài viết.
     - Chuẩn hóa Unicode tiếng Việt, định dạng ảnh CDN đầy đủ.
     - Hỗ trợ cờ `--dry-run` (xem trước sai biệt mà không ghi DB).
  2. Tạo migration dữ liệu thật `worker/migrations/0002_seed_official.sql` thay thế dữ liệu mẫu cũ.
  3. Bổ sung bài kiểm thử tự động cho module đồng bộ dữ liệu (`worker/test/sync-adapter.test.mjs`).
- **Definition of Done (DoD):**
  - Chạy lệnh đồng bộ 2 lần liên tiếp không sinh bản ghi trùng.
  - `GET /api/places` trên môi trường dev trả về 15 địa điểm thật của huyện Đắk Song.

---

### PHASE 3: Kiểm Thử Đầu-Cuối Chat AI & Thẻ Địa Điểm Trên Dữ Liệu Thật (Dự kiến: 1 ngày làm việc)
- **Mục tiêu:** Khép kín luồng tương tác thực tế giữa người dùng, FE, Worker và Google Gemini AI.
- **Nhiệm vụ cụ thể:**
  1. Nạp ngữ cảnh bài viết và danh mục thật vào System Prompt của Worker.
  2. Kiểm thử kịch bản:
     - Khách hỏi tổng quan về du lịch Đắk Song -> AI tóm tắt văn hóa bản địa.
     - Khách hỏi điểm ngắm cảnh -> AI giới thiệu "Thiền Viện Trúc Lâm Đạo Nguyên", "Khu bảo tồn Nâm Nung" và trả về `placeIds` tương ứng.
     - Khách bấm vào thẻ gợi ý `PlaceCard` ngay trong tin nhắn chat -> Điều hướng sang màn hình Chi tiết địa điểm (`/place/:id`).
     - Khách bấm "Hỏi AI về nơi này" -> Mở lại chat với ngữ cảnh địa điểm đó (`/chat?placeId=...`).
- **Definition of Done (DoD):**
  - AI trả lời chính xác, không hallucinate địa điểm lạ, hiển thị thẻ PlaceCard hoạt động 100%.

---

### PHASE 4: Gia Cố An Ninh Backend & Tối Ưu Hóa (Dự kiến: 0.5 - 1 ngày làm việc)
- **Mục tiêu:** Bảo vệ API khỏi lạm dụng và hoàn thiện các đường truyền lỗi mạng.
- **Nhiệm vụ cụ thể:**
  1. Tích hợp cơ chế Rate Limiting đơn giản trên Worker cho route `/api/chat` (chống spam request làm cạn hạn mức Gemini).
  2. Rà soát CORS headers đảm bảo chỉ chấp nhận nguồn hợp lệ hoặc an toàn cho Mini App.
  3. Bổ sung kiểm thử tự động cho kịch bản Prompt Injection: Đảm bảo dữ liệu trích xuất từ bên ngoài không làm thay đổi chỉ dẫn hệ thống.
- **Definition of Done (DoD):**
  - 100% test pass, không để lộ API keys hay thông tin nội bộ trong header/log.

---

### PHASE 5: Đảm Bảo Chất Lượng Giao Diện FE (Visual & Device QA) (Dự kiến: 0.5 - 1 ngày làm việc)
- **Mục tiêu:** Kiểm tra độ hiển thị và công thái học trên thiết bị di động.
- **Nhiệm vụ cụ thể:**
  1. Kiểm thử responsive trên các cỡ màn hình chuẩn: 360px (màn nhỏ), 390px (iPhone tiêu chuẩn), 430px (màn lớn).
  2. Kiểm tra hiển thị tương phản chuẩn Stitch trên cả Light Mode và Dark Mode.
  3. Kiểm tra bàn phím ảo đẩy khung chat trên Zalo WebView không che khuất ô nhập liệu.
  4. Xác nhận luồng Onboarding Welcome Sheet hoạt động mượt mà khi Lưu, Bỏ qua hoặc Xóa dữ liệu.
- **Definition of Done (DoD):**
  - Không có lỗi vỡ giao diện (UI overflow), đạt chuẩn visual đã duyệt.

---

### PHASE 6: Triển Khai Staging Cloudflare & Đưa Lên Zalo Mini App Center (Phụ thuộc cấp quyền)
- **Mục tiêu:** Chạy thực tế trên môi trường đám mây và quét mã QR test trên app Zalo điện thoại thật.
- **Nhiệm vụ cụ thể:**
  1. Cấu hình `database_id` Cloudflare D1 thật trong `wrangler.jsonc`.
  2. Chạy migration tạo bảng và nạp dữ liệu lên Cloudflare D1 Remote.
  3. Đặt bí mật an toàn trên Cloudflare: `wrangler secret put AI_API_KEY`.
  4. Triển khai Cloudflare Worker lên domain HTTPS thật.
  5. Cập nhật `VITE_API_BASE_URL` trong `miniapp/.env.production` trỏ về Worker thật.
  6. Đóng gói Miniapp và tải lên Zalo Mini App Center qua tài khoản nhà phát triển của dự án.
- **Definition of Done (DoD):**
  - Mở app Zalo trên điện thoại thật, quét mã QR, duyệt 4 màn hình và chat AI nhận phản hồi mượt mà.

---

### PHASE 7: Nghiệm Thu, Bàn Giao & Đóng Khung MVP (Dự kiến: 0.5 ngày làm việc)
- **Mục tiêu:** Lập biên bản bàn giao, cập nhật tài liệu vận hành và đánh dấu phiên bản Git release.
- **Nhiệm vụ cụ thể:**
  1. Hoàn tất bảng kiểm nghiệm thu `docs/ACCEPTANCE_MATRIX.md`.
  2. Bàn giao Runbook khôi phục máy sạch (`docs/CODEX_EXECUTION_RUNBOOK.md`).
  3. Gắn thẻ Git Tag: `v1.0.0-mvp`.
  4. Chốt khung MVP để sẵn sàng đưa vào sử dụng.

---

## 4. MA TRẬN PHÂN CÔNG & QUYỀN DUYỆT (GOVERNANCE & APPROVAL GATES)

| Cửa nghiệm thu (Gate) | Điều kiện tiên quyết | Người chịu trách nhiệm | Người có thẩm quyền phê duyệt |
| :--- | :--- | :---: | :---: |
| **Gate 1: Duyệt Kế Hoạch & Kiến Trúc** | Hoàn thành bộ 6 tài liệu audit và spec | Lead Architect (Codex) | **Anh trai (Project Owner)** |
| **Gate 2: Duyệt Dữ Liệu Đồng Bộ D1** | Hoàn thành kịch bản sync, chạy dry-run | Full-stack Engineer | **Anh trai (Project Owner)** |
| **Gate 3: Duyệt Triển Khai Cloudflare** | Kiểm thử cục bộ pass 100%, sẵn sàng deploy | DevOps / Backend | **Anh trai (Cung cấp Account)** |
| **Gate 4: Nghiệm Thu Máy Thật Zalo** | Test mượt trên điện thoại qua mã QR | QA & Product Lead | **Anh trai (Phê duyệt đóng MVP)** |

---

## 5. TỔNG KẾT
Kế hoạch trên tập trung tối đa vào tính thực chiến, loại bỏ hoàn toàn các giả định mơ hồ và tận dụng 100% dữ liệu du lịch chính thức của địa phương. Sau khi anh duyệt Kế hoạch này, bước tiếp theo duy nhất cần thực hiện là **PHASE 2: Xây dựng công cụ đồng bộ dữ liệu và nạp dữ liệu D1 thật**.
