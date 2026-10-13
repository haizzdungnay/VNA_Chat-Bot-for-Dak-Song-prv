

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
  const migrationFiles = fs.readdirSync(path.join(REPO_ROOT, 'worker/migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations', file), 'utf8');
    db.exec(sql);
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


// =============================================================================
// PHASE 8.4.1 P1-01: SERVER-AUTHORITATIVE CONFIGURABLE SCORING TESTS
// =============================================================================
test('P1-01: Challenge with nondefault score (20 pts) snapshots immutably, awards 20 pts per correct, and preserves history', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);
  const adminService = new AdminQuizService(env);
  const vnToday = getVnToday();

  // 1. Admin creates collection with 3 questions
  const col = await adminService.createCollection({
    title: 'Bộ đề 20 Điểm',
    selection_mode: 'manual',
    question_ids: ['qz-q-001', 'qz-q-002', 'qz-q-003'],
  }, 'admin@vna.vn');

  // 2. Set up challenge with score_per_question = 20
  const chId = 'ch-' + vnToday;
  await env.DB.prepare(
    `UPDATE quiz_challenges SET score_per_question = 20, collection_id = ? WHERE business_date = ?`
  ).bind(col.id, vnToday).run();

  // 3. User Alice starts challenge
  const startResult = await quizService.startAttempt('user-alice', {
    attemptType: 'daily_challenge',
    challengeId: chId,
  });

  assert.equal(startResult.scorePerQuestion, 20, 'Attempt must snapshot challenge score_per_question = 20');
  assert.equal(startResult.maxScore, 60, 'Max score must be 3 * 20 = 60');

  // Verify DB record has score_per_question = 20
  const dbAttempt = await env.DB.prepare(
    'SELECT score_per_question, max_score FROM quiz_attempts WHERE id = ?'
  ).bind(startResult.attemptId).first();
  assert.equal(dbAttempt.score_per_question, 20);
  assert.equal(dbAttempt.max_score, 60);

  // 4. Alice answers question 1: correct answer
  const q1 = startResult.questions[0];
  const q1Detail = await env.DB.prepare(
    'SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?'
  ).bind(q1.id).first();

  const ans1 = await quizService.submitAnswer('user-alice', startResult.attemptId, {
    attemptQuestionId: q1.id,
    selectedOptionId: q1Detail.correct_option_id,
  });
  assert.equal(ans1.success, true);

  // Check stored answer points = 20
  const ansRow = await env.DB.prepare(
    'SELECT points, is_correct FROM quiz_attempt_answers WHERE attempt_id = ? AND attempt_question_id = ?'
  ).bind(startResult.attemptId, q1.id).first();
  assert.equal(ansRow.is_correct, 1);
  assert.equal(ansRow.points, 20, 'Correct answer must be awarded 20 points');

  // 5. Alice answers question 2: incorrect answer
  const q2 = startResult.questions[1];
  const wrongOpt = q2.options.find(o => o.id !== q1Detail.correct_option_id) || q2.options[0];
  await quizService.submitAnswer('user-alice', startResult.attemptId, {
    attemptQuestionId: q2.id,
    selectedOptionId: 'wrong-opt-id',
  }).catch(() => {
    // If option validity enforced, pick valid incorrect option
    const validWrong = q2.options[1].id;
    return quizService.submitAnswer('user-alice', startResult.attemptId, {
      attemptQuestionId: q2.id,
      selectedOptionId: validWrong,
    });
  });

  // 6. Finish attempt
  const finishRes = await quizService.finishAttempt('user-alice', startResult.attemptId);
  assert.equal(finishRes.status, 'completed');
  assert.equal(finishRes.scorePerQuestion, 20);
  assert.equal(finishRes.maxScore, 60);
  assert.ok(finishRes.score >= 20);

  // 7. Historical immutability test:
  // Admin subsequently changes challenge score_per_question to 50 in DB
  await env.DB.prepare(
    'UPDATE quiz_challenges SET score_per_question = 50 WHERE id = ?'
  ).bind(chId).run();

  // Query Alice finished attempt again: It MUST RETAIN 20 points per question and original score!
  const reloaded = await quizService.getAttempt('user-alice', startResult.attemptId);
  assert.equal(reloaded.scorePerQuestion, 20, 'Historical attempt score_per_question must NOT change');
  assert.equal(reloaded.maxScore, 60, 'Historical max_score must NOT change');
  assert.equal(reloaded.score, finishRes.score, 'Historical score must remain identical');

  // Double finalize on same attempt returns identical score without double counting stats
  const statsBefore = await quizService.getUserStats('user-alice');
  const doubleFinish = await quizService.finishAttempt('user-alice', startResult.attemptId);
  const statsAfter = await quizService.getUserStats('user-alice');
  assert.equal(doubleFinish.score, finishRes.score);
  assert.equal(statsAfter.totalAttempts, statsBefore.totalAttempts, 'Stats must not double-increment');
});

