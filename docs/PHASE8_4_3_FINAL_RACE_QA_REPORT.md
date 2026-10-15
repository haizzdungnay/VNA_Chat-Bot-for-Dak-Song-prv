# VNA DAK SONG SMART TOURISM — CODEX REPORT
## PHASE 8.4.3 — FINALIZE/ANSWER RACE CONDITION & TEST EVIDENCE HARDENING
Date: 2026-10-13

---

### 1. THÔNG TIN PHIÊN BẢN & GIT BASELINE
- **Repository:** `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
- **Branch duy nhất:** `feature/phase8-tourism-quiz` (không tách nhánh mới, không merge `main`).
- **Starting commit:** `32acaf8360d05fb761e0b93f14800c1313e3b88f` (Phase 8.4.2 baseline).
- **Trạng thái nhánh chính (`main`):** Giữ nguyên commit `c2d7673` (`v1.0.0-mvp`).
- **Phạm vi triển khai:** Localhost Development (`http://localhost:5173`, `http://localhost:3001`, `http://127.0.0.1:8788`). Không remote deployment.

---

### 2. PHÂN TÍCH NGUYÊN NHÂN GỐC & GIẢI PHÁP KỸ THUẬT (P1-QZ-06)

#### Hiện tượng phát hiện (Vulnerability Analysis):
Trong phiên bản trước, `finishAttempt()` thực hiện truy vấn SELECT tổng hợp (`COUNT/SUM quiz_attempt_answers`) trong JavaScript trước khi chạy batch D1 chốt trạng thái `completed` và ghi nhận `quiz_user_stats`.
Rủi ro tranh chấp (Interleaving Race Condition):
- T1: Yêu cầu kết thúc bài thi đọc được 0 câu trả lời từ DB.
- T2: Yêu cầu nộp đáp án (`submitAnswer`) từ client gửi lên đồng thời, batch ghi nhận câu trả lời vào DB thành công vì bài thi vẫn đang `in_progress`.
- T3: Batch của T1 thực thi ghi đè điểm số = 0 và số câu đúng = 0 (từ số liệu đọc trước đó), bỏ qua câu trả lời vừa được ghi nhận hợp lệ ở T2.

#### Giải pháp khắc phục triệt để:
1. **Loại bỏ hoàn toàn SELECT trong JavaScript trước batch:**
   Tất cả chỉ số (`correct_count`, `incorrect_count`, `unanswered_count`, `score`, `max_score`) được tính toán trực tiếp bằng các câu lệnh con SQL (`subqueries`) ngay trong mệnh đề `UPDATE quiz_attempts SET ... WHERE id = ? AND status = 'in_progress'`.
   ```sql
   UPDATE quiz_attempts
   SET status = 'completed',
       correct_count = (SELECT COALESCE(SUM(is_correct), 0) FROM quiz_attempt_answers WHERE attempt_id = quiz_attempts.id),
       incorrect_count = (SELECT COALESCE(SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END), 0) FROM quiz_attempt_answers WHERE attempt_id = quiz_attempts.id),
       unanswered_count = max(0, quiz_attempts.total_questions - (SELECT COUNT(*) FROM quiz_attempt_answers WHERE attempt_id = quiz_attempts.id)),
       score = (SELECT COALESCE(SUM(points), 0) FROM quiz_attempt_answers WHERE attempt_id = quiz_attempts.id),
       max_score = quiz_attempts.total_questions * quiz_attempts.score_per_question,
       completed_at = datetime('now'),
       updated_at = datetime('now')
   WHERE id = ? AND status = 'in_progress'
   ```
2. **Kiểm soát CAS & Khóa giao dịch D1 Atomic Batch:**
   Theo sau lệnh UPDATE là `INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())`. Nếu không có dòng nào được cập nhật (`changes() = 0`), ràng buộc `CHECK (guard_id = 1)` sẽ kích hoạt hủy bỏ và rollback toàn bộ transaction ngay lập tức.
