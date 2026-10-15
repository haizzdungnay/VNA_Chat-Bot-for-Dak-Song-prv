import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { BookingService } from '../src/services/booking.service.ts';
import { IdentityService } from '../src/services/identity.service.ts';
import worker from '../src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createTestEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(4, '0');
    const migFile = fs.readdirSync(path.join(REPO_ROOT, 'worker/migrations')).find((f) => f.startsWith(num));
    if (migFile) {
      const sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations', migFile), 'utf8');
      db.exec(sql);
    }
  }

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

  return {
    DB: {
      prepare(sql) {
        return makeStmt(sql);
      },
      async batch(statements) {
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
      },
    },
    rawDb: db,
    ENVIRONMENT: 'development',
    ADMIN_DEV_MOCK_AUTH: 'true',
    ...overrides,
  };
}

// ==================== P1-01: FEATURE FLAG FAIL-OPEN (10 TEST CASES) ====================

test('P1-01 Policy 1-4: Missing, undefined, empty string, or false MOCK_PAYMENT_ENABLED must deny payment (503)', async () => {
  const invalidFlagCases = [
    {}, // missing
    { MOCK_PAYMENT_ENABLED: undefined },
    { MOCK_PAYMENT_ENABLED: '' },
    { MOCK_PAYMENT_ENABLED: 'false' },
    { MOCK_PAYMENT_ENABLED: false },
    { MOCK_PAYMENT_ENABLED: 'some_random_value' },
  ];

  for (const flagCase of invalidFlagCases) {
    const env = createTestEnv(flagCase);
    const bookingService = new BookingService(env);

    env.rawDb.exec(`
      INSERT INTO users (id, display_name, status) VALUES ('user-flag-test', 'Tester', 'active');
      INSERT INTO booking_quotes (id, quote_reference, user_id, status, total_price, expires_at)
      VALUES ('q-flag', 'QT-FLAG-' || random(), 'user-flag-test', 'consumed', 500000, datetime('now', '+30 minutes'));
      INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status)
      VALUES ('bk-flag', 'BK-FLAG-' || random(), 'user-flag-test', 'q-flag', 'Alice', '0987654321', 500000, 'pending', 'unpaid');
    `);

    await assert.rejects(
      async () => {
        await bookingService.processMockPayment({
          userId: 'user-flag-test',
          bookingId: 'bk-flag',
          paymentMethod: 'mock_bank_transfer',
          simulateStatus: 'success',
        });
      },
      (err) => err.status === 503 && err.message.includes('vô hiệu hóa')
    );
  }
});

test('P1-01 Policy 5-7: MOCK_PAYMENT_ENABLED=true in development, test, and staging is allowed', async () => {
  const allowedEnvs = ['development', 'test', 'staging'];

  for (const envName of allowedEnvs) {
    const env = createTestEnv({
      ENVIRONMENT: envName,
      MOCK_PAYMENT_ENABLED: 'true',
    });
    const bookingService = new BookingService(env);

    const bId = 'bk-allow-' + envName;
    const qId = 'q-allow-' + envName;
    env.rawDb.exec(`
      INSERT INTO users (id, display_name, status) VALUES ('u-${envName}', 'Tester', 'active');
      INSERT INTO booking_quotes (id, quote_reference, user_id, status, total_price, expires_at)
      VALUES ('${qId}', 'QT-${envName}', 'u-${envName}', 'consumed', 500000, datetime('now', '+30 minutes'));
      INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status)
      VALUES ('${bId}', 'BK-${envName}', 'u-${envName}', '${qId}', 'Alice', '0987654321', 500000, 'pending', 'unpaid');
    `);

    const res = await bookingService.processMockPayment({
      userId: 'u-' + envName,
      bookingId: bId,
      paymentMethod: 'mock_bank_transfer',
      simulateStatus: 'success',
    });

    assert.equal(res.success, true);
    assert.equal(res.booking.payment_status, 'paid');
  }
});

test('P1-01 Policy 8-9: MOCK_PAYMENT_ENABLED=true in production or unknown environment must be strictly denied (503)', async () => {
  const disallowedEnvs = ['production', 'prod', 'unknown_env', 'custom_demo'];

  for (const envName of disallowedEnvs) {
    const env = createTestEnv({
      ENVIRONMENT: envName,
      MOCK_PAYMENT_ENABLED: 'true',
    });
    const bookingService = new BookingService(env);

    const bId = 'bk-deny-' + envName;
    const qId = 'q-deny-' + envName;
    env.rawDb.exec(`
      INSERT INTO users (id, display_name, status) VALUES ('u-${envName}', 'Tester', 'active');
      INSERT INTO booking_quotes (id, quote_reference, user_id, status, total_price, expires_at)
      VALUES ('${qId}', 'QT-${envName}', 'u-${envName}', 'consumed', 500000, datetime('now', '+30 minutes'));
      INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status)
      VALUES ('${bId}', 'BK-${envName}', 'u-${envName}', '${qId}', 'Alice', '0987654321', 500000, 'pending', 'unpaid');
    `);

    await assert.rejects(
      async () => {
        await bookingService.processMockPayment({
          userId: 'u-' + envName,
          bookingId: bId,
          paymentMethod: 'mock_bank_transfer',
          simulateStatus: 'success',
        });
      },
      (err) => err.status === 503 && err.message.includes('vô hiệu hóa')
    );
  }
});

