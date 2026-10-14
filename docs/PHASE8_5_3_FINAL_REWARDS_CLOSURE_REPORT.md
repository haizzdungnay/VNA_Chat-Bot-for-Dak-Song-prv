# BÁO CÁO NGHIỆM THU PHASE 8.5.3 — FINAL REWARDS CLOSURE
## QUOTA RACE CLOSURE, HISTORICAL MIGRATION BACKFILL & CONCURRENCY EVIDENCE
**Ngày bàn giao:** 14/10/2026 (Asia/Ho_Chi_Minh)
**Môi trường thực hiện:** LOCAL DEVELOPMENT ONLY (Cloudflare Worker + Local D1 + Zalo Mini App + Admin Console)
**Repository:** `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
**Branch Git:** `feature/phase8-tourism-quiz`
**Starting HEAD:** `29d9d742b39b23eb9438eaab982efac8bbd32fcb`
**Main Baseline:** `c2d767300fd6bfdc571475883068f68a293bfa61` (v1.0.0-mvp, bất biến)
**Kết quả nghiệm thu:** PHASE 8.5 LOCAL TECHNICAL CLOSURE: PASS (Ngoại lệ: Remote D1 & Real Payment Gateway OPEN)

---

## I. NGUYÊN NHÂN GỐC & GIẢI PHÁP KHẮC PHỤC (ROOT CAUSES & FIXES)

### 1. [P2-RWD-10] Bằng chứng HTTP 2 Entitlements độc lập tranh chấp Per-User Quota:
- **Nguyên nhân gốc:** Trước đây bước 15 của `rewards-concurrency-tier-c.test.mjs` chỉ gọi `claim-daily` một lần. Khi 2 request POST spin đồng thời được kích hoạt, chúng cùng tranh chấp một quyền quay duy nhất, dẫn đến việc test PASS do cơ chế khóa `entitlements` chứ chưa thực sự chứng minh được tranh chấp quota `per_user_limit = 1` của người dùng khi sở hữu 2 quyền độc lập.
- **Giải pháp khắc phục:**
  + Cấp chính xác 2 entitlement IDs ĐỘC LẬP cho cùng User 1 và cùng chiến dịch bằng các luồng nghiệp vụ thực qua HTTP: 1 từ `free_daily` và 1 từ `claim-quiz` (hoàn thành bài thi Quiz đạt chuẩn).
  + Trước khi gửi 2 request song song, truy vấn D1 trực tiếp kiểm tra: `COUNT(DISTINCT id) = 2`, cả 2 đều chưa tiêu thụ (`consumed_count = 0`), `campaign.per_user_limit = 1`.
  + Gửi 2 request `POST /api/rewards/spins` đồng thời với 2 Idempotency-Key khác nhau.
  + Sau phản hồi: kiểm tra D1 đảm bảo chính xác 1 request thành công (200), 1 request bị từ chối/rollback có kiểm soát; `reward_user_campaign_spins.completed_spins = 1`, `campaign.total_spins_count` tăng 1, `SUM(consumed_count) = 1` (entitlement thứ hai không bị trừ oan).

### 2. [P2-RWD-11] Kiểm thử Migration 0015 Upgrade có dữ liệu lịch sử:
- **Nguyên nhân gốc:** Migration test cho 0015 trước đây chỉ chạy trên DB rỗng, chưa chứng minh được câu lệnh `INSERT OR IGNORE ... SELECT ... FROM reward_spin_attempts` backfill chính xác khi đã có dữ liệu nhiều user và nhiều campaign.
- **Giải pháp khắc phục:**
  + Thêm test `P2-RWD-11` trong `worker/test/migrations.test.mjs`: khởi tạo DB đến `0014`, nạp dữ liệu lịch sử cho >= 2 user và >= 2 campaign, nhiều wheel khác nhau và 1 attempt `status = 'failed'`.
  + Áp dụng `0015_rewards_time_quota_hardening.sql`: kiểm tra số đếm backfill khớp 100% với các attempt `completed`, loại trừ hoàn toàn các attempt `failed`, không double count qua nhiều wheel của cùng một campaign.
  + Kiểm tra toàn vẹn ràng buộc khóa ngoại (`PRAGMA foreign_key_check = 0`) và truy vấn đối chiếu reconciliation không có bất kỳ sai lệch nào giữa sổ cái và bộ đếm.

### 3. [P2-RWD-12] Admin đổi `per_user_limit` tại thời điểm commit:
- **Nguyên nhân gốc:** `RewardService.executeSpin` đọc `campaign.per_user_limit` vào biến JavaScript trước batch và truyền snapshot vào câu lệnh SQL CAS. Nếu Admin giảm giới hạn trong cửa sổ giữa lúc đọc và commit, giao dịch vẫn commit theo giới hạn cũ.
- **Giải pháp khắc phục:**
  + Thay thế giá trị tham số JS bằng câu truy vấn con SQL trực tiếp đọc từ bảng `reward_campaigns` tại thời điểm thực thi batch:
    ```sql
    UPDATE reward_user_campaign_spins
    SET completed_spins = completed_spins + 1, updated_at = datetime('now')
    WHERE campaign_id = ? AND user_id = ?
      AND (
        (SELECT per_user_limit FROM reward_campaigns WHERE id = ?) = 0
        OR completed_spins < (SELECT per_user_limit FROM reward_campaigns WHERE id = ?)
      )
    ```
  + Kèm `optimistic_lock_guard` (`changes() = 1`). Nếu Admin giảm giới hạn khiến số lượt đã quay không còn nhỏ hơn giới hạn mới, batch rollback 100%.
  + Thêm test đơn vị `P2-RWD-12` kiểm thử đổi giới hạn động thành công.

---

## II. BẰNG CHỨNG KIỂM THỬ THỰC TẾ (TAP RUNNER EVIDENCE)

### 1. Worker Tests (`npm test -w worker`):
- **Số file kiểm thử:** 19 test files.
- **Kết quả:** **176 / 176 PASS** (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`
- **Thời gian chạy:** 17.58 giây.

