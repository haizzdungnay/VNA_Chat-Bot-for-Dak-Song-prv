# BÁO CÁO RÀ SOÁT HIỆN TRẠNG TOÀN DIỆN (CURRENT STATE AUDIT)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày thực hiện:** 08/10/2026  
**Cơ sở kiểm tra:** GitHub main tại commit `f44df71ffef90147756a7afdca6039ce4aaa53bc`  
**Phạm vi:** Kiểm toán mã nguồn, kiểm thử tự động, cấu hình môi trường, REST API, D1 database, AI prompt và giao diện người dùng theo thiết kế Stitch.

---

## 1. TỔNG QUAN REPOSITORY VÀ MÔI TRƯỜNG PHÁT TRIỂN

### 1.1. Thông tin Git & Nhánh làm việc
- **Repository:** `https://github.com/haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
- **Branch:** `main` (Up-to-date với `origin/main`, working tree hoàn toàn sạch).
- **HEAD Commit:** `f44df71` (`ci: bump node version to 22 for wrangler compatibility`).
- **5 Commits gần nhất:**
  1. `f44df71` (08/10/2026): Cập nhật Node.js lên v22 trong GitHub Actions workflow để tương thích Wrangler v4.
  2. `55b1fc4` (08/10/2026): Thêm ESM ts-register loader giải quyết lỗi biên dịch TS trong `node --test` và ép quy tắc phản hồi 100% tiếng Việt cho system prompt.
  3. `9fe8bb7` (08/10/2026): Thiết lập CI workflow tự động, cấu hình API base URL và ổn định hành vi chia sẻ FE.
  4. `b8c4d97` (08/10/2026): Khóa chặn lỗi gửi tin nhắn lặp (retry duplication), bổ sung thông báo trung thực khi chia sẻ và hoàn thiện lifecycle lưu trữ.
  5. `c9a2a0b` (08/10/2026): Hiện thực hóa thiết kế Stitch Eco Modern (Light) và Highland Nocturne (Dark), bổ sung Welcome Personalization Sheet.

### 1.2. Hiện trạng Kiểm thử Tự động & Build (GitHub Actions Run #37727653296)
- **CI Status:** PASS (Toàn bộ 4 giai đoạn đều xanh):
  - `npm ci`: Cài đặt sạch các gói phụ thuộc trên Node 22.
  - `npm run typecheck`: Kiểm tra kiểu tĩnh TypeScript đạt 0 lỗi trên cả miniapp và worker.
  - `npm test`: 16/16 kiểm thử tự động đạt 100% (6 bài test Worker, 10 bài test Miniapp).
  - `npm run build`: Biên dịch Vite sản sinh bundle sản xuất (`www/`) và Wrangler build dry-run thành công.
- **Môi trường Runtime cục bộ:**
  - Worker Dev Server: Đang chạy tại `http://127.0.0.1:8787` (`GET /api/health` phản hồi HTTP 200).
  - Miniapp Dev Server: Đang chạy tại `http://localhost:5173` (Vite HMR phản hồi HTTP 200).

---

## 2. MA TRẬN RÀ SOÁT TỪNG THÀNH PHẦN (MODULE STATUS MATRIX)