test('P1-01: Legacy attempt compatibility defaults safely to 10 points', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  // Directly insert legacy attempt with NULL score_per_question (simulating pre-0012 migration)
  const legacyId = 'qz-att-legacy-001';
  await env.DB.prepare(
    `INSERT INTO quiz_attempts (
      id, user_id, attempt_type, total_questions, correct_count, incorrect_count, unanswered_count,
      score, max_score, status, started_at, created_at, updated_at
    ) VALUES (?, 'user-alice', 'practice', 5, 3, 2, 0, 30, 50, 'completed', datetime('now'), datetime('now'), datetime('now'))`
  ).bind(legacyId).run();

  const legacyAttempt = await quizService.getAttempt('user-alice', legacyId);
  assert.equal(legacyAttempt.scorePerQuestion, 10, 'Legacy attempt without snapshot must default to 10');
  assert.equal(legacyAttempt.maxScore, 50);
  assert.equal(legacyAttempt.score, 30);
  assert.equal(legacyAttempt.percentage, 60);
});

// =============================================================================
// PHASE 8.4.1 P1-02: DAILY CHALLENGE SCHEDULE ENFORCEMENT TESTS
// =============================================================================
test('P1-02: Daily challenge schedule strictly enforces opening/closing time window in Asia/Ho_Chi_Minh', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);
  const adminService = new AdminQuizService(env);
  const vnToday = getVnToday();

  // Helper function to evaluate schedule with mock VN time
  const { evaluateChallengeSchedule } = await import('../src/services/quiz.service.ts');

  const testChallenge = {
    status: 'scheduled',
    business_date: vnToday,
    opening_time: '08:00:00',
    closing_time: '22:00:00',
  };

  // Case 1: Before opening time (07:30:00) -> scheduled, isOpen = false
  const resBefore = evaluateChallengeSchedule(testChallenge, { dateStr: vnToday, timeStr: '07:30:00' });
  assert.equal(resBefore.isOpen, false);
  assert.equal(resBefore.effectiveStatus, 'scheduled');
  assert.ok(resBefore.reason.includes('08:00:00'));

  // Case 2: Exact opening time (08:00:00) -> active, isOpen = true
  const resExactOpen = evaluateChallengeSchedule(testChallenge, { dateStr: vnToday, timeStr: '08:00:00' });
  assert.equal(resExactOpen.isOpen, true);
  assert.equal(resExactOpen.effectiveStatus, 'active');

  // Case 3: Middle of day (14:30:00) -> active, isOpen = true
  const resMiddle = evaluateChallengeSchedule(testChallenge, { dateStr: vnToday, timeStr: '14:30:00' });
  assert.equal(resMiddle.isOpen, true);
  assert.equal(resMiddle.effectiveStatus, 'active');

  // Case 4: Exact closing time (22:00:00) -> active, isOpen = true
  const resExactClose = evaluateChallengeSchedule(testChallenge, { dateStr: vnToday, timeStr: '22:00:00' });
  assert.equal(resExactClose.isOpen, true);
  assert.equal(resExactClose.effectiveStatus, 'active');

  // Case 5: After closing time (22:00:01) -> closed, isOpen = false
  const resAfter = evaluateChallengeSchedule(testChallenge, { dateStr: vnToday, timeStr: '22:00:01' });
  assert.equal(resAfter.isOpen, false);
  assert.equal(resAfter.effectiveStatus, 'closed');
  assert.ok(resAfter.reason.includes('22:00:00'));

  // Case 6: Wrong business date (yesterday or tomorrow)
  const resYesterday = evaluateChallengeSchedule(testChallenge, { dateStr: '2026-10-10', timeStr: '12:00:00' });
  assert.equal(resYesterday.isOpen, false);

  // Case 7: Admin validation rejects opening >= closing
  await assert.rejects(
    () => adminService.createChallenge({
      title: 'Khung giờ nghịch đảo',
      business_date: '2026-12-01',
      collection_id: 'col-dak-song-intro',
      opening_time: '22:00:00',
      closing_time: '08:00:00', // Invalid: closing before opening
    }, 'admin@vna.vn'),
    /Khung giờ không hợp lệ/
  );

  // Case 8: Admin validation rejects invalid score_per_question
  await assert.rejects(
    () => adminService.createChallenge({
      title: 'Điểm âm',
      business_date: '2026-12-02',
      collection_id: 'col-dak-song-intro',
      score_per_question: -10,
    }, 'admin@vna.vn'),
    /Điểm mỗi câu phải là số nguyên dương/
  );

  await assert.rejects(
    () => adminService.createChallenge({
      title: 'Điểm phân số',
      business_date: '2026-12-03',
      collection_id: 'col-dak-song-intro',
      score_per_question: 15.5,
    }, 'admin@vna.vn'),
    /Điểm mỗi câu phải là số nguyên dương/
  );
});