test('P1-01 Policy 10: Disabling feature flag does NOT block reading existing bookings and history', async () => {
  const env = createTestEnv({
    ENVIRONMENT: 'development',
    MOCK_PAYMENT_ENABLED: 'false', // explicitly disabled
  });
  const bookingService = new BookingService(env);

  env.rawDb.exec(`
    INSERT INTO users (id, display_name, status) VALUES ('user-view', 'Viewer', 'active');
    INSERT INTO booking_quotes (id, quote_reference, user_id, status, total_price, expires_at)
    VALUES ('q-view', 'QT-VIEW', 'user-view', 'consumed', 500000, datetime('now', '+30 minutes'));
    INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status)
    VALUES ('bk-view', 'BK-VIEW', 'user-view', 'q-view', 'Alice', '0987654321', 500000, 'confirmed', 'paid');
  `);

  // Both detail and list queries must succeed cleanly
  const detail = await bookingService.getBooking('user-view', 'bk-view');
  assert.equal(detail.booking.id, 'bk-view');
  assert.equal(detail.booking.customer_name, 'Alice');

  const list = await bookingService.listUserBookings('user-view');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'bk-view');
});

// ==================== P1-02: INVALID SIMULATE STATUS (FULL SUITE) ====================

test('P1-02: POST /api/bookings/:id/pay strictly validates simulateStatus and causes zero side effects', async () => {
  const env = createTestEnv({
    MOCK_PAYMENT_ENABLED: 'true',
  });

  const identityService = new IdentityService(env);
  const loginRes = await identityService.loginWithZalo('mock_zalo_token_dev_1');
  const sessionToken = loginRes.sessionToken;
  const authedUserId = loginRes.user.id;

  env.rawDb.exec(`
    INSERT INTO booking_quotes (id, quote_reference, user_id, status, total_price, expires_at)
    VALUES ('q-route', 'QT-ROUTE', '${authedUserId}', 'consumed', 500000, datetime('now', '+30 minutes'));

    INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status)
    VALUES ('bk-route', 'BK-ROUTE', '${authedUserId}', 'q-route', 'Alice', '0987654321', 500000, 'pending', 'unpaid');
  `);

  const mockCtx = { waitUntil: () => {}, passThroughOnException: () => {} };

  // 1. Valid inputs: 'success' and 'failed'
  // Test 'failed' first to preserve 'unpaid' / 'failed' retryable state
  const reqFail = new Request('http://localhost/api/bookings/bk-route/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ simulateStatus: 'failed', paymentMethod: 'mock_bank_transfer' }),
  });
  const resFail = await worker.fetch(reqFail, env, mockCtx);
  assert.equal(resFail.status, 200, 'simulateStatus: "failed" must succeed with 200');
  const bodyFail = await resFail.json();
  assert.equal(bodyFail.success, false);

  // 2. All invalid inputs must return 400
  const invalidInputs = ['abc', null, undefined, true, 123, '', [], {}];

  for (const invalid of invalidInputs) {
    const req = new Request('http://localhost/api/bookings/bk-route/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ simulateStatus: invalid, paymentMethod: 'mock_bank_transfer' }),
    });

    const res = await worker.fetch(req, env, mockCtx);
    assert.equal(res.status, 400, `Invalid simulateStatus ${JSON.stringify(invalid)} must return 400`);
  }

  // 3. Verify zero database side effects: attempts count must remain 1 (from the single valid failed test above)
  const attemptsCount = env.rawDb.prepare('SELECT count(*) as cnt FROM mock_payment_attempts WHERE booking_id = ?').get('bk-route').cnt;
  assert.equal(attemptsCount, 1, 'Invalid requests caused 0 additional payment attempts');

  const booking = env.rawDb.prepare('SELECT payment_status FROM tour_bookings WHERE id = ?').get('bk-route');
  assert.equal(booking.payment_status, 'failed', 'Booking remains in failed retryable state, not erroneously marked paid');
});

// ==================== P1-03: FRACTIONAL TRAVELER COUNTS (FULL MATRIX) ====================