| Mô-đun | Thành phần con | Trạng thái | Tệp nguồn & Bằng chứng kiểm tra | Đánh giá kỹ thuật |
| :--- | :--- | :---: | :--- | :--- |
| **Frontend** | Routing (4 routes) | **DONE** | `miniapp/src/app.tsx` | ZMPRouter định tuyến chính xác /, /explore, /place/:id, /chat. |
| | Trang Chủ (Home) | **DONE** | `miniapp/src/pages/home.tsx` | Header tìm kiếm, lưới 4 danh mục, danh sách Địa điểm nổi bật, chip gợi ý AI. |
| | Khám Phá (Explore) | **DONE** | `miniapp/src/pages/explore.tsx` | Bộ lọc danh mục ngang, danh sách thẻ PlaceCard, tìm kiếm theo tên/mô tả. |
| | Chi Tiết Địa Điểm | **DONE** | `miniapp/src/pages/place-detail.tsx` | Ảnh cover, gallery, thông tin địa chỉ, giờ mở cửa, điện thoại, share Zalo/clipboard, mở Google Maps, nút "Hỏi AI về nơi này". |
| | Trợ Lý AI (Chat) | **DONE** | `miniapp/src/pages/chat.tsx` | Hội thoại nhiều lượt, giữ ngữ cảnh, khóa chặn bấm gửi kép (concurrency guard), nút Thử lại (retry) không nhân đôi tin nhắn, hiển thị PlaceCard đính kèm. |
| | Giao diện Stitch | **DONE** | `miniapp/src/css/app.css` | Đã hiện thực hóa chuẩn xác bảng màu: Eco Modern (#137A3E) cho Light Mode và Highland Nocturne (#102217) cho Dark Mode. Tự phát hiện dark mode hệ điều hành. |
| | Onboarding Sheet | **DONE** | `miniapp/src/components/welcome-sheet.tsx` | Bottom Sheet chào đón lần đầu, hỗ trợ Bỏ qua (Skip), Lưu tùy chọn cá nhân hóa (opt-in), Cập nhật và Xóa sạch dữ liệu (Xóa thông tin). |
| | Quyền riêng tư & Storage | **DONE** | `miniapp/src/services/storage.ts` | Bọc quanh Zalo Storage SDK, fallback an toàn bộ nhớ. Tuyệt đối không gửi dữ liệu hồ sơ khi người dùng chưa opt-in. |
| **Worker API** | `GET /api/health` | **DONE** | `worker/src/routes/health.ts` | Trả về `{"status": "ok"}`, HTTP 200. |
| | `GET /api/categories` | **DONE** | `worker/src/routes/categories.ts` | Truy vấn bảng categories trong D1, trả về JSON danh sách danh mục. |
| | `GET /api/places` | **DONE** | `worker/src/routes/places.ts` | Hỗ trợ lọc theo `category`, `q` (tìm kiếm), `featured`. |
| | `GET /api/places/:id` | **DONE** | `worker/src/routes/places.ts` | Trả về chi tiết địa điểm; ID không tồn tại trả về đúng mã HTTP 404. |
| | `POST /api/chat` | **DONE** | `worker/src/routes/chat.ts` | Kiểm tra độ dài tin nhắn (<=500 ký tự), lịch sử (<=8 lượt), nạp dữ liệu D1 làm bối cảnh, gọi Gemini qua OpenAI-compatible API, lọc ID địa điểm hợp lệ. |
| **AI Integration** | Provider Adapter | **DONE** | `worker/src/services/ai/openai-compatible.provider.ts` | Kết nối `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, model `gemini-3.8-flash`, `reasoning_effort: "low"`. Bắt lỗi 401, 404, 429, 503 chuẩn xác. Kiểm tra thực tế bằng API key dev thành công 100%. |
| | System Prompt | **DONE** | `worker/src/prompts/travel-assistant.ts` | Ép buộc 100% tiếng Việt, cấm hư cấu địa điểm ngoài D1, trích xuất placeIds chính xác từ ngữ cảnh. |
| **D1 Database** | Schema (0001) | **DONE** | `worker/migrations/0001_initial.sql` | Bảng `categories` và `places`, khóa ngoại, chỉ mục tìm kiếm, cột `images_json` mở rộng. |
| | Seed Data (0002) | **PARTIAL** | `worker/migrations/0002_seed.sql` | Hiện chỉ chứa 4 địa điểm giả định (`place-01` đến `place-04`). Cần thay bằng dữ liệu thật của Đắk Song. |
| | Remote Binding | **BLOCKED** | `worker/wrangler.jsonc` | Còn `database_id = "REPLACE_WITH_D1_DATABASE_ID"`. Cần tài khoản Cloudflare của dự án để liên kết. |
| **Staging/Deploy**| Cloudflare Deploy | **NOT STARTED**| `worker/wrangler.jsonc` | Chưa cấu hình remote deployment. |
| | Zalo Mini App Center | **NOT STARTED**| `miniapp/app-config.json` | Cần App ID thực tế được cấp để kiểm thử trên thiết bị di động thật qua Zalo. |

---

## 3. PHÂN LOẠI PHÁT HIỆN & RỦI RO (FINDINGS & RISK CLASSIFICATION)

### Mức P0 — Điểm nghẽn ngăn cản Staging & Vận hành Thật
1. **D1 Remote Database ID chưa được gán:**  
   - *Chi tiết:* Trong `worker/wrangler.jsonc`, trường `database_id` đang mang giá trị `REPLACE_WITH_D1_DATABASE_ID`.
   - *Tác động:* Lệnh `wrangler d1 migrations apply DB --remote` và `wrangler deploy` sẽ thất bại.
   - *Yêu cầu:* Cần tài khoản Cloudflare chủ quản cung cấp ID cơ sở dữ liệu thật.
2. **Dữ liệu D1 hiện tại chỉ là Mock Data:**  
   - *Chi tiết:* Bảng `places` chỉ có 4 bản ghi giả định `place-01` đến `place-04`.
   - *Tác động:* Màn hình người dùng và AI chỉ biết đến dữ liệu mẫu, chưa cung cấp thông tin du lịch hữu ích cho Đắk Song.
   - *Yêu cầu:* Thực thi đồng bộ từ cổng thông tin du lịch nguồn `dulichdaksong.vnasw.vn`.

### Mức P1 — Rủi ro kỹ thuật & Giới hạn hạ tầng
1. **Hạn mức Gemini Free Tier (20 lượt gọi/ngày):**  
   - *Chi tiết:* Key phát triển hiện tại là Free Tier của Google AI Studio, có trần 20 requests/ngày trên model `gemini-3.8-flash`.
   - *Tác động:* Thử nghiệm cường độ cao sẽ chạm lỗi HTTP 429.
   - *Khắc phục:* Đã có xử lý lỗi thân thiện trả lời người dùng "Hệ thống đang bận...". Khi ra mắt cần chuyển sang khóa trả phí hoặc phân bổ quota.
2. **URL Production FE chưa liên kết Worker thật:**  
   - *Chi tiết:* `miniapp/.env.production` đang đặt giá trị giữ chỗ `https://vna-dak-song-api.workers.dev`.
   - *Tác động:* Build sản xuất đưa lên Zalo sẽ không kết nối được backend.
   - *Khắc phục:* Cập nhật URL chính thức ngay sau khi deploy Cloudflare Worker.

### Mức P2 — Kiến trúc dữ liệu bài viết
1. **Phân biệt Bài viết (Articles) vs Địa điểm (Places):**  
   - *Chi tiết:* Khảo sát website nguồn cho thấy có 42 bài viết tin tức/văn hóa/lễ hội và 15 địa điểm lưu trú/ẩm thực/thắng cảnh.
   - *Tác động:* Schema D1 hiện tại chỉ hỗ trợ bảng `places`. Cần phương án chốt: Dùng bài viết làm tư liệu bối cảnh cho AI và bổ sung trường mô tả, hay mở rộng thêm bảng `articles` trong tương lai.

---

## 4. KẾT LUẬN AUDIT
1. Khung mã nguồn FE và BE đã đạt độ hoàn thiện cao, tuân thủ nghiêm ngặt các quy tắc thiết kế Stitch, routing, bảo mật hồ sơ và xử lý lỗi mạng.
2. Không cần refactor lớn ở tầng giao diện hay router backend.
3. Trọng tâm kế tiếp là tích hợp nguồn dữ liệu thật từ cổng thông tin du lịch Đắk Song để hoàn tất nội dung.
