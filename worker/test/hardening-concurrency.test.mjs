import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { BookingService } from '../src/services/booking.service.ts';
import { AdminBookingService, getPeriodBoundsUtc } from '../src/services/admin-booking.service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createHardenedTestEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  for (let i = 1; i <= 9; i++) {
    const num = String(i).padStart(4, '0');
    const migFile = fs.readdirSync(path.join(REPO_ROOT, 'worker/migrations')).find((f) => f.startsWith(num));
    if (migFile) {
      const sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations', migFile), 'utf8');
      db.exec(sql);
    }
  }

  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-1', 'alice@example.com', 'Alice', 'active');");
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-2', 'bob@example.com', 'Bob', 'active');");

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
        batchLock = new Promise((r) => (resolveLock = r));
        await prev;
        try {
          return runBatch();
        } finally {
          resolveLock();
        }
      },
    },
    rawDb: db,
    ENVIRONMENT: 'test',
    ADMIN_DEV_MOCK_AUTH: 'true',
    MOCK_PAYMENT_ENABLED: 'true',
    ...overrides,
  };
}

// ==================== P0-01 TESTS ====================

test('P0-01: Same quote, different keys concurrently -> exactly 1 winner, quote consumed, loser 409', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 2,
    childrenCount: 0,
    durationDays: 1,
  });

  const results = await Promise.allSettled([
    bookingService.createBooking({
      userId: 'user-1',
      quoteReference: quote.quote.quote_reference,
      customerName: 'Alice Nguyen 1',
      customerPhone: '0987654321',
      idempotencyKey: 'key-req-1',
    }),
    bookingService.createBooking({
      userId: 'user-1',
      quoteReference: quote.quote.quote_reference,
      customerName: 'Alice Nguyen 2',
      customerPhone: '0987654322',
      idempotencyKey: 'key-req-2',
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one request must succeed');
  assert.equal(rejected.length, 1, 'The competing request must be rejected');
  assert.equal(rejected[0].reason.status, 409, 'Rejection must have 409 status');

  const count = env.rawDb.prepare('SELECT count(*) as count FROM tour_bookings WHERE quote_id = ?').get(quote.quote.id).count;
  assert.equal(count, 1, 'Database must have exactly 1 booking for this quote');

  const quoteStatus = env.rawDb.prepare('SELECT status FROM booking_quotes WHERE id = ?').get(quote.quote.id).status;
  assert.equal(quoteStatus, 'consumed', 'Quote must be marked consumed');
});

test('P0-01: Same quote, same key -> idempotent replay returns identical booking, zero duplicates', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 2,
    childrenCount: 0,
    durationDays: 1,
  });

  const req = {
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice Nguyen',
    customerPhone: '0987654321',
    idempotencyKey: 'stable-key-1',
  };

  const first = await bookingService.createBooking(req);
  const replay = await bookingService.createBooking(req);

  assert.equal(first.booking.id, replay.booking.id, 'Replay must return exact same booking ID');
  assert.equal(first.booking.booking_reference, replay.booking.booking_reference);

  const count = env.rawDb.prepare('SELECT count(*) as count FROM tour_bookings WHERE quote_id = ?').get(quote.quote.id).count;
  assert.equal(count, 1, 'Database has exactly 1 booking');

  const itemsCount = env.rawDb.prepare('SELECT count(*) as count FROM tour_booking_items WHERE booking_id = ?').get(first.booking.id).count;
  assert.equal(itemsCount, 1, 'Items count unchanged on replay');
});

test('P0-01: Same key, different payload -> 409 Conflict', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 2,
    childrenCount: 0,
    durationDays: 1,
  });

  await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice Nguyen',
    customerPhone: '0987654321',
    idempotencyKey: 'key-payload-conflict',
  });

  // Second request reuses same key but modifies customer name
  await assert.rejects(
    async () => {
      await bookingService.createBooking({
        userId: 'user-1',
        quoteReference: quote.quote.quote_reference,
        customerName: 'Alice Nguyen MODIFIED',
        customerPhone: '0987654321',
        idempotencyKey: 'key-payload-conflict',
      });
    },
    err => err.status === 409 && err.message.includes('thông tin đặt tour khác')
  );
});

// ==================== P0-02 TESTS ====================