### 2. Miniapp Tests (`npm test -w miniapp`):
- **Số file:** 6 test files.
- **Kết quả:** **36 / 36 PASS** (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`

### 3. Admin Tests (`npm test -w admin`):
- **Số file:** 4 test files.
- **Kết quả:** **14 / 14 PASS** (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`

### 4. Tổng Hợp Toàn Bộ Monorepo:
- **Tổng số ca kiểm thử:** **226 / 226 PASS** (100% PASS, 0 FAIL, 0 SKIPPED).
- **Typecheck:** `npm run --workspaces typecheck` -> **0 lỗi** (Exit Code 0).
- **Production Build:** `npm run --workspaces build` -> **Thành công 100%** cả 3 workspaces (Exit Code 0).

---

## III. MA TRẬN ACCEPTANCE GATES (A-G1 - A-G6)

| Mã Gate | Nội dung yêu cầu | Bằng chứng thực tế | Trạng thái |
|---|---|---|---|
| **A-G1** | Tier C 2 entitlements độc lập có row-level DB evidence, không skip | `rewards-concurrency-tier-c.test.mjs` step 15 assert D1 trước/sau, đúng 1 lượt commit | **PASS** |
| **A-G2** | Migration 0015 upgrade có historical data >= 2 users x 2 campaigns | `migrations.test.mjs` test P2-RWD-11: backfill chuẩn xác, FK check = 0 | **PASS** |
| **A-G3** | Dynamic per_user_limit guard tại commit time qua SQL subquery | `reward.service.ts` + `rewards-wallet-spin.test.mjs` test P2-RWD-12 | **PASS** |
| **A-G4** | Voucher, gift, quota, idempotency & CAS regression không phantom win | 20/20 test trong `rewards-wallet-spin.test.mjs` PASS | **PASS** |
| **A-G5** | 3 workspaces test, typecheck, build PASS; 2 suite Tier C HTTP bắt buộc | 226/226 test PASS, Tier C HTTP 8788 chạy và xác nhận trực tiếp qua D1 | **PASS** |
| **A-G6** | Báo cáo chi tiết root cause, test totals, invariants, limitations, QA register | Tài liệu `docs/PHASE8_5_3_FINAL_REWARDS_CLOSURE_REPORT.md` hoàn chỉnh | **PASS** |

---

## IV. KẾT LUẬN GATE A
**PHASE 8.5 LOCAL TECHNICAL CLOSURE: PASS**
Toàn bộ 6 tiêu chí Gate A đạt chuẩn 100%. Sẵn sàng tạo Commit A và chuyển tiếp sang Gate B (Phase 8.6).

## V. SỔ ĐĂNG KÝ QA TIẾP TỤC DUY TRÌ OPEN
1. **Remote Cloudflare D1 Distributed Concurrency:** Duy trì OPEN chờ phase deploy remote chính thức.
2. **Historical Refund Reconciliation (Phase 8.3):** Duy trì OPEN chờ cổng thanh toán thực tế.
3. **Thương mại hóa Voucher đối tác:** Toàn bộ coupon và phần thưởng hiện tại là DEMO mô phỏng nghiệp vụ, cần quy trình ký kết đối tác kinh doanh trước khi đưa vào khai thác thực tế.

