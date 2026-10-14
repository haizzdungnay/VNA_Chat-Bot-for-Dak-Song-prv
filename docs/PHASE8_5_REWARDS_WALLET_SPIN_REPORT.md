# BÁO CÁO NGHIỆM THU PHASE 8.5 — VOUCHER WALLET, LUCKY SPIN & REWARD MANAGEMENT
**Ngày bàn giao:** 14/10/2026 (Asia/Ho_Chi_Minh)
**Môi trường thực hiện:** Localhost Development Only (Cloudflare Worker + Local D1 + Zalo Mini App + Admin Console)
**Branch Git:** `feature/phase8-tourism-quiz` (Baseline: `1d9ae59`, Main: `c2d7673`)
**Người triển khai:** Codex (Senior Fullstack Developer Agent)
**Trạng thái kiểm thử:** 213/213 PASS (Worker 163, Miniapp 36, Admin 14, 0 fail, 0 skipped)

---

## I. TỔNG QUAN VÀ MỤC TIÊU NGHIỆP VỤ
Phase 8.5 hiện thực hóa hệ thống phần thưởng du lịch số, ví voucher và vòng quay may mắn server-authoritative hoàn chỉnh cho hệ sinh thái Du lịch Thông minh Đắk Song.

### Ranh giới an toàn và nguyên tắc đạo đức (Ethics & Safety Boundaries):
- **Tuyệt đối KHÔNG cờ bạc / cá cược / đổi thưởng tiền mặt:** Không có nạp/rút tiền, không mua bán lượt quay, không đổi điểm thưởng lấy tiền thật, không tích hợp cổng thanh toán cược.
- **Minh bạch và mô phỏng DEMO:** Mọi voucher/coupon trong phase này là dữ liệu thử nghiệm nghiệp vụ (DEMO), có điều khoản rõ ràng, không cam kết quyền lợi thương mại thực tế với doanh nghiệp khi chưa kết nối đối tác chính thức.
- **Server-Authoritative RNG:** Client không được quyền tự quyết định ô trúng. Mọi kết quả quay được sinh ngẫu nhiên từ server bằng thuật toán Web Crypto khử hoàn toàn sai số modulo (modulo-bias free rejection sampling) và cam kết atomic trong D1 transaction trước khi client hiển thị hoạt ảnh.
- **Chống rò rỉ Quiz (P1-QZ-08 Invariant):** Không cấp lượt quay dựa trên client claims; backend chỉ đọc các bài thi đã chốt trạng thái `completed` trong DB.

---

## II. THIẾT KẾ DỮ LIỆU & ERD (MIGRATION 0013 ADDITIVE)
Tập tin migration mới: `worker/migrations/0013_rewards_wallet_spin.sql` được tạo theo nguyên tắc additive, giữ nguyên vẹn các migration `0001` đến `0012`.

### 1. Thực thể dữ liệu (ERD Entities):
1. **`reward_campaigns`:** Quản lý chiến dịch ưu đãi du lịch (`code`, `title`, `campaign_type`, `status`, `start_at`, `end_at`, `total_quota`, `per_user_limit`, `eligibility_rules_json`, `version`).
2. **`reward_voucher_templates`:** Mẫu voucher ưu đãi (`code_prefix`, `title`, `discount_display`, `discount_type`, `discount_value`, `min_order_value`, `category`, `terms_conditions`, `validity_days`, `total_stock`, `issued_count`).
3. **`reward_wallet_items`:** Ví voucher của từng du khách (`user_id`, `template_id`, `campaign_id`, `voucher_code` UNIQUE, `title`, `discount_display`, `terms_conditions_snapshot`, `status`, `source_type`, `expires_at`, `redeemed_at`, `revoked_at`).
4. **`reward_spin_wheels`:** Vòng quay may mắn (`campaign_id`, `title`, `cost_entitlement_count`, `status`, `version`).
5. **`reward_spin_segments`:** Các ô trên vòng quay (`wheel_id`, `order_index`, `label`, `segment_type` [voucher, no_win, gift_item], `voucher_template_id`, `weight`, `total_inventory`, `awarded_count`, `color`).
6. **`reward_entitlements`:** Quyền quay của du khách (`user_id`, `campaign_id`, `grant_type`, `source_event_key` UNIQUE, `total_granted`, `consumed_count`, `expires_at`).
7. **`reward_spin_attempts`:** Sổ cái ghi nhận lịch sử quay bất biến (`user_id`, `wheel_id`, `entitlement_id`, `segment_id`, `result_type`, `voucher_id`, `result_snapshot_json`, `idempotency_key` UNIQUE).
8. **`reward_redemptions`:** Nhật ký xác nhận sử dụng voucher tại quầy bởi Admin (`voucher_id` UNIQUE success, `actor`, `status`, `reason`, `idempotency_key`).
9. **`reward_audit_events`:** Nhật ký kiểm toán quản trị (`actor`, `actor_type`, `action`, `resource_type`, `resource_id`, `payload_json`).