test('P0-02: Two concurrent success payments on same booking -> exactly 1 winner, no double revenue', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 2,
    childrenCount: 0,
    durationDays: 1,
  });

  const booking = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice Nguyen',
    customerPhone: '0987654321',
  });

  const results = await Promise.allSettled([
    bookingService.processMockPayment({
      userId: 'user-1',
      bookingId: booking.booking.id,
      paymentMethod: 'mock_bank_transfer',
      simulateStatus: 'success',
      idempotencyKey: 'pay-key-1',
    }),
    bookingService.processMockPayment({
      userId: 'user-1',
      bookingId: booking.booking.id,
      paymentMethod: 'mock_bank_transfer',
      simulateStatus: 'success',
      idempotencyKey: 'pay-key-2',
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one payment must succeed');
  assert.equal(rejected.length, 1, 'The competing payment must be rejected');
  assert.equal(rejected[0].reason.status, 409);

  const count = env.rawDb.prepare("SELECT count(*) as count FROM mock_payment_attempts WHERE booking_id = ? AND status = 'success'").get(booking.booking.id).count;
  assert.equal(count, 1, 'Database must have exactly 1 success payment');

  const bStatus = env.rawDb.prepare('SELECT payment_status FROM tour_bookings WHERE id = ?').get(booking.booking.id).payment_status;
  assert.equal(bStatus, 'paid');
});

test('P0-02: Idempotent replay of successful payment returns exact receipt without adding rows', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 1,
    childrenCount: 0,
  });
  const booking = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice',
    customerPhone: '0987654321',
  });

  const payReq = {
    userId: 'user-1',
    bookingId: booking.booking.id,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'success',
    idempotencyKey: 'pay-replay-key',
  };

  const p1 = await bookingService.processMockPayment(payReq);
  const p2 = await bookingService.processMockPayment(payReq);

  assert.equal(p1.transactionReference, p2.transactionReference);
  assert.equal(p1.success, true);
  assert.equal(p2.success, true);

  const txCount = env.rawDb.prepare('SELECT count(*) as count FROM mock_payment_attempts WHERE booking_id = ?').get(booking.booking.id).count;
  assert.equal(txCount, 1, 'Must have strictly 1 payment attempt record');
});

test('P0-02: Payment on cancelled booking is strictly rejected', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 1,
    childrenCount: 0,
  });
  const booking = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice',
    customerPhone: '0987654321',
  });

  await bookingService.cancelBooking('user-1', booking.booking.id, 'Khách hủy');

  await assert.rejects(
    async () => {
      await bookingService.processMockPayment({
        userId: 'user-1',
        bookingId: booking.booking.id,
        paymentMethod: 'mock_bank_transfer',
        simulateStatus: 'success',
      });
    },
    err => err.status === 409 && err.message.includes('đã bị hủy')
  );
});

// ==================== P0-03 TESTS ====================

test('P0-03: Cross-user idempotency must NEVER leak another users booking', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  // User 1 creates and pays booking
  const quote1 = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 1,
    childrenCount: 0,
    durationDays: 1,
  });
  const booking1 = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote1.quote.quote_reference,
    customerName: 'Alice Secret',
    customerPhone: '0987654321',
  });
  await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId: booking1.booking.id,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'success',
    idempotencyKey: 'alice-secret-key',
  });

  // User 2 creates booking 2
  const quote2 = await bookingService.calculateQuote({
    userId: 'user-2',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 1,
    childrenCount: 0,
    durationDays: 1,
  });
  const booking2 = await bookingService.createBooking({
    userId: 'user-2',
    quoteReference: quote2.quote.quote_reference,
    customerName: 'Bob Intruder',
    customerPhone: '0912345678',
  });

  // User 2 maliciously calls payment on booking 2 using User 1's idempotency key
  await assert.rejects(
    async () => {
      await bookingService.processMockPayment({
        userId: 'user-2',
        bookingId: booking2.booking.id,
        paymentMethod: 'mock_bank_transfer',
        simulateStatus: 'success',
        idempotencyKey: 'alice-secret-key',
      });
    },
    err => err.status === 409 && err.message.includes('Khóa định danh')
  );

  // Verify Bob cannot read Alice's booking details
  await assert.rejects(
    async () => {
      await bookingService.getBooking('user-2', booking1.booking.id);
    },
    err => err.status === 404
  );
});

test('P0-03: Same user using same key on different booking is rejected with 409', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  const q1 = await bookingService.calculateQuote({ userId: 'user-1', selectedServiceIds: ['srv-guide-01'], adultsCount: 1, childrenCount: 0 });
  const b1 = await bookingService.createBooking({ userId: 'user-1', quoteReference: q1.quote.quote_reference, customerName: 'Alice', customerPhone: '0987654321' });
  await bookingService.processMockPayment({ userId: 'user-1', bookingId: b1.booking.id, paymentMethod: 'mock_bank_transfer', simulateStatus: 'success', idempotencyKey: 'shared-user1-key' });

  const q2 = await bookingService.calculateQuote({ userId: 'user-1', selectedServiceIds: ['srv-guide-01'], adultsCount: 1, childrenCount: 0 });
  const b2 = await bookingService.createBooking({ userId: 'user-1', quoteReference: q2.quote.quote_reference, customerName: 'Alice', customerPhone: '0987654321' });

  await assert.rejects(
    async () => {
      await bookingService.processMockPayment({ userId: 'user-1', bookingId: b2.booking.id, paymentMethod: 'mock_bank_transfer', simulateStatus: 'success', idempotencyKey: 'shared-user1-key' });
    },
    err => err.status === 409 && err.message.includes('đơn đặt khác')
  );
});

