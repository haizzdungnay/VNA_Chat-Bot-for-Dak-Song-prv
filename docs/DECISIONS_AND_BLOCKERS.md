# QUYẾT ĐỊNH KIẾN TRÚC, ĐIỂM NGHẼN VÀ QUẢN TRỊ RỦI RO
(DECISIONS, BLOCKERS & RISK LOG — PHASE 2 ĐẾN PHASE 5 CLOSURE)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày cập nhật:** 09/10/2026  
**Phiên bản:** 2.0 (Post Phase 2-5 Closure Audit)  

---

## 1. CÁC QUYẾT ĐỊNH KIẾN TRÚC ĐÃ XÁC LẬP (ADRs)

### ADR-01: Lựa Chọn Nguồn Dữ Liệu Chính Thức
- **Bối cảnh:** Cần dữ liệu chính thống cho huyện Đắk Song từ Cổng du lịch (`https://dulichdaksong.vnasw.vn/`), loại bỏ dữ liệu bịa.
- **Quyết định:** Sử dụng API chính thức của VNA tại `https://core-360.vnaapi.com/` (`travel-location-public`, `post-public`, `category`) với mã đơn vị `DAKNONG-2-29`.
- **Lợi ích:** Dữ liệu chuẩn mực, có tọa độ GPS thật, ảnh CDN chính thống, phân biệt rõ điểm đến xác minh và điểm đến thực tế ảo.

### ADR-02: Giữ Đóng Băng Hợp Đồng REST API và Schema D1
- **Quyết định:** Bảo toàn 100% hợp đồng API của Worker (`/api/health`, `/api/categories`, `/api/places`, `/api/places/:id`, `/api/articles`, `/api/articles/:slug`, `/api/chat`) và cấu trúc bảng D1 (`categories`, `places`, `articles`).
- **Lợi ích:** API Key AI được bảo vệ an toàn trên Worker; tách rời FE khỏi biến động upstream; tốc độ truy vấn D1 cực nhanh (< 20ms).

### ADR-03: Cơ Chế Đồng Bộ Idempotent (scripts/sync-upstream-content.mjs)
- **Quyết định:** Đồng bộ theo cơ chế CLI batch có kiểm soát, hỗ trợ cờ `--dry-run` và `--apply`.
- **Nguyên tắc an toàn:**
  - Tuyệt đối không xóa/ghi đè rỗng dữ liệu khi upstream gặp sự cố.
  - Tạo file seed `0002_seed.sql` và migration `0003_schema_update.sql` có cấu trúc `ON CONFLICT(id) DO UPDATE SET...` đảm bảo chạy nhiều lần không nhân đôi bản ghi.

### ADR-04: Lưu Trữ Ảnh Bằng CDN Chính Thống
- **Quyết định:** Sử dụng đường dẫn CDN chính thức `https://static.dggv.edu.vn/360/{tên_ảnh}`.
- **Lợi ích:** Không tốn chi phí lưu trữ R2 trung gian; CDN phản hồi nhanh và hỗ trợ hotlink trong WebView.

### ADR-06: Xác Minh Thực Nghiệm & Lựa Chọn Model AI (Gemini)
- **Bối cảnh:** Yêu cầu ban đầu đề cập `gemini-3.8-flash` với `reasoning_effort: "low"`, trong khi kho mã nguồn đang cấu hình `gemini-2.5-flash-lite`.
- **Kết quả kiểm thử thực nghiệm trực tiếp (Live Verification Evidence):**
  1. Thử nghiệm `gemini-3.8-flash`: Phản hồi mất **23.8 giây** với prompt cơ bản do thinking tokens tiêu thụ ngân sách trước khi sinh text câu trả lời; khi thêm `reasoning_effort: "low"`, upstream trả về **HTTP 503** (Service Unavailable / Overloaded).
  2. Thử nghiệm `gemini-2.5-flash-lite`: Phản hồi chỉ trong **1.048ms** (HTTP 200), xuất định dạng JSON sạch (`answer`, `placeIds`), câu trả lời tiếng Việt chính xác và ổn định.
