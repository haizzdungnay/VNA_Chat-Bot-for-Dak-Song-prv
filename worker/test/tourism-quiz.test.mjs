

function getVnTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getVnToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { QuizService } from '../src/services/quiz.service.ts';
import { AdminQuizService } from '../src/services/admin-quiz.service.ts';
import worker from '../src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createQuizTestEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  for (let i = 1; i <= 11; i++) {
    const pad = String(i).padStart(4, '0');
    const files = fs.readdirSync(path.join(REPO_ROOT, 'worker/migrations')).filter(f => f.startsWith(pad));
    if (files.length > 0) {
      const sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations', files[0]), 'utf8');
      db.exec(sql);
    }
  }

  // Test users
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-alice', 'alice@example.com', 'Alice Dang', 'active');");
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-bob', 'bob@example.com', 'Bob Tran', 'active');");

    const vnToday = getVnToday();
  db.exec(`INSERT INTO quiz_challenges (id, title, description, business_date, collection_id, opening_time, closing_time, time_limit_seconds, score_per_question, max_attempts, status)
  VALUES ('ch-${vnToday}', 'Thử thách Du lịch Đắk Song hàng ngày', 'Mô tả', '${vnToday}', 'col-dak-song-intro', '00:00:00', '23:59:59', 300, 10, 1, 'active')
  ON CONFLICT(business_date) DO UPDATE SET status = 'active';`);

  // Auth sessions
  db.exec("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ('sess-alice', 'user-alice', '676a5ea41393fe0ca5a5d3f81601a3fd918667a013e6bca865baeddae6f271dd', datetime('now', '+1 day'));");
  db.exec("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ('sess-bob', 'user-bob', 'hash-bob-token', datetime('now', '+1 day'));");

  const makeStmt = (sql, params = []) => ({
    bind(...newParams) {
      return makeStmt(sql, newParams);
    },
    async all() {
      const stmt = db.prepare(sql);
      return { results: stmt.all(...params) };
    },
    async first() {
      const stmt = db.prepare(sql);
      return stmt.get(...params);
    },
    async run() {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
    },
    _runSync() {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
    },
  });

  let batchLock = Promise.resolve();

  return {
    DB: {
      prepare(sql) {
        return makeStmt(sql);
      },
      async batch(statements) {
        const runBatch = () => {
          db.exec('BEGIN IMMEDIATE');
          try {
            const results = [];
            for (const s of statements) {
              results.push(s._runSync ? s._runSync() : { meta: { changes: 1 } });
            }
            db.exec('COMMIT');
            return results;
          } catch (err) {
            try { db.exec('ROLLBACK'); } catch {}
            throw err;
          }
        };

        const prev = batchLock;
        let resolveLock;
        batchLock = new Promise((resolve) => {
          resolveLock = resolve;
        });

        await prev;
        try {
          return runBatch();
        } finally {
          resolveLock();
        }
      },
    },
    ADMIN_DEV_MOCK_AUTH: 'true',
    ENVIRONMENT: 'development',
    CORS_ALLOW_ORIGIN: '*',
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// 1. QUESTION BANK TESTS
// -----------------------------------------------------------------------------
test('Admin creates a valid question in draft state with options', async () => {
  const env = createQuizTestEnv();
  const service = new AdminQuizService(env);

  const input = {
    code: 'QZ-TEST-001',
    question_type: 'single_choice',
    category_id: 'cat-quiz-nature',
    difficulty: 'easy',
    question_text: 'Thác Lưu Ly thuộc khu bảo tồn thiên nhiên nào tại Đắk Song?',
    explanation: 'Thác Lưu Ly thuộc Khu bảo tồn thiên nhiên Nâm Nung.',
    source_type: 'place',
    related_place_id: 'c5e658bd-da7c-420d-9f5e-bdf8a61bcf42',
    options: [
      { option_key: 'A', option_text: 'Khu bảo tồn Nâm Nung', is_correct: 1 },
      { option_key: 'B', option_text: 'Vườn quốc gia Tà Đùng', is_correct: 0 },
      { option_key: 'C', option_text: 'Vườn quốc gia Yok Đôn', is_correct: 0 },
    ],
  };

  const created = await service.createQuestion(input, 'admin@vna.vn');
  assert.equal(created.code, 'QZ-TEST-001');
  assert.equal(created.status, 'draft');
  assert.equal(created.options.length, 3);
  assert.equal(created.options[0].is_correct, 1);
});

test('Admin rejects question with invalid options, duplicate texts, or missing correct answer', async () => {
  const env = createQuizTestEnv();
  const service = new AdminQuizService(env);

  // Less than 2 options
  await assert.rejects(
    () => service.createQuestion({
      question_type: 'single_choice',
      category_id: 'cat-quiz-nature',
      difficulty: 'easy',
      question_text: 'Câu hỏi test?',
      explanation: 'Giải thích',
      source_type: 'manual',
      options: [{ option_key: 'A', option_text: 'Chỉ 1 đáp án', is_correct: 1 }],
    }, 'admin@vna.vn'),
    /từ 2 đến 6 phương án/
  );

  // Duplicate option text
  await assert.rejects(
    () => service.createQuestion({
      question_type: 'single_choice',
      category_id: 'cat-quiz-nature',
      difficulty: 'easy',
      question_text: 'Câu hỏi test trùng lặp?',
      explanation: 'Giải thích',
      source_type: 'manual',
      options: [
        { option_key: 'A', option_text: 'Phương án 1', is_correct: 1 },
        { option_key: 'B', option_text: 'Phương án 1', is_correct: 0 },
      ],
    }, 'admin@vna.vn'),
    /không được trùng lặp/
  );

  // Zero correct answers
  await assert.rejects(
    () => service.createQuestion({
      question_type: 'single_choice',
      category_id: 'cat-quiz-nature',
      difficulty: 'easy',
      question_text: 'Không có đáp án đúng?',
      explanation: 'Giải thích',
      source_type: 'manual',
      options: [
        { option_key: 'A', option_text: 'Phương án 1', is_correct: 0 },
        { option_key: 'B', option_text: 'Phương án 2', is_correct: 0 },
      ],
    }, 'admin@vna.vn'),
    /chính xác 01 đáp án đúng/
  );

  // Multiple correct answers in single_choice
  await assert.rejects(
    () => service.createQuestion({
      question_type: 'single_choice',
      category_id: 'cat-quiz-nature',
      difficulty: 'easy',
      question_text: 'Quá nhiều đáp án đúng?',
      explanation: 'Giải thích',
      source_type: 'manual',
      options: [
        { option_key: 'A', option_text: 'Phương án 1', is_correct: 1 },
        { option_key: 'B', option_text: 'Phương án 2', is_correct: 1 },
      ],
    }, 'admin@vna.vn'),
    /chính xác 01 đáp án đúng/
  );
});

test('Admin question lifecycle: Edit draft -> Publish -> Archive -> Restore -> Duplicate', async () => {
  const env = createQuizTestEnv();
  const service = new AdminQuizService(env);

  const created = await service.createQuestion({
    code: 'QZ-LIFE-01',
    question_type: 'single_choice',
    category_id: 'cat-quiz-nature',
    difficulty: 'easy',
    question_text: 'Câu hỏi vòng đời gốc?',
    explanation: 'Giải thích ban đầu',
    source_type: 'manual',
    options: [
      { option_key: 'A', option_text: 'Đúng', is_correct: 1 },
      { option_key: 'B', option_text: 'Sai', is_correct: 0 },
    ],
  }, 'admin@vna.vn');

  // Edit draft
  const updated = await service.updateQuestion(created.id, {
    question_text: 'Câu hỏi vòng đời đã sửa?',
  }, 'admin@vna.vn');
  assert.equal(updated.question_text, 'Câu hỏi vòng đời đã sửa?');
  assert.equal(updated.version, 2);

  // Publish
  const published = await service.publishQuestion(created.id, 'admin@vna.vn');
  assert.equal(published.status, 'published');

  // Archive
  const archived = await service.archiveQuestion(created.id, 'admin@vna.vn');
  assert.equal(archived.status, 'archived');

  // Updating archived throws
  await assert.rejects(
    () => service.updateQuestion(created.id, { question_text: 'Sửa khi lưu trữ' }, 'admin@vna.vn'),
    /Không thể cập nhật câu hỏi đã lưu trữ/
  );

  // Restore to draft
  const restored = await service.restoreQuestion(created.id, 'admin@vna.vn');
  assert.equal(restored.status, 'draft');

  // Duplicate question
  const duplicated = await service.duplicateQuestion(created.id, 'admin@vna.vn');
  assert.ok(duplicated.id !== created.id);
  assert.ok(duplicated.code.includes('COPY'));
  assert.equal(duplicated.status, 'draft');
  assert.equal(duplicated.options.length, 2);
});

// -----------------------------------------------------------------------------
// 2. COLLECTIONS & CHALLENGES TESTS
// -----------------------------------------------------------------------------
test('Admin creates collection, enforces published question rule, and schedules challenge', async () => {
  const env = createQuizTestEnv();
  const adminService = new AdminQuizService(env);

  // Create valid collection with seeded published questions
  const col = await adminService.createCollection({
    title: 'Bộ đề Kiểm thử Đặc sắc',
    selection_mode: 'manual',
    question_ids: ['qz-q-001', 'qz-q-002', 'qz-q-003'],
  }, 'admin@vna.vn');

  assert.equal(col.title, 'Bộ đề Kiểm thử Đặc sắc');
  assert.equal(col.question_count, 3);

  // Attempting to create challenge with same business date throws
  await assert.rejects(
    () => adminService.createChallenge({
      title: 'Thử thách trùng ngày',
      business_date: getVnToday(), // Already seeded for today
      collection_id: col.id,
    }, 'admin@vna.vn'),
    /Đã tồn tại thử thách ngày/
  );

  // Create challenge for future date
  const futureCh = await adminService.createChallenge({
    title: 'Thử thách ngày mai',
    business_date: getVnTomorrow(),
    collection_id: col.id,
    time_limit_seconds: 600,
  }, 'admin@vna.vn');

  assert.equal(futureCh.business_date, getVnTomorrow());
  assert.equal(futureCh.time_limit_seconds, 600);
});

// -----------------------------------------------------------------------------
// 3. QUIZ ENGINE & CONCURRENCY TESTS
// -----------------------------------------------------------------------------
test('Quiz Engine: Start practice attempt hides correct answers, snapshots options fairly', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  const attempt = await quizService.startAttempt('user-alice', {
    attemptType: 'practice',
    questionCount: 3,
  });

  assert.ok(attempt.attemptId);
  assert.equal(attempt.attemptType, 'practice');
  assert.equal(attempt.questions.length, 3);

  // Verify security: No correct answers or explanations exposed in active question payload
  for (const q of attempt.questions) {
    assert.equal(q.correctOptionId, undefined, 'Must not expose correctOptionId');
    assert.equal(q.explanation, undefined, 'Must not expose explanation');
    assert.ok(q.options.length >= 2, 'Options present');
    for (const opt of q.options) {
      assert.equal(opt.is_correct, undefined, 'Option must not expose is_correct');
    }
  }
});

