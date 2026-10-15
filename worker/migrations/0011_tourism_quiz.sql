-- Migration 0011: Tourism Quiz, Daily Challenge & Question Bank Management

-- 1. Quiz Categories
CREATE TABLE IF NOT EXISTS quiz_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  question_type TEXT NOT NULL CHECK(question_type IN ('single_choice', 'true_false')),
  category_id TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard')),
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('place', 'article', 'manual')),
  source_reference TEXT,
  related_place_id TEXT,
  related_article_id TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES quiz_categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (related_place_id) REFERENCES places(id) ON DELETE SET NULL,
  FOREIGN KEY (related_article_id) REFERENCES articles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_category ON quiz_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_status ON quiz_questions(status);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_code ON quiz_questions(code);

-- 3. Quiz Question Options
CREATE TABLE IF NOT EXISTS quiz_question_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  option_key TEXT NOT NULL,
  option_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  UNIQUE(question_id, option_key)
);

CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON quiz_question_options(question_id);

-- 4. Quiz Collections
CREATE TABLE IF NOT EXISTS quiz_collections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT,
  difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard', 'mixed')),
  selection_mode TEXT NOT NULL DEFAULT 'manual' CHECK(selection_mode IN ('manual', 'auto')),
  question_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES quiz_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_collections_status ON quiz_collections(status);

-- 5. Quiz Collection Questions
CREATE TABLE IF NOT EXISTS quiz_collection_questions (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (collection_id) REFERENCES quiz_collections(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE RESTRICT,
  UNIQUE(collection_id, question_id),
  UNIQUE(collection_id, order_index)
);

-- 6. Quiz Daily Challenges
CREATE TABLE IF NOT EXISTS quiz_challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  business_date TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  opening_time TEXT NOT NULL DEFAULT '00:00:00',
  closing_time TEXT NOT NULL DEFAULT '23:59:59',
  time_limit_seconds INTEGER NOT NULL DEFAULT 0,
  score_per_question INTEGER NOT NULL DEFAULT 10,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'active', 'closed', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (collection_id) REFERENCES quiz_collections(id) ON DELETE RESTRICT,
  UNIQUE(business_date)
);

CREATE INDEX IF NOT EXISTS idx_quiz_challenges_date ON quiz_challenges(business_date);
CREATE INDEX IF NOT EXISTS idx_quiz_challenges_status ON quiz_challenges(status);

-- 7. Quiz User Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge_id TEXT,
  collection_id TEXT,
  attempt_type TEXT NOT NULL CHECK(attempt_type IN ('daily_challenge', 'practice')),
  business_date TEXT,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'expired', 'abandoned')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES quiz_challenges(id) ON DELETE SET NULL,
  FOREIGN KEY (collection_id) REFERENCES quiz_collections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON quiz_attempts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_daily_user_challenge ON quiz_attempts(user_id, challenge_id) WHERE attempt_type = 'daily_challenge';
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_attempts_daily_user_date ON quiz_attempts(user_id, business_date) WHERE attempt_type = 'daily_challenge';

