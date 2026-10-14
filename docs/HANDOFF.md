# PROJECT HANDOFF — VNA DAK SONG SMART TOURISM
**Cap nhat lan cuoi:** 14/10/2026 (Hoan tat Phase 8.4.4 Closure)

---

## 1. THONG TIN GIT & REPOSITORY BASELINE
- **Repository:** `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
- **Nhanh lam viec chinh thuc:** `feature/phase8-tourism-quiz`
- **HEAD Commit hien tai:** `3b6dc04a78fdc9ec0fd40dfb0c57973a2c85dfb6` (Clean working tree, da push len `origin`).
- **Base commit nhanh:** `df26cc587d7814bbbf81bcd440a498112e42d700` (Phase 8.3.2).
- **Nhanh chinh (`main`):** `c2d767300fd6bfdc571475883068f68a293bfa61` (`v1.0.0-mvp`).
- **Quy tac Git bat bien:** TUYET DOI KHONG tu y merge vao `main` khi chua co lenh ro rang cua user. Tiep tuc lam viec tren feature branch.

---

## 2. KIEN TRUC & HA TANG LOCALHOST FIRST
He thong la monorepo npm workspaces gom 3 du an doc lap:
1. **Worker API Backend** (`worker/`): Cloudflare Workers + D1 Database (SQLite local engine).
   - Port local: `http://127.0.0.1:8788`
   - Khoi chay: `cd worker; npx wrangler dev --port 8788 --ip 127.0.0.1`
2. **Tourist Mini App** (`miniapp/`): React 18, Vite, Zalo Mini App SDK (ZMP UI), ZMP Router.
   - Port local: `http://localhost:5173`
   - Khoi chay: `cd miniapp; npm run dev`
   - Cac route hoat dong: `/`, `/explore`, `/place/:id`, `/chat`, `/planner`, `/vouchers`, `/quiz`, `/quiz/play`, `/quiz/result/:id`, `/quiz/history`.
3. **Admin Dashboard Backoffice** (`admin/`): React 18, Vite, Single-page Admin Console.
   - Port local: `http://localhost:3001`
   - Khoi chay: `cd admin; npm run dev`
   - Quan tri: Doanh thu mo phong (`revenue`), Quan ly Tour (`tours`), Dich vu & Bang gia (`services`), Don dat (`bookings`), Ngan hang cau hoi (`quiz_questions`), Bo de & Thu thach (`quiz_challenges`), Ket qua & Thong ke Quiz (`quiz_analytics`), Nguoi dung luu (`visitors`), Cau hinh AI (`profiles`), Nhat ky (`logs`), Cai dat (`settings`).

---

## 3. CO SO DU LIEU D1 LOCAL & MIGRATION FREEZE
Toan bo database D1 local nam tai `worker/.wrangler/state/v3/d1`.
**Cac migration tu 0001 den 0015 da dong bang (FROZEN), tuyet doi khong sua doi file cu:**
- `0001_initial.sql`: Bang `categories` va `places`.
- `0002_seed.sql`: 19 dia danh Dak Song (15 verified + 4 VR360 3D).
- `0003_schema_update.sql`: Bang `articles` va 42 bai viet cam nang van hoa.
- `0004_admin_extension.sql`: Schema Admin AI profiles, audit logs, visitor consent, telemetry.
- `0005_identity.sql` (Phase 8.1): Bang `users`, `auth_identities`, `auth_sessions`, `auth_challenges`.
- `0006_travel_planner.sql` (Phase 8.2): Bang `travel_itineraries`, `itinerary_days`, `itinerary_items`.
- `0007_optimistic_lock_guard.sql`: Bang `optimistic_lock_guard` co CHECK(guard_id = 1) abort D1 batch neu CAS UPDATE = 0 dong.
- `0008_business_booking.sql` (Phase 8.3): Bang `tour_products`, `tour_services`, `tour_price_rules`, `booking_quotes`, `tour_bookings`, `mock_payment_attempts`, `booking_state_events`.
- `0009_booking_transaction_hardening.sql` (Phase 8.3.1): UNIQUE index quote, bang `mock_payment_refunds` (ledger bat bien), bang `idempotency_records`.
- `0010_historical_refund_reconciliation.sql` (Phase 8.3.2): Cot `timestamp_provenance` phan biet hoan tien backfill lich su.
- `0011_tourism_quiz.sql` (Phase 8.4): Bang `quiz_categories`, `quiz_questions`, `quiz_question_options`, `quiz_collections`, `quiz_collection_questions`, `quiz_challenges`, `quiz_attempts`, `quiz_attempt_questions`, `quiz_attempt_answers`, `quiz_user_stats`.
- `0012_quiz_scoring_and_schedule.sql` (Phase 8.4.1): Cot `score_per_question` trong `quiz_attempts` phuc vu snapshot diem so bat bien.
- `0013_rewards_wallet_spin.sql` (Phase 8.5): He thong phan thuong, vi voucher va vong quay may man.
- `0014_rewards_integrity_hardening.sql` (Phase 8.5.1): Bang `reward_gift_claims`, cot `total_spins_count` CAS guard.
- `0015_rewards_time_quota_hardening.sql` (Phase 8.5.2): Bang `reward_user_campaign_spins` CAS atomic per-user limit.
*Quy tac additive migration:* Neu cac phase sau can thay doi schema, bat dau tu `0016_*.sql`. Khong sua file tu 0001-0015.

---

## 4. TOM TAT CAC TINH NANG DA HOAN TAT
1. **Phase 8.1 — Identity & Authentication**:
   - Zalo OAuth dang nhap mot cham, dev mock auth `mock_*` phan biet nguoi dung doc lap.
   - Email OTP challenge hashing, xac thuc single-use, gioi han thu lai, phan quyen so huu session.
