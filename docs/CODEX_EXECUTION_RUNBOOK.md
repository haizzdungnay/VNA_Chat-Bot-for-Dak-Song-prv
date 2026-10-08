# SỔ TAY HƯỚNG DẪN THỰC THI DỰ ÁN CHO CODEX
(CODEX EXECUTION RUNBOOK)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày ban hành:** 08/10/2026  
**Mục tiêu:** Cung cấp hướng dẫn từng bước, quy trình giao việc, câu lệnh xác minh và ranh giới an toàn cho các phiên làm việc tiếp theo của Codex.

---

## 1. NGUYÊN TẮC ĐIỀU HÀNH BẤT BIẾN (CORE GUARDRAILS)

1. **Một lượt chạy — Một giai đoạn duy nhất:** Tuyệt đối không giao Codex làm gộp nhiều phase cùng lúc. Mỗi lượt chạy chỉ tập trung giải quyết trọn vẹn 1 phase và dừng lại báo cáo kết quả.
2. **Kiểm tra trước khi viết mã (Read-Before-Write):** Trước khi can thiệp bất kỳ tệp nào, phải kiểm tra `git status`, chạy `npm run typecheck` và `npm test` để nắm chắc trạng thái nền tảng.
3. **Bảo toàn giao diện Stitch & Hợp đồng API:** Không tự ý thay đổi màu sắc, bố cục màn hình, hoặc đổi tên các endpoint REST đã chốt (`/api/health`, `/api/categories`, `/api/places`, `/api/places/:id`, `/api/chat`).
4. **Bảo mật bí mật (No Committed Secrets):** Tuyệt đối không commit API key, token hoặc file `.dev.vars` lên git.
5. **Dừng lại chờ phê duyệt (Stop-at-Gates):** Khi đạt tiêu chuẩn kết thúc (Definition of Done) của phase, Codex phải dừng lại nộp bằng chứng và chờ anh trai phê duyệt mới bước sang phase tiếp theo.

---

## 2. CHUẨN BỊ MÔI TRƯỜNG TỪ MÁY SẠCH (CLEAN REPO SETUP)

Nếu bắt đầu phiên làm việc trên một máy tính mới:
```bash
# 1. Clone repository
git clone https://github.com/haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv.git
cd VNA_Chat-Bot-for-Dak-Song-prv

# 2. Cài đặt các gói phụ thuộc (yêu cầu Node >= 20, khuyến nghị Node 22)
npm ci

# 3. Kiểm tra tính toàn vẹn của mã nguồn
npm run typecheck
npm test
npm run build

# 4. Khởi chạy môi trường giả lập cục bộ
# Terminal 1: Chạy Worker backend (Port 8787)
npm --workspace worker run dev

# Terminal 2: Chạy Miniapp frontend (Port 5173)
npm --workspace miniapp run dev
```

---

## 3. KỊCH BẢN THỰC THI THEO TỪNG GIAI ĐOẠN

### GIAI ĐOẠN TIẾP THEO: PHASE 2 — XÂY DỰNG CÔNG CỤ ĐỒNG BỘ DỮ LIỆU & NẠP D1 THẬT

#### A. Prompt Giao Việc Chuẩn Cho Codex Ở Phase 2:
> "Anh đã duyệt Kế hoạch tổng thể và Đặc tả tích hợp nguồn dữ liệu. Bây giờ em hãy tiến hành **PHASE 2**:
> 1. Viết kịch bản đồng bộ `scripts/sync-upstream-content.mjs` gọi VNA Core API (`https://core-360.vnaapi.com/`) lấy 15 địa điểm và 42 bài viết về Đắk Song.
> 2. Hỗ trợ cờ `--dry-run` để in preview và cờ `--apply` để tạo file migration seed chính thức `worker/migrations/0002_seed.sql`.
> 3. Nạp dữ liệu vào cơ sở dữ liệu D1 cục bộ và chạy kiểm thử tự động xác nhận 15 địa điểm được hiển thị chính xác.
> 4. Tuyệt đối không thay đổi schema D1 hay API contract. Làm xong báo cáo kết quả và dừng lại."

