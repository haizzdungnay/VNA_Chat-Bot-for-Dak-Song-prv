# BÁO CÁO NGHIỆM THU KỸ THUẬT — PHASE 8.4
## HỆ THỐNG QUIZ DU LỊCH, THỬ THÁCH HÀNG NGÀY & QUẢN TRỊ NGÂN HÀNG CÂU HỎI

---

### 1. THÔNG TIN GIT & BASELINE
- **Repository:** `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
- **Base Branch:** `feature/phase8-business-booking`
- **Base Commit:** `df26cc587d7814bbbf81bcd440a498112e42d700` (Phase 8.3.2 baseline)
- **Active Feature Branch:** `feature/phase8-tourism-quiz`
- **Trạng thái nhánh chính (`main`):** Giữ nguyên tuyệt đối (`c2d7673`), không merge khi chưa có lệnh.
- **Môi trường vận hành:** Localhost first (`http://localhost:5173`, `http://localhost:3001`, `http://127.0.0.1:8788`). Không triển khai Cloudflare Workers/Pages remote.

---

### 2. MÔ HÌNH DỮ LIỆU & MIGRATION D1
- **Additive Migration:** `worker/migrations/0011_tourism_quiz.sql` (Áp dụng nối tiếp sau `0001` – `0010`, bảo toàn 100% dữ liệu trước đó).
- **Các bảng thực thể chuẩn hóa:**
  1. `quiz_categories`: 5 danh mục câu hỏi (Thiên nhiên & Cảnh quan, Văn hóa & Bản sắc, Ẩm thực địa phương, Địa điểm du lịch, Kiến thức Đắk Song).
  2. `quiz_questions`: 8 câu hỏi xác thực tư liệu gốc (liên kết `places`, `articles`), hỗ trợ `single_choice` và `true_false`, quản lý vòng đời `draft -> published -> archived`, quản lý phiên bản `version`.
  3. `quiz_question_options`: 30 phương án trả lời có thứ tự, gắn cờ `is_correct` (ràng buộc CHECK chỉ 0 hoặc 1).
  4. `quiz_collections`: Bộ đề câu hỏi gom nhóm theo chủ đề, hỗ trợ chọn thủ công hoặc tự động ngẫu nhiên.
  5. `quiz_collection_questions`: Quan hệ N-N lưu trữ câu hỏi và thứ tự trong từng bộ đề.
  6. `quiz_challenges`: Cấu hình Thử thách hàng ngày (ràng buộc `UNIQUE(business_date)`, tính giờ countdown, điểm mỗi câu).
  7. `quiz_attempts`: Lượt thi của người dùng (`attempt_type`, điểm số, thời gian bắt đầu, hạn chót, thời gian nộp bài).
     - Ràng buộc chặn thi lặp: `idx_quiz_attempts_daily_user_challenge` và `idx_quiz_attempts_daily_user_date` UNIQUE partial index trên `attempt_type = 'daily_challenge'`.
  8. `quiz_attempt_questions`: Snapshot nội dung câu hỏi và xáo trộn vị trí đáp án (A, B, C, D) theo từng phiên làm bài để đảm bảo tính nhất quán khi tải lại trang, che giấu đáp án đúng.
  9. `quiz_attempt_answers`: Lưu câu trả lời người dùng chọn kèm kết quả và điểm số do server chấm (ràng buộc UNIQUE theo lượt và câu hỏi).
  10. `quiz_user_stats`: Bảng tổng hợp thành tích cá nhân (tổng điểm, số bài hoàn thành, thử thách ngày, điểm cao nhất).

---

