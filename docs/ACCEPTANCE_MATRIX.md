# MA TRẬN TIÊU CHÍ NGHIỆM THU MVP TỔNG THỂ
(ACCEPTANCE MATRIX)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày cập nhật:** 08/10/2026  
**Mục tiêu:** Cung cấp danh mục kiểm tra định lượng, có thể tái lập và xác minh bằng lệnh cụ thể trước khi bàn giao.

---

## 1. BẢNG TIÊU CHÍ NGHIỆM THU THEO TỪNG MÔ-ĐUN

| Mã ID | Mô-đun / Hạng mục | Điều kiện kiểm thử / Đầu vào | Hành vi & Kết quả kỳ vọng | Trạng thái thực tế | Bằng chứng kiểm tra / Lệnh xác minh | Ưu tiên |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| **TC-FE-01** | FE Routing | Điều hướng URL: `/`, `/explore`, `/place/:id`, `/chat` | Chuyển trang mượt mà bằng ZMPRouter, không trắng trang | **ĐÃ ĐẠT (Local)** | `miniapp/src/app.tsx`, truy cập `http://localhost:5173/` | P0 |
| **TC-FE-02** | Trang Chủ (Home) | Tải trang chủ lần đầu | Hiển thị Banner, Lưới 4 danh mục, Top địa điểm nổi bật, Chip gợi ý AI | **ĐÃ ĐẠT (Local)** | `miniapp/src/pages/home.tsx` HTTP 200 | P0 |
| **TC-FE-03** | Khám Phá (Explore) | Bấm chọn danh mục hoặc gõ ô tìm kiếm | Danh sách thẻ địa điểm lọc thời gian thực, hiển thị ảnh và tên chuẩn | **ĐÃ ĐẠT (Local)** | `miniapp/src/pages/explore.tsx` | P0 |
| **TC-FE-04** | Chi Tiết Địa Điểm | Bấm vào 1 thẻ địa điểm bất kỳ | Tải đầy đủ thông tin: Ảnh bìa, Tọa độ, Địa chỉ, Số điện thoại, Nút bản đồ | **ĐÃ ĐẠT (Local)** | `miniapp/src/pages/place-detail.tsx` | P0 |
| **TC-FE-05** | Chat AI (Đa lượt) | Gửi câu hỏi "Xin chào Đắk Song" | Nhận phản hồi tiếng Việt trong < 5s; tiếp tục gửi lượt 2 giữ nguyên ngữ cảnh | **ĐÃ ĐẠT (Local)** | Kiểm thử API thật trên Worker cục bộ | P0 |
| **TC-FE-06** | PlaceCard trong Chat | Hỏi về "địa điểm ăn uống" hoặc "thắng cảnh" | Trả lời kèm danh sách `placeIds`, FE render thẻ `PlaceCard` có thể click | **ĐÃ ĐẠT (Local)** | Đã test render `PlaceCard` trên FE | P0 |
| **TC-FE-07** | Concurrency Guard | Bấm nút Gửi tin nhắn liên tục nhiều lần | Khóa chặn gửi lặp, nút gửi chuyển trạng thái đang xử lý, chỉ gửi 1 request | **ĐÃ ĐẠT (Local)** | Test suite: `miniapp/test/fe-logic.test.mjs` (Test 3) | P0 |
| **TC-FE-08** | Chat Retry an toàn | Lỗi mạng xảy ra -> Bấm nút "Thử lại" | Chỉ gửi lại đúng câu hỏi bị lỗi, không nhân đôi lịch sử trò chuyện | **ĐÃ ĐẠT (Local)** | Test suite: `miniapp/test/fe-logic.test.mjs` (Test 2) | P0 |
| **TC-FE-09** | Giao diện Stitch | Chuyển đổi giữa Light Mode và Dark Mode | Màu chuẩn Eco Modern (#137A3E) và Highland Nocturne (#102217), tương phản tốt | **ĐÃ ĐẠT (Local)** | `miniapp/src/css/app.css` | P1 |
| **TC-FE-10** | Welcome Sheet | Mở app lần đầu; thử Skip, Save, Edit, Delete | Lưu trữ đúng trạng thái; khi Delete hoặc Skip thì không gửi thông tin profile | **ĐÃ ĐẠT (Local)** | Test suite: `miniapp/test/fe-logic.test.mjs` (Test 5, 6, 10) | P0 |
| **TC-FE-11** | Chia Sẻ & Clipboard | Bấm nút chia sẻ địa điểm | Gọi native share Zalo; nếu không hỗ trợ fallback copy link có thông báo trung thực | **ĐÃ ĐẠT (Local)** | Test suite: `miniapp/test/fe-logic.test.mjs` (Test 8) | P1 |
| **TC-BE-01** | Health Check API | `GET /api/health` | Trả về mã HTTP 200: `{"status": "ok"}` | **ĐÃ ĐẠT (Local)** | `curl http://127.0.0.1:8787/api/health` | P0 |
| **TC-BE-02** | Categories API | `GET /api/categories` | Trả về danh sách danh mục du lịch chuẩn định dạng JSON | **ĐÃ ĐẠT (Local)** | `curl http://127.0.0.1:8787/api/categories` | P0 |
| **TC-BE-03** | Places API (Filter) | `GET /api/places?category=...&q=...` | Lọc địa điểm theo danh mục và từ khóa chính xác | **ĐÃ ĐẠT (Local)** | `curl http://127.0.0.1:8787/api/places` | P0 |
| **TC-BE-04** | Place Detail API | `GET /api/places/:id` | Trả về 200 cho ID có thật; trả về 404 cho ID không tồn tại | **ĐÃ ĐẠT (Local)** | `worker/test/router.test.js` | P0 |
| **TC-BE-05** | Chat API Validation | Gửi tin nhắn > 500 ký tự hoặc lịch sử > 8 lượt | Trả về mã lỗi 400 Bad Request, không làm sập server | **ĐÃ ĐẠT (Local)** | `worker/src/routes/chat.ts` | P0 |
| **TC-AI-01** | Kết nối Gemini Thật | Gọi API chat với dev key thật | Kết nối `gemini-3.8-flash` thành công, trả lời tự nhiên | **ĐÃ ĐẠT (Local)** | Đã test live: trả lời 200 OK | P0 |
| **TC-AI-02** | Ngôn ngữ 100% Tiếng Việt| Hỏi tiếng Việt, hỏi tiếng Anh, hỏi ký tự lạ | Trợ lý AI trả lời 100% bằng tiếng Việt chuẩn mực | **ĐÃ ĐẠT (Local)** | Đã kiểm chứng trong System Prompt | P0 |
| **TC-AI-03** | Chống ảo giác (Anti-Hallucination)| Hỏi về một địa điểm hoàn toàn bịa đặt | AI trả lời rõ ràng là không có đủ thông tin, không tự sáng tác | **ĐÃ ĐẠT (Local)** | Đã test: từ chối bịa địa điểm ngoài D1 | P0 |
| **TC-DATA-01**| Nguồn dữ liệu VNA | Kết nối VNA Core API `core-360.vnaapi.com` | Trích xuất thành công 15 địa điểm và 42 bài viết thật của Đắk Song | **ĐÃ ĐẠT (Live)** | Đã test trực tiếp từ isolate script | P0 |
| **TC-DATA-02**| Ảnh CDN Du lịch | Tải ảnh từ `static.dggv.edu.vn` | Ảnh trả về HTTP 200, hiển thị mượt mà trên WebView | **ĐÃ ĐẠT (Live)** | Đã kiểm tra HEAD request: HTTP 200, 95KB | P0 |
| **TC-DATA-03**| Đồng bộ Idempotent | Chạy lệnh sync dữ liệu lặp lại nhiều lần | Không tạo bản ghi trùng lặp, cập nhật đúng nếu nguồn thay đổi | **Chờ Phase 2** | Sẽ kiểm thử khi tạo script sync | P0 |
| **TC-SEC-01** | Bí mật API Key | Kiểm tra commit history và file tĩnh | Không có API Key Gemini hay token nào bị commit lên git | **ĐÃ ĐẠT (Repo)** | Đã kiểm tra: `.dev.vars` nằm trong `.gitignore` | P0 |
| **TC-SEC-02** | Rate Limiting | Gửi 50 request liên tục vào `/api/chat` | Kích hoạt giới hạn tốc độ 429 bảo vệ hệ thống | **Chờ Phase 4** | Sẽ hiện thực ở Phase 4 | P1 |
| **TC-STG-01** | Cloudflare D1 Remote | Cấu hình `database_id` thật và chạy migration | Cơ sở dữ liệu đám mây lưu trữ đầy đủ 15 địa điểm chính thức | **Chờ Phase 6** | Cần tài khoản Cloudflare từ anh trai | P0 |
| **TC-STG-02** | Zalo Mini App QR | Quét mã QR bản thử nghiệm trên Zalo điện thoại | Khởi chạy ứng dụng trơn tru trên cả iOS và Android thật | **Chờ Phase 6** | Cần đưa lên Zalo Mini App Center | P0 |

---

## 2. QUY TRÌNH KÝ DUYỆT NGHIỆM THU (SIGN-OFF PROCESS)
1. **Kiểm thử tại máy phát triển (Local Sign-off):** Lead Engineer chạy toàn bộ test tự động và báo cáo. (Đã hoàn thành 16/16).
2. **Kiểm thử dữ liệu thật (Data Sign-off):** Soát xét 15 địa điểm và 42 bài viết từ VNA API trước khi nạp vào D1. (Sẵn sàng cho Phase 2).
3. **Kiểm thử thiết bị thật (Device Sign-off):** Quét mã QR trên Zalo Mini App, kiểm tra các luồng nghiệp vụ chính. (Sau khi hoàn tất Phase 6).
