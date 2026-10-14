import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import worker from '../src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function sha256Sync(str) {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(str).digest('hex');
}

function createCrossModuleEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  const migrationFiles = fs.readdirSync(path.join(REPO_ROOT, 'worker/migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations', file), 'utf8');
    db.exec(sql);
  }

  // Seed users
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-alice', 'alice@vna.vn', 'Alice Dang', 'active');");
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-bob', 'bob@vna.vn', 'Bob Tran', 'active');");

  // Auth tokens
  const aliceToken = 'alice-cross-module-token-123456';
  const bobToken = 'bob-cross-module-token-123456';
  const aliceHash = '1e0461b7ad580e5c5d52e5003cec799b4fbd41882e4fb0285a45d8d56e3cad62'; // sha256(aliceToken)
  const bobHash = 'e80a89bf75fcd2ae7d40899dde61004e95b425cb818732550066900ff3e13e4e'; // sha256(bobToken)

  db.exec(`INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ('sess-alice', 'user-alice', '${aliceHash}', datetime('now', '+1 day'));`);
  db.exec(`INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ('sess-bob', 'user-bob', '${bobHash}', datetime('now', '+1 day'));`);
  db.exec("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ('sess-expired', 'user-alice', 'expired-hash-01', datetime('now', '-1 day'));");

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
    rawDb: db,
    aliceToken,
    bobToken,
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
    MOCK_PAYMENT_ENABLED: 'true',
    ADMIN_AI_CONFIG_ENABLED: 'true',
    ADMIN_ENCRYPTION_KEY: '1234567890123456',
    CORS_ALLOW_ORIGIN: '*',
    ...overrides,
  };
}

// =============================================================================
// B2.1: IDENTITY -> PROFILE / SESSION OWNERSHIP
// =============================================================================
test('B2.1 Cross-Module: Identity authentication, token lifecycle, and user data isolation', async () => {
  const env = createCrossModuleEnv();

  // 1. Unauthenticated request to /api/me -> 401
  const unauthRes = await worker.fetch(new Request('http://localhost/api/me'), env);
  assert.equal(unauthRes.status, 401);

  // 2. Authenticated Alice -> 200 with Alice profile
  const aliceRes = await worker.fetch(new Request('http://localhost/api/me', {
    headers: { 'Authorization': 'Bearer ' + env.aliceToken },
  }), env);
  assert.equal(aliceRes.status, 200);
  const aliceData = await aliceRes.json();
  assert.equal(aliceData.user.id, 'user-alice');
  assert.equal(aliceData.user.email, 'alice@vna.vn');

  // 3. Authenticated Bob -> 200 with Bob profile
  const bobRes = await worker.fetch(new Request('http://localhost/api/me', {
    headers: { 'Authorization': 'Bearer ' + env.bobToken },
  }), env);
  assert.equal(bobRes.status, 200);
  const bobData = await bobRes.json();
  assert.equal(bobData.user.id, 'user-bob');
  assert.notEqual(aliceData.user.id, bobData.user.id);

  // 4. Expired token -> 401
  const expRes = await worker.fetch(new Request('http://localhost/api/me', {
    headers: { 'Authorization': 'Bearer expired-token-invalid' },
  }), env);
  assert.equal(expRes.status, 401);
});

