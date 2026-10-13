# VNA GROUP — CODEX IMPLEMENTATION REPORT
## PHASE 8.4.1 — TOURISM QUIZ CORRECTIVE PATCH & SECURITY HARDENING

---

### 1. THÔNG TIN PHIÊN BẢN & GIT BASELINE
- **Repository:** `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
- **Branch:** `feature/phase8-tourism-quiz` (duy trì trên nhánh hiện hành, không tạo nhánh mới).
- **Starting HEAD:** `43061806c73d53bd730b896c975c6b8d1c5b1475` (Phase 8.4 baseline).
- **Trạng thái nhánh chính (`main`):** Giữ nguyên tuyệt đối commit `c2d7673` (`v1.0.0-mvp`), không merge khi chưa có yêu cầu trực tiếp.
- **Môi trường chạy nghiệm thu:** Localhost (`http://localhost:5173`, `http://localhost:3001`, `http://127.0.0.1:8788`). Không chạy deploy remote, không áp dụng remote D1.

---

### 2. NGUYÊN NHÂN GỐC & CÁC LỖ HỔNG ĐÃ KHẮC PHỤC

#### P1-01: SERVER-AUTHORITATIVE CONFIGURABLE SCORING
- **Nguyên nhân gốc:**
  - Trong `quiz.service.ts`, hàm `submitAnswer` cố định `points = isCorrect ? 10 : 0`.
  - Các hàm `getAttempt` và `finishAttempt` tính `maxScore = total_questions * 10`.
  - Bảng `quiz_challenges` có trường cấu hình `score_per_question` (cho phép 20, 50 điểm/câu), nhưng điểm số thực tế khi thi và kết quả trả về không tuân theo cấu hình này.
  - Bảng `quiz_attempts` thiếu trường lưu trữ điểm snapshot của từng lượt thi, dẫn đến nguy cơ nếu Admin sửa điểm của thử thách sau đó, các bài thi đã làm trong quá khứ có thể bị tính toán sai lệch hoặc mất tính bất biến lịch sử.
- **Giải pháp xử lý:**
  1. Tạo migration bổ sung `worker/migrations/0012_quiz_scoring_and_schedule.sql` thêm cột `score_per_question INTEGER NOT NULL DEFAULT 10` vào `quiz_attempts`.
  2. Tại thời điểm bắt đầu lượt thi (`startAttempt`):
     - Thử thách ngày (`daily_challenge`): snapshot bất biến `score_per_question` từ cấu hình thử thách (xác thực số nguyên dương an toàn `Number.isSafeInteger`, phạm vi 1 đến 1000).
     - Luyện tập tự do (`practice`): áp dụng mặc định minh bạch 10 điểm/câu.
     - Khởi tạo `max_score = total_questions * score_per_question`.
  3. Khi nộp đáp án (`submitAnswer`): điểm cộng bằng chính xác `attempt.score_per_question` đã snapshot.
  4. Khi hoàn thành bài thi (`finishAttempt`): truy vấn tổng kết điểm chính thức từ `quiz_attempt_answers` (`SUM(points)`), cập nhật `max_score = total_questions * score_per_question`.
  5. Tính tương thích ngược với dữ liệu cũ (Legacy): với các bản ghi tạo trước bản vá (chưa có trường này), fallback mặc định 10 điểm an toàn, bảo toàn 100% kết quả lịch sử.
  6. Tính bất biến lịch sử: Việc Admin sửa `score_per_question` của thử thách trong tương lai tuyệt đối không làm biến đổi điểm số, điểm tối đa hay tỷ lệ phần trăm của các bài thi đã hoàn thành trước đó.

#### P1-02: DAILY CHALLENGE SCHEDULE ENFORCEMENT
- **Nguyên nhân gốc:**
  - Trong `startAttempt`, chỉ kiểm tra ngày `business_date` mà chưa đối chiếu khung giờ `opening_time` và `closing_time`.
  - Một thử thách ở trạng thái `scheduled` có thể bị mở thi trước giờ quy định nếu ngày trùng khớp; hoặc du khách vẫn có thể mở thi sau giờ đóng cửa.
