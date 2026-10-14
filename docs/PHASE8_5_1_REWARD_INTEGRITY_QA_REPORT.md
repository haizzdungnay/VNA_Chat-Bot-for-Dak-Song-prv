# BÁO CÁO KIỂM CHỨNG & NGHIỆM THU PHASE 8.5.1
## REWARD INTEGRITY, QUOTA ENFORCEMENT & CONCURRENCY HARDENING
**Ngày bàn giao:** 14/10/2026 (Asia/Ho_Chi_Minh)
**Môi trường thực hiện:** LOCAL DEVELOPMENT ONLY (Cloudflare Worker + Local D1 + Zalo Mini App + Admin Console)
**Repository:** `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
**Branch Git:** `feature/phase8-tourism-quiz` (Bắt buộc giữ nguyên)
**Starting HEAD:** `e678e40a8230c2acfcbe332c040cd93b8a43c2b0`
**Main Baseline:** `c2d767300fd6bfdc571475883068f68a293bfa61` (Bất biến)
**Trạng thái kiểm thử:** 220 / 220 PASS (0 FAIL, 0 SKIPPED)

---

## I. NGUYÊN NHÂN GỐC VÀ GIẢI PHÁP KHẮC PHỤC (ROOT CAUSES & FIXES)

### 1. [P1-RWD-01] Trúng voucher nhưng không phát được voucher (Ghost Voucher Win)
- **Nguyên nhân gốc:** `executeSpin()` chọn voucher segment trước, sau đó mới đọc template. Nếu template bị paused, archived hoặc hết stock, nhánh `if (tpl && ...)` bị bỏ qua khiến `voucher_id` và `voucherDetail` là `null`, nhưng transaction vẫn ghi nhận `spin_attempt` thành công và trừ mất lượt của người dùng.
- **Giải pháp khắc phục:**
  + Thắt chặt bộ lọc ứng viên `getActiveWheel()`: chỉ các ô voucher có template đang `active` và còn tồn kho (`total_stock = -1 OR issued_count < total_stock`) mới được tham gia bốc thăm ngẫu nhiên.
  + Trong atomic D1 batch: thực thi `UPDATE reward_voucher_templates SET issued_count = issued_count + 1 WHERE id = ? AND status = 'active' AND (total_stock = -1 OR issued_count < total_stock)` kèm `optimistic_lock_guard` (`changes() = 1`).
  + Bất biến: Mọi kết quả quay `voucher` bắt buộc phải sinh `voucher_id` và bản ghi ví hợp lệ. Nếu phát sinh tranh chấp kho tại thời điểm commit, toàn bộ batch rollback 100% (không tiêu hao lượt, không ghi nhận spin ảo).

### 2. [P1-RWD-02] `gift_item` không có claim/fulfillment và không trừ stock
- **Nguyên nhân gốc:** Nhánh `segment_type === 'gift_item'` trước đó không tạo phiếu nhận quà, không có vòng đời giao nhận và không tăng `awarded_count` của ô thưởng.
- **Giải pháp khắc phục:**
  + Tạo bảng additive `reward_gift_claims` trong migration `0014_rewards_integrity_hardening.sql` với vòng đời: `pending` -> `fulfilled` | `revoked`.
  + Trong `executeSpin()`: khi trúng quà lưu niệm, tự động sinh mã phiếu nhận `GIFT-XXXXXXXX`, trừ tồn kho ô thưởng bằng CAS guard nguyên tử trong cùng D1 batch.
  + Bổ sung API Admin: `GET /api/admin/rewards/gift-claims`, `POST /api/admin/rewards/gift-claims/:id/fulfill` (CAS `status = 'pending'`), và `POST /api/admin/rewards/gift-claims/:id/revoke`.
  + Bổ sung mục quản lý quà tặng trong Admin Console (`RewardRedemptionsPage`) và ví Mini App (`VoucherWalletPage`).

### 3. [P1-RWD-03] Idempotency catch trả response không kiểm tra owner/payload
- **Nguyên nhân gốc:** Ở đầu `executeSpin()`, bản ghi idempotency được kiểm tra `user_id` và `request_hash`. Nhưng trong khối `catch (batchErr)`, lệnh SELECT theo `idempotency_key` trả thẳng `response_json` mà không đối chiếu quyền sở hữu và hash.
- **Giải pháp khắc phục:**
  + Gom toàn bộ logic xác thực vào hàm dùng chung `verifyAndReturnIdempotency(db, key, userId, op, hash)`: đối chiếu `user_id` (sai => 403), `operation` (sai => 409), `request_hash` (sai => 409).
  + Gọi helper thống nhất ở cả bước pre-read lẫn recovery catch.
  + Bắt buộc truyền `Idempotency-Key` (chuỗi 8-128 ký tự alnum/gạch), từ chối ngay với 400 nếu thiếu hoặc không hợp lệ.

### 4. [P1-RWD-04] Quota, khung giờ, wheelId và timezone chưa được enforce đầy đủ
- **Nguyên nhân gốc:** Tham số `wheelId` bị bỏ qua trong `getActiveWheel()`; chiến dịch không kiểm tra `start_at` / `end_at`; `total_quota` không có cơ chế chặn overbooking nguyên tử; hạn dùng daily free spin dùng giờ địa phương so sánh với UTC gây lệch 7 tiếng.
- **Giải pháp khắc phục:**
  + Bổ sung cột `total_spins_count` vào `reward_campaigns` (migration 0014). Chặn overbooking bằng CAS atomic batch: `UPDATE reward_campaigns SET total_spins_count = total_spins_count + 1 WHERE id = ? AND total_spins_count < total_quota` kèm guard.
  + Kiểm tra `per_user_limit`: đếm số lượt quay đã hoàn thành của user trong chiến dịch, từ chối với 403 nếu vượt quá.
  + Kiểm tra khung giờ chiến dịch: `start_at <= UTC now < end_at`; từ chối với 400 nếu chiến dịch chưa mở hoặc đã kết thúc.
  + Xác thực `wheelId`: đối chiếu chính xác mã vòng quay, trạng thái `active` và quyền thuộc về chiến dịch.
  + Chuẩn hóa timezone: tính mốc kết thúc ngày Việt Nam (`+07:00`) thành chuỗi ISO UTC lưu vào `expires_at`.

### 5. [P2-RWD-05] Cấu hình segment làm hỏng lịch sử
- **Nguyên nhân gốc:** `setWheelSegments()` thực thi DELETE toàn bộ segments rồi INSERT lại, vi phạm ràng buộc FK `ON DELETE RESTRICT` của `reward_spin_attempts.segment_id` khi vòng quay đã có dữ liệu.
- **Giải pháp khắc phục (Chiến lược A):**
  + Kiểm tra lịch sử quay trước khi sửa: nếu vòng quay đã có lượt quay ghi nhận, chặn thao tác sửa đổi trực tiếp với mã lỗi 409 Conflict.
  + Bổ sung chức năng `cloneWheel(wheelId, title)`: sao chép vòng quay sang bản nháp mới (draft) với các ô thưởng được làm mới `awarded_count = 0`, cho phép Admin điều chỉnh tỷ lệ trên vòng quay mới mà không ảnh hưởng dữ liệu lịch sử.

### 6. [P2-RWD-06] Voucher State Machine / Expiry / Redeem-Revoke Race
- **Nguyên nhân gốc:** `revokeVoucher()` trước đây UPDATE vô điều kiện, có thể thu hồi voucher đã redeem; voucher hết hạn theo thời gian vẫn lưu trạng thái `issued` thô.
- **Giải pháp khắc phục:**
  + Ràng buộc máy trạng thái: `issued` -> `redeemed` | `revoked` | `expired`. Voucher đã `redeemed` không được thu hồi (409); voucher đã `revoked` hoặc hết hạn không được sử dụng (400/409).
  + Thực thi CAS với điều kiện `WHERE id = ? AND status = 'issued' AND datetime('now') < expires_at` kèm `optimistic_lock_guard` cho cả `redeemVoucher` và `revokeVoucher`.
  + Tính toán `effective_status`: tự động ánh xạ thành `expired` trong các truy vấn khi `status = 'issued'` và `expires_at <= datetime('now')`.

---

## II. MIGRATION ADDITIVE 0014
Tập tin: `worker/migrations/0014_rewards_integrity_hardening.sql`
- `ALTER TABLE reward_campaigns ADD COLUMN total_spins_count INTEGER NOT NULL DEFAULT 0;`
- `CREATE TABLE reward_gift_claims (...)` với ràng buộc FK, UNIQUE `spin_attempt_id`, UNIQUE `claim_code`.
- Đã kiểm thử migration 0001->0014 fresh và 0001->0013->0014 upgrade trên local D1: 100% sạch, zero FK violations (`PRAGMA foreign_key_check = 0`).

---

## III. BẰNG CHỨNG KIỂM THỬ THỰC TẾ (TAP RUNNER EVIDENCE)

### 1. Worker Tests (`npm test -w worker`):
- **Số file kiểm thử:** 19 test files.
- **Kết quả:** **170 / 170 PASS** (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`
- **Các suite nổi bật:**
  + `migrations.test.mjs`: 14 pass (Bổ sung kiểm thử 0014 fresh & upgrade).
  + `rewards-wallet-spin.test.mjs`: 16 pass (Bao phủ toàn diện 4 P1 và 2 P2: voucher stock rollback, gift fulfillment, idempotency catch, campaign quota/window, wheel cloning, terminal state machine).
  + `rewards-concurrency-tier-c.test.mjs`: 1 pass (Kiểm thử Live workerd HTTP 8788 đa luồng: 2 user tranh 1 voucher stock cuối, 2 user tranh quota, gift fulfillment HTTP E2E, cross-user 403, duplicate redeem 409).
  + `quiz-concurrency-tier-c.test.mjs`: 1 pass (Live workerd HTTP 8788 bảo toàn P1-QZ-08 anti-leak).