// ==================== P0-04 TESTS ====================

test('P0-04: Direct cancel on paid booking must be rejected', async () => {
  const env = createHardenedTestEnv();
  const admin = new AdminBookingService(env);
  const bookingService = new BookingService(env);

  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 1,
    childrenCount: 0,
    durationDays: 1,
  });
  const booking = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice Nguyen',
    customerPhone: '0987654321',
  });
  await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId: booking.booking.id,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'success',
  });

  await assert.rejects(
    async () => {
      await admin.adminCancelBooking(booking.booking.id, 'admin@test.com', 'Hủy nhầm');
    },
    err => err.status === 409 && err.message.includes('Không thể hủy trực tiếp đơn hàng đã thanh toán')
  );
});

test('P0-04: Double refund concurrently allows strictly 1 winner and writes immutable ledger', async () => {
  const env = createHardenedTestEnv();
  const admin = new AdminBookingService(env);
  const bookingService = new BookingService(env);

  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 1,
    childrenCount: 0,
    durationDays: 1,
  });
  const booking = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice Nguyen',
    customerPhone: '0987654321',
  });
  await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId: booking.booking.id,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'success',
  });

  const results = await Promise.allSettled([
    admin.adminMockRefund(booking.booking.id, 'admin1@test.com', 'Khách đổi ý 1'),
    admin.adminMockRefund(booking.booking.id, 'admin2@test.com', 'Khách đổi ý 2'),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one refund must succeed');
  assert.equal(rejected.length, 1, 'The competing refund must fail');
  assert.equal(rejected[0].reason.status, 409);

  const refundsCount = env.rawDb.prepare('SELECT count(*) as count FROM mock_payment_refunds WHERE booking_id = ?').get(booking.booking.id).count;
  assert.equal(refundsCount, 1, 'Ledger must have strictly 1 refund record');
});

// ==================== P1-01 & P1-02 TESTS ====================

test('P1-01: Revenue Analytics derives gross from payment date, refund from refund date, net can be negative', async () => {
  const env = createHardenedTestEnv();
  const admin = new AdminBookingService(env);

  // Manually seed:
  // Payment A: Yesterday 500,000 VND
  // Refund A: Today 500,000 VND (for Payment A)
  // No new payment today!
  const yesterdayUtc = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const todayUtc = new Date().toISOString();

  env.rawDb.exec(`
    INSERT INTO booking_quotes (id, quote_reference, user_id, status, expires_at, created_at)
    VALUES ('q-past', 'QT-PAST', 'user-1', 'consumed', '${yesterdayUtc}', '${yesterdayUtc}');

    INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status, created_at, updated_at)
    VALUES ('bk-past', 'BK-PAST', 'user-1', 'q-past', 'Khách', '0912345678', 500000, 'cancelled', 'refunded', '${yesterdayUtc}', '${todayUtc}');

    INSERT INTO mock_payment_attempts (id, booking_id, transaction_reference, payment_method, amount, currency, status, refunded_amount, created_at)
    VALUES ('tx-past', 'bk-past', 'TX-PAST', 'mock_bank_transfer', 500000, 'VND', 'success', 500000, '${yesterdayUtc}');

    INSERT INTO mock_payment_refunds (id, payment_attempt_id, booking_id, amount, currency, reason, actor, created_at)
    VALUES ('rf-today', 'tx-past', 'bk-past', 500000, 'VND', 'Hoàn hôm nay', 'admin', '${todayUtc}');
  `);

  // Query analytics for "today"
  const todayAnalytics = await admin.getRevenueAnalytics('today');

  assert.equal(todayAnalytics.grossSimulatedRevenue, 0, 'No payment happened today');
  assert.equal(todayAnalytics.simulatedRefundedAmount, 500000, 'Refund of 500k happened today');
  assert.equal(todayAnalytics.netSimulatedRevenue, -500000, 'Net revenue today is negative -500k');

  // Verify daily trend reconciles with net revenue
  const trendSum = todayAnalytics.dailyTrends.reduce((acc, d) => acc + d.revenue, 0);
  assert.equal(trendSum, todayAnalytics.netSimulatedRevenue, 'Daily trends sum must strictly equal netSimulatedRevenue');
});