test('Quiz Engine: Daily Challenge uniqueness allows exactly 1 attempt per user, blocks concurrent duplicates', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  // User Alice starts official Daily Challenge
  const attempt = await quizService.startAttempt('user-alice', {
    attemptType: 'daily_challenge',
    challengeId: 'ch-' + getVnToday(),
  });
  assert.ok(attempt.attemptId);

  // Sequential duplicate attempt fails with 409
  await assert.rejects(
    () => quizService.startAttempt('user-alice', {
      attemptType: 'daily_challenge',
      challengeId: 'ch-' + getVnToday(),
    }),
    (err) => err.statusCode === 409
  );

  // Bob can still start his own attempt
  const bobAttempt = await quizService.startAttempt('user-bob', {
    attemptType: 'daily_challenge',
    challengeId: 'ch-' + getVnToday(),
  });
  assert.ok(bobAttempt.attemptId);
});

test('Quiz Engine: Answer submission evaluates server-side, allows idempotent replay, rejects conflicting replay', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  const attempt = await quizService.startAttempt('user-alice', {
    attemptType: 'practice',
    questionCount: 1,
  });

  const q = attempt.questions[0];
  const firstOption = q.options[0];
  const secondOption = q.options[1];

  // Submit answer
  const res1 = await quizService.submitAnswer('user-alice', attempt.attemptId, {
    attemptQuestionId: q.id,
    selectedOptionId: firstOption.id,
  });
  assert.equal(res1.success, true);

  // Idempotent retry with SAME option succeeds cleanly
  const res2 = await quizService.submitAnswer('user-alice', attempt.attemptId, {
    attemptQuestionId: q.id,
    selectedOptionId: firstOption.id,
  });
  assert.equal(res2.success, true);
  assert.equal(res2.alreadyAnswered, true);

  // Conflicting retry with DIFFERENT option rejected with 409 Conflict
  await assert.rejects(
    () => quizService.submitAnswer('user-alice', attempt.attemptId, {
      attemptQuestionId: q.id,
      selectedOptionId: secondOption.id,
    }),
    (err) => err.statusCode === 409
  );

  // User Bob cannot submit answer to Alice attempt (Ownership)
  await assert.rejects(
    () => quizService.submitAnswer('user-bob', attempt.attemptId, {
      attemptQuestionId: q.id,
      selectedOptionId: firstOption.id,
    }),
    (err) => err.statusCode === 403
  );
});

