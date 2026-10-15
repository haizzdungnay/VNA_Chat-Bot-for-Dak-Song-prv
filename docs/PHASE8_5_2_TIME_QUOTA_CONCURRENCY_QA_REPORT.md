# BÁO CÁO KIỂM CHỨNG & NGHIỆM THU PHASE 8.5.2
## REWARD TIME CONSISTENCY, ATOMIC PER-USER QUOTA & DETERMINISTIC CONCURRENCY EVIDENCE
**Ngày bàn giao:** 14/10/2026 (Asia/Ho_Chi_Minh)
**Môi trường thực hiện:** LOCAL DEVELOPMENT ONLY (Cloudflare Worker + Local D1 + Zalo Mini App + Admin Console)
**Repository:** `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
**Branch Git:** `feature/phase8-tourism-quiz` (Bắt buộc giữ nguyên)
**Starting HEAD:** `3d2d7d1c266c591d6194fd09f809403f589de5dc`
**Main Baseline:** `c2d767300fd6bfdc571475883068f68a293bfa61` (Bất biến)
**Trạng thái kiểm thử:** 224 / 224 PASS (Worker 174, Miniapp 36, Admin 14, 0 fail, 0 skipped)
**Trạng thái review:** Codex tested; awaiting ChatGPT independent review

---

## I. NGUYÊN NHÂN GỐC VÀ GIẢI PHÁP KHẮC PHỤC (ROOT CAUSES & FIXES)

### 1. [P1-RWD-07] So sánh thời gian chuỗi không đồng nhất (Time Representation & Expiry Race)
- **Nguyên nhân gốc:**
  + Trong SQLite, so sánh chuỗi thô giữa ISO 8601 UTC (ví dụ: `'2026-10-14T10:00:00.000Z'`) và `datetime('now')` (ví dụ: `'2026-10-14 12:00:00'`) là so sánh theo thứ tự từ điển ASCII.
  + Ký tự thứ 11 trong ISO là `'T'` (mã ASCII 84), trong khi SQLite `datetime('now')` dùng dấu cách `' '` (mã ASCII 32). Vì `84 > 32`, biểu thức `'2026-10-14T10:00:00.000Z' > '2026-10-14 12:00:00'` trả về `1` (TRUE)! Nghĩa là voucher/entitlement đã hết hạn 2 tiếng trước vẫn bị coi là chưa hết hạn khi so sánh chuỗi thô.
  + Trước đây chỉ kiểm tra hết hạn ở bước SELECT sơ bộ; lệnh CAS `UPDATE reward_entitlements` trong batch không kiểm tra thời hạn, tạo lỗ hổng race condition nếu quyền hết hạn trong lúc request đang xử lý.
- **Giải pháp khắc phục:**
  + Chuẩn hóa so sánh thời gian trong SQLite bằng `unixepoch()` instant: `unixepoch(expires_at) <= unixepoch()`. Hàm `unixepoch()` của SQLite phân tích chuẩn xác ISO 8601 (có 'T', 'Z', hoặc offset `+07:00`) và SQLite datetime thành số nguyên epoch giây, loại bỏ hoàn toàn sai số thứ tự chuỗi.
  + Trong JS, sử dụng `Date.parse()` / `Date.now()` để so sánh số nguyên milliseconds.
  + Đưa điều kiện kiểm tra thời hạn và trạng thái chiến dịch vào TRỰC TIẾP lệnh CAS UPDATE bên trong atomic D1 batch:
    * `UPDATE reward_entitlements ... WHERE id = ? AND consumed_count < total_granted AND (expires_at IS NULL OR unixepoch() < unixepoch(expires_at))`
    * `UPDATE reward_campaigns ... WHERE id = ? AND status = 'published' AND unixepoch(start_at) <= unixepoch() AND (end_at IS NULL OR unixepoch() < unixepoch(end_at)) AND (total_quota = 0 OR total_spins_count < total_quota)`
    * Kèm `optimistic_lock_guard` (`changes() = 1`). Nếu hết hạn hoặc chiến dịch bị đóng/tạm dừng giữa chừng, transaction rollback 100%.

### 2. [P1-RWD-08] Giới hạn lượt quay mỗi người dùng (Per-User Campaign Limit Concurrency)
- **Nguyên nhân gốc:**
  + Việc kiểm tra `per_user_limit` trước đó thực hiện bằng `SELECT COUNT(*) FROM reward_spin_attempts` trước batch. Nếu người dùng sở hữu 2 quyền quay hợp lệ (ví dụ: 1 từ free daily và 1 từ quiz) và bắn 2 request đồng thời với 2 Idempotency-Key khác nhau, cả 2 request đều đọc count = 0 và cùng commit thành công dưới `per_user_limit = 1`.
- **Giải pháp khắc phục:**
  + Tạo bảng additive `reward_user_campaign_spins` trong migration `0015_rewards_time_quota_hardening.sql` với khóa chính `(campaign_id, user_id)` và cột `completed_spins`.
  + Backfill dữ liệu lịch sử từ `reward_spin_attempts` JOIN `reward_spin_wheels`.
  + Trong batch `executeSpin()`:
    * Đảm bảo bản ghi tồn tại: `INSERT OR IGNORE INTO reward_user_campaign_spins (campaign_id, user_id, completed_spins, updated_at) VALUES (?, ?, 0, datetime('now'))`
    * Nếu `per_user_limit > 0`: `UPDATE reward_user_campaign_spins SET completed_spins = completed_spins + 1, updated_at = datetime('now') WHERE campaign_id = ? AND user_id = ? AND completed_spins < ?` kèm `optimistic_lock_guard`.
    * Nếu `per_user_limit == 0` (không giới hạn): vẫn thực hiện `UPDATE reward_user_campaign_spins SET completed_spins = completed_spins + 1 ...` để lưu vết đầy đủ. Khi Admin chuyển từ không giới hạn sang có giới hạn, lịch sử dùng trước đó được bảo toàn và áp dụng ngay lập tức.

### 3. [P2-RWD-09] Kiểm thử Tier C tất định và không điều kiện (Deterministic Tier C Evidence)
- **Nguyên nhân gốc:**
  + Bài test Tier C trước đây cấu hình xác suất 100 (voucher) và 50 (no_win), mang tính xác suất ngẫu nhiên. Ngoài ra có các khối `if (wallet.length > 0)` khiến các kiểm tra quan trọng bị bỏ qua ngầm nếu không trúng voucher.
- **Giải pháp khắc phục:**
  + Thiết lập kịch bản tất định 100%: ô voucher trọng số 100, ô no_win trọng số 0 (hoặc tồn kho hữu hạn đối chiếu rõ ràng).
  + Loại bỏ 100% các câu lệnh `if` bọc quanh assertion: kiểm tra trực tiếp ví voucher, cách ly người dùng (403), quét xác nhận tại quầy (200) và từ chối quét lần 2 (409).
  + Bổ sung kịch bản kiểm thử tranh chấp 2 request đồng thời dưới `per_user_limit = 1` qua live workerd HTTP: chính xác 1 request thành công (200), 1 request bị từ chối/rollback, và replay lại key thắng trả kết quả nhất quán.

---

## II. MIGRATION ADDITIVE 0015
Tập tin: `worker/migrations/0015_rewards_time_quota_hardening.sql`
- `CREATE TABLE reward_user_campaign_spins (...)`
- `INSERT OR IGNORE INTO reward_user_campaign_spins ... SELECT ... FROM reward_spin_attempts ...`
- Áp dụng thành công vào D1 local (`npx wrangler d1 migrations apply dak-song-db --local`).
- Kiểm thử fresh migration 0001->0015 và upgrade 0014->0015: 100% sạch, zero FK violations (`PRAGMA foreign_key_check = 0`).

---

## III. BẰNG CHỨNG KIỂM THỬ THỰC TẾ (TAP RUNNER EVIDENCE)

### 1. Worker Tests (`npm test -w worker`):
- **Số file kiểm thử:** 19 test files.
- **Kết quả:** **174 / 174 PASS** (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`
- **Các suite kiểm thử cốt lõi:**
  + `migrations.test.mjs`: 15 pass (Fresh & upgrade 0001->0015, FK check).
  + `rewards-wallet-spin.test.mjs`: 19 pass (Bao phủ toàn diện P1-RWD-07 instant time comparison, P1-RWD-08 concurrent per-user limit with 2 entitlements, unlimited-to-finite transition, P1-RWD-01 stock rollback, P1-RWD-02 gift claims, P1-RWD-03 idempotency, P2-RWD-05 clone wheel, P2-RWD-06 state machine).
  + `rewards-concurrency-tier-c.test.mjs`: 1 pass (Live workerd HTTP 8788: tranh chấp 1-stock voucher tất định, tranh chấp 2 request cùng user dưới per_user_limit=1, gift fulfillment, replay idempotency, cách ly 403).
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
- **Tổng số ca kiểm thử:** **224 / 224 PASS** (100% PASS, 0 FAIL, 0 SKIPPED).
- **Typecheck:** `npm run --workspaces typecheck` -> **0 lỗi** (Exit Code 0).
- **Production Build:** `npm run --workspaces build` -> **Thành công 100%** cả 3 workspaces (Exit Code 0).