- **Đề xuất kỹ thuật trình Product Owner:**
  - **Khuyến nghị:** Tiếp tục duy trì `gemini-2.5-flash-lite` làm mô hình chính thức cho bản phát hành MVP nhằm đảm bảo độ trễ trải nghiệm dưới 2 giây trên điện thoại di động và độ tin cậy kết nối.
  - **Trạng thái:** PENDING_PO_APPROVAL (Nếu PO bắt buộc dùng `gemini-3.8-flash`, hệ thống có thể chuyển đổi qua cấu hình `AI_MODEL`, nhưng cần chấp nhận rủi ro độ trễ cao 20s+ và mã lỗi 503).

### ADR-07: Chiến Lược Thứ Tự Migration D1 An Toàn (Khắc Phục P2-01)
- **Bối cảnh:** Trước đây `0001_initial.sql` tạo bảng places không có cột `source_type`, nhưng `0002_seed.sql` lại chèn cột `source_type` và bảng `articles`, trong khi `0003_schema_update.sql` mới tạo bảng `articles` và alter `source_type`. Khi dựng DB sạch từ đầu, migration 0002 bị lỗi crash SQLite.
- **Quyết định giải quyết:**
  - `0001_initial.sql`: Tạo cấu trúc ban đầu (`categories`, `places`).
  - `0002_seed.sql`: Nạp danh mục và 19 địa điểm chuẩn theo đúng schema của 0001 (không gọi cột `source_type` và không chèn bảng `articles`).
  - `0003_schema_update.sql`: Chạy `ALTER TABLE places ADD COLUMN source_type TEXT DEFAULT ''verified''`, cập nhật 4 điểm `vr360`, tạo bảng `articles` kèm chỉ mục và nạp toàn bộ 42 bài viết.
- **Xác minh kép:**
  - Đường dựng mới (Fresh DB): Áp dụng 0001 -> 0002 -> 0003 hoàn toàn thành công, 0 lỗi, COUNT places = 19, articles = 42.
  - Đường nâng cấp (Preexisting DB): Cơ sở dữ liệu cũ áp dụng 0003 suôn sẻ, không làm mất bất kỳ bản ghi hiện hữu nào.

### ADR-08: Ranh Giới Bảo Mật IP & Bounded Streaming Body (Khắc Phục P4-01, P4-02)
- **Bối cảnh:** Client bên ngoài có thể làm giả header `x-forwarded-for` để vượt rate limiter; Content-Length có thể bị bỏ qua hoặc khai báo sai để tấn công làm tràn bộ nhớ Worker isolate.
- **Quyết định:**
  - Ranh giới IP: Chỉ tin cậy header `cf-connecting-ip` do Cloudflare edge gán. Tuyệt đối không cho phép client công khai can thiệp rate limiter key bằng `x-forwarded-for`.
  - Giới hạn Body: Sử dụng cơ chế đọc luồng giới hạn (`readBoundedBody`) tối đa 10KB (10.240 bytes). Nếu body truyền vượt quá 10KB, stream bị hủy ngay lập tức và trả về HTTP 413, không đọc tràn RAM isolate.
  - Phân tán: Ở môi trường sản xuất đa isolate, Cloudflare WAF Rate Limiting rule được khuyến nghị kết hợp với In-Memory limiter cục bộ.

### ADR-09: Xác Minh Nguồn Gốc 4 Điểm Đến VR360 (Khắc Phục P2-02)
- **Bối cảnh:** Tránh tự sáng tác nội dung du lịch cho 4 điểm đến VR360.
- **Bằng chứng nguồn gốc thực tế:**
  1. `vr360-dien-gio`: Node 51 tour thực tế ảo Đắk Song (`https://daksong-daknong.vnasw.vn/#node51`), ảnh tua-bin gió từ CDN VNA.
  2. `vr360-hang-thong-ql14`: Node 46 (`https://daksong-daknong.vnasw.vn/#node46`), ảnh hàng thông QL14 từ CDN VNA.
  3. `vr360-cong-dong-mnong`: Node 60 (`https://daksong-daknong.vnasw.vn/#node60`), ảnh sinh hoạt cồng chiêng M''nông từ CDN VNA.
  4. `vr360-toan-canh-daksong`: Node 110 (`https://daksong-daknong.vnasw.vn/#node110`), ảnh flycam toàn cảnh từ CDN VNA.