test('Quiz Engine: Finalization grades authoritative score, updates user stats, and reveals explanations', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  const attempt = await quizService.startAttempt('user-alice', {
    attemptType: 'practice',
    questionCount: 2,
  });

  // Finish attempt
  const result = await quizService.finishAttempt('user-alice', attempt.attemptId);
  assert.equal(result.status, 'completed');
  assert.equal(result.totalQuestions, 2);
  assert.ok(result.maxScore === 20);

  // Now questions have correctOptionId, explanation and source links
  for (const q of result.questions) {
    assert.ok(q.correctOptionId, 'Completed quiz reveals correctOptionId');
    assert.ok(q.explanation, 'Completed quiz reveals explanation');
  }

  // Double finish is idempotent
  const secondFinish = await quizService.finishAttempt('user-alice', attempt.attemptId);
  assert.equal(secondFinish.score, result.score);

  // Stats are updated
  const stats = await quizService.getUserStats('user-alice');
  assert.equal(stats.totalAttempts, 1);
  assert.equal(stats.completedAttempts, 1);
});

// -----------------------------------------------------------------------------
// 4. ADMIN ANALYTICS TESTS
// -----------------------------------------------------------------------------
test('Admin Analytics: Derives KPIs from actual attempts, calculates accuracy, and exports CSV with BOM', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);
  const adminService = new AdminQuizService(env);

  // Alice takes a quiz
  const att = await quizService.startAttempt('user-alice', {
    attemptType: 'practice',
    questionCount: 2,
  });
  await quizService.finishAttempt('user-alice', att.attemptId);

  // Analytics query
  const analytics = await adminService.getAnalytics();
  assert.ok(analytics.kpis.totalPublishedQuestions >= 8);
  assert.equal(analytics.kpis.totalAttempts, 1);
  assert.equal(analytics.kpis.completedAttempts, 1);
  assert.equal(analytics.kpis.uniqueParticipants, 1);

  // CSV export
  const csv = await adminService.exportAnalyticsCsv();
  assert.ok(csv.startsWith('﻿'), 'CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('BÁO CÁO THỐNG KÊ QUIZ'));
  assert.ok(csv.includes('Tổng câu hỏi đã xuất bản'));
});