---

## IV. MA TRẬN ACCEPTANCE GATES (G1 - G9)

| Mã Gate | Nội dung yêu cầu | Kết quả thực nghiệm | Trạng thái |
|---|---|---|---|
| **G1** | So sánh thời gian nhất quán qua unixepoch(), không dùng chuỗi thô | P1-RWD-07 verified: SQLite unixepoch() chuẩn hóa ISO UTC / SQLite / offset +07:00 | **PASS** |
| **G2** | Thời hạn/trạng thái kiểm tra nguyên tử lúc commit bên trong CAS UPDATE | P1-RWD-07 verified: CAS UPDATE kiểm tra unexpired, campaign active, schedule window | **PASS** |
| **G3** | Giới hạn per-user campaign enforce nguyên tử dưới 2 request đồng thời | P1-RWD-08 verified: bảng reward_user_campaign_spins + CAS guard, đúng 1 request thắng | **PASS** |
| **G4** | Total quota, per-user counter và completed-spin ledger đối chiếu chính xác | Khớp 100% giữa counter và COUNT(*) reward_spin_attempts | **PASS** |
| **G5** | Thất bại, tranh chấp kho hoặc quota làm rollback toàn bộ giao dịch | Batch có optimistic_lock_guard đảm bảo all-or-nothing rollback | **PASS** |
| **G6** | Idempotency same-key replay trả kết quả cũ, khác user (403), khác payload (409) | Helper dùng chung verifyAndReturnIdempotency cho cả pre-read và catch recovery | **PASS** |
| **G7** | Test Tier C live HTTP chạy tất định, không điều kiện ẩn (zero skippable checks) | Loại bỏ 100% if-guards, deterministic setup, chạy qua workerd 127.0.0.1:8788 | **PASS** |
| **G8** | Migration 0015 additive, fresh + upgrade pass, giữ nguyên 0001-0014 | 0015 applied local D1, 15/15 migration tests PASS, PRAGMA foreign_key_check = 0 | **PASS** |
| **G9** | 224/224 test pass toàn monorepo, typecheck sạch, build sạch, git an toàn | 3 workspaces test/typecheck/build 100% Exit Code 0, branch an toàn | **PASS** |

---

## V. SỔ ĐĂNG KÝ QA (CÁC VẤN ĐỀ DUY TRÌ TRẠNG THÁI OPEN)
1. **Remote Cloudflare D1 Distributed Concurrency:** Duy trì OPEN chờ phase deploy remote chính thức.
2. **Historical Refund Reconciliation (Phase 8.3):** Duy trì OPEN chờ cổng thanh toán thực tế.
3. **Thương mại hóa Voucher đối tác:** Toàn bộ coupon và phần thưởng hiện tại là DEMO mô phỏng nghiệp vụ, cần quy trình ký kết đối tác kinh doanh trước khi đưa vào khai thác thực tế.