#### B. Các Tệp Được Phép Chỉnh Sửa / Tạo Mới Ở Phase 2:
- `scripts/sync-upstream-content.mjs` (Tạo mới)
- `worker/migrations/0002_seed.sql` (Cập nhật dữ liệu thật)
- `worker/test/sync.test.mjs` (Tạo mới bài test tự động)

#### C. Lệnh Xác Minh Kết Quả Phase 2:
```bash
# 1. Chạy thử nghiệm xem trước dữ liệu (không ghi DB)
node scripts/sync-upstream-content.mjs --dry-run

# 2. Chạy áp dụng nạp dữ liệu chính thức
node scripts/sync-upstream-content.mjs --apply

# 3. Chạy test tự động xác nhận
npm test

# 4. Kiểm tra API trả về dữ liệu thật
curl http://127.0.0.1:8787/api/places
```

---

### GIAI ĐOẠN TIẾP THEO: PHASE 3 — KIỂM THỬ CHAT AI ĐẦU-CUỐI TRÊN DỮ LIỆU THẬT

#### A. Prompt Giao Việc Chuẩn Cho Codex Ở Phase 3:
> "Bây giờ em hãy tiến hành **PHASE 3**:
> 1. Nạp bối cảnh 42 bài viết văn hóa và 15 địa điểm thật của Đắk Song vào prompt của Worker.
> 2. Kiểm thử kịch bản hỏi đáp thực tế với Gemini 3.8 Flash qua `POST /api/chat`.
> 3. Đảm bảo câu trả lời đính kèm `placeIds` chuẩn, click vào mở đúng thẻ `PlaceCard` và chuyển trang chi tiết.
> 4. Làm xong báo cáo nhật ký hỏi đáp thực tế và dừng lại."

#### B. Kịch Bản Kiểm Thử Bắt Buộc (Test Scenarios):
1. **Scenario 1:** "Xin chào, hãy giới thiệu cho tôi về văn hóa Đắk Song" -> Phản hồi trích xuất từ các bài viết  Việc Chuẩn Cho Codex Ở Phase 5:
> "Bây giờ em hãy tiến hành **PHASE 5**:
> 1. Kiểm thử responsive giao diện trên 3 độ rộng màn hình: 360px, 390px, 430px.
> 2. Kiểm tra độ tương phản màu sắc Stitch trên cả Light Mode và Dark Mode.
> 3. Kiểm tra hành vi bàn phím ảo đẩy ô chat trên thiết bị di động không làm lệch header/bottom tabs.
> 4. Lập báo cáo kết quả và dừng lại."

---

### GIAI ĐOẠN TIẾP THEO: PHASE 6 — TRIỂN KHAI CLOUDFLARE STAGING & ZALO CENTER

#### A. Điều Kiện Tiên Quyết: Anh trai cung cấp tài khoản Cloudflare và Zalo App ID.
#### B. Lệnh Triển Khai:
```bash
# 1. Cấu hình bí mật API Key trên Cloudflare Worker
npx wrangler secret put AI_API_KEY

# 2. Chạy migration tạo bảng và nạp dữ liệu D1 trên môi trường Cloudflare thật
npx wrangler d1 migrations apply DB --remote

# 3. Triển khai Cloudflare Worker
npx wrangler deploy

# 4. Cập nhật biến môi trường Miniapp với URL Worker HTTPS thật
# Sửa miniapp/.env.production: VITE_API_BASE_URL=https://...

# 5. Đóng gói bản sản xuất
npm --workspace miniapp run build

# 6. Upload lên Zalo Mini App Center (dùng ZMP CLI hoặc web portal)
npx zmp-cli deploy
```

---

## 4. QUY TRÌNH PHỤC HỒI KHẨN CẤP (ROLLBACK RUNBOOK)

Nếu bất kỳ phiên làm việc nào của Codex gây ra lỗi không thể khắc phục:
```bash
# 1. Hủy bỏ mọi thay đổi chưa commit
git restore .
git clean -fd

# 2. Đưa về HEAD commit ổn định gần nhất
git reset --hard HEAD

# 3. Cài đặt lại sạch dependencies và chạy test kiểm tra
npm ci
npm test
```