### 3. CHỨC NĂNG QUẢN TRỊ ADMIN BACKOFFICE (`http://localhost:3001`)
Được tích hợp vào nhóm điều hướng **TRÒ CHƠI & TƯƠNG TÁC** trên Sidebar Admin:
1. **Ngân hàng câu hỏi (`QuizQuestionsPage.tsx`):**
   - Xem danh sách câu hỏi kèm phân trang, tìm kiếm từ khóa, lọc theo danh mục, độ khó, loại câu hỏi và trạng thái xuất bản.
   - Biên tập câu hỏi: Form trực quan nhập nội dung, giải thích, thêm/xóa phương án trả lời, chọn đáp án đúng.
   - Xem trước (Preview) giao diện câu hỏi như khi hiển thị cho du khách.
   - Quy trình xuất bản an toàn: Tạo nháp (`draft`) -> Xuất bản (`published`) -> Lưu trữ (`archived`) -> Khôi phục nháp -> Nhân bản câu hỏi (`duplicate`).
   - Kiểm tra ràng buộc tư liệu: Bắt buộc gắn nguồn tham chiếu (`places`, `articles` hoặc tài liệu khảo sát), chống XSS stored.
2. **Bộ đề & Thử thách (`QuizChallengesPage.tsx`):**
   - Tạo bộ đề: Chế độ chọn thủ công từng câu hỏi đã xuất bản hoặc chọn tự động theo tiêu chí.
   - Lên lịch Thử thách hàng ngày: Thiết lập ngày áp dụng (`business_date` theo giờ Việt Nam), bộ đề tương ứng, thời gian giới hạn làm bài và điểm số mỗi câu.
   - Thao tác đóng/ngắt thử thách an toàn mà không làm lỗi các lượt thi đang diễn ra.
3. **Kết quả & Thống kê (`QuizAnalyticsPage.tsx`):**
   - KPI Dashboard: Tổng câu hỏi đã xuất bản, câu hỏi nháp, lượt tham gia, du khách độc lập, điểm trung bình, tỷ lệ trả lời đúng (%).
   - Phân tích chất lượng câu hỏi (Question Quality Analysis): Liệt kê các câu hỏi có tỷ lệ trả lời sai cao nhất để ban biên tập hoàn thiện tư liệu.
   - Xuất báo cáo CSV: Có UTF-8 BOM hiển thị chuẩn tiếng Việt trên Excel, lọc theo ngày, chống CSV Formula Injection (escape `'=+-@`).

---

### 4. TRẢI NGHIỆM DU KHÁCH TRÊN MINI APP (`http://localhost:5173`)
1. **Trang chủ Quiz (`/quiz`):**
   - Thẻ Thử thách ngày nổi bật: Hiển thị ngày thi, số câu hỏi, thời gian và điểm số. Nhận diện trạng thái đã thi hay chưa thi.
   - Luyện tập tự do: Tùy biến chọn danh mục, độ khó và số lượng câu hỏi (3, 5, 8 câu).
   - Thống kê cá nhân: Điểm Quiz tích lũy, số bài đã hoàn thành.
   - Banner trực quan từ Trang chủ (`/`) và nút Quiz trên thanh tiêu đề đầu trang.
2. **Màn hình làm bài tương tác (`/quiz/play`):**
   - Giao diện tập trung, ẩn thanh điều hướng dưới.
   - Thanh tiến độ câu hỏi (Câu X/Y) và đồng hồ đếm ngược (nếu có giới hạn thời gian).
   - Danh sách phương án trả lời xáo trộn công bằng.
   - Nút xác nhận câu trả lời -> khóa phương án chống đổi ý gian lận -> câu tiếp theo.
3. **Màn hình kết quả & chấm điểm (`/quiz/result/:id`):**
   - Hiển thị điểm số chính thức, số câu đúng, câu sai, câu bỏ qua.
   - Rà soát từng câu: Hiện đáp án du khách chọn, đáp án đúng chuẩn xác kèm phần giải thích tư liệu văn hóa Đắk Song.
   - Nút liên kết trực tiếp tới chi tiết điểm đến (`/place/:id`) để tiếp tục hành trình khám phá.
4. **Lịch sử làm bài (`/quiz/history`):**
   - Danh sách các bài thi trước đó của riêng người dùng đó (bảo vệ phân quyền, không rò rỉ dữ liệu chéo).