2. **Phase 8.2 — AI Travel Planner**:
   - Tao lich trinh du lich thong minh, bao ton diem den VR360.
   - Optimistic locking phien ban (`version`), rollback mid-batch, 0 transit buffer ao.
3. **Phase 8.3 / 8.3.1 / 8.3.2 — Business Operations & Booking**:
   - Quan ly Tour & Bang gia dich vu du lich Dak Song.
   - CAS quote consumption, khoa chong double revenue, hoan tien qua so cai bat bien `mock_payment_refunds`.
   - Feature flag `MOCK_PAYMENT_ENABLED` deny-by-default (chi mo o dev/test/staging, khoa 503 tren production).
   - Xac thuc SafeInteger nguyen so cho so khach va tien te. Xuat CSV chong Formula Injection kem UTF-8 BOM.
4. **Phase 8.4 / 8.4.1 / 8.4.2 / 8.4.3 / 8.4.4 — Tourism Quiz & Daily Challenge Platform**:
   - **Ngan hang cau hoi (Admin)**: CRUD day du, preview truc quan, loc da tieu chi, status `draft -> published -> archived`, chong XSS stored, bat buoc 1 dap an dung, kiem dinh nguon lien ket `places`/`articles`.
   - **Thu thach hang ngay**: Len lich theo ngay nghiep vu (`business_date`), kiem soat khung gio `[opening_time, closing_time]` gio VN (Asia/Ho_Chi_Minh), tu dong kich hoat, bao toan luot thi dang lam do (`ongoing attempt preservation`).
   - **Server-Authoritative Quiz Engine**: Client khong duoc gui diem; tinh diem qua subquery SQL long truc tiep trong atomic batch (`UPDATE quiz_attempts ... WHERE status = 'in_progress'` + `optimistic_lock_guard` + `quiz_user_stats` UPSERT); chong race condition giua submitAnswer va finishAttempt.
   - **Chong gian lan & Che giau dap an**: UNIQUE constraint `(user_id, business_date)` chan tuyet doi thi lap Daily Challenge; response envelope giau 100% dap an dung va giai thich khi `in_progress`.
   - **Doi soat so lieu (`reconcileUserStats`)**: Cau lenh SQL atomic duy nhat gom SELECT va UPSERT, dong bo `total_attempts = completed_attempts` cho cac bai thi da chot, phuc hoi trung thuc du lieu khi bi sai lech.
5. **Phase 8.5 / 8.5.1 / 8.5.2 / 8.5.3 — Voucher Wallet, Lucky Spin & Reward Management**:
   - **Vòng quay may mắn (Lucky Spin)**: Server-authoritative Web Crypto rejection-sampling RNG, atomic D1 batch, CAS optimistic lock guard, an toàn tồn kho hữu hạn không âm, không quà ảo.
   - **Ví Voucher & Quà tặng**: Bảng `reward_wallet_items` và `reward_gift_claims`, xác nhận đổi quà tại quầy một lần duy nhất (`reward_redemptions`), chuẩn hóa thời gian `unixepoch()` instant.
   - **Giới hạn lượt quay người dùng (Per-User Quota)**: Bảng `reward_user_campaign_spins` bảo vệ giới hạn quay nguyên tử dưới tranh chấp đa luồng.
6. **Phase 8.6 — Operations, Admin Readiness & Cross-Module Acceptance**:
   - Phân hệ vận hành Admin (`/api/admin/operations/readiness`) tự động kiểm chứng 5 phân hệ cốt lõi và 5 quy tắc bất biến dữ liệu (invariants).
   - Xuất báo cáo nghiệm thu CSV chuẩn UTF-8 BOM, chống formula injection.
   - Bộ kiểm thử tích hợp liên phân hệ `cross-module-acceptance.test.mjs` (Identity -> Quiz -> Rewards -> Booking -> Planner -> Admin Ops).
   - Sổ tay vận hành cục bộ `docs/PHASE8_6_LOCAL_OPERATIONS_RUNBOOK.md`.

---

## 5. TINH TRANG KIEM THU (TEST SUITE STATUS - PHASE 8.6)
- **Miniapp Tests:** **36 / 36 PASS** (`npm test -w miniapp`)
- **Admin Tests:** **14 / 14 PASS** (`npm test -w admin`)
- **Worker Tests:** **181 / 181 PASS** (`npm test -w worker`, 20 test files bao gom Tier C live workerd HTTP 8788)
- **TONG TEST TOAN DU AN:** **231 / 231 PASS (0 FAIL, 0 SKIPPED)**.
- **Typecheck:** 0 loi TypeScript tren ca 3 workspace (`npm run --workspaces typecheck`).
- **Production Build:** Ca 3 workspace build thanh cong 100% (`npm run --workspaces build`).

---

## 6. SO DANG KY QA & CAC DIEM CON MO (QA REGISTER)
1. **Cloudflare D1 Remote Distributed Concurrency:** Giữ trạng thái **OPEN** chờ phase deploy remote chính thức.
2. **Historical Refund Reconciliation (Phase 8.3):** Giữ trạng thái **OPEN** chờ cổng thanh toán thực tế.
3. **Thương mại hóa Voucher Đối tác:** Giữ trạng thái **OPEN**; toàn bộ voucher hiện tại là DEMO mô phỏng nghiệp vụ.
4. **Đăng ký Zalo Mini App Production:** Giữ trạng thái **OPEN** chờ phê duyệt Zalo Platform.