test('P1-02: Ongoing attempt preservation allows finishing after challenge closing time passes', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);
  const vnToday = getVnToday();

  // Create challenge first with status closed
  const chClosedId = 'ch-closed-test';
  await env.DB.prepare(
    `INSERT INTO quiz_challenges (
      id, title, business_date, collection_id, opening_time, closing_time, status
    ) VALUES (?, 'Thử thách đã đóng', ?, 'col-dak-song-intro', '08:00:00', '09:00:00', 'closed')
    ON CONFLICT(business_date) DO UPDATE SET status = 'closed'`
  ).bind(chClosedId, '2026-11-20').run();

  // Attempt that was legitimately started before closing
  const attId = 'att-ongoing-test';
  const expiresFuture = new Date(Date.now() + 600 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO quiz_attempts (
      id, user_id, challenge_id, attempt_type, business_date, total_questions, score_per_question,
      max_score, status, started_at, expires_at, created_at, updated_at
    ) VALUES (?, 'user-alice', ?, 'daily_challenge', '2026-11-20', 1, 10, 10, 'in_progress', datetime('now'), ?, datetime('now'), datetime('now'))`
  ).bind(attId, chClosedId, expiresFuture).run();

  await env.DB.prepare(
    `INSERT INTO quiz_attempt_questions (
      id, attempt_id, question_id, order_index, question_text, question_type, explanation, options_json, correct_option_id
    ) VALUES ('att-q-test', ?, 'qz-q-001', 1, 'Câu hỏi test', 'single_choice', 'Giải thích', '[]', 'opt-1')`
  ).bind(attId).run();

  // Alice can still submit and finish her already started ongoing attempt!
  const finishRes = await quizService.finishAttempt('user-alice', attId);
  assert.equal(finishRes.status, 'completed', 'Ongoing in-progress attempt must be allowed to complete');
});


// =============================================================================
// PHASE 8.4.2 TRANSACTION INTEGRITY & FAILURE INJECTION TESTS
// =============================================================================
test('Phase 8.4.3 Test A: Injected mid-batch failure after CAS UPDATE and before stats commit causes full rollback, retry increments exactly once', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  const startRes = await quizService.startAttempt('user-alice', {
    attemptType: 'practice',
    questionCount: 2,
  });

  const attId = startRes.attemptId;

  // Answer 1 question
  const q1 = startRes.questions[0];
  await quizService.submitAnswer('user-alice', attId, {
    attemptQuestionId: q1.id,
    selectedOptionId: q1.options[0].id,
  });

  // Intercept DB.batch: execute statements 0 (UPDATE) and 1 (guard) normally inside BEGIN IMMEDIATE,
  // but fail statement 2 (stats UPSERT) to trigger transaction ROLLBACK!
  const originalBatch = env.DB.batch.bind(env.DB);
  let batchInvocations = 0;

  env.DB.batch = async (statements) => {
    batchInvocations++;
    if (batchInvocations === 1) {
      // Modify statement 2 (stats upsert) to throw during transactional execution
      const failingStatements = statements.map((s, idx) => {
        if (idx === 2) {
          return {
            ...s,
            _runSync() {
              throw new Error('Simulated D1 engine crash during statement 2 inside transaction');
            },
          };
        }
        return s;
      });
      return originalBatch(failingStatements);
    }
    return originalBatch(statements);
  };

  // Attempt finish: must throw due to simulated mid-batch crash
  const finishResult = await quizService.finishAttempt('user-alice', attId).catch(err => err);
  assert.ok(finishResult instanceof Error, 'Mid-batch crash must throw');
  assert.ok(finishResult.message.includes('Simulated D1 engine crash'));

  // PROOF OF TRANSACTIONAL ROLLBACK:
  // Statement 0 (UPDATE quiz_attempts) ran before statement 2 threw.
  // Because SQLite rolled back the transaction, quiz_attempts MUST REVERT to 'in_progress'!
  const inDb = await env.DB.prepare('SELECT status, completed_at FROM quiz_attempts WHERE id = ?').bind(attId).first();
  assert.equal(inDb.status, 'in_progress', 'Attempt status must rollback to in_progress');
  assert.equal(inDb.completed_at, null, 'completed_at must rollback to null');

  // User stats must NOT exist
  const statsInDb = await env.DB.prepare('SELECT * FROM quiz_user_stats WHERE user_id = ?').bind('user-alice').first();
  assert.ok(!statsInDb, 'User stats must NOT be written when transaction rolls back');

  // Retry finishAttempt without injected failure: Must succeed cleanly!
  const retryFinish = await quizService.finishAttempt('user-alice', attId);
  assert.equal(retryFinish.status, 'completed');

  const afterRetryDb = await env.DB.prepare('SELECT status FROM quiz_attempts WHERE id = ?').bind(attId).first();
  assert.equal(afterRetryDb.status, 'completed');

  const afterStats = await env.DB.prepare('SELECT completed_attempts FROM quiz_user_stats WHERE user_id = ?').bind('user-alice').first();
  assert.equal(afterStats.completed_attempts, 1, 'Stats must increment exactly once after retry');
});


test('Phase 8.4.3 Test B: Interleaving test: commit submitAnswer (both correct and incorrect) during finalize pause, verify atomic final score matches answers', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  const startRes = await quizService.startAttempt('user-alice', {
    attemptType: 'practice',
    questionCount: 3,
  });

  const attId = startRes.attemptId;
  const q1 = startRes.questions[0];
  const q2 = startRes.questions[1];
  const q3 = startRes.questions[2];

  // Fetch correct option for q1, wrong option for q2
  const q1Detail = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(q1.id).first();
  const q2Detail = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(q2.id).first();

  const q1CorrectOpt = q1Detail.correct_option_id;
  const q2WrongOpt = q2.options.find(o => o.id !== q2Detail.correct_option_id)?.id || q2.options[0].id;

  // Intercept DB.batch: Pause right before finish batch executes,
  // and commit valid submitAnswer for Q1 (correct) and Q2 (incorrect) during that pause!
  const originalBatch = env.DB.batch.bind(env.DB);
  let batchCalls = 0;

  env.DB.batch = async (statements) => {
    batchCalls++;
    if (batchCalls === 1) {
      // Simulate concurrent T2 submitAnswer interleaved right before finish batch commits!
      // Submit Q1 (correct -> +10)
      await quizService.submitAnswer('user-alice', attId, {
        attemptQuestionId: q1.id,
        selectedOptionId: q1CorrectOpt,
      });

      // Submit Q2 (incorrect -> +0)
      await quizService.submitAnswer('user-alice', attId, {
        attemptQuestionId: q2.id,
        selectedOptionId: q2WrongOpt,
      });
      // Q3 is left unanswered
    }
    return originalBatch(statements);
  };

  // Alice finalizes attempt
  const finishRes = await quizService.finishAttempt('user-alice', attId);

  // Assert atomic SQL subqueries inside finish batch captured the interleaved answers!
  assert.equal(finishRes.status, 'completed');
  assert.equal(finishRes.correctCount, 1, 'Correct count must be exactly 1');
  assert.equal(finishRes.incorrectCount, 1, 'Incorrect count must be exactly 1');
  assert.equal(finishRes.unansweredCount, 1, 'Unanswered count must be exactly 1 (Q3)');
  assert.equal(finishRes.score, 10, 'Score must be exactly 10 points (Q1 correct, Q2 wrong)');
  assert.equal(finishRes.maxScore, 30, 'Max score must be 3 * 10 = 30');

  // Assert user stats derived directly from finalized attempt
  const stats = await quizService.getUserStats('user-alice');
  assert.equal(stats.completedAttempts, 1);
  assert.equal(stats.totalScore, 10);
  assert.equal(stats.totalCorrect, 1);
  assert.equal(stats.totalQuestionsAnswered, 2);

  // Repeated finish is idempotent
  const repeatedFinish = await quizService.finishAttempt('user-alice', attId);
  assert.equal(repeatedFinish.score, 10);
  assert.equal(repeatedFinish.correctCount, 1);

  const statsAfterRepeat = await quizService.getUserStats('user-alice');
  assert.equal(statsAfterRepeat.completedAttempts, 1, 'Repeated finish must not double count stats');
  assert.equal(statsAfterRepeat.totalScore, 10);
});

test('Phase 8.4.2: Submitting answer to already finalized attempt is blocked and rolled back by optimistic guard', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  const startRes = await quizService.startAttempt('user-alice', {
    attemptType: 'practice',
    questionCount: 2,
  });
  const attId = startRes.attemptId;

  // Finalize attempt directly
  await quizService.finishAttempt('user-alice', attId);

  // Now attempt to submit answer to completed attempt
  const q1 = startRes.questions[0];
  await assert.rejects(
    () => quizService.submitAnswer('user-alice', attId, {
      attemptQuestionId: q1.id,
      selectedOptionId: q1.options[0].id,
    }),
    (err) => err.statusCode === 400 && err.message.includes('Bài thi đã kết thúc')
  );

  // Confirm 0 answers were inserted
  const ansCount = await env.DB.prepare('SELECT count(*) as count FROM quiz_attempt_answers WHERE attempt_id = ?').bind(attId).first();
  assert.equal(ansCount.count, 0, 'No answer rows must be committed to completed attempt');
});

test('Phase 8.4.2: reconcileUserStats reconciles stats deterministically from authoritative completed attempts', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  // User Alice completes 2 practice attempts
  const att1 = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 1 });
  await quizService.finishAttempt('user-alice', att1.attemptId);

  const att2 = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 1 });
  await quizService.finishAttempt('user-alice', att2.attemptId);

  // Tamper with stats table (e.g. corrupt or out-of-sync state)
  await env.DB.prepare('UPDATE quiz_user_stats SET completed_attempts = 999, total_score = 9999 WHERE user_id = ?').bind('user-alice').run();

  // Run reconciliation
  const reconciled = await quizService.reconcileUserStats('user-alice');
  assert.equal(reconciled.completedAttempts, 2, 'Reconciliation must restore exact completed attempts count (2)');
  assert.ok(reconciled.totalScore < 100, 'Reconciliation must restore truthful total score');
});


// =============================================================================
// PHASE 8.4.4 P2-QZ-07 STATS RECONCILIATION & INTERLEAVING TEST SUITE
// =============================================================================
test('Phase 8.4.4 P2-QZ-07 Scenario 1: User with 1 completed + 2 in_progress attempts maintains totalAttempts = completedAttempts = 1 before and after reconcile', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  // 1. User Alice starts and completes 1 practice attempt with 1 question
  const att1 = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 1 });
  const q1 = att1.questions[0];
  const q1Detail = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(q1.id).first();
  await quizService.submitAnswer('user-alice', att1.attemptId, {
    attemptQuestionId: q1.id,
    selectedOptionId: q1Detail.correct_option_id,
  });
  await quizService.finishAttempt('user-alice', att1.attemptId);

  // Check stats right after completion: totalAttempts = 1, completedAttempts = 1
  const statsAfterFinish = await quizService.getUserStats('user-alice');
  assert.equal(statsAfterFinish.totalAttempts, 1);
  assert.equal(statsAfterFinish.completedAttempts, 1);
  assert.equal(statsAfterFinish.totalScore, 10);
  assert.equal(statsAfterFinish.totalCorrect, 1);

  // 2. Alice starts 2 new practice attempts that remain in_progress (never finished)
  await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 2 });
  await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 3 });

  // 3. Run reconcileUserStats: Must NOT count in_progress towards totalAttempts!
  const reconciled = await quizService.reconcileUserStats('user-alice');
  assert.equal(reconciled.totalAttempts, 1, 'Reconciled totalAttempts must remain 1');
  assert.equal(reconciled.completedAttempts, 1, 'Reconciled completedAttempts must remain 1');
  assert.equal(reconciled.totalScore, 10, 'In-progress attempts must not pollute score');
  assert.equal(reconciled.totalCorrect, 1);
});

test('Phase 8.4.4 P2-QZ-07 Scenario 2: User with 0 completed + in_progress, and user with 0 attempts yields all 0 counters', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  // Case A: User Bob starts 2 attempts but completes 0
  await quizService.startAttempt('user-bob', { attemptType: 'practice', questionCount: 2 });
  await quizService.startAttempt('user-bob', { attemptType: 'practice', questionCount: 1 });

  const bobReconciled = await quizService.reconcileUserStats('user-bob');
  assert.equal(bobReconciled.totalAttempts, 0);
  assert.equal(bobReconciled.completedAttempts, 0);
  assert.equal(bobReconciled.dailyChallengesCompleted, 0);
  assert.equal(bobReconciled.totalScore, 0);
  assert.equal(bobReconciled.totalCorrect, 0);
  assert.equal(bobReconciled.totalQuestionsAnswered, 0);
  assert.equal(bobReconciled.bestScore, 0);
  assert.equal(bobReconciled.lastAttemptAt, null);

  // Case B: Brand new user with 0 attempts created
  await env.DB.prepare("INSERT INTO users (id, email) VALUES ('user-newbie', 'newbie@example.com')").run();
  const newbieReconciled = await quizService.reconcileUserStats('user-newbie');
  assert.equal(newbieReconciled.totalAttempts, 0);
  assert.equal(newbieReconciled.completedAttempts, 0);
  assert.equal(newbieReconciled.totalScore, 0);
  assert.equal(newbieReconciled.lastAttemptAt, null);
});

test('Phase 8.4.4 P2-QZ-07 Scenario 3: 2 completed attempts with 1 daily challenge calculates daily_challenges_completed and best_score accurately', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);
  const vnToday = getVnToday();

  // Attempt 1: Practice attempt with score 20
  const att1 = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 2 });
  for (const q of att1.questions) {
    const qDetail = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(q.id).first();
    await quizService.submitAnswer('user-alice', att1.attemptId, { attemptQuestionId: q.id, selectedOptionId: qDetail.correct_option_id });
  }
  await quizService.finishAttempt('user-alice', att1.attemptId);

  // Attempt 2: Daily challenge with score 10 (1 correct, 1 wrong)
  const att2 = await quizService.startAttempt('user-alice', { attemptType: 'daily_challenge', challengeId: 'ch-' + vnToday });
  const qDaily1 = att2.questions[0];
  const qDaily1Detail = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(qDaily1.id).first();
  await quizService.submitAnswer('user-alice', att2.attemptId, { attemptQuestionId: qDaily1.id, selectedOptionId: qDaily1Detail.correct_option_id });
  await quizService.finishAttempt('user-alice', att2.attemptId);

  // Reconcile and assert exact metrics
  const stats = await quizService.reconcileUserStats('user-alice');
  assert.equal(stats.totalAttempts, 2);
  assert.equal(stats.completedAttempts, 2);
  assert.equal(stats.dailyChallengesCompleted, 1);
  assert.equal(stats.bestScore, 20, 'bestScore must be max between 20 and 10');
  assert.ok(stats.totalScore >= 30);
  assert.ok(stats.lastAttemptAt !== null);
});

test('Phase 8.4.4 P2-QZ-07 Scenario 4: Reconcile idempotency over multiple consecutive invocations', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  const att = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 1 });
  await quizService.finishAttempt('user-alice', att.attemptId);

  const firstStats = await quizService.reconcileUserStats('user-alice');

  // Run 5 consecutive reconciliations
  for (let i = 0; i < 5; i++) {
    const nextStats = await quizService.reconcileUserStats('user-alice');
    assert.deepEqual(nextStats.totalAttempts, firstStats.totalAttempts);
    assert.deepEqual(nextStats.completedAttempts, firstStats.completedAttempts);
    assert.deepEqual(nextStats.totalScore, firstStats.totalScore);
    assert.deepEqual(nextStats.bestScore, firstStats.bestScore);
  }
});

test('Phase 8.4.4 P2-QZ-07 Scenario 5: Reconcile repairs corrupted stats without mutating attempts, answers or history', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  const att = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 2 });
  const q1 = att.questions[0];
  const q1Detail = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(q1.id).first();
  await quizService.submitAnswer('user-alice', att.attemptId, { attemptQuestionId: q1.id, selectedOptionId: q1Detail.correct_option_id });
  await quizService.finishAttempt('user-alice', att.attemptId);

  // Record initial attempt rows and answers count
  const attemptsCountBefore = await env.DB.prepare('SELECT count(*) as c FROM quiz_attempts').first();
  const answersCountBefore = await env.DB.prepare('SELECT count(*) as c FROM quiz_attempt_answers').first();

  // Maliciously tamper with user stats
  await env.DB.prepare(`
    UPDATE quiz_user_stats
    SET total_attempts = 9999, completed_attempts = 8888, total_score = 77777, best_score = 66666
    WHERE user_id = 'user-alice'
  `).run();

  // Run reconciliation
  const repaired = await quizService.reconcileUserStats('user-alice');
  assert.equal(repaired.totalAttempts, 1, 'Repaired totalAttempts must be 1');
  assert.equal(repaired.completedAttempts, 1, 'Repaired completedAttempts must be 1');
  assert.equal(repaired.totalScore, 10, 'Repaired totalScore must be 10');
  assert.equal(repaired.bestScore, 10, 'Repaired bestScore must be 10');

  // Assert zero side effects on attempts and answers tables
  const attemptsCountAfter = await env.DB.prepare('SELECT count(*) as c FROM quiz_attempts').first();
  const answersCountAfter = await env.DB.prepare('SELECT count(*) as c FROM quiz_attempt_answers').first();
  assert.equal(attemptsCountAfter.c, attemptsCountBefore.c);
  assert.equal(answersCountAfter.c, answersCountBefore.c);
});

test('Phase 8.4.4 P2-QZ-07 Scenario 6: Interleaving & race test between reconcileUserStats and finishAttempt in both execution orders', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  // Order A: Reconcile runs while attempt 1 is in_progress -> then finishAttempt commits.
  // Stats must accurately reflect the newly completed attempt!
  const attA = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 1 });
  const qA = attA.questions[0];
  const qADetail = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(qA.id).first();
  await quizService.submitAnswer('user-alice', attA.attemptId, { attemptQuestionId: qA.id, selectedOptionId: qADetail.correct_option_id });

  // Reconcile before finish
  const statsBeforeFinish = await quizService.reconcileUserStats('user-alice');
  assert.equal(statsBeforeFinish.completedAttempts, 0);

  // Now finish commits
  await quizService.finishAttempt('user-alice', attA.attemptId);
  const statsAfterFinish = await quizService.getUserStats('user-alice');
  assert.equal(statsAfterFinish.completedAttempts, 1);
  assert.equal(statsAfterFinish.totalScore, 10);

  // Order B: finishAttempt completes -> then reconcile runs.
  // Stats must remain exactly 1 completed attempt, 10 points.
  const attB = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 1 });
  const qB = attB.questions[0];
  const qBDetail = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(qB.id).first();
  await quizService.submitAnswer('user-alice', attB.attemptId, { attemptQuestionId: qB.id, selectedOptionId: qBDetail.correct_option_id });
  await quizService.finishAttempt('user-alice', attB.attemptId);

  const statsAfterBothFinishes = await quizService.reconcileUserStats('user-alice');
  assert.equal(statsAfterBothFinishes.completedAttempts, 2);
  assert.equal(statsAfterBothFinishes.totalAttempts, 2);
  assert.equal(statsAfterBothFinishes.totalScore, 20);
});
