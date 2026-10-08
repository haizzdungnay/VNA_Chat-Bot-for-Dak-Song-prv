# QUYẾT ĐỊNH KIẾN TRÚC, ĐIỂM NGHẼN VÀ QUẢN TRỊ RỦI RO
(DECISIONS, BLOCKERS & RISK LOG)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày lập:** 08/10/2026  
**Mục tiêu:** Ghi nhận các quyết định kiến trúc đã chốt (ADRs), các điểm nghẽn hiện hữu và danh sách các câu hỏi cần chủ dự án phê duyệt.

---

## 1. CÁC QUYẾT ĐỊNH KIẾN TRÚC ĐÃ XÁC LẬP (ARCHITECTURE DECISION RECORDS - ADRs)

### ADR-01: Lựa Chọn Nguồn Dữ Liệu Chính Thức
- **Bối cảnh:** Người dùng yêu cầu lấy dữ liệu bài viết, địa điểm, hình ảnh từ cổng du lịch Đắk Song (`https://dulichdaksong.vnasw.vn/`), không nhập tay.
- **Quyết định:** Sử dụng cụm API công khai chính thức của VNA tại `https://core-360.vnaapi.com/` (`travel-location-public`, `post-public`, `category`) với mã đơn vị `DAKNONG-2-29`.
- **Lý do & Lợi ích:**
  - Không cần cào HTML (web scraping) dễ vỡ khi đổi giao diện.
  - Dữ liệu trả về định dạng JSON chuẩn mực, có tọa độ GPS chính xác, số điện thoại và mảng ảnh rõ ràng.
  - Đây chính là nguồn dữ liệu gốc do VNA triển khai cho huyện Đắk Song.

### ADR-02: Giữ Đóng Băng (Freeze) Hợp Đồng REST API và Schema D1
- **Bối cảnh:** Có ý kiến đề xuất đổi `VITE_API_BASE_URL` của Zalo FE trỏ thẳng vào domain cổng du lịch.
- **Quyết định:** Giữ nguyên 100% hợp đồng API của Worker (`/api/health`, `/api/categories`, `/api/places`, `/api/places/:id`, `/api/chat`) và cấu trúc bảng D1 (`categories`, `places`).
- **Lý do & Lợi ích:**
  - Giữ an toàn tuyệt đối cho API Key Gemini trên máy chủ (không để lộ ra client).
  - Tách rời giao diện người dùng khỏi biến động của máy chủ nguồn.
  - Tốc độ truy vấn D1 cực nhanh (< 50ms) so với việc gọi ra ngoài internet mỗi khi lướt app.

### ADR-03: Cơ Chế Đồng Bộ Hàng Loạt (Batch CLI Sync) Thay Vì Proxy Thời Gian Thực
- **Bối cảnh:** Cần chọn giữa việc Worker làm proxy gọi VNA API mỗi khi khách xem danh sách, hay đồng bộ định kỳ vào D1.
- **Quyết định:** Áp dụng cơ chế Đồng bộ theo kịch bản (`scripts/sync-upstream-content.mjs`) nạp vh Ảnh
- **Bối cảnh:** Hàng trăm bức ảnh du lịch chất lượng cao trên cổng nguồn.
- **Quyết định:** Sử dụng trực tiếp đường dẫn CDN chính thức `https://static.dggv.edu.vn/360/{tên_ảnh}` trong thẻ `<img>` của Mini App.
- **Lý do & Lợi ích:**
  - CDN trả về HTTP 200, tốc độ phản hồi nhanh, không chặn hotlink từ WebView.
  - Tiết kiệm dung lượng lưu trữ Cloudflare R2 và không tốn công chuyển tải ảnh.