---

### 5. BẢO MẬT & SERVER-AUTHORITATIVE ENGINE
- **Chấm điểm độc quyền tại Server:** Client không gửi điểm số hoặc cờ đúng/sai. Server đối chiếu với snapshot đáp án trong database.
- **Che giấu đáp án tuyệt đối:** API `GET /api/quiz/attempts/:id` khi bài thi đang diễn ra (`in_progress`) loại bỏ hoàn toàn `correct_option_id`, `explanation`, và cờ `is_correct`.
- **Chống thi lặp Daily Challenge:** Sử dụng UNIQUE index cấp cơ sở dữ liệu trên `(user_id, business_date)`, chặn triệt để tình trạng double-click, race condition đồng thời và trả HTTP 409 Conflict.
- **Idempotency câu trả lời:** Nộp lại cùng một đáp án trả về thành công an toàn, nộp đáp án khác bị chặn với 409 Conflict.
- **Kiểm soát hết giờ:** Khi hết hạn `expires_at`, server tự động hoàn tất và chấm điểm.
- **Chuẩn bị tích hợp Phase 8.5:** Điểm số được định danh là **Điểm Quiz / Điểm kiến thức**, độc lập hoàn toàn, không quy đổi tiền tệ và không phát hành voucher giả.

---

### 6. TỔNG HỢP KIỂM THỬ & CHẤT LƯỢNG
- **Miniapp Tests:** **32 / 32 PASS** (`test/fe-logic.test.mjs`, `test/fe-auth.test.mjs`, `test/fe-planner.test.mjs`, `test/fe-booking.test.mjs`, `test/fe-quiz.test.mjs`).
- **Worker Backend Tests:** **133 / 133 PASS** (Bao gồm bộ kiểm thử `test/tourism-quiz.test.mjs` 10 bài test nghiệp vụ & E2E).
- **Admin Dashboard Tests:** **10 / 10 PASS** (`test/admin-ui.test.mjs`, `test/admin-business.test.mjs`, `test/admin-quiz.test.mjs`).
- **Tổng số test toàn dự án:** **175 / 175 PASS**.
- **TypeScript Typecheck:** 0 lỗi across 3 workspaces (`miniapp`, `worker`, `admin`).
- **Production Build:** Cả 3 workspace build thành công.
- **Tích hợp D1 thực tế:** D1 local database đã apply đủ migration `0011`, 8 câu hỏi, 5 danh mục, 1 bộ đề, 1 thử thách, 0 vi phạm foreign key.

---

### 7. HƯỚNG DẪN KIỂM TRA ĐỘC LẬP TRÊN LOCALHOST
1. **Trang Quản trị Admin:** Mở trình duyệt tại `http://localhost:3001`
   - Nhấn tab **Ngân hàng câu hỏi**: Xem 8 câu hỏi đã duyệt, bấm "+ Thêm câu hỏi mới", nhập thử câu hỏi, lưu nháp, duyệt và nhân bản.
   - Nhấn tab **Bộ đề & Thử thách**: Xem thử thách hôm nay, tạo bộ đề mới.
   - Nhấn tab **Kết quả & Thống kê**: Xem các chỉ số KPI, bảng câu hỏi hay sai nhất và xuất CSV.
2. **Trang Du khách Mini App:** Mở trình duyệt tại `http://localhost:5173`
   - Tại Trang chủ, nhấn banner "Thử thách Du lịch Đắk Song" hoặc icon Quiz trên đầu trang để vào `/quiz`.
   - Chọn "Bắt đầu Thử thách ngay" hoặc chọn danh mục để "Vào phòng Luyện tập".
   - Trả lời các câu hỏi, bấm "Xác nhận câu trả lời" và "Hoàn thành & Xem kết quả".
   - Xem lại điểm số, giải thích chi tiết và bấm liên kết xem điểm đến.
