# SỔ TAY VẬN HÀNH DỰ ÁN CỤC BỘ (LOCAL OPERATIONS RUNBOOK)
## VNA ĐẮK SONG SMART TOURISM — PHASE 8.6
**Ngày phát hành:** 14/10/2026 | **Môi trường:** Localhost Development Only
**Phiên bản hệ thống:** v1.0.0-phase8.6 | **CSDL:** SQLite / Cloudflare D1 Local

---

## 1. YÊU CẦU MÔI TRƯỜNG & TIỀN ĐIỀU KIỆN (PRE-REQUISITES)
- **Hệ điều hành:** Windows 10/11 (PowerShell 5.1 / PowerShell 7+) hoặc macOS/Linux bash.
- **Node.js:** v20.x hoặc v24.x LTS (`node -v`).
- **Trình quản lý gói:** npm v10.x+ (`npm -v`).
- **Cloudflare Wrangler CLI:** v4.148.0+ (tích hợp sẵn trong `worker/node_modules`).
- **Cổng mạng bắt buộc (Ports):**
  + `127.0.0.1:8788`: Worker API Backend (workerd runtime)
  + `localhost:5173`: Tourist Zalo Mini App (Vite dev server)
  + `localhost:3001`: Admin Dashboard Backoffice (Vite dev server)
- **Các biến cấu hình môi trường cục bộ (Local Environment Variables):**
  + `ENVIRONMENT`: `development`
  + `MOCK_PAYMENT_ENABLED`: `true` (Chỉ bật trên dev/test/staging; cấm tuyệt đối trên production)
  + `ADMIN_DEV_MOCK_AUTH`: `true` (Cho phép giả lập admin `admin@daksong.vn` khi kiểm thử local không có CF Access)
  + `ADMIN_ENCRYPTION_KEY`: `1234567890123456` (CẢNH BÁO: KHÓA MẪU NÀY CHỈ DÙNG CHO LOCAL DEV / TEST, TUYỆT ĐỐI KHÔNG DÙNG CHO PRODUCTION)
  + `ADMIN_AI_CONFIG_ENABLED`: `true`
  + `CORS_ALLOW_ORIGIN`: `*`

---

## 2. QUY TRÌNH CÀI ĐẶT & KHỞI TẠO CSDL LOCAL D1

### Bước 2.1: Cài đặt Dependencies Monorepo
```powershell
npm install
```

### Bước 2.2: Áp dụng Toàn Bộ Migrations CSDL Local D1 (0001 -> 0015)
```powershell
cd worker
npx wrangler d1 migrations apply dak-song-db --local
cd ..
```
Sau khi áp dụng, bảng metadata `d1_migrations` trong D1 SQLite sẽ ghi nhận đủ 15 migrations (`0001_initial.sql` đến `0015_rewards_time_quota_hardening.sql`).
Hệ thống Admin tại `/api/admin/operations/readiness` sẽ tự động xác minh và báo trạng thái `VERIFIED (15/15)`. Nếu chạy trên SQLite in-memory không có bảng metadata, hệ thống sẽ trả trạng thái trung thực `UNKNOWN` thay vì giả định thành công.
*Lưu ý an toàn:* Tuyệt đối KHÔNG truyền cờ `--remote` để tránh tác động CSDL Cloudflare D1 đám mây.

---

## 3. KHỞI ĐỘNG CÁC PHÂN HỆ DỊCH VỤ LOCAL

### Phân hệ 1: Worker API Backend (:8788)
```powershell
cd worker
npx wrangler dev --port 8788 --ip 127.0.0.1
```
Kiểm tra sức khỏe dịch vụ:
```powershell
curl http://127.0.0.1:8788/api/health
# Phản hồi mong đợi: {"status":"ok"}
```

### Phân hệ 2: Tourist Mini App (:5173)
```powershell
cd miniapp
npm run dev
```
Truy cập: `http://localhost:5173`

### Phân hệ 3: Admin Console Backoffice (:3001)
```powershell
cd admin
npm run dev -- --port 3001
```
Truy cập: `http://localhost:3001`

---

## 4. CHECKLIST KIỂM THỬ KHÓI (SMOKE TEST CHECKLIST)

| Phân hệ | Hành động kiểm tra | Kết quả mong đợi | Ghi chú an toàn |
|---|---|---|---|
| **Auth (8.1)** | Nhấn 'Đăng nhập giả lập' trên Mini App | Tạo session `user-xxx`, lưu token vào localStorage | Token SHA-256 lưu CSDL |
| **Planner (8.2)** | Tạo lịch trình 3N2Đ tại `/planner` | Lập lịch trình tự động, hiển thị VR360 | Trôi mượt kể cả khi AI offline |
| **Booking (8.3)** | Đặt tour tại `/vouchers` tab Tour | Tạo đơn đặt, thanh toán mô phỏng thành công | Nhãn 'MÔ PHỎNG / DEMO' rõ ràng |
| **Quiz (8.4)** | Tham gia thử thách tại `/quiz/play` | Nộp bài, chấm điểm server-authoritative | Che 100% điểm khi `in_progress` |
| **Rewards (8.5)** | Quay thưởng tại `/spin` | Vòng quay dừng đúng ô server chốt, nhận voucher ví | Thuật toán Web Crypto ngẫu nhiên |
| **Admin (8.6)** | Mở tab 'Nghiệm thu & Vận hành' | Hiển thị 5/5 phân hệ Active, 5/5 Invariants xanh | Xuất CSV UTF-8 BOM thành công |

---

## 5. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### Sự cố 1: Cổng 8788 bị chiếm dụng (EADDRINUSE)
```powershell
# Tìm Process ID đang chiếm cổng 8788:
Get-NetTCPConnection -LocalPort 8788 -ErrorAction SilentlyContinue | Select-Object OwningProcess
# Dừng tiến trình cũ:
Stop-Process -Id <PID> -Force
```

### Sự cố 2: Lỗi CSDL Local D1 không đồng bộ migration
```powershell
# Sao lưu và tạo lại CSDL local sạch:
cd worker
npx wrangler d1 migrations apply dak-song-db --local
cd ..
```

### Sự cố 3: Tier C Test thất bại do máy chủ chưa bật
- Các bài test Tier C (`quiz-concurrency-tier-c.test.mjs`, `rewards-concurrency-tier-c.test.mjs`) yêu cầu máy chủ Worker đang chạy tại `http://127.0.0.1:8788`.
- Khởi động Worker dev server trước khi chạy kiểm thử HTTP.

---

## 6. SỔ ĐĂNG KÝ RỦI RO DUY TRÌ TRẠNG THÁI OPEN (QA REGISTER)
1. **Cloudflare D1 Multi-Region Distributed Concurrency:** Chưa kiểm chứng trên mạng biên toàn cầu; hiện tại chạy trên công cụ giả lập SQLite/D1 local.
2. **Hoàn tiền qua Ngân hàng thực tế (Phase 8.3):** Cổng thanh toán thật chưa kết nối; toàn bộ giao dịch đang ở chế độ MOCK.
3. **Thương mại hóa Voucher Đối tác (Phase 8.5):** Toàn bộ voucher trong ví là DEMO; cần quy trình ký hợp đồng đối tác trước khi kích hoạt quyền lợi thực tế ngoài đời.
4. **Đăng ký Zalo Mini App Production:** Chưa nộp phê duyệt chính thức lên Zalo Platform.

