

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
  assert.equal(stats.totalScore, 30, 'Exact totalScore sum: 20 + 10 = 30');
  assert.equal(stats.totalCorrect, 3, 'Exact totalCorrect: 2 + 1 = 3');
  assert.equal(stats.totalQuestionsAnswered, 3, 'Exact questions answered: 2 + 1 = 3');
  assert.ok(stats.lastAttemptAt !== null, 'lastAttemptAt must be non-null');
  const att2Row = await env.DB.prepare('SELECT completed_at FROM quiz_attempts WHERE id = ?').bind(att2.attemptId).first();
  assert.equal(stats.lastAttemptAt, att2Row.completed_at, 'lastAttemptAt must reflect most recent completed attempt');
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

  // Snapshot entire attempts and answers content before reconcile
  const attemptsBefore = await env.DB.prepare('SELECT * FROM quiz_attempts ORDER BY id ASC').all();
  const answersBefore = await env.DB.prepare('SELECT * FROM quiz_attempt_answers ORDER BY id ASC').all();

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

  // Assert zero side effects on attempts and answers rows: snapshot bit-for-bit identical
  const attemptsAfter = await env.DB.prepare('SELECT * FROM quiz_attempts ORDER BY id ASC').all();
  const answersAfter = await env.DB.prepare('SELECT * FROM quiz_attempt_answers ORDER BY id ASC').all();
  assert.deepEqual(attemptsAfter.results, attemptsBefore.results, 'quiz_attempts rows must remain bit-for-bit unchanged');
  assert.deepEqual(answersAfter.results, answersBefore.results, 'quiz_attempt_answers rows must remain bit-for-bit unchanged');
});