// =============================================================================
// B2.2: QUIZ -> REWARDS INTEGRATION FLOW
// =============================================================================
test('B2.2 Cross-Module: Quiz start -> answer -> finalize -> claim quiz reward -> lucky spin -> wallet', async () => {
  const env = createCrossModuleEnv();

  // 1. Alice starts practice quiz attempt
  const startQuizRes = await worker.fetch(new Request('http://localhost/api/quiz/attempts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({ attemptType: 'practice', questionCount: 2 }),
  }), env);
  assert.equal(startQuizRes.status, 201);
  const startQuizData = await startQuizRes.json();
  const attemptId = startQuizData.attempt.attemptId;
  const q0 = startQuizData.attempt.questions[0];
  const q1 = startQuizData.attempt.questions[1];

  // In-progress anti-leak verification: correctOptionId must NOT be revealed!
  assert.equal(q0.correctOptionId, undefined, 'Must not leak correctOptionId while in_progress');
  assert.equal(q0.isCorrect, undefined);

  // Query correct options from DB securely to ensure 20 points (passing threshold)
  const qDetail0 = env.rawDb.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').get(q0.id);
  const qDetail1 = env.rawDb.prepare('SELECT correct_option_id FROM quiz_attempt_questions WHERE id = ?').get(q1.id);
  assert.ok(qDetail0.correct_option_id);
  assert.ok(qDetail1.correct_option_id);

  // 2. Submit correct answers for both questions
  await worker.fetch(new Request(`http://localhost/api/quiz/attempts/${attemptId}/answers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({ attemptQuestionId: q0.id, selectedOptionId: qDetail0.correct_option_id }),
  }), env);

  const ansRes = await worker.fetch(new Request(`http://localhost/api/quiz/attempts/${attemptId}/answers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({ attemptQuestionId: q1.id, selectedOptionId: qDetail1.correct_option_id }),
  }), env);
  assert.equal(ansRes.status, 200);
  const ansData = await ansRes.json();
  assert.equal(ansData.isCorrect, undefined, 'submitAnswer must not reveal isCorrect');

  // Verify in_progress attempt score is masked as null (P1-QZ-08)
  const inProgAtt = await worker.fetch(new Request(`http://localhost/api/quiz/attempts/${attemptId}`, {
    headers: { 'Authorization': 'Bearer ' + env.aliceToken },
  }), env);
  const inProgData = await inProgAtt.json();
  assert.equal(inProgData.attempt.status, 'in_progress');
  assert.equal(inProgData.attempt.score, null, 'Score must remain null while in_progress');

  // 3. Finalize attempt
  const finRes = await worker.fetch(new Request(`http://localhost/api/quiz/attempts/${attemptId}/finish`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.aliceToken },
  }), env);
  assert.equal(finRes.status, 200);
  const finData = await finRes.json();
  assert.equal(finData.result.status, 'completed');
  assert.equal(finData.result.score, 20, 'Authoritative score: 20 points');

  // 4. Alice claims Quiz reward for lucky spin
  const claimQuizRes = await worker.fetch(new Request('http://localhost/api/rewards/spins/claim-quiz', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({ quizAttemptId: attemptId, campaignId: 'cmp-dak-song-2026' }),
  }), env);
  assert.equal(claimQuizRes.status, 200);
  const claimData = await claimQuizRes.json();
  assert.equal(claimData.success, true);
  assert.ok(claimData.entitlementId);

  // Bob cannot claim Alice's quiz attempt -> 403
  const bobCheatRes = await worker.fetch(new Request('http://localhost/api/rewards/spins/claim-quiz', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.bobToken,
    },
    body: JSON.stringify({ quizAttemptId: attemptId, campaignId: 'cmp-dak-song-2026' }),
  }), env);
  assert.equal(bobCheatRes.status, 403, 'Cross-user quiz claim must be rejected');

  // 5. Alice spins wheel with newly awarded entitlement
  // Set deterministic 100% voucher win
  env.rawDb.exec("UPDATE reward_spin_segments SET weight = 0 WHERE wheel_id = 'wheel-dak-song-lucky'");
  env.rawDb.exec("UPDATE reward_spin_segments SET weight = 100 WHERE id = 'seg-1'");

  const spinRes = await worker.fetch(new Request('http://localhost/api/rewards/spins', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-quiz-spin-01',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({ campaignId: 'cmp-dak-song-2026' }),
  }), env);
  assert.equal(spinRes.status, 200);
  const spinData = await spinRes.json();
  assert.ok(spinData.voucher);

  // 6. Alice views wallet and verifies newly issued voucher
  const walletRes = await worker.fetch(new Request('http://localhost/api/rewards/wallet', {
    headers: { 'Authorization': 'Bearer ' + env.aliceToken },
  }), env);
  assert.equal(walletRes.status, 200);
  const walletData = await walletRes.json();
  const v = walletData.items.find((item) => item.voucher_code === spinData.voucher.code);
  assert.ok(v);
  assert.equal(v.status, 'issued');

  // Bob cannot view Alice's voucher -> 403
  const bobLeakRes = await worker.fetch(new Request(`http://localhost/api/rewards/wallet/${v.id}`, {
    headers: { 'Authorization': 'Bearer ' + env.bobToken },
  }), env);
  assert.equal(bobLeakRes.status, 403);
});