test('P1-03: calculateQuote strictly validates integers and rejects fractional, negative, or invalid types', async () => {
  const env = createTestEnv({
    MOCK_PAYMENT_ENABLED: 'true',
  });
  const bookingService = new BookingService(env);

  env.rawDb.exec("INSERT INTO users (id, display_name, status) VALUES ('u-pricing', 'Pricer', 'active');");

  // Valid integers: Accepted
  const valid = await bookingService.calculateQuote({
    userId: 'u-pricing',
    adultsCount: 2,
    childrenCount: 1,
    durationDays: 2,
  });
  assert.ok(valid.quote.id);
  assert.equal(valid.quote.adults_count, 2);
  assert.equal(valid.quote.children_count, 1);

  // Invalid cases: Must reject without silent rounding
  const invalidMatrix = [
    { adults: 1.7, children: 0, reason: 'fractional adults' },
    { adults: 2, children: 2.9, reason: 'fractional children' },
    { adults: -1, children: 0, reason: 'negative adults' },
    { adults: 2, children: -1, reason: 'negative children' },
    { adults: NaN, children: 0, reason: 'NaN adults' },
    { adults: Infinity, children: 0, reason: 'Infinity adults' },
    { adults: null, children: 0, reason: 'null adults' },
    { adults: 'abc', children: 0, reason: 'string adults' },
    { adults: true, children: 0, reason: 'boolean adults' },
    { adults: Number.MAX_SAFE_INTEGER + 100, children: 0, reason: 'unsafe integer adults' },
  ];

  for (const testCase of invalidMatrix) {
    await assert.rejects(
      async () => {
        await bookingService.calculateQuote({
          userId: 'u-pricing',
          adultsCount: testCase.adults,
          childrenCount: testCase.children,
        });
      },
      /Số lượng/
    );
  }
});

// ==================== P1-04: MIGRATION 0010 RECONCILIATION ====================

test('P1-04: Migration 0010 reconciles historical refund timestamps and sets provenance', async () => {
  const env = createTestEnv();

  // Seed historical booking, payment and state event with DIFFERENT timestamps
  const paymentTime = '2026-10-10T10:00:00.000Z';
  const refundTime = '2026-10-12T14:30:00.000Z';

  env.rawDb.exec(`
    INSERT INTO users (id, display_name, status) VALUES ('u-rec', 'Rec', 'active');
    INSERT INTO booking_quotes (id, quote_reference, user_id, status, total_price, expires_at)
    VALUES ('q-rec', 'QT-REC', 'u-rec', 'consumed', 500000, datetime('now', '+30 minutes'));
    INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status, created_at)
    VALUES ('bk-rec', 'BK-REC', 'u-rec', 'q-rec', 'Alice', '0987654321', 500000, 'cancelled', 'refunded', '${paymentTime}');
    INSERT INTO mock_payment_attempts (id, booking_id, transaction_reference, payment_method, amount, currency, status, refunded_amount, created_at)
    VALUES ('tx-rec', 'bk-rec', 'TX-REC', 'mock_bank_transfer', 500000, 'VND', 'success', 500000, '${paymentTime}');
    INSERT INTO booking_state_events (id, booking_id, event_type, from_status, to_status, actor, reason, created_at)
    VALUES ('ev-rec-ref', 'bk-rec', 'refunded', 'paid', 'refunded', 'admin@daksong.vn', 'Khách hủy', '${refundTime}');

    -- Backfilled record with old paymentTime
    INSERT INTO mock_payment_refunds (id, payment_attempt_id, booking_id, amount, currency, reason, actor, created_at)
    VALUES ('rf-backfill-tx-rec', 'tx-rec', 'bk-rec', 500000, 'VND', 'Backfill', 'system', '${paymentTime}');
  `);

  // Apply migration 0010 logic
  const m10 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0010_historical_refund_reconciliation.sql'), 'utf8');
  // Strip ALTER TABLE since createTestEnv already applied it
  const updateOnly = m10.slice(m10.indexOf('UPDATE mock_payment_refunds'));
  env.rawDb.exec(updateOnly);

  const reconciled = env.rawDb.prepare('SELECT created_at, timestamp_provenance FROM mock_payment_refunds WHERE id = ?').get('rf-backfill-tx-rec');
  assert.equal(reconciled.created_at, refundTime, 'created_at reconciled to exact refund event timestamp');
  assert.equal(reconciled.timestamp_provenance, 'state_event_recovered', 'timestamp_provenance marked state_event_recovered');
});

// ==================== P1-05: LIVE WRANGLER D1 INTEGRATION ====================

test('P1-05: Live Wrangler D1 Binding Integration (http://127.0.0.1:8788)', async (t) => {
  let isServerRunning = false;
  try {
    const probe = await fetch('http://127.0.0.1:8788/api/places');
    if (probe.status === 200) isServerRunning = true;
  } catch {}

  if (!isServerRunning) {
    t.skip('Local Wrangler dev server is not active on http://127.0.0.1:8788');
    return;
  }

  // Live test against the actual Cloudflare Worker + local D1 database
  const toursRes = await fetch('http://127.0.0.1:8788/api/tours');
  assert.equal(toursRes.status, 200);
  const toursData = await toursRes.json();
  assert.ok(Array.isArray(toursData.tours));
  assert.ok(toursData.tours.length >= 3);
});