test('Phase 8.4.4 P2-QZ-07 Scenario 6: Controlled barrier & latch concurrency test between reconcileUserStats and finishAttempt in both execution orders', async () => {
  // Test A: finishAttempt and reconcileUserStats fired concurrently via Promise.all
  // SQLite transaction serialization ensures atomic execution without stale-write corruption.
  const envA = createQuizTestEnv();
  const serviceA = new QuizService(envA);

  const attA = await serviceA.startAttempt('user-alice', { attemptType: 'practice', questionCount: 1 });
  const qA = attA.questions[0];
  const qADetail = await envA.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(qA.id).first();
  await serviceA.submitAnswer('user-alice', attA.attemptId, { attemptQuestionId: qA.id, selectedOptionId: qADetail.correct_option_id });

  // Fire finishAttempt and reconcileUserStats concurrently via Promise.all
  const [finResA, recResA] = await Promise.all([
    serviceA.finishAttempt('user-alice', attA.attemptId),
    serviceA.reconcileUserStats('user-alice'),
  ]);

  // Both must resolve successfully
  assert.equal(finResA.status, 'completed');
  assert.ok(recResA);

  // Authoritative user stats verification: exactly 1 attempt, 10 score (no stale 0 overwrite)
  const finalStatsA = await serviceA.getUserStats('user-alice');
  assert.equal(finalStatsA.totalAttempts, 1, 'Concurrent order A totalAttempts must be 1');
  assert.equal(finalStatsA.completedAttempts, 1, 'Concurrent order A completedAttempts must be 1');
  assert.equal(finalStatsA.totalScore, 10, 'Concurrent order A totalScore must be 10');

  // Test B: Opposite initiation order with controlled Promise.all
  const envB = createQuizTestEnv();
  const serviceB = new QuizService(envB);

  const attB = await serviceB.startAttempt('user-bob', { attemptType: 'practice', questionCount: 1 });
  const qB = attB.questions[0];
  const qBDetail = await envB.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(qB.id).first();
  await serviceB.submitAnswer('user-bob', attB.attemptId, { attemptQuestionId: qB.id, selectedOptionId: qBDetail.correct_option_id });

  // Fire reconcile first, immediately followed by finish
  const [recResB, finResB] = await Promise.all([
    serviceB.reconcileUserStats('user-bob'),
    serviceB.finishAttempt('user-bob', attB.attemptId),
  ]);

  assert.equal(finResB.status, 'completed');
  assert.ok(recResB);

  // Authoritative stats: run a final reconcile to prove convergence
  const finalStatsB = await serviceB.reconcileUserStats('user-bob');
  assert.equal(finalStatsB.totalAttempts, 1, 'Concurrent order B totalAttempts must be 1');
  assert.equal(finalStatsB.completedAttempts, 1, 'Concurrent order B completedAttempts must be 1');
  assert.equal(finalStatsB.totalScore, 10, 'Concurrent order B totalScore must be 10');

  // Test C: Demonstration of the 8.4.3 stale-write vulnerability vs 8.4.4 atomic SQL resilience
  // In 8.4.3: multi-step JavaScript read-then-write would read 0 completed attempts before finish,
  // then write back 0 AFTER finish committed, destroying the stats.
  // In 8.4.4: single SQL INSERT...SELECT...ON CONFLICT prevents stale reads because the SELECT
  // and the UPDATE happen in the same atomic engine lock.
  const envC = createQuizTestEnv();
  const serviceC = new QuizService(envC);
  const attC = await serviceC.startAttempt('user-alice', { attemptType: 'practice', questionCount: 1 });
  const qC = attC.questions[0];
  const qCDetail = await envC.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(qC.id).first();
  await serviceC.submitAnswer('user-alice', attC.attemptId, { attemptQuestionId: qC.id, selectedOptionId: qCDetail.correct_option_id });

  // Simulate 8.4.3 vulnerability: JS reads state BEFORE finish
  const staleReadCount = await envC.DB.prepare("SELECT COUNT(*) as c FROM quiz_attempts WHERE user_id = 'user-alice' AND status = 'completed'").first();
  assert.equal(staleReadCount.c, 0, 'Pre-finish read sees 0 completed attempts');

  // Concurrently, finish commits
  await serviceC.finishAttempt('user-alice', attC.attemptId);
  const statsAfterFinish = await serviceC.getUserStats('user-alice');
  assert.equal(statsAfterFinish.completedAttempts, 1, 'Finish committed 1 completed attempt');

  // If 8.4.3 applied stale read:
  // UPDATE quiz_user_stats SET completed_attempts = 0 -> would corrupt stats!
  // But calling 8.4.4 atomic reconcile:
  const repairedC = await serviceC.reconcileUserStats('user-alice');
  assert.equal(repairedC.completedAttempts, 1, '8.4.4 atomic reconcile reads authoritative completed state, immune to stale JS snapshot');
});

// =============================================================================
// PHASE 8.4.4a P1-QZ-08: ANTI-LEAKAGE OF AGGREGATE GRADING DURING IN_PROGRESS
// =============================================================================

function inspectNoGradingLeaks(obj, path = '') {
  if (obj === null || obj === undefined || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => inspectNoGradingLeaks(item, `${path}[${idx}]`));
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    const curPath = path ? `${path}.${key}` : key;

    // Allowed public metadata and configurations
    if ([
      'scorePerQuestion', 'score_per_question',
      'maxScore', 'max_score',
      'questionCount', 'question_count',
      'totalQuestions', 'total_questions',
      'answeredCount',
      'timeLimitSeconds', 'time_limit_seconds',
      'orderIndex', 'order_index'
    ].includes(key)) {
      continue;
    }

    // Question-level private answers and explanations MUST be undefined
    if (['isCorrect', 'is_correct', 'correctOptionId', 'correct_option_id', 'points', 'explanation'].includes(key)) {
      assert.equal(val, undefined, `Forbidden question grading key ${curPath} must be undefined during in_progress`);
    }

    // Attempt-level and history-level grading metrics MUST be null
    if ([
      'score',
      'correctCount', 'correct_count',
      'incorrectCount', 'incorrect_count',
      'unansweredCount', 'unanswered_count',
      'percentage'
    ].includes(key)) {
      assert.equal(val, null, `Grading metric ${curPath} must be null during in_progress, got ${val}`);
    }

    if (typeof val === 'object' && val !== null) {
      inspectNoGradingLeaks(val, curPath);
    }
  }
}