test('P1-02: CSV export respects range filter, escapes formula injection, and reconciles with net KPI', async () => {
  const env = createHardenedTestEnv();
  const admin = new AdminBookingService(env);

  const oldDate = '2026-08-01T00:00:00Z';
  const recentDate = new Date().toISOString();

  // Old payment 60 days ago
  env.rawDb.exec(`
    INSERT INTO booking_quotes (id, quote_reference, user_id, status, expires_at, created_at)
    VALUES ('q-old', 'QT-OLD', 'user-1', 'consumed', '${oldDate}', '${oldDate}');

    INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status, created_at, updated_at)
    VALUES ('bk-old', 'BK-OLD-60DAYS', 'user-1', 'q-old', 'Khách Cổ', '0900000000', 500000, 'confirmed', 'paid', '${oldDate}', '${oldDate}');

    INSERT INTO mock_payment_attempts (id, booking_id, transaction_reference, payment_method, amount, currency, status, created_at)
    VALUES ('tx-old', 'bk-old', 'TX-OLD', 'mock_bank_transfer', 500000, 'VND', 'success', '${oldDate}');

    -- Recent payment with potential CSV formula injection in customer_name: =SUM(1+1)
    INSERT INTO booking_quotes (id, quote_reference, user_id, status, expires_at, created_at)
    VALUES ('q-recent', 'QT-RECENT', 'user-1', 'consumed', '${recentDate}', '${recentDate}');

    INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, customer_name, customer_phone, total_amount, booking_status, payment_status, created_at, updated_at)
    VALUES ('bk-recent', 'BK-RECENT-7D', 'user-1', 'q-recent', '=SUM(1+1) Danger', '0912345678', 800000, 'confirmed', 'paid', '${recentDate}', '${recentDate}');

    INSERT INTO mock_payment_attempts (id, booking_id, transaction_reference, payment_method, amount, currency, status, created_at)
    VALUES ('tx-recent', 'bk-recent', 'TX-RECENT', 'mock_bank_transfer', 800000, 'VND', 'success', '${recentDate}');
  `);

  // Request CSV for '7d'
  const csv7d = await admin.exportRevenueCsv('7d');
  assert.ok(csv7d.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.ok(!csv7d.includes('BK-OLD-60DAYS'), 'CSV 7d must exclude old transaction');
  assert.ok(csv7d.includes('BK-RECENT-7D'), 'CSV 7d must include recent transaction');
  // Formula injection check: '=SUM(1+1)' must be prefixed with '''
  assert.ok(csv7d.includes("\"'=SUM(1+1) Danger\""), 'Formula injection must be safely escaped with leading single quote');

  // Verify KPI matches CSV
  const analytics7d = await admin.getRevenueAnalytics('7d');
  assert.equal(analytics7d.grossSimulatedRevenue, 800000);
});

// ==================== P1-03 & FEATURE FLAG TESTS ====================

test('P1-03: 1-day tour calculates 0 nights, SafeInteger checks and Feature Flag 503', async () => {
  const env = createHardenedTestEnv();
  const bookingService = new BookingService(env);

  // 1. 1-day tour with per_night service -> 0 nights
  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-hotel-01'],
    adultsCount: 2,
    childrenCount: 0,
    durationDays: 1,
  });
  const hotelItem = quote.items.find((i) => i.service_id === 'srv-hotel-01');
  assert.equal(hotelItem?.quantity, 0, '1-day tour has 0 nights');
  assert.equal(hotelItem?.line_total, 0, '0 nights costs 0 VND');

  // 2. SafeInteger reject on negative or floating travelers
  await assert.rejects(
    async () => {
      await bookingService.calculateQuote({ userId: 'user-1', adultsCount: -5, childrenCount: 0 });
    },
    /Số lượng người lớn tối thiểu là 1/
  );

  // 3. Feature Flag OFF rejects payment with 503
  const disabledEnv = createHardenedTestEnv({ MOCK_PAYMENT_ENABLED: 'false' });
  const disabledBookingService = new BookingService(disabledEnv);
  const b = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice',
    customerPhone: '0987654321',
  });

  await assert.rejects(
    async () => {
      await disabledBookingService.processMockPayment({
        userId: 'user-1',
        bookingId: b.booking.id,
        paymentMethod: 'mock_bank_transfer',
        simulateStatus: 'success',
      });
    },
    err => err.status === 503 && err.message.includes('vô hiệu hóa')
  );
});
