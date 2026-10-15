# BÁO CÁO NGHIỆM THU PHASE 8.3.1: TRANSACTION HARDENING, IDEMPOTENCY & REVENUE RECONCILIATION

## 1. Baseline Commit & Branch
- **Repository**: `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
- **Branch**: `feature/phase8-business-booking`
- **Base Commit**: `8e7f0608e7f8147bf2a036e5a7947b5e246f1e42`
- **Final Commit**: Sẽ được gắn nhãn `fix(phase8.3.1): harden booking transactions, CAS state guards, scoped idempotency, immutable refund ledger, and timezone reconciliation`
- **Tuân thủ quy định**: Không merge vào `main`, không deploy Cloudflare/Zalo, không sửa migration cũ 0001–0008, dữ liệu kiểm thử thực thi 100% trên localhost và local D1.

---

## 2. Danh Sách Lỗi & Trạng Thái Nghiệm Thu

| Mã lỗi | Mức độ | Mô tả ngắn | Trạng thái |
|---|---|---|---|
| **P0-01** | CRITICAL | Một báo giá có thể tạo nhiều booking khi có request đồng thời | **FIXED** |
| **P0-02** | CRITICAL | Mock Payment có thể ghi nhận thành công nhiều lần, nhân đôi doanh thu | **FIXED** |
| **P0-03** | CRITICAL | Idempotency Key không kiểm tra quyền sở hữu, rò rỉ dữ liệu booking người khác | **FIXED** |
| **P0-04** | CRITICAL | Hủy đơn thanh toán trực tiếp không qua refund; thiếu CAS & bảng hoàn tiền bất biến | **FIXED** |
| **P1-01** | HIGH | Báo cáo doanh thu lọc sai ngữ nghĩa created_at booking thay vì thời điểm thanh toán/hoàn tiền; sai timezone UTC+7 | **FIXED** |
| **P1-02** | HIGH | Xuất file CSV bỏ qua bộ lọc thời gian range Dashboard; thiếu phòng chống CSV Formula Injection | **FIXED** |
| **P1-03** | HIGH | Tour 1 ngày tự động tính 1 đêm lưu trú; thiếu kiểm tra SafeInteger và chặn tràn số; thiếu feature flag MOCK_PAYMENT_ENABLED | **FIXED** |
| **P1-04** | MEDIUM | Nút thao tác Admin/Miniapp chưa khóa trạng thái hợp lệ, thiếu idempotency key ổn định khi retry | **FIXED** |

---

## 3. Nguyên Nhân Gốc (Root Cause) & Giải Pháp Khắc Phục

### 3.1. P0-01 — Một báo giá tạo nhiều đơn đặt
- **Root Cause**: `createBooking()` kiểm tra trạng thái quote bằng SELECT trước rồi mới INSERT booking và UPDATE quote mà không có CAS (`WHERE status = 'active'`). Bảng `tour_bookings` không có UNIQUE index trên `quote_id`. Khi 2 request đồng thời cùng đọc quote active, cả hai đều tạo được booking riêng biệt.
- **Giải Pháp**:
  1. Thêm UNIQUE index: `CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_bookings_quote_unique ON tour_bookings(quote_id);` trong migration 0009.
  2. Triển khai CAS atomic: `UPDATE booking_quotes SET status = 'consumed' WHERE id = ? AND user_id = ? AND status = 'active'`.
  3. Gắn assertion guard `optimistic_lock_guard` (`INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())`) trong cùng batch transaction. Nếu CAS cập nhật 0 dòng, CHECK constraint thất bại, rollback toàn bộ batch.
  4. Hỗ trợ Idempotency scoped: Cùng key + cùng payload trả về booking đã tạo; khác payload trả về 409 Conflict.

### 3.2. P0-02 — Mock Payment ghi nhận trùng lặp
- **Root Cause**: `processMockPayment()` đọc booking unpaid rồi UPDATE sang paid mà không có CAS condition. Bảng `mock_payment_attempts` cho phép nhiều dòng `status = 'success'` cho cùng một `booking_id`.
- **Giải Pháp**:
  1. Thêm partial unique index: `CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_success_unique ON mock_payment_attempts(booking_id) WHERE status = 'success';`
  2. CAS conditional update: `UPDATE tour_bookings SET payment_status = 'paid', booking_status = 'confirmed', updated_at = ? WHERE id = ? AND user_id = ? AND booking_status = 'pending' AND payment_status IN ('unpaid', 'failed')`.
  3. Gắn guard `optimistic_lock_guard` kiểm tra `changes() === 1`.

### 3.3. P0-03 — Rò rỉ dữ liệu qua Idempotency Key
- **Root Cause**: Code tìm payment theo `idempotency_key` toàn cục rồi trả về booking mà không xác thực booking thuộc user đang đăng nhập.
- **Giải Pháp**:
  1. **Quy tắc phân quyền bất biến**: Bắt buộc tìm và xác thực booking thuộc authenticated user (`WHERE id = ? AND user_id = ?`) trước khi xử lý bất kỳ thao tác thanh toán nào.
  2. Bổ sung bảng `idempotency_records` lưu `user_id`, `operation`, `resource_id`, `request_hash` (SHA-256 fingerprint), `response_json`.
  3. Nếu user B gửi trùng key của user A, hệ thống từ chối ngay với 409 Conflict mà không tiết lộ bất kỳ thông tin nào của user A.

### 3.4. P0-04 — Cancellation & Hoàn tiền bất biến
- **Root Cause**: Admin cho phép bấm hủy trực tiếp trên đơn đã paid, tạo ra trạng thái sai lệch giữa payment và booking. Không có bảng lưu lịch sử refund riêng biệt.
- **Giải Pháp**:
  1. State machine: Đơn đã `paid` bị cấm hủy trực tiếp (`adminCancelBooking` quăng 409). Bắt buộc phải qua quy trình hoàn tiền (`adminMockRefund`).
  2. Bổ sung bảng sổ cái bất biến (immutable refund ledger): `mock_payment_refunds` với `UNIQUE INDEX` trên `payment_attempt_id`, ngăn double refund tuyệt đối.
  3. CAS `UPDATE tour_bookings SET payment_status = 'refunded', booking_status = 'cancelled' WHERE id = ? AND payment_status = 'paid'` kèm `optimistic_lock_guard`.

### 3.5. P1-01 — Ngữ nghĩa thời gian & Múi giờ Asia/Ho_Chi_Minh (+07:00)
- **Root Cause**: Doanh thu bị lọc theo `tour_bookings.created_at` thay vì thời điểm phát sinh thanh toán thật (`mock_payment_attempts.created_at`) hoặc thời điểm hoàn tiền (`mock_payment_refunds.created_at`).
- **Giải Pháp**:
  1. Tách biệt rõ ràng 3 chỉ số:
     - **Booking KPIs**: Theo `tour_bookings.created_at`.
     - **Gross Revenue**: Theo `mock_payment_attempts.created_at` với `status = 'success'`.
     - **Refund Amount**: Theo `mock_payment_refunds.created_at`.
  2. **Net Revenue**: `Gross - Refund` trong kỳ. Cho phép số âm nếu kỳ hiện tại hoàn tiền nhiều hơn thu (không dùng `Math.max(0, ...)`).
  3. Chuẩn hóa ranh giới thời gian theo múi giờ kinh doanh `Asia/Ho_Chi_Minh` (+07:00) qua hàm `getPeriodBoundsUtc()`.

### 3.6. P1-02 — Xuất CSV đồng bộ bộ lọc & Chống Injection
- **Root Cause**: `exportRevenueCsv()` nhận tham số `range` nhưng không áp dụng bộ lọc ngày; định dạng theo bảng booking thay vì sổ cái tài chính; thiếu escape ký tự nguy hiểm `=+-@`.
- **Giải Pháp**:
  1. Dùng chung hàm `getPeriodBoundsUtc(range, startDate, endDate)` cho cả Dashboard và CSV export.
  2. Định dạng sổ cái giao dịch mô phỏng đối soát: Mã giao dịch, Mã đơn hàng, Khách hàng, Số tiền, Đóng góp doanh thu thuần (+ hoặc -), Thời gian giờ VN.
  3. Chống CSV Formula Injection: Tự động thêm `'` trước ô dữ liệu bắt đầu bằng `=+-@\t\r`.
  4. Hỗ trợ hiển thị tiếng Việt trên Excel bằng tiền tố UTF-8 BOM (`\uFEFF`).