### 2. Miniapp Tests (`npm test -w miniapp`):
- **Số file:** 6 test files.
- **Kết quả:** **36 / 36 PASS** (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`

### 3. Admin Tests (`npm test -w admin`):
- **Số file:** 4 test files.
- **Kết quả:** **14 / 14 PASS** (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`

### 4. Tổng Hợp Monorepo:
- **Tổng số ca kiểm thử:** **220 / 220 PASS** (100% PASS, 0 FAIL, 0 SKIPPED).
- **Typecheck:** `npm run --workspaces typecheck` -> **0 lỗi** (Exit Code 0).
- **Production Build:** `npm run --workspaces build` -> **Thành công 100%** (Exit Code 0).

---

## IV. MA TRẬN ACCEPTANCE GATES (G1 - G8)

| Mã Gate | Nội dung yêu cầu | Kết quả thực nghiệm | Trạng thái |
|---|---|---|---|
| **G1** | Trúng voucher => DB có voucher thật, stock/entitlement/spin đồng bộ, rollback an toàn | P1-RWD-01 verified: 100% voucher spin có voucher_id, stock template/segment CAS guard, 0 phantom vouchers | **PASS** |
| **G2** | gift_item => có claim + inventory + fulfillment đáng tin cậy | P1-RWD-02 verified: bảng reward_gift_claims, CAS fulfillment, inventory decrement, admin UI & tourist wallet | **PASS** |
| **G3** | Idempotency retry đúng 1 kết quả, chặn key khác user (403), khác payload (409) | P1-RWD-03 verified: helper dùng chung cho pre-read và catch recovery, validate key format | **PASS** |
| **G4** | Campaign time/quota/per-user và wheelId được enforce dưới concurrent HTTP | P1-RWD-04 verified: total_spins_count CAS guard, per_user_limit check, schedule window, ISO UTC timezone | **PASS** |
| **G5** | Admin cập nhật cấu hình an toàn, không phá FK, có nút nhân bản wheel | P2-RWD-05 verified: chặn sửa wheel đã có lịch sử (409), cloneWheel tạo draft wheel mới an toàn | **PASS** |
| **G6** | Voucher expiry/redeem/revoke đúng state machine, CAS và audit nguyên tử | P2-RWD-06 verified: terminal state transitions, CAS WHERE status='issued' AND unexpired | **PASS** |
| **G7** | Migration 0014 upgrade, D1 local, HTTP Tier C live socket không silent skip | 0014 applied local D1, 2 suite Tier C chạy qua 127.0.0.1:8788 với postcondition DB assertions | **PASS** |
| **G8** | Monorepo tests/typecheck/build pass, git clean, không deploy remote | 220/220 test PASS, typecheck 0 lỗi, build 3/3 workspace thành công | **PASS** |

---

## V. SỔ ĐĂNG KÝ QA (CÁC VẤN ĐỀ DUY TRÌ TRẠNG THÁI OPEN)
1. **Remote Cloudflare D1 Distributed Concurrency:** Duy trì OPEN chờ phase deploy remote chính thức.
2. **Historical Refund Reconciliation (Phase 8.3):** Duy trì OPEN chờ tích hợp cổng thanh toán thực tế.
3. **Thương mại hóa Voucher đối tác:** Toàn bộ coupon và phần thưởng hiện tại là DEMO mô phỏng nghiệp vụ, cần quy trình ký kết đối tác kinh doanh trước khi đưa vào khai thác thực tế.