-- 8. Quiz Attempt Questions (Snapshot)
CREATE TABLE IF NOT EXISTS quiz_attempt_questions (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  category_name TEXT,
  difficulty TEXT,
  explanation TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_option_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE RESTRICT,
  UNIQUE(attempt_id, question_id),
  UNIQUE(attempt_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempt_questions_attempt ON quiz_attempt_questions(attempt_id);

-- 9. Quiz Attempt Answers
CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  attempt_question_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_option_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
  points INTEGER NOT NULL DEFAULT 0,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (attempt_question_id) REFERENCES quiz_attempt_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE RESTRICT,
  UNIQUE(attempt_id, attempt_question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_attempt ON quiz_attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_question ON quiz_attempt_answers(question_id);

-- 10. Quiz User Aggregate Stats
CREATE TABLE IF NOT EXISTS quiz_user_stats (
  user_id TEXT PRIMARY KEY,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  completed_attempts INTEGER NOT NULL DEFAULT 0,
  daily_challenges_completed INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_questions_answered INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- SEED INITIAL VERIFIED TOURISM QUIZ CONTENT
-- ==========================================

-- Seed Categories
INSERT INTO quiz_categories (id, slug, name, description, icon) VALUES
  ('cat-quiz-nature', 'thien-nhien-canh-quan', 'Thiên nhiên & Cảnh quan', 'Các thắng cảnh rừng, thác, núi và khu bảo tồn Đắk Song', 'park'),
  ('cat-quiz-culture', 'van-hoa-ban-sac', 'Văn hóa & Bản sắc', 'Không gian văn hóa cồng chiêng, buôn làng M''nông, nhà Rông', 'festival'),
  ('cat-quiz-cuisine', 'am-thuc-dia-phuong', 'Ẩm thực địa phương', 'Đặc sản nướng, cá suối, cà phê và ẩm thực Tây Nguyên', 'restaurant'),
  ('cat-quiz-destinations', 'dia-diem-du-lich', 'Địa điểm du lịch', 'Các danh lam, cơ sở tâm linh, điểm check-in tiêu biểu', 'location_on'),
  ('cat-quiz-general', 'kien-thuc-dak-song', 'Kiến thức Đắk Song', 'Cánh đồng điện gió, địa lý và giao thông Đắk Song', 'lightbulb')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon;

-- Seed Verified Questions (8 questions)
-- Q1: Thác Lưu Ly
INSERT INTO quiz_questions (id, code, question_type, category_id, difficulty, question_text, explanation, source_type, source_reference, related_place_id, status, version) VALUES
  ('qz-q-001', 'QZ-001', 'single_choice', 'cat-quiz-nature', 'easy',
   'Thác Lưu Ly - một trong những thắng cảnh nổi tiếng của huyện Đắk Song - nằm ẩn mình trong quần thể khu bảo tồn thiên nhiên nào?',
   'Thác Lưu Ly thuộc địa phận xã Nâm N''Jang, huyện Đắk Song, nằm ẩn mình trong quần thể Khu bảo tồn thiên nhiên Nâm Nung xanh mát.',
   'place', 'c5e658bd-da7c-420d-9f5e-bdf8a61bcf42', 'c5e658bd-da7c-420d-9f5e-bdf8a61bcf42', 'published', 1)
ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, status = excluded.status;

INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index) VALUES
  ('qz-opt-001-a', 'qz-q-001', 'A', 'Khu bảo tồn thiên nhiên Nâm Nung', 1, 1),
  ('qz-opt-001-b', 'qz-q-001', 'B', 'Vườn quốc gia Tà Đùng', 0, 2),
  ('qz-opt-001-c', 'qz-q-001', 'C', 'Vườn quốc gia Yok Đôn', 0, 3),
  ('qz-opt-001-d', 'qz-q-001', 'D', 'Khu bảo tồn Chư Yang Sin', 0, 4)
ON CONFLICT(id) DO UPDATE SET option_text = excluded.option_text, is_correct = excluded.is_correct;

-- Q2: Cánh đồng điện gió Đắk Song
INSERT INTO quiz_questions (id, code, question_type, category_id, difficulty, question_text, explanation, source_type, source_reference, related_place_id, status, version) VALUES
  ('qz-q-002', 'QZ-002', 'single_choice', 'cat-quiz-general', 'medium',
   'Cánh đồng điện gió Đắk Song với các turbine gió khổng lồ trải dài trên các đồi đất đỏ bazan thuộc những xã nào?',
   'Cánh đồng điện gió Đắk Song gồm các dự án turbine gió trải dài qua các xã Nam Bình, Đắk Hòa, Thuận Hạnh, tạo nên cảnh quan kỳ vĩ trên cao nguyên bazan.',
   'place', 'vr360-dien-gio', 'vr360-dien-gio', 'published', 1)
ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, status = excluded.status;

INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index) VALUES
  ('qz-opt-002-a', 'qz-q-002', 'A', 'Nam Bình, Đắk Hòa, Thuận Hạnh', 1, 1),
  ('qz-opt-002-b', 'qz-q-002', 'B', 'Đắk Nia, Quảng Tân, Nhân Cơ', 0, 2),
  ('qz-opt-002-c', 'qz-q-002', 'C', 'Quảng Sơn, Quảng Hòa, Đắk R''măng', 0, 3),
  ('qz-opt-002-d', 'qz-q-002', 'D', 'Trường Xuân, Nâm N''Jang, Đắk Rung', 0, 4)
ON CONFLICT(id) DO UPDATE SET option_text = excluded.option_text, is_correct = excluded.is_correct;

-- Q3: Thiền Viện Trúc Lâm Đạo Nguyên
INSERT INTO quiz_questions (id, code, question_type, category_id, difficulty, question_text, explanation, source_type, source_reference, related_place_id, status, version) VALUES
  ('qz-q-003', 'QZ-003', 'single_choice', 'cat-quiz-destinations', 'easy',
   'Thiền Viện Trúc Lâm Đạo Nguyên tại Đắk Song là một cơ sở Phật giáo nổi tiếng nằm nép mình giữa không gian nào?',
   'Thiền Viện Trúc Lâm Đạo Nguyên tọa lạc giữa rừng thông và rừng nguyên sinh thuộc Khu bảo tồn thiên nhiên Nâm Nung, mang lại không gian thanh tịnh và khí hậu trong lành.',
   'place', 'beef28a3-316e-471c-8836-68f677697941', 'beef28a3-316e-471c-8836-68f677697941', 'published', 1)
ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, status = excluded.status;

INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index) VALUES
  ('qz-opt-003-a', 'qz-q-003', 'A', 'Rừng nguyên sinh Nâm Nung', 1, 1),
  ('qz-opt-003-b', 'qz-q-003', 'B', 'Đỉnh đồi chè Gia Nghĩa', 0, 2),
  ('qz-opt-003-c', 'qz-q-003', 'C', 'Thung lũng hồ Đắk R''Tih', 0, 3),
  ('qz-opt-003-d', 'qz-q-003', 'D', 'Khu du lịch hồ Tây Đắk Mil', 0, 4)
ON CONFLICT(id) DO UPDATE SET option_text = excluded.option_text, is_correct = excluded.is_correct;

-- Q4: Văn hóa cồng chiêng M'nông
INSERT INTO quiz_questions (id, code, question_type, category_id, difficulty, question_text, explanation, source_type, source_reference, related_place_id, status, version) VALUES
  ('qz-q-004', 'QZ-004', 'single_choice', 'cat-quiz-culture', 'easy',
   'Trong không gian sinh hoạt văn hóa truyền thống của đồng bào M''nông tại Đắk Song, đêm hội lửa trại thường gắn liền với loại hình nghệ thuật nào?',
   'Không gian sinh hoạt văn hóa của người M''nông tại Đắk Song nổi bật với nghệ thuật diễn tấu cồng chiêng Tây Nguyên, múa xoang truyền thống và thưởng thức rượu cần quanh bếp lửa.',
   'place', 'vr360-cong-dong-mnong', 'vr360-cong-dong-mnong', 'published', 1)
ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, status = excluded.status;

INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index) VALUES
  ('qz-opt-004-a', 'qz-q-004', 'A', 'Diễn tấu cồng chiêng và múa xoang', 1, 1),
  ('qz-opt-004-b', 'qz-q-004', 'B', 'Hát chèo cổ và múa xòe', 0, 2),
  ('qz-opt-004-c', 'qz-q-004', 'C', 'Đờn ca tài tử Nam Bộ', 0, 3),
  ('qz-opt-004-d', 'qz-q-004', 'D', 'Hát Then đàn Tính', 0, 4)