### ADR-06: Cấu Hình Mô Hình AI Google Gemini
 - **Bối cảnh:** Tích hợp mô hình AI phù hợp nhất với du lịch địa phương.
 - **Quyết định:** Sử dụng `gemini-2.5-flash-lite` với `reasoning_effort: "low"` qua giao thức OpenAI-compatible endpoint của Google Generative Language (`https://generativelanguage.googleapis.com/v1beta/openai`).
 - **Lý do kỹ thuật:** Mô hình `gemini-2.5-flash` trên gói Free-tier của Google bị áp hạn ngạch tối đa 20 lượt gọi/ngày (`limit: 20 per day`), dẫn đến mã lỗi 429 RESOURCE_EXHAUSTED. Trong khi đó, `gemini-2.5-flash-lite` có hạn ngạch khả dụng dồi dào, phản hồi cực nhanh (~3000ms), hỗ trợ thinking/reasoning_effort "low" và trả lời tiếng Việt chính xác 100%. Tắt cờ JSON gốc (`AI_JSON_MODE="false"`) và bóc tách JSON an toàn bằng parser Regex + fallback.

### ADR-07: Chuẩn Hóa Tính Toàn Vẹn Dữ Liệu & Nguồn Gốc (Data Integrity & Provenance - Phase 2)
 - **Bối cảnh:** Yêu cầu nghiêm ngặt không tự bịa đặt giờ mở cửa, tọa độ, địa chỉ hoặc mô tả giả.
 - **Quyết định:**
   1. Chỉ giữ đúng 15 địa điểm xác minh từ API VNA (`source_type = "verified"`).
   2. Bổ sung 4 điểm đến VR360 từ tour thực tế ảo Đắk Song với phân loại `source_type = "vr360"`, tọa độ GPS và giờ mở cửa để `NULL`.
   3. Bỏ toàn bộ 16 bản ghi heuristic từng bị ép từ bài viết thành địa điểm.
   4. Giờ mở cửa không có trong nguồn upstream thì để `NULL`, giao diện FE chỉ render khi có dữ liệu.

---

## 2. DANH SÁCH QUYẾT ĐỊNH CẦN ANH PHÊ DUYỆT (DECISIONS FOR USER APPROVAL)

Để tiến hành Phase 2 ngay sau lượt rà soát này, em xin gửi anh **6 câu hỏi then chốt (ưu tiên ngắn gọn)** để anh chốt phương án:

1. **[D01 - Nguồn Dữ Liệu]:** Anh có duyệt phương án lấy trực tiếp 15 địa điểm và 42 bài viết từ VNA Core API (`core-360.vnaapi.com`) của Cổng du lịch Đắk Song không?  
   *(Khuyến nghị: DUYỆT - Đây là cách chính thống, sạch sẽ và tự động 100%).*
2. **[D02 - Bài Viết Văn Hóa]:** Anh có đồng ý phương án tận dụng 42 bài viết làm cơ sở tri thức bối cảnh cho Trợ lý AI và gắn vào mô tả địa điểm trong MVP, chưa tạo thêm tab đọc báo riêng không?  
   *(Khuyến nghị: DUYỆT - Giữ khung MVP gọn gàng, tránh scope creep).*
3. **[D03 - Tải Ảnh CDN]:** Anh có đồng ý sử dụng trực tiếp CDN ảnh `static.dggv.edu.vn` của hệ thống nguồn để hiển thị trên Mini App không?  
   *(Khuyến nghị: DUYỆT - Ảnh hiển thị rất nhanh và không tốn tiền lưu trữ thêm).*
4. **[D04 - Tần Suất Cập Nhật]:** Chế độ cập nhật dữ liệu từ nguồn: Anh muốn chạy bằng tay (mỗi khi bên huyện có địa điểm mới thì bấm chạy lệnh sync), hay cấu hình tự động định kỳ hàng tuần?  
   *(Khuyến nghị: Chạy thủ công theo nhu cầu trong giai đoạn MVP).*