- **Quy tắc:** Đặt `source_type = ''vr360''`, các trường giờ mở cửa, số điện thoại và tọa độ GPS để `NULL` (không bịa GPS hoặc giờ mở cửa).

---

## 2. NHẬT KÝ ĐIỂM NGHẼN & TÌNH TRẠNG NGHIỆM THU

| Mã | Mô tả | Mức độ | Trạng thái kỹ thuật | Biện pháp & Hành động yêu cầu |
| :---: | :--- | :---: | :---: | :--- |
| **BLK-01** | Chưa có Cloudflare D1 Remote Database ID | P0 | LOCAL_VERIFIED | Local D1 đã xác minh 100%. Sẵn sàng deploy khi anh cung cấp D1 Database ID ở Phase 6. |
| **BLK-02** | Google Gemini API Key Free-tier bị giới hạn quota | P1 | LIVE_VERIFIED (Có kiểm soát) | Kết nối live Gemini đã chứng minh hoạt động (HTTP 200, 1048ms). Khuyến nghị nâng cấp khóa trả phí (Pay-as-you-go) khi chạy pilot diện rộng. |
| **BLK-03** | Thiếu thiết bị thật gắn Zalo App ID để test Zalo WebView | P0 | REAL_DEVICE_NOT_VERIFIED | Đã hoàn thành 100% responsive matrix 360/390/430. Đã chuẩn bị sẵn Checklist thao tác trên máy thật để anh thực hiện khi quét mã QR. |

---

## 3. CHECKLIST KIỂM THỬ TRÊN THIẾT BỊ THẬT (DÀNH CHO ANH TRAI KHI TEST TRÊN ZALO)

Khi anh tạo Zalo Mini App ID và quét mã QR trên điện thoại:
1. [ ] **Mở app lần đầu:** Bottom Sheet chào mừng xuất hiện, thử bấm "Bỏ qua" hoặc điền thông tin và bấm "Lưu".
2. [ ] **Trang Chủ:** Banner hiển thị sắc nét, lưới 4 danh mục bấm lọc sang Khám phá mượt mà.
3. [ ] **Chế độ Sáng / Tối:** Bấm icon góc trên bên phải để chuyển đổi giữa Stitch Eco Modern và Highland Nocturne; kiểm tra chữ và nền tương phản rõ ràng.
4. [ ] **Chi tiết địa điểm:** Bấm vào 1 địa điểm (ví dụ Thiền Viện Trúc Lâm hoặc Điểm VR360); thử bấm xem ảnh gallery phóng to, bấm nút "Hỏi AI về địa điểm này".
5. [ ] **Mở bài viết văn hóa:** Đọc bài viết, cuộn xem nội dung, bấm "Hỏi trợ lý AI về bài viết này" và kiểm tra AI tự động gửi câu hỏi liên quan.
6. [ ] **Trò chuyện AI:** Gõ câu hỏi, kiểm tra bàn phím ảo không che thanh nhập tin nhắn; thử hỏi câu hỏi liên tiếp xem ngữ cảnh có được duy trì không.
7. [ ] **Chia sẻ:** Bấm nút chia sẻ địa điểm, kiểm tra hộp thoại chia sẻ Zalo xuất hiện bình thường.