ON CONFLICT(id) DO UPDATE SET option_text = excluded.option_text, is_correct = excluded.is_correct;

-- Q5: Ẩm thực Mạ
INSERT INTO quiz_questions (id, code, question_type, category_id, difficulty, question_text, explanation, source_type, source_reference, related_article_id, status, version) VALUES
  ('qz-q-005', 'QZ-005', 'single_choice', 'cat-quiz-cuisine', 'medium',
   'Theo tập quán ẩm thực truyền thống của người Mạ tại Đắk Nông, phương thức chế biến món ăn phổ biến và đặc trưng nhất khi đi rừng, lên nương rẫy là gì?',
   'Người Mạ ưa thích chế biến thức ăn bằng cách nướng nguyên bản trên than hồng (như cá suối nướng kẹp thanh tre với chút muối ớt), giữ trọn vẹn hương vị ngọt mát tự nhiên của sông suối núi rừng.',
   'article', '0c62023b-2065-48a5-99e3-f332998893e5', '0c62023b-2065-48a5-99e3-f332998893e5', 'published', 1)
ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, status = excluded.status;

INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index) VALUES
  ('qz-opt-005-a', 'qz-q-005', 'A', 'Món nướng kẹp tre trên than hồng', 1, 1),
  ('qz-opt-005-b', 'qz-q-005', 'B', 'Chiên giòn ngập dầu gia vị', 0, 2),
  ('qz-opt-005-c', 'qz-q-005', 'C', 'Kho quẹt tiêu rừng đậm đặc', 0, 3),
  ('qz-opt-005-d', 'qz-q-005', 'D', 'Hầm nhừ cùng củ thảo quả', 0, 4)