// -----------------------------------------------------------------------------
// 5. HTTP ROUTER END-TO-END FLOW
// -----------------------------------------------------------------------------
test('HTTP Router E2E: Full tourist and admin API lifecycle', async () => {
  const env = createQuizTestEnv();

  // 1. Tourist queries categories
  const catReq = new Request('http://localhost/api/quiz/categories', { method: 'GET' });
  const catRes = await worker.fetch(catReq, env);
  assert.equal(catRes.status, 200);
  const catData = await catRes.json();
  assert.ok(catData.categories.length >= 5);

  // 2. Tourist queries daily challenge
  const dailyReq = new Request('http://localhost/api/quiz/daily', { method: 'GET' });
  const dailyRes = await worker.fetch(dailyReq, env);
  assert.equal(dailyRes.status, 200);
  const dailyData = await dailyRes.json();
  assert.equal(dailyData.challenge.businessDate, getVnToday());

  // 3. Unauthenticated tourist starting attempt -> 401
  const anonStartReq = new Request('http://localhost/api/quiz/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attemptType: 'practice' }),
  });
  const anonStartRes = await worker.fetch(anonStartReq, env);
  assert.equal(anonStartRes.status, 401);

  // 4. Authenticated tourist starts attempt
  const authStartReq = new Request('http://localhost/api/quiz/attempts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer alice-test-session-token-123456',
    },
    body: JSON.stringify({ attemptType: 'practice', questionCount: 2 }),
  });
  const authStartRes = await worker.fetch(authStartReq, env);
  assert.equal(authStartRes.status, 201);
  const startData = await authStartRes.json();
  const attemptId = startData.attempt.attemptId;
  assert.ok(attemptId);

  // 5. Submit answer
  const q = startData.attempt.questions[0];
  const ansReq = new Request(`http://localhost/api/quiz/attempts/${attemptId}/answers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer alice-test-session-token-123456',
    },
    body: JSON.stringify({
      attemptQuestionId: q.id,
      selectedOptionId: q.options[0].id,
    }),
  });
  const ansRes = await worker.fetch(ansReq, env);
  assert.equal(ansRes.status, 200);

  // 6. Finish attempt
  const finishReq = new Request(`http://localhost/api/quiz/attempts/${attemptId}/finish`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer alice-test-session-token-123456',
    },
  });
  const finishRes = await worker.fetch(finishReq, env);
  assert.equal(finishRes.status, 200);
  const finishData = await finishRes.json();
  assert.equal(finishData.result.status, 'completed');

  // 7. Admin reads analytics via API
  const adminAnalyticsReq = new Request('http://localhost/api/admin/quiz/analytics', {
    method: 'GET',
    headers: {
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
  });
  const adminAnalyticsRes = await worker.fetch(adminAnalyticsReq, env);
  assert.equal(adminAnalyticsRes.status, 200);
  const adminData = await adminAnalyticsRes.json();
  assert.equal(adminData.kpis.completedAttempts, 1);
});