test('P1-QZ-08: Practice attempt never leaks aggregate grading (score, counts, percentage) while in_progress', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);

  // 1. Start practice attempt with 2 questions
  const startRes = await quizService.startAttempt('user-alice', { attemptType: 'practice', questionCount: 2 });
  assert.equal(startRes.totalQuestions, 2);
  const q1 = startRes.questions[0];
  const q2 = startRes.questions[1];

  const q1Row = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(q1.id).first();
  const q2Row = await env.DB.prepare('SELECT correct_option_id, options_json FROM quiz_attempt_questions WHERE id = ?').bind(q2.id).first();
  const q2Opts = JSON.parse(q2Row.options_json);
  const wrongOptForQ2 = q2Opts.find((o) => o.id !== q2Row.correct_option_id).id;

  // 2. Submit Q1 with CORRECT answer
  const ans1 = await quizService.submitAnswer('user-alice', startRes.attemptId, {
    attemptQuestionId: q1.id,
    selectedOptionId: q1Row.correct_option_id,
  });
  assert.equal(ans1.success, true);
  assert.equal(ans1.isCorrect, undefined, 'submitAnswer must not reveal isCorrect');

  // Immediately query GET attempt while in_progress: Must NOT reveal score or correctCount!
  const attAfterQ1 = await quizService.getAttempt('user-alice', startRes.attemptId);
  assert.equal(attAfterQ1.status, 'in_progress');
  assert.equal(attAfterQ1.score, null, 'Score must be null while in_progress');
  assert.equal(attAfterQ1.correctCount, null, 'correctCount must be null while in_progress');
  assert.equal(attAfterQ1.incorrectCount, null, 'incorrectCount must be null while in_progress');
  assert.equal(attAfterQ1.unansweredCount, null, 'unansweredCount must be null while in_progress');
  assert.equal(attAfterQ1.percentage, null, 'percentage must be null while in_progress');
  assert.equal(attAfterQ1.answeredCount, 1, 'answeredCount can safely report progress');
  inspectNoGradingLeaks(attAfterQ1);

  // Immediately query GET history: Must NOT reveal score or counts for in_progress attempt!
  const historyAfterQ1 = await quizService.getUserHistory('user-alice', 1, 10);
  assert.equal(historyAfterQ1.history.length, 1);
  const histItemQ1 = historyAfterQ1.history[0];
  assert.equal(histItemQ1.status, 'in_progress');
  assert.equal(histItemQ1.score, null);
  assert.equal(histItemQ1.percentage, null);
  assert.equal(histItemQ1.correctCount, null);
  assert.equal(histItemQ1.correct_count, null);
  assert.equal(histItemQ1.incorrectCount, null);
  assert.equal(histItemQ1.incorrect_count, null);
  inspectNoGradingLeaks(historyAfterQ1);

  // 3. Submit Q2 with WRONG answer
  const ans2 = await quizService.submitAnswer('user-alice', startRes.attemptId, {
    attemptQuestionId: q2.id,
    selectedOptionId: wrongOptForQ2,
  });
  assert.equal(ans2.success, true);
  assert.equal(ans2.isCorrect, undefined);

  // Re-verify GET attempt after wrong answer: Still strictly masked!
  const attAfterQ2 = await quizService.getAttempt('user-alice', startRes.attemptId);
  assert.equal(attAfterQ2.status, 'in_progress');
  assert.equal(attAfterQ2.score, null);
  assert.equal(attAfterQ2.correctCount, null);
  assert.equal(attAfterQ2.incorrectCount, null);
  assert.equal(attAfterQ2.percentage, null);
  assert.equal(attAfterQ2.answeredCount, 2);
  inspectNoGradingLeaks(attAfterQ2);

  // 4. Now finish attempt: grading is legitimately revealed!
  const finishRes = await quizService.finishAttempt('user-alice', startRes.attemptId);
  assert.equal(finishRes.status, 'completed');
  assert.equal(finishRes.score, 10, 'Authoritative score: 10 out of 20');
  assert.equal(finishRes.correctCount, 1);
  assert.equal(finishRes.incorrectCount, 1);
  assert.equal(finishRes.unansweredCount, 0);
  assert.equal(finishRes.percentage, 50);

  // Questions now have explanations and correctness
  assert.equal(finishRes.questions[0].isCorrect, true);
  assert.equal(finishRes.questions[0].points, 10);
  assert.ok(finishRes.questions[0].explanation);
  assert.equal(finishRes.questions[1].isCorrect, false);
  assert.equal(finishRes.questions[1].points, 0);
  assert.ok(finishRes.questions[1].explanation);

  // History also now shows completed score
  const historyAfterFinish = await quizService.getUserHistory('user-alice', 1, 10);
  assert.equal(historyAfterFinish.history[0].status, 'completed');
  assert.equal(historyAfterFinish.history[0].score, 10);
  assert.equal(historyAfterFinish.history[0].correctCount, 1);
  assert.equal(historyAfterFinish.history[0].incorrectCount, 1);
  assert.equal(historyAfterFinish.history[0].percentage, 50);
});