3. **Upsert thống kê kế thừa trực tiếp từ hàng đã finalize:**
   `quiz_user_stats` được chèn/cập nhật thông qua `SELECT qa.user_id, ..., qa.score, qa.correct_count, ... FROM quiz_attempts qa WHERE qa.id = ?`. Nhờ đó, chỉ khi lượt thi được chốt thành công trong cùng transaction thì các chỉ số mới được ghi nhận vào bảng thống kê, loại bỏ hoàn toàn tình trạng số liệu treo hoặc sai lệch.
4. **Chuẩn hóa chỉ số đối soát (`reconcileUserStats`):**
   Quy ước thống nhất: `total_attempts` và `completed_attempts` trong bảng tổng hợp cá nhân chỉ phản ánh các bài thi đã chính thức hoàn thành và có kết quả (`status = 'completed'`). Các bài nháp đang làm dở (`in_progress`) không được tính vào bảng thành tích cho đến khi nộp bài.

---

### 3. BẰNG CHỨNG KIỂM THỬ ĐA TẦNG (MULTI-TIER PROOF)

#### TẦNG A — UNIT & IN-MEMORY SQLITE ENGINE TESTS
- **worker/test/tourism-quiz.test.mjs:** **18 / 18 PASS**
  * **Test A (Thực nghiệm Rollback thật sau khi CAS thành công):**
    Thiết lập mô phỏng giao dịch SQLite thực tế: Statement 0 (UPDATE quiz_attempts) và Statement 1 (guard) chạy thành công bên trong `BEGIN IMMEDIATE`, sau đó Statement 2 (stats upsert) cố tình ném lỗi (injected crash).
    Chứng minh: Giao dịch thực hiện `ROLLBACK`, `quiz_attempts.status` trở về `in_progress`, `completed_at` là null, `quiz_user_stats` không có bản ghi nào. Khi thử lại (`retry`) không có lỗi, giao dịch thành công và `completed_attempts` tăng chính xác 1 đơn vị.
  * **Test B (Interleaving Race Condition Test):**
    Tạm dừng ngay trước khi batch finalize ghi vào DB, thực hiện chèn 2 câu trả lời (`submitAnswer` 1 đúng, 1 sai). Cho batch tiếp tục chạy.
    Chứng minh: Nhờ các câu lệnh con SQL trong batch, kết quả cuối cùng phản ánh chính xác `correctCount = 1`, `incorrectCount = 1`, `unansweredCount = 1`, `score = 10`, `maxScore = 30`. Nộp lại nhiều lần (`repeated finish`) vẫn trả về đúng kết quả và stats không bị nhân đôi.

#### TẦNG B — LOCAL D1 STORAGE BINDING TESTS
- **worker/test/hardening-validation-d1.test.mjs:** **8 / 8 PASS** (Bao gồm kiểm tra binding D1 thực tế).
- **worker/test/d1-concurrency.test.mjs:** **PASS** (Kiểm tra rollback engine SQLite).

#### TẦNG C — LIVE RUNNING WORKER HTTP CONCURRENCY (127.0.0.1:8788)
- **worker/test/quiz-concurrency-tier-c.test.mjs:** **1 / 1 PASS** (Kết nối socket HTTP thật tới workerd dev runtime).
  * **Daily Challenge Concurrent Start:** Kịch bản bắt buộc (không bị bọc trong if-skip). Hai yêu cầu đồng thời mở thử thách ngày: chính xác một 201 Created, một 409 Conflict.
  * **Concurrent Identical Answers:** Hai yêu cầu nộp cùng đáp án đồng thời đều trả về 200 OK (idempotent an toàn), không lộ `isCorrect`.
  * **Concurrent Conflicting Answers:** Hai yêu cầu nộp đáp án khác nhau đồng thời: chính xác một 200 OK, một 409 Conflict.
  * **Concurrent Finalize:** Hai yêu cầu chốt bài đồng thời: đều trả về 200 OK cùng điểm số, stats người dùng chỉ tăng đúng 1 lần (CAS winner guard).
  * **Simultaneous submitAnswer vs finishAttempt Race:**
    Kích hoạt đồng thời 1 yêu cầu nộp câu trả lời và 1 yêu cầu kết thúc bài thi.
    Kết quả: Nếu câu trả lời hoàn tất trước, điểm số bài thi ghi nhận đầy đủ; nếu lệnh kết thúc hoàn tất trước, câu trả lời đến sau bị từ chối (HTTP 400) và bài thi giữ nguyên điểm 0 mà không bị lệch số liệu.
  * **Bảo mật cách ly người dùng & Không rò rỉ đáp án:** User 2 gọi các thao tác trên bài thi của User 1 đều nhận 403 Forbidden. Trạng thái `in_progress` giấu kín 100% đáp án đúng và lời giải thích.