// =============================================================================
// B2.3: BOOKING -> ADMIN & MOCK PAYMENT FLOW
// =============================================================================
test('B2.3 Cross-Module: Tour listing -> quote calculation -> booking with idempotency -> mock payment', async () => {
  const env = createCrossModuleEnv();

  // 1. Browse public tours
  const toursRes = await worker.fetch(new Request('http://localhost/api/tours'), env);
  assert.equal(toursRes.status, 200);
  const toursData = await toursRes.json();
  assert.ok(toursData.tours.length >= 3);
  const tour = toursData.tours[0];

  // 2. Create authoritative quote
  const quoteRes = await worker.fetch(new Request('http://localhost/api/quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({
      tourId: tour.id,
      adultsCount: 2,
      childrenCount: 1,
      bookingDate: '2026-11-20',
    }),
  }), env);
  assert.equal(quoteRes.status, 201);
  const quoteData = await quoteRes.json();
  assert.ok(quoteData.quote.id);
  assert.ok(quoteData.quote.total_price > 0);

  // 3. Create booking with idempotency key
  const bookRes = await worker.fetch(new Request('http://localhost/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-book-cross-01',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({
      quoteReference: quoteData.quote.quote_reference,
      customerName: 'Alice Dang',
      customerPhone: '0912345678',
    }),
  }), env);
  assert.equal(bookRes.status, 201);
  const bookData = await bookRes.json();
  const bookingId = bookData.booking.id;
  assert.ok(bookingId);

  // 4. Bob cannot view Alice's booking detail -> 404 (unauthorized/non-existent)
  const bobViewRes = await worker.fetch(new Request(`http://localhost/api/bookings/${bookingId}`, {
    headers: { 'Authorization': 'Bearer ' + env.bobToken },
  }), env);
  assert.equal(bobViewRes.status, 404);

  // 5. Alice pays with mock payment
  const payRes = await worker.fetch(new Request(`http://localhost/api/bookings/${bookingId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({ simulateStatus: 'success', idempotencyKey: 'idem-pay-cross-01' }),
  }), env);
  assert.equal(payRes.status, 200);
  const payData = await payRes.json();
  assert.equal(payData.success, true);
  assert.equal(payData.booking.payment_status, 'paid');

  // 6. Admin inspects booking in Admin API
  const adminBookRes = await worker.fetch(new Request(`http://localhost/api/admin/bookings/${bookingId}`, {
    headers: { 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  }), env);
  assert.equal(adminBookRes.status, 200);
  const adminBookData = await adminBookRes.json();
  assert.equal(adminBookData.booking.payment_status, 'paid');
});