ON CONFLICT(id) DO UPDATE SET option_text = excluded.option_text, is_correct = excluded.is_correct;

-- Q6: Hàng thông cảnh quan Quốc lộ 14
INSERT INTO quiz_questions (id, code, question_type, category_id, difficulty, question_text, explanation, source_type, source_reference, related_place_id, status, version) VALUES
  ('qz-q-006', 'QZ-006', 'single_choice', 'cat-quiz-nature', 'easy',
   'Đoạn đường Quốc lộ 14 chạy qua địa bàn huyện Đắk Song nổi tiếng với cảnh quan rợp bóng loài cây nào, mang đến không khí se lạnh tựa Đà Lạt?',
   'Hàng thông cảnh quan Quốc lộ 14 qua Đắk Song là cung đường biểu tượng với những hàng thông cổ thụ ngút ngàn hai bên đường, tạo cảm giác trong lành, mát mẻ quanh năm.',
   'place', 'vr360-hang-thong-ql14', 'vr360-hang-thong-ql14', 'published', 1)
ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, status = excluded.status;

INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index) VALUES
  ('qz-opt-006-a', 'qz-q-006', 'A', 'Rừng thông cổ thụ bạt ngàn', 1, 1),
  ('qz-opt-006-b', 'qz-q-006', 'B', 'Hàng cây cao su thẳng tắp', 0, 2),
  ('qz-opt-006-c', 'qz-q-006', 'C', 'Rừng trúc nhiệt đới', 0, 3),
  ('qz-opt-006-d', 'qz-q-006', 'D', 'Hàng cây muồng hoàng yến vàng', 0, 4)
ON CONFLICT(id) DO UPDATE SET option_text = excluded.option_text, is_correct = excluded.is_correct;

-- Q7: Đỉnh núi Nâm Nung
INSERT INTO quiz_questions (id, code, question_type, category_id, difficulty, question_text, explanation, source_type, source_reference, related_place_id, status, version) VALUES
  ('qz-q-007', 'QZ-007', 'single_choice', 'cat-quiz-nature', 'medium',
   'Đỉnh núi Nâm Nung trong Khu bảo tồn thiên nhiên Đắk Song có độ cao vượt trên bao nhiêu mét so với mực nước biển?',
   'Khu bảo tồn thiên nhiên Nâm Nung có đỉnh núi Nâm Nung cao hơn 1.500m, là mái nhà sinh thái che chở hệ thống thác nước và rừng nguyên sinh đa dạng của khu vực.',
   'place', '360a56b1-324d-40df-98e7-f7ad6ece2404', '360a56b1-324d-40df-98e7-f7ad6ece2404', 'published', 1)
ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, status = excluded.status;

INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index) VALUES
  ('qz-opt-007-a', 'qz-q-007', 'A', '1.500m', 1, 1),
  ('qz-opt-007-b', 'qz-q-007', 'B', '800m', 0, 2),
  ('qz-opt-007-c', 'qz-q-007', 'C', '2.800m', 0, 3),
  ('qz-opt-007-d', 'qz-q-007', 'D', '500m', 0, 4)
ON CONFLICT(id) DO UPDATE SET option_text = excluded.option_text, is_correct = excluded.is_correct;

-- Q8: Nhà Rông Tây Nguyên (True / False)
INSERT INTO quiz_questions (id, code, question_type, category_id, difficulty, question_text, explanation, source_type, source_reference, related_article_id, status, version) VALUES
  ('qz-q-008', 'QZ-008', 'true_false', 'cat-quiz-culture', 'easy',
   'Kiến trúc Nhà Rông truyền thống của các dân tộc Tây Nguyên sử dụng vật liệu xây dựng hiện đại như xi măng và sắt thép để kiên cố phần móng.',
   'Sai. Nhà Rông truyền thống Tây Nguyên hoàn toàn sử dụng nguyên vật liệu từ thiên nhiên núi rừng như gỗ quý, tranh, tre, nứa, lồ ô mà không dùng xi măng hay cốt thép.',
   'article', 'fe9c0492-8d50-483e-ae8c-539c5bba5d54', 'fe9c0492-8d50-483e-ae8c-539c5bba5d54', 'published', 1)
ON CONFLICT(id) DO UPDATE SET question_text = excluded.question_text, status = excluded.status;

INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index) VALUES
  ('qz-opt-008-a', 'qz-q-008', 'A', 'Đúng', 0, 1),
  ('qz-opt-008-b', 'qz-q-008', 'B', 'Sai', 1, 2)
ON CONFLICT(id) DO UPDATE SET option_text = excluded.option_text, is_correct = excluded.is_correct;

-- Seed Collection: "Khám phá Du lịch Đắk Song" (5 questions)
INSERT INTO quiz_collections (id, title, description, category_id, difficulty, selection_mode, question_count, status) VALUES
  ('col-dak-song-intro', 'Hành trình Khám phá Đắk Song', 'Bộ đề câu hỏi trắc nghiệm tìm hiểu thiên nhiên, văn hóa và danh thắng tiêu biểu tại Đắk Song', 'cat-quiz-general', 'mixed', 'manual', 5, 'published')
ON CONFLICT(id) DO UPDATE SET title = excluded.title, question_count = excluded.question_count, status = excluded.status;

INSERT INTO quiz_collection_questions (id, collection_id, question_id, order_index) VALUES
  ('col-q-001', 'col-dak-song-intro', 'qz-q-001', 1),
  ('col-q-002', 'col-dak-song-intro', 'qz-q-002', 2),
  ('col-q-003', 'col-dak-song-intro', 'qz-q-003', 3),
  ('col-q-004', 'col-dak-song-intro', 'qz-q-004', 4),
  ('col-q-005', 'col-dak-song-intro', 'qz-q-005', 5)
ON CONFLICT(id) DO UPDATE SET order_index = excluded.order_index;

-- Seed Daily Challenge for today (2026-10-12)
INSERT INTO quiz_challenges (id, title, description, business_date, collection_id, opening_time, closing_time, time_limit_seconds, score_per_question, max_attempts, status) VALUES
  ('ch-2026-10-12', 'Thử thách Du lịch Đắk Song hàng ngày', 'Thử thách kiến thức văn hóa và cảnh quan Đắk Song ngày 12/10/2026. Mỗi du khách có 01 lượt thi chính thức.', '2026-10-12', 'col-dak-song-intro', '00:00:00', '23:59:59', 300, 10, 1, 'active')
ON CONFLICT(business_date) DO UPDATE SET title = excluded.title, status = excluded.status;