- **Giải pháp xử lý:**
  1. Xây dựng hàm kiểm soát thời gian chuẩn Việt Nam (`getVietnamDateTime` dựa trên timezone `Asia/Ho_Chi_Minh`, +07:00).
  2. Xây dựng hàm chuẩn hóa giờ `normalizeTimeString` (`HH:mm:ss`) và hàm đánh giá lịch trình `evaluateChallengeSchedule`:
     - Nếu `vnNow.timeStr < opening_time`: trạng thái hiệu lực là `scheduled` ("Thử thách chưa mở (Thời gian mở: HH:mm:ss)"), chặn mở thi (`isOpen: false`).
     - Nếu `vnNow.timeStr > closing_time`: trạng thái hiệu lực là `closed` ("Thử thách đã đóng cửa lúc HH:mm:ss"), chặn mở thi (`isOpen: false`).
     - Nếu nằm trong `[opening_time, closing_time]`: trạng thái hiệu lực là `active`, cho phép mở thi (`isOpen: true`).
  3. Tự động hóa trạng thái: Thử thách `scheduled` đến đúng ngày và giờ mở sẽ tự động chuyển thành `active` theo giờ máy chủ mà không cần thao tác bấm mở thủ công lúc nửa đêm.
  4. Bảo toàn lượt thi đang làm dở (`Ongoing attempt preservation`): Tách bạch rõ giữa "hạn chót nhận lượt thi mới" (`closing_time`) và "hạn chót nộp bài của từng lượt" (`expires_at`). Một du khách đã mở bài thi hợp lệ trước giờ đóng cửa vẫn được phép nộp đáp án và hoàn thành bài thi bình thường nếu chưa vượt quá thời gian làm bài (`expires_at`).
  5. Xác thực chặt chẽ tại tầng Admin: Chặn tạo thử thách có giờ mở sau hoặc bằng giờ đóng (`opening_time >= closing_time`), chặn điểm số âm/thập phân/vượt ngưỡng 1000, chặn thời gian làm bài âm.

#### KIỂM ĐỊNH CONCURRENCY & BẢO MẬT
1. **Idempotency & Race Condition trong `submitAnswer`:**
   - Kết hợp kiểm tra bản ghi có sẵn và bắt ngoại lệ `UNIQUE constraint failed: quiz_attempt_answers.attempt_id, quiz_attempt_answers.attempt_question_id`.
   - Nếu nộp lại cùng một phương án: trả về hợp lệ an toàn (`alreadyAnswered: true`).
   - Nếu nộp phương án khác: trả về 409 Conflict rõ ràng.
2. **CAS & Chống gian lận điểm trong `finishAttempt`:**
   - Sử dụng câu lệnh CAS atomic: `UPDATE quiz_attempts ... WHERE id = ? AND status = 'in_progress'`.
   - Chỉ khi CAS thực sự thay đổi 1 dòng (`changes === 1`) thì mới ghi nhận tăng số bài vào `quiz_user_stats`. Hai request đồng thời gọi kết thúc bài thi sẽ chỉ có 1 request thắng CAS, ngăn chặn triệt để lỗi cộng trùng điểm hoặc tăng gấp đôi số bài thi hoàn thành.

---

### 3. DANH SÁCH TẬP TIN THAY ĐỔI
- `worker/migrations/0012_quiz_scoring_and_schedule.sql` (Migration mới, thêm cột `score_per_question`).
- `worker/src/types/index.ts` (Bổ sung `score_per_question` trong `QuizAttemptRow`).
- `worker/src/services/quiz.service.ts` (Thời gian VN, snapshot điểm số, thẩm định khung giờ, CAS hoàn thành bài thi).
- `worker/src/services/admin-quiz.service.ts` (Xác thực khung giờ và điểm số khi tạo thử thách).
- `worker/test/migrations.test.mjs` (Kiểm thử migration 0001 -> 0012).
- `worker/test/tourism-quiz.test.mjs` (Bổ sung 4 bộ test chuyên sâu cho P1-01 và P1-02).
- `miniapp/src/types/index.ts` (Bổ sung `scorePerQuestion`, `openingTime`, `closingTime`, `reason`).
- `miniapp/src/pages/quiz.tsx` (Hiển thị khung giờ mở/đóng, điểm số mỗi câu, vô hiệu hóa nút thi khi chưa mở).
- `miniapp/src/pages/quiz-play.tsx` (Thông báo điểm cộng thực tế theo lượt thi).
- `miniapp/src/pages/quiz-result.tsx` (Hiển thị điểm đạt được từng câu theo điểm snapshot).
- `admin/src/pages/QuizChallengesPage.tsx` (Thêm ô chọn giờ mở và giờ đóng cho Admin).