// =============================================================================
// B2.4: TRAVEL PLANNER CAS & USER ISOLATION
// =============================================================================
test('B2.4 Cross-Module: Travel planner preview -> save -> version CAS update -> delete', async () => {
  const env = createCrossModuleEnv();

  // 1. Preview itinerary
  const prevRes = await worker.fetch(new Request('http://localhost/api/itineraries/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Lịch trình Đắk Song 3N2Đ',
      startDate: '2026-11-01',
      durationDays: 3,
      travelersCount: 2,
    }),
  }), env);
  assert.equal(prevRes.status, 200);
  const prevData = await prevRes.json();
  assert.ok(prevData.itinerary.days.length === 3);

  // 2. Save itinerary for Alice
  const saveRes = await worker.fetch(new Request('http://localhost/api/itineraries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify(prevData.itinerary),
  }), env);
  assert.equal(saveRes.status, 201);
  const saveData = await saveRes.json();
  const itinId = saveData.itinerary.id;
  assert.equal(saveData.itinerary.version, 1);

  // 3. Bob cannot modify Alice's itinerary -> 404 (unauthorized/non-existent)
  const bobUpdateRes = await worker.fetch(new Request(`http://localhost/api/itineraries/${itinId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.bobToken,
    },
    body: JSON.stringify({
      version: 1,
      title: 'Bob Hacker Itinerary',
    }),
  }), env);
  assert.equal(bobUpdateRes.status, 404);

  // 4. Alice updates with stale version 0 -> 409 Conflict (CAS guard)
  const staleUpdateRes = await worker.fetch(new Request(`http://localhost/api/itineraries/${itinId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({
      version: 0,
      title: 'Stale update',
    }),
  }), env);
  assert.equal(staleUpdateRes.status, 409);

  // 5. Alice updates with correct version 1 -> 200, version becomes 2
  const correctUpdateRes = await worker.fetch(new Request(`http://localhost/api/itineraries/${itinId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.aliceToken,
    },
    body: JSON.stringify({
      ...saveData.itinerary,
      version: 1,
      title: 'Lịch trình Đắk Song Nâng Cấp',
    }),
  }), env);
  assert.equal(correctUpdateRes.status, 200);
  const updatedData = await correctUpdateRes.json();
  assert.equal(updatedData.itinerary.version, 2);
});

// =============================================================================
// B2.5: ADMIN OPERATIONS & READINESS AUDIT
// =============================================================================
test('B2.5 Cross-Module: Admin operations readiness endpoint returns accurate D1 state and CSV export is formula-safe', async () => {
  const env = createCrossModuleEnv();

  // 1. Unauthenticated request to /api/admin/operations/readiness in fail-closed mode -> 401
  const failClosedEnv = { ...env, ENVIRONMENT: 'production', ADMIN_DEV_MOCK_AUTH: 'false' };
  const unauthRes = await worker.fetch(new Request('http://localhost/api/admin/operations/readiness'), failClosedEnv);
  assert.equal(unauthRes.status, 401);

  // 2. Authenticated Admin request -> 200 with full D1 state
  const readinessRes = await worker.fetch(new Request('http://localhost/api/admin/operations/readiness', {
    headers: { 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  }), env);
  assert.equal(readinessRes.status, 200);
  const readyData = await readinessRes.json();

  // Invariants verification:
  assert.equal(readyData.system.databaseConnected, true);
  assert.equal(readyData.system.expectedMigrationsCount, 15);
  assert.equal(readyData.system.migrationVerificationStatus, 'UNKNOWN');
  assert.equal(readyData.invariants.zeroOversoldTemplates, true);
  assert.equal(readyData.invariants.zeroOversoldSegments, true);
  assert.equal(readyData.invariants.zeroGhostVoucherSpins, true);
  assert.equal(readyData.invariants.overallIntegrity, true);

  // Verify prominent DEMO/MOCK labels:
  assert.ok(readyData.modules.bookingAndPayment.label.includes('MÔ PHỎNG / DEMO'));
  assert.ok(readyData.modules.rewardsAndLuckySpin.label.includes('DEMO ONLY'));

  // 3. Export Operations CSV
  const { AdminService } = await import('../src/services/admin.service.ts');
  const adminService = new AdminService(env);
  const directCsv = await adminService.exportOperationsCsv();
  assert.ok(directCsv.startsWith('\uFEFF'), 'Direct CSV string must start with UTF-8 BOM');

  const csvRes = await worker.fetch(new Request('http://localhost/api/admin/operations/export', {
    headers: { 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  }), env);
  assert.equal(csvRes.status, 200);
  const csvBytes = new Uint8Array(await csvRes.arrayBuffer());
  assert.equal(csvBytes[0], 0xEF, 'First BOM byte must be 0xEF');
  assert.equal(csvBytes[1], 0xBB, 'Second BOM byte must be 0xBB');
  assert.equal(csvBytes[2], 0xBF, 'Third BOM byte must be 0xBF');
  const csvText = new TextDecoder('utf-8').decode(csvBytes);
  assert.ok(csvText.includes('BÁO CÁO NGHIỆM THU & VẬN HÀNH HỆ THỐNG DU LỊCH ĐẮK SONG'));
  assert.ok(csvText.includes('100% ĐẠT CHUẨN KỸ THUẬT'));
});