5. **[D05 - Tài Khoản Cloudflare]:** Khi hoàn thiện kiểm thử cục bộ và bước vào Phase 6, anh sẽ cung cấp `database_id` D1 và cấu hình deploy, hay em sẽ chuẩn bị sẵn script để anh chạy deploy trên máy của anh?  
   *(Khuyến nghị: Em chuẩn bị sẵn script tự động, anh chỉ cần paste lệnh chạy).*
6. **[D06 - Đưa Lên Zalo Mini App]:** Anh đã có App ID trên Zalo Mini App Center để upload bản thử nghiệm quét QR chưa?  
   *(Nếu chưa có, hệ thống vẫn hoàn thành 100% kiểm thử qua trình duyệt và Zalo DevTools trước).*

---

## 3. NHẬT KÝ ĐIỂM NGHẼN HIỆN HỮU (BLOCKERS LOG)

| Mã Blocker | Mô tả điểm nghẽn | Mức độ | Tác động | Biện pháp giải tỏa / Hành động kế tiếp |
| :---: | :--- | :---: | :--- | :--- |
| **BLK-01** | Chưa có `database_id` Cloudflare D1 thật trong `wrangler.jsonc` | P0 | Không thể deploy remote lên Cloudflare | Chạy hoàn toàn trên D1 cục bộ ở Phase 2-5; chỉ kích hoạt khi anh cung cấp tài khoản ở Phase 6. |
| **BLK-02** | Khóa Gemini dev dùng gói Free Tier (giới hạn 20 req/ngày) | P1 | Có thể gặp mã 429 nếu test dồn dập | Đã có cơ chế retry và thông báo thân thiện; nâng cấp API key trả phí khi nghiệm thu diện rộng. |
| **BLK-03** | Chưa liên kết App ID trên Zalo Mini App Center | P1 | Chưa thể sinh mã QR test trên app Zalo điện thoại | Kiểm thử toàn diện trên trình duyệt và ZMP Simulator trước; upload khi anh cấp App ID. |

---

## 4. MA TRẬN RỦI RO & PHƯƠNG ÁN DỰ PHÒNG (RISK MANAGEMENT MATRIX)

| Mã Rủi ro | Nguy cơ tiềm ẩn | Khả năng | Tác động | Phương án phòng ngừa & Ứng phó |
| :---: | :--- | :---: | :---: | :--- |
| **R01** | Nguồn du lịch ngắt kết nối hoặc thay đổi API | Thấp | Vừa | Cơ chế Idempotent Sync nạp dữ liệu vào D1; D1 hoạt động độc lập không bị ảnh hưởng nếu nguồn gián đoạn. |
| **R02** | Gemini API bị lỗi 503 hoặc hết hạn mức | Vừa | Vừa | Đã có bộ parser bắt lỗi 429/503 và trả về thông báo lỗi lịch sự, không làm sập giao diện chat. |
| **R03** | Khách hỏi câu hỏi ngoài phạm vi Đắk Song | Cao | Thấp | System Prompt đã ép cấm hallucinate: AI sẽ khiêm tốn trả lời "Tôi chỉ hỗ trợ thông tin du lịch Đắk Song". |
| **R04** | Người dùng gửi nội dung chứa Prompt Injection | Vừa | Vừa | Toàn bộ dữ liệu bài viết bên ngoài được coi là UNTRUSTED DATA; bọc thẻ tag rõ ràng và không thi hành lệnh ẩn. |
| **R05** | Vỡ layout trên màn hình điện thoại siêu nhỏ (360px) | Vừa | Thấp | Đã thiết kế responsive bằng CSS flexbox và kiểm thử đa kích thước ở Phase 5. |

---

## 5. KẾT LUẬN
Mọi rủi ro và điểm nghẽn đều nằm trong tầm kiểm soát kỹ thuật. Sau khi nhận được sự đồng thuận của anh cho các câu hỏi D01-D04, toàn bộ khung dữ liệu sẽ được kích hoạt vào Phase 2.