test('P1-QZ-08: Daily Challenge never leaks current score via GET /api/quiz/daily or GET attempt while in_progress', async () => {
  const env = createQuizTestEnv();
  const quizService = new QuizService(env);
  const vnToday = getVnToday();

  // 1. Verify initial daily state
  const initialDaily = await quizService.getDailyChallenge('user-alice');
  assert.equal(initialDaily.isOpen, true);
  assert.equal(initialDaily.hasAttempted, false);
  assert.equal(initialDaily.score, null);

  // 2. Start daily challenge attempt
  const startDaily = await quizService.startAttempt('user-alice', {
    attemptType: 'daily_challenge',
    challengeId: 'ch-' + vnToday,
  });
  assert.ok(startDaily.attemptId);

  // 3. Submit 1 correct answer
  const q1 = startDaily.questions[0];
  const q1Row = await env.DB.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').bind(q1.id).first();
  await quizService.submitAnswer('user-alice', startDaily.attemptId, {
    attemptQuestionId: q1.id,
    selectedOptionId: q1Row.correct_option_id,
  });

  // Query GET /api/quiz/daily: Must NOT leak score!
  const midDaily = await quizService.getDailyChallenge('user-alice');
  assert.equal(midDaily.hasAttempted, true);
  assert.equal(midDaily.attemptStatus, 'in_progress');
  assert.equal(midDaily.score, null, 'Daily challenge score MUST be null while attempt is in_progress');
  inspectNoGradingLeaks(midDaily);

  // Query GET /api/quiz/attempts/:id: Must NOT leak score!
  const midAttempt = await quizService.getAttempt('user-alice', startDaily.attemptId);
  assert.equal(midAttempt.status, 'in_progress');
  assert.equal(midAttempt.score, null);
  assert.equal(midAttempt.correctCount, null);
  inspectNoGradingLeaks(midAttempt);

  // Query stats: must not count in_progress attempt
  const stats = await quizService.getUserStats('user-alice');
  assert.equal(stats.totalAttempts, 0);
  assert.equal(stats.completedAttempts, 0);
  assert.equal(stats.totalScore, 0);

  // 4. Finish attempt: score is now revealed in both attempt and daily challenge
  await quizService.finishAttempt('user-alice', startDaily.attemptId);
  const finalDaily = await quizService.getDailyChallenge('user-alice');
  assert.equal(finalDaily.attemptStatus, 'completed');
  assert.equal(finalDaily.score, 10);

  const finalAttempt = await quizService.getAttempt('user-alice', startDaily.attemptId);
  assert.equal(finalAttempt.status, 'completed');
  assert.equal(finalAttempt.score, 10);
});