### 3.7. P1-03 — Chuẩn hóa tính giá & Demo Feature Flag
- **Root Cause**: `per_night` dùng `Math.max(1, durationDays - 1)`, làm tour 1 ngày bị tính 1 đêm. Thiếu kiểm tra `Number.isSafeInteger()`.
- **Giải Pháp**:
  1. Sửa `per_night`: `numberOfNights = Math.max(0, durationDays - 1)`. Tour 1 ngày có số đêm = 0.
  2. Xác thực số nguyên `Number.isSafeInteger()` và không âm cho mọi trường giá, số lượng khách, số ngày.
  3. Kiểm tra tính nhất quán giữa báo giá và `travel_itineraries` (số khách, số ngày, version).
  4. Bổ sung feature flag backend `MOCK_PAYMENT_ENABLED`: khi `false`, trả về HTTP 503 Service Unavailable.

---

## 4. Migration & Kết Quả Backfill (0009_booking_transaction_hardening.sql)

Đã tạo migration additive mới `worker/migrations/0009_booking_transaction_hardening.sql`:
1. `CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_bookings_quote_unique ON tour_bookings(quote_id);`
2. `CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_success_unique ON mock_payment_attempts(booking_id) WHERE status = 'success';`
3. Bảng sổ cái hoàn tiền: `mock_payment_refunds`.
4. Bảng định danh yêu cầu: `idempotency_records`.
5. Backfill dữ liệu lịch sử hoàn tiền idempotently:
   ```sql
   INSERT OR IGNORE INTO mock_payment_refunds (id, payment_attempt_id, booking_id, amount, currency, reason, actor, created_at)
   SELECT 'rf-backfill-' || id, id, booking_id, refunded_amount, currency, 'Backfill historical refund', 'system', created_at
   FROM mock_payment_attempts
   WHERE refunded_amount > 0;
   ```