### ADR-09: Kiến Trúc Quản Trị Độc Lập & Xác Thực Cloudflare Access Fail-Closed
- **Bối cảnh:** Cần cung cấp giao diện quản trị desktop cho đúng 1 quản trị viên duy nhất, không thêm độ phức tạp của RBAC hoặc màn hình đăng ký công khai.
- **Quyết định:** Tách Admin thành workspace độc lập (`admin/`), gọi các endpoint `/api/admin/*` trên Worker. Backend kiểm tra chứng thực Cloudflare Access (`Cf-Access-Jwt-Assertion`) server-side với chính sách allowlist email của chủ sở hữu.
- **Nguyên tắc Fail-Closed:** Khi không có JWT hợp lệ hoặc thông tin sai lệch, API trả về 401/403 lập tức. Cho phép mock dev chỉ trong môi trường local khi có cờ rõ ràng.

### ADR-10: Mã Hóa Khóa API Đa Profile Bằng Web Crypto AES-256-GCM Envelope
- **Bối cảnh:** Admin cần lưu và chuyển đổi linh hoạt nhiều AI Provider profile (Google Gemini, Groq, OpenAI...) mà không phải nhập lại khóa, nhưng tuyệt đối không lưu plaintext khóa trong D1 hay trả khóa qua HTTP.
- **Quyết định:** Sử dụng Web Crypto API chuẩn trên Cloudflare Workers với thuật toán AES-256-GCM. Mỗi bản ghi sử dụng 12-byte IV ngẫu nhiên mới hoàn toàn; khóa chủ được nạp từ secret `ADMIN_ENCRYPTION_KEY`. Khóa chỉ được giải mã tạm thời trong isolate khi gửi request sang upstream AI. API chỉ trả về 4 ký tự cuối (`key_suffix`).

### ADR-11: Schema Additive 0004 & Nguyên Tắc Trung Thực Dữ Liệu (Truth-in-Telemetry)
- **Bối cảnh:** Yêu cầu thống kê dữ liệu thật nhưng hệ thống trước đây chưa thu thập telemetry lượt gọi hay consent người dùng.
- **Quyết định:** Tạo migration `0004_admin_extension.sql` có cấu trúc `IF NOT EXISTS` bảo toàn 100% dữ liệu cũ (19 địa điểm và 42 bài viết). Bảng điều khiển hiển thị trung thực các trạng thái "Chưa có dữ liệu" hoặc "Chưa bật thu thập" thay vì dùng số giả lập.

---

## 4. DANH MỤC ĐIỂM NGHẼN & TRẠNG THÁI (BLOCKERS & ACTION LOG)

1. **BLOCKED_BY_ACCESS_SETUP (Chờ thiết lập Cloudflare Zero Trust Console):**
   - **Tác động:** Xác thực Cloudflare Access trên production cần chủ dự án tạo Access Application và cung cấp `CF_ACCESS_TEAM_NAME`, `CF_ACCESS_AUD`, `ADMIN_EMAIL_ALLOWLIST`.
   - **Xử lý an toàn:** API `/api/admin/*` hoạt động theo cơ chế **FAIL-CLOSED** (mặc định từ chối mọi yêu cầu khi thiếu chứng thực). Tại môi trường local dev, hỗ trợ cờ `ADMIN_DEV_MOCK_AUTH=true` để chạy thử nghiệm an toàn.

2. **BLOCKED_BY_CREDENTIAL (Khóa mã hóa bí mật ADMIN_ENCRYPTION_KEY):**
   - **Tác động:** Khóa chủ 256-bit chưa được nạp lên Cloudflare Worker remote.
   - **Xử lý an toàn:** Khóa được tạo và lưu trong file local bí mật `.dev.vars` (đã nằm trong `.gitignore`). Khi triển khai remote, chủ dự án chỉ cần thực thi: `npx wrangler secret put ADMIN_ENCRYPTION_KEY`.

3. **BLOCKED_BY_ZALO_IDENTITY (Xác thực danh tính Zalo người dùng thật):**
   - **Tác động:** Việc gắn hồ sơ người dùng vào Zalo ID thật cần Zalo OAuth / Access Token verification ở Phase 6.
   - **Xử lý an toàn:** Sử dụng token ẩn danh (`UUID v4`), tuân thủ nguyên tắc Privacy-by-Default; mục Visitors trong Admin Dashboard chỉ hiển thị hồ sơ đã chủ động opt-in lưu server.