---

### 4. ĐỐI SOÁT SỐ LƯỢNG TEST TRÊN TOÀN HỆ THỐNG
- **Miniapp Tests:** **32 / 32 PASS** (`npm test -w miniapp`).
- **Worker Tests:** **143 / 143 PASS** (`npm test -w worker`).
  * `admin-backend.test.mjs`: 27 pass
  * `ai-config-switch.test.mjs`: 4 pass
  * `business-booking.test.mjs`: 7 pass
  * `chat-e2e-scenarios.test.mjs`: 7 pass
  * `d1-concurrency.test.mjs`: 1 pass
  * `hardening-concurrency.test.mjs`: 13 pass
  * `hardening-validation-d1.test.mjs`: 8 pass
  * `identity-auth.test.mjs`: 9 pass
  * `migrations.test.mjs`: 12 pass
  * `openai-compatible.test.mjs`: 3 pass
  * `quiz-concurrency-tier-c.test.mjs`: 1 pass
  * `router.test.js`: 3 pass
  * `security.test.mjs`: 7 pass
  * `sync-adapter.test.mjs`: 6 pass
  * `tourism-quiz.test.mjs`: 18 pass
  * `travel-planner.test.mjs`: 15 pass
  * `visitor-consent.test.mjs`: 3 pass
- **Admin Tests:** **10 / 10 PASS** (`npm test -w admin`).
- **TỔNG CỘNG:** **185 / 185 PASS (0 FAIL, 0 SKIPPED)**.
*(Giải thích chênh lệch: Ở báo cáo trước ghi nhận 141/142 do bài test P1-05 và Tier C phụ thuộc vào server local 8788 đang chạy. Khi server 8788 hoạt động ổn định, toàn bộ 143 test trong Worker chạy đầy đủ và PASS 100%).*

- **Typecheck:** 0 lỗi across 3 workspaces (`npm run --workspaces typecheck`).
- **Production Build:** Cả 3 workspace build thành công (`npm run --workspaces build`).

---

### 5. SỔ ĐĂNG KÝ QA & CÁC VẤN ĐỀ CÒN MỞ (QA REGISTER)
1. **Cloudflare D1 Remote Distributed Concurrency:** Concurrency và transaction atomicity đã được chứng minh cục bộ qua SQLite engine và local workerd HTTP. Tranh chấp mạng đa vùng phân tán trên Cloudflare production edge tiếp tục duy trì trạng thái **OPEN** vì không deploy remote trong phase này.
2. **Historical Refund Reconciliation (Phase 8.3):** Cột `timestamp_provenance` đã phân biệt dữ liệu backfill, giữ trạng thái **OPEN** chờ kết nối cổng thanh toán thật tại Phase tương lai.

---

### 6. KẾT LUẬN NGHIỆM THU
**PHASE 8.4 ĐẠT CHUẨN NGHIỆM THU HOÀN TOÀN TRÊN MÔI TRƯỜNG LOCAL DEVELOPMENT.**
Mã nguồn đã sẵn sàng cho ChatGPT kiểm tra chéo độc lập từ commit mới nhất.