---

## III. STATE MACHINES & BUSINESS RULES

### 1. Trạng thái Voucher trong Ví (`reward_wallet_items.status`):
- `issued`: Đã cấp vào ví, còn hạn sử dụng, sẵn sàng xuất trình tại quầy.
- `redeemed`: Đã được nhân viên/Admin quét xác minh sử dụng thành công (khóa 1 lần duy nhất).
- `expired`: Hết hạn theo thời gian `expires_at` hoặc trạng thái tự động.
- `revoked`: Đã bị quản trị viên thu hồi kèm lý do kiểm toán.

### 2. Trạng thái Chiến dịch (`reward_campaigns.status`):
- `draft` -> `published` -> `paused` -> `closed` -> `archived`.

### 3. Vòng quay & Ô thưởng:
- Bắt buộc có tối thiểu 2 ô và ít nhất 1 ô Không trúng (`no_win`).
- Quản lý tồn kho hữu hạn (`total_inventory != -1`), tự động điều hướng sang ô an toàn (`no_win`) khi voucher hết kho, không bao giờ phát sinh tồn kho âm.

---

## IV. DANH MỤC API & CONTRACTS

### 1. Tourist Mini App APIs:
- `GET /api/rewards/campaigns`: Danh sách chiến dịch công khai đang mở.
- `GET /api/rewards/wallet`: Ví voucher phân trang/lọc theo trạng thái của du khách đăng nhập.
- `GET /api/rewards/wallet/:id`: Chi tiết điều khoản snapshot và mã xác nhận của voucher.
- `GET /api/rewards/spins/active`: Cấu hình vòng quay và danh sách ô thưởng công khai.
- `GET /api/rewards/spins/eligibility`: Số lượt quay khả dụng và quyền nhận lượt miễn phí.
- `POST /api/rewards/spins/claim-daily`: Nhận 1 lượt quay miễn phí/ngày (idempotent theo ngày VN).
- `POST /api/rewards/spins/claim-quiz`: Nhận lượt quay từ bài thi Quiz hoàn thành đạt điểm chuẩn.
- `POST /api/rewards/spins`: Thực hiện quay thưởng server-authoritative (kèm Idempotency-Key).
- `GET /api/rewards/spins/history`: Lịch sử các lần quay và kết quả trúng thưởng cá nhân.

### 2. Admin Console APIs (Cloudflare Access Fail-Closed):
- `GET/POST /api/admin/rewards/campaigns`: CRUD chiến dịch ưu đãi.
- `POST /api/admin/rewards/campaigns/:id/status`: Đổi trạng thái published/paused/closed.
- `GET/POST /api/admin/rewards/templates`: Quản lý mẫu voucher ưu đãi.
- `GET/POST /api/admin/rewards/wheels`: Quản lý danh sách vòng quay.
- `PUT /api/admin/rewards/wheels/:id/segments`: Cấu hình ô thưởng, trọng số và kho giải.
- `GET /api/admin/rewards/wallet`: Tra cứu danh sách voucher đã cấp toàn hệ thống.
- `POST /api/admin/rewards/wallet/:id/redeem`: Quét / Xác nhận sử dụng voucher một lần tại quầy (DEMO).
- `POST /api/admin/rewards/wallet/:id/revoke`: Thu hồi voucher vi phạm kèm lý do.
- `GET /api/admin/rewards/analytics`: Tổng hợp KPI, tỷ lệ trúng thưởng (win rate), tỷ lệ sử dụng (redemption rate).
- `GET /api/admin/rewards/export`: Xuất báo cáo voucher CSV (UTF-8 BOM + Anti-Formula Injection).

---

## V. BẰNG CHỨNG KIỂM THỬ THỰC TẾ (TAP RUNNER EVIDENCE)