---

### 4. BẰNG CHỨNG KIỂM THỬ TOÀN BỘ SUITE

#### 4.1. Unit & Integration Test Suites
- **Miniapp Tests:** **32 / 32 PASS** (`npm test -w miniapp`).
- **Worker Tests:** **138 / 138 PASS** (`npm test -w worker`).
  * `test/router.test.js`: PASS
  * `test/security.test.mjs`: PASS
  * `test/migrations.test.mjs`: 12/12 PASS (Bao gồm migration 0011 và 0012)
  * `test/travel-planner.test.mjs`: PASS
  * `test/business-booking.test.mjs`: PASS
  * `test/hardening-concurrency.test.mjs`: PASS
  * `test/hardening-validation-d1.test.mjs`: PASS (Bao gồm Live Wrangler integration P1-05)
  * `test/tourism-quiz.test.mjs`: 14/14 PASS (Bao gồm 4 bài test P1-01 snapshot điểm 20 & P1-02 kiểm soát khung giờ)
- **Admin Dashboard Tests:** **10 / 10 PASS** (`npm test -w admin`).
- **TỔNG CỘNG TEST:** **180 / 180 PASS** (0 FAIL, 0 SKIPPED).

#### 4.2. TypeScript Typecheck
- `npm run --workspaces typecheck`: **0 lỗi** across 3 workspaces (`miniapp`, `worker`, `admin`).

#### 4.3. Production Build
- `npm run --workspaces build`: **Cả 3 workspace build thành công 100%**.

#### 4.4. Live Local Servers Status
- `http://localhost:5173` (Miniapp Web): **HTTP 200 OK**
- `http://localhost:3001` (Admin Dashboard): **HTTP 200 OK**
- `http://127.0.0.1:8788/api/health` (Worker API): **HTTP 200 OK**

---

### 5. SỔ ĐĂNG KÝ QA & CÁC VẤN ĐỀ CÒN MỞ (QA REGISTER)
Theo nguyên tắc trung thực kỹ thuật của dự án, các mục sau tiếp tục được ghi nhận trên sổ QA register:
1. **Concurrency D1 remote:** Mặc dù kiểm thử concurrency cục bộ (Real Node SQLite Engine) đã chứng minh CAS và Rollback hoạt động chuẩn xác, bài test tranh chấp mạng phân tán đa vùng của Cloudflare D1 trên remote worker vẫn được giữ ở trạng thái **OPEN** do chính sách không triển khai remote trong các phase nội bộ.
2. **Historical Refund Reconciliation (Phase 8.3):** Cột `timestamp_provenance` đã phân biệt dữ liệu backfill, nhưng việc đối chiếu ngân hàng thực tế chỉ được kích hoạt khi tích hợp cổng thanh toán chính thức ở Phase tương lai.

---

### 6. KẾT LUẬN NGHIỆM THU PHASE 8.4.1
- **P1-01 (Server-Authoritative Configurable Scoring):** **PASS**
- **P1-02 (Daily Challenge Schedule Enforcement):** **PASS**
- **Idempotency & Concurrency Hardening:** **PASS**
- **Regression Toàn Bộ Workspace:** **PASS (180/180)**
- **Khuyến nghị:** **CHẤP NHẬN BẢN VÁ PHASE 8.4.1.** Sẵn sàng tiến tới Phase 8.5 khi có yêu cầu.