- **Kết quả thực thi**:
  - Migration áp dụng thành công trên local D1 (`wrangler d1 migrations apply dak-song-db --local`).
  - Đã backfill thành công 2 bản ghi refund lịch sử (`tx-8e8518ad-fdcd-46af-840e-1eb2b91b8953` trị giá 3.500.000 VND và `tx-4d371c40-1b73-404e-9c30-4e93a60c612e` trị giá 2.800.000 VND).

---

## 5. Bằng Chứng Kiểm Thử Concurrency & Rollback (Wrangler D1 Local & Node SQLite)

1. **Test Concurrency trên Engine SQLite**:
   - Hai request tạo booking cùng quote chạy đồng thời: Thắng 1, Thua 1 (409 Conflict), DB ghi nhận chính xác 1 đơn.
   - Hai request thanh toán thành công cùng booking chạy đồng thời: Thắng 1, Thua 1 (409 Conflict), DB ghi nhận chính xác 1 payment success, không nhân đôi doanh thu.
   - Hai request hoàn tiền cùng payment attempt chạy đồng thời: Thắng 1, Thua 1 (409 Conflict), DB ghi nhận chính xác 1 dòng refund trong ledger.
2. **Kiểm chứng trực tiếp trên Wrangler D1 Local Storage Engine**:
   - Lệnh `INSERT` booking thứ hai với cùng `quote_id` trực tiếp trên D1 local bị chặn với:
     `UNIQUE constraint failed: tour_bookings.quote_id: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)`
   - Lệnh `INSERT` payment success thứ hai với cùng `booking_id` trực tiếp trên D1 local bị chặn với:
     `UNIQUE constraint failed: mock_payment_attempts.booking_id: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)`
   - Lệnh `INSERT` refund thứ hai với cùng `payment_attempt_id` trực tiếp trên D1 local bị chặn với:
     `UNIQUE constraint failed: mock_payment_refunds.payment_attempt_id: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)`

---

## 6. Bằng Chứng Đối Soát Doanh Thu & Xuất CSV

1. **Đối soát Doanh Thu**:
   - Booking ngày hôm trước, thanh toán ngày hôm nay: Doanh thu ghi nhận đúng ngày hôm nay.
   - Thanh toán ngày hôm trước, hoàn tiền ngày hôm nay: Kỳ hôm nay ghi nhận Doanh thu thuần âm (Net = -500.000 VND), phản ánh trung thực biến động dòng tiền mô phỏng.
   - Tổng doanh thu theo từng ngày (`dailyTrends.map(d => d.revenue)`) khớp 100% với `netSimulatedRevenue`.
2. **Đối soát Xuất CSV**:
   - Khi lọc 7 ngày: CSV xuất chính xác các giao dịch trong 7 ngày, loại trừ giao dịch cũ 60 ngày trước.
   - Tổng cột "Đóng góp doanh thu thuần (VND)" trong file CSV khớp hoàn toàn với chỉ số KPI Net Revenue trên Dashboard.
   - Tiền tố UTF-8 BOM (`\uFEFF`) bảo đảm mở trực tiếp trên Excel tiếng Việt không bị vỡ font.
   - Dữ liệu độc hại chứa `=SUM(1+1)` được chuyển thành `'=SUM(1+1)` an toàn.

---

## 7. Thống Kê Test Suites & Build Artifacts

### 7.1. Test Suites
- **Worker Tests**: **113 / 113 PASS** (14 file test, bao gồm `hardening-concurrency.test.mjs` với 13 ca kiểm thử concurrency chuyên sâu).
- **Miniapp Tests**: **27 / 27 PASS** (FE Auth, FE Booking, FE Planner, Sanitization).
- **Admin Tests**: **6 / 6 PASS** (Admin UI, Security Fail-Closed, Revenue Deductions).
- **Tổng cộng**: **146 / 146 PASS (100%)**.

### 7.2. Typecheck & Build
- `npm run typecheck`: **0 lỗi TypeScript** across all 3 workspaces.
- `npm run build:miniapp`: **PASS** (`www/index.html` + bundled assets).
- `npm run build:worker`: **PASS** (wrangler deploy --dry-run PASS, 258.37 KiB bundle).
- `npm run build:admin`: **PASS** (`dist/index.html` + bundled assets).

---

## 8. Kết Luận Nghiệm Thu & Sẵn Sàng Cho Phase 8.4

- Toàn bộ 4 lỗi **P0** và 4 lỗi **P1** đã được khắc phục triệt để và chứng minh qua automated tests.
- Hệ thống cơ sở dữ liệu và API đạt chuẩn an toàn giao dịch tài chính mô phỏng, bảo toàn tính bất biến của báo giá và đơn hàng lịch sử.
- **Khuyến nghị**: **PHASE 8.3.1 ĐẠT CHUẨN NGHIỆM THU — SẴN SÀNG CHUYỂN TIẾP SANG PHASE 8.4 (QUIZ QUESTION BANK & DAILY CHALLENGE).**