### 1. Worker Test Suite (`npm test -w worker`):
- **Số file:** 19 test files (bao gồm 2 test suite mới cho Phase 8.5).
- **Kết quả:** 163 / 163 PASS (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`
- **Chi tiết 19 files:**
  1. `admin-backend.test.mjs`: 27 pass
  2. `ai-config-switch.test.mjs`: 4 pass
  3. `business-booking.test.mjs`: 7 pass
  4. `chat-e2e-scenarios.test.mjs`: 7 pass
  5. `d1-concurrency.test.mjs`: 1 pass
  6. `hardening-concurrency.test.mjs`: 13 pass
  7. `hardening-validation-d1.test.mjs`: 8 pass
  8. `identity-auth.test.mjs`: 9 pass
  9. `migrations.test.mjs`: 13 pass (Bổ sung kiểm thử fresh & upgrade cho 0013)
  10. `openai-compatible.test.mjs`: 3 pass
  11. `quiz-concurrency-tier-c.test.mjs`: 1 pass (Live HTTP workerd 8788)
  12. `rewards-concurrency-tier-c.test.mjs`: 1 pass (Live HTTP workerd 8788 cho Lucky Spin & Wallet)
  13. `rewards-wallet-spin.test.mjs`: 10 pass (Unit & transactional tests Phase 8.5)
  14. `router.test.js`: 3 pass
  15. `security.test.mjs`: 7 pass
  16. `sync-adapter.test.mjs`: 6 pass
  17. `tourism-quiz.test.mjs`: 26 pass
  18. `travel-planner.test.mjs`: 14 pass
  19. `visitor-consent.test.mjs`: 3 pass

### 2. Miniapp Test Suite (`npm test -w miniapp`):
- **Số file:** 6 test files.
- **Kết quả:** 36 / 36 PASS (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`

### 3. Admin Test Suite (`npm test -w admin`):
- **Số file:** 4 test files.
- **Kết quả:** 14 / 14 PASS (0 FAIL, 0 SKIPPED).
- **Exit Code:** `0`

### 4. Tổng Hợp Toàn Bộ Monorepo:
- **Tổng số ca kiểm thử:** **213 / 213 PASS** (100% PASS, 0 FAIL, 0 SKIPPED).
- **Typecheck:** `npm run --workspaces typecheck` -> **0 lỗi** (Exit Code 0).
- **Production Build:** `npm run --workspaces build` -> **Thành công 100%** cả 3 workspaces (Exit Code 0).

---

## VI. MA TRẬN ACCEPTANCE GATES (G1 - G7)

| Mã Gate | Nội dung yêu cầu | Kết quả thực nghiệm | Trạng thái |
|---|---|---|---|
| **G1** | Migration 0013 additive, constraints, snapshots, không sửa migration cũ | 0001->0013 fresh & upgrade pass, PRAGMA foreign_key_check = 0 violations | **PASS** |
| **G2** | Admin tạo/publish/quản lý campaign, voucher, wheel/odds/stock qua UI thật | 4 tab Admin mới hoạt động với dữ liệu D1, form CRUD và toggle status hoàn chỉnh | **PASS** |
| **G3** | Tourist có wallet D1-backed và spin server-authoritative, booking không bị phá | Tab Tour & Dịch vụ và BookingCheckoutModal bảo toàn 100%; /vouchers/wallet và /spin chạy thật | **PASS** |
| **G4** | Exactly-once spin/issuance/redemption, quotas/stock/CAS/rollback, HTTP local | D1 batch + guard + idempotency records; test concurrency 2 requests cùng key trả 1 kết quả | **PASS** |
| **G5** | User isolation, admin fail-closed, quiz anti-leak, idempotency, không tiền thật | Chặn cross-user 403, Cloudflare Access fail-closed, không có luồng nạp/rút tiền | **PASS** |
| **G6** | Kiểm thử đa tầng + typecheck + build PASS, 0 silent skip | 213/213 test pass across 3 workspaces, exit code 0 toàn bộ | **PASS** |
| **G7** | Git branch/main nguyên vẹn, có commit trên origin, không deploy remote | Nhánh feature/phase8-tourism-quiz, main giữ nguyên c2d7673, localhost first | **PASS** |

---

## VII. SỔ ĐĂNG KÝ QA (CÁC VẤN ĐỀ CÒN MỞ)
1. **Remote Cloudflare D1 Distributed Concurrency:** Duy trì OPEN cho phase deploy Cloudflare edge chính thức.
2. **Historical Refund Reconciliation (Phase 8.3):** Duy trì OPEN cho đến khi tích hợp cổng thanh toán thực tế.
3. **Thương mại hóa Voucher đối tác:** Toàn bộ coupon hiện tại là DEMO mô phỏng nghiệp vụ, cần quy trình ký kết đối tác kinh doanh trước khi có giá trị sử dụng ngoài đời thực.

