import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { BookingService } from '../src/services/booking.service.ts';
import { AdminBookingService } from '../src/services/admin-booking.service.ts';
import worker from '../src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createBusinessTestEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  const m1 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0001_initial.sql'), 'utf8');
  const m2 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0002_seed.sql'), 'utf8');
  const m3 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0003_schema_update.sql'), 'utf8');
  const m4 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0004_admin_extension.sql'), 'utf8');
  const m5 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0005_identity.sql'), 'utf8');
  const m6 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0006_travel_planner.sql'), 'utf8');
  const m7 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0007_optimistic_lock_guard.sql'), 'utf8');
  const m8 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0008_business_booking.sql'), 'utf8');
  const m9 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0009_booking_transaction_hardening.sql'), 'utf8');

  db.exec(m1);
  db.exec(m2);
  db.exec(m3);
  db.exec(m4);
  db.exec(m5);
  db.exec(m6);
  db.exec(m7);
  db.exec(m8);
  db.exec(m9);

  // Insert two test users for isolation testing
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-1', 'alice@example.com', 'Alice', 'active');");
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-2', 'bob@example.com', 'Bob', 'active');");

  // Insert test session for user-1
  db.exec("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ('sess-1', 'user-1', 'hash-alice-token', datetime('now', '+1 day'));");

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
    ...overrides,
  };
}

test('Admin Tour & Service CRUD: creates, updates, and deletes with audit logging', async () => {
  const env = createBusinessTestEnv();
  const admin = new AdminBookingService(env);

  // 1. Create Tour
  const createdTour = await admin.createTour({
    code: 'TOUR-TEST-01',
    title: 'Tour Thử Nghiệm Nâm Nung',
    description: 'Chi tiết tour',
    durationDays: 3,
    minTravelers: 2,
    maxTravelers: 10,
    basePrice: 1500000,
  }, 'admin@test.com');

  assert.equal(createdTour.code, 'TOUR-TEST-01');
  assert.equal(createdTour.durationDays, 3);
  assert.equal(createdTour.basePrice, 1500000);

  // 2. Update Tour
  const updatedTour = await admin.updateTour(createdTour.id, {
    title: 'Tour Thử Nghiệm Nâm Nung Đổi Tên',
    basePrice: 1600000,
  }, 'admin@test.com');

  assert.equal(updatedTour.title, 'Tour Thử Nghiệm Nâm Nung Đổi Tên');
  assert.equal(updatedTour.basePrice, 1600000);

  // 3. Create Service
  const service = await admin.createService({
    code: 'SRV-TEST-01',
    name: 'Dịch vụ chèo thuyền thác',
    category: 'other',
    pricingMode: 'per_person',
    unitPrice: 200000,
  }, 'admin@test.com');

  assert.equal(service.code, 'SRV-TEST-01');
  assert.equal(service.pricingRule?.unitPrice, 200000);

  // 4. Toggle active
  await admin.toggleServiceActive(service.id, false, 'admin@test.com');
  const servicesInactive = await admin.listServices('other', true);
  assert.ok(!servicesInactive.some(s => s.id === service.id), 'Service must be excluded when activeOnly=true');

  // Verify Audit Log was recorded
  const logs = env.rawDb.prepare("SELECT count(*) as count FROM admin_audit_logs WHERE action IN ('create_tour', 'update_tour', 'create_service', 'toggle_service')").get();
  assert.equal(logs.count, 4, 'Audit logs must capture 4 admin actions');
});

test('PricingService: Calculates quotes accurately across all pricing modes', async () => {
  const env = createBusinessTestEnv();
  const bookingService = new BookingService(env);

  // Add services with different pricing modes
  env.rawDb.exec(`
    INSERT INTO tour_services (id, code, name, category, is_active) VALUES
      ('srv-fixed', 'SRV-FIXED', 'Phí hướng dẫn cố định', 'guide', 1),
      ('srv-adult', 'SRV-ADULT', 'Vé người lớn', 'ticket', 1),
      ('srv-child', 'SRV-CHILD', 'Vé trẻ em', 'ticket', 1),
      ('srv-day', 'SRV-DAY', 'Thuê xe theo ngày', 'transport', 1),
      ('srv-night', 'SRV-NIGHT', 'Lưu trú theo đêm', 'accommodation', 1);

    INSERT INTO tour_price_rules (id, service_id, pricing_mode, unit_price, is_active) VALUES
      ('pr-fixed', 'srv-fixed', 'fixed', 500000, 1),
      ('pr-adult', 'srv-adult', 'per_adult', 100000, 1),
      ('pr-child', 'srv-child', 'per_child', 50000, 1),
      ('pr-day', 'srv-day', 'per_day', 600000, 1),
      ('pr-night', 'srv-night', 'per_night', 400000, 1);
  `);

  // Adults: 2, Children: 1, Duration: 3 days (2 nights)
  const quoteResult = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-fixed', 'srv-adult', 'srv-child', 'srv-day', 'srv-night'],
    adultsCount: 2,
    childrenCount: 1,
    durationDays: 3,
  });

  const quote = quoteResult.quote;
  const items = quoteResult.items;

  // Verify each item's calculated price
  // fixed: 500,000 * 1 = 500,000
  // adult: 100,000 * 2 = 200,000
  // child: 50,000 * 1 = 50,000
  // day: 600,000 * 3 = 1,800,000
  // night: 400,000 * 2 = 800,000
  // total: 500,000 + 200,000 + 50,000 + 1,800,000 + 800,000 = 3,350,000 VND
  assert.equal(quote.subtotal, 3350000);
  assert.equal(quote.total_price, 3350000);
  assert.equal(items.length, 5);
});

test('Price Snapshot Preservation: Price rule update never changes past quotes or bookings', async () => {
  const env = createBusinessTestEnv();
  const admin = new AdminBookingService(env);
  const bookingService = new BookingService(env);

  // 1. Initial quote for 'srv-guide-01' (price: 500,000 VND/day)
  const initialQuote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 2,
    childrenCount: 0,
    durationDays: 1,
  });

  assert.equal(initialQuote.quote.total_price, 500000);

  // 2. Book using initial quote
  const booking = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: initialQuote.quote.quote_reference,
    customerName: 'Alice Nguyen',
    customerPhone: '0987654321',
  });
  assert.equal(booking.booking.total_amount, 500000);

  // 3. Admin raises price of 'srv-guide-01' to 800,000 VND/day
  await admin.updatePriceRule('srv-guide-01', 'per_day', 800000, 'admin@test.com');

  // 4. New quote uses updated price 800,000 VND
  const newQuote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 2,
    childrenCount: 0,
    durationDays: 1,
  });
  assert.equal(newQuote.quote.total_price, 800000);

  // 5. Existing booking and original quote snapshot MUST STAY 500,000 VND
  const savedBooking = await bookingService.getBooking('user-1', booking.booking.id);
  assert.equal(savedBooking.booking.total_amount, 500000);
  assert.equal(savedBooking.items[0].unit_price, 500000);
  assert.equal(savedBooking.items[0].line_total, 500000);
});

test('Quote Invalidation on Stale Itinerary Version: Concurrency safety', async () => {
  const env = createBusinessTestEnv();
  const bookingService = new BookingService(env);

  // Create an itinerary with version 1
  env.rawDb.exec(`
    INSERT INTO travel_itineraries (id, user_id, title, start_date, duration_days, travelers_count, version)
    VALUES ('itin-1', 'user-1', 'Lịch trình thử', '2026-10-15', 2, 2, 1);
  `);

  // Calculate quote referencing itin-1 at version 1
  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    itineraryId: 'itin-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 2,
    childrenCount: 0,
  });

  // User edits itinerary concurrently -> version increments to 2
  env.rawDb.exec("UPDATE travel_itineraries SET version = 2 WHERE id = 'itin-1';");

  // Attempting to book with the old quote must be rejected with version conflict
  await assert.rejects(
    async () => {
      await bookingService.createBooking({
        userId: 'user-1',
        quoteReference: quote.quote.quote_reference,
        customerName: 'Alice Nguyen',
        customerPhone: '0987654321',
      });
    },
    /Lịch trình đã được chỉnh sửa/
  );
});

test('Mock Payment State Machine: Success, Failure, Retry, Idempotency, and Refund', async () => {
  const env = createBusinessTestEnv();
  const admin = new AdminBookingService(env);
  const bookingService = new BookingService(env);

  // Create quote & booking
  const quote = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-ticket-nn'],
    adultsCount: 2,
    childrenCount: 1,
    durationDays: 1,
  });
  // ticket: 60,000 * 3 = 180,000 VND
  assert.equal(quote.quote.total_price, 180000);

  const bookingRes = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: quote.quote.quote_reference,
    customerName: 'Alice Nguyen',
    customerPhone: '0987654321',
  });
  const bookingId = bookingRes.booking.id;

  // 1. Simulate Payment Failure
  const failRes = await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'failed',
  });
  assert.equal(failRes.success, false);
  assert.equal(failRes.booking.payment_status, 'failed');

  // 2. Retry Payment with Success & Idempotency Key
  const successRes = await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'success',
    idempotencyKey: 'idem-pay-123',
  });
  assert.equal(successRes.success, true);
  assert.equal(successRes.booking.payment_status, 'paid');
  assert.equal(successRes.booking.booking_status, 'confirmed');

  // 3. Repeated request with same Idempotency Key returns same receipt
  const idemRes = await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'success',
    idempotencyKey: 'idem-pay-123',
  });
  assert.equal(idemRes.success, true);
  assert.equal(idemRes.transactionReference, successRes.transactionReference);

  // 4. Admin Mock Refund
  const refunded = await admin.adminMockRefund(bookingId, 'admin@test.com', 'Khách hàng đổi ý');
  assert.equal(refunded.payment_status, 'refunded');
  assert.equal(refunded.booking_status, 'cancelled');

  // Verify refund amount recorded in mock_payment_attempts
  const tx = env.rawDb.prepare("SELECT * FROM mock_payment_attempts WHERE booking_id = ? AND status = 'success'").get(bookingId);
  assert.equal(tx.refunded_amount, 180000);
});

test('Revenue Analytics Reconciliation: Truthful KPIs and CSV Export', async () => {
  const env = createBusinessTestEnv();
  const admin = new AdminBookingService(env);
  const bookingService = new BookingService(env);

  // Booking A: 500,000 VND -> Paid
  const qA = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-guide-01'],
    adultsCount: 1,
    childrenCount: 0,
    durationDays: 1,
  });
  const bA = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: qA.quote.quote_reference,
    customerName: 'Khách A',
    customerPhone: '0912345678',
  });
  await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId: bA.booking.id,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'success',
  });

  // Booking B: 1,200,000 VND -> Failed
  const qB = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-bus-01'],
    adultsCount: 1,
    childrenCount: 0,
    durationDays: 1,
  });
  const bB = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: qB.quote.quote_reference,
    customerName: 'Khách B',
    customerPhone: '0912345679',
  });
  await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId: bB.booking.id,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'failed',
  });

  // Booking C: 450,000 VND -> Paid then Refunded
  const qC = await bookingService.calculateQuote({
    userId: 'user-1',
    selectedServiceIds: ['srv-hotel-01'],
    adultsCount: 1,
    childrenCount: 0,
    durationDays: 2, // 1 night = 450,000
  });
  const bC = await bookingService.createBooking({
    userId: 'user-1',
    quoteReference: qC.quote.quote_reference,
    customerName: 'Khách C',
    customerPhone: '0912345680',
  });
  await bookingService.processMockPayment({
    userId: 'user-1',
    bookingId: bC.booking.id,
    paymentMethod: 'mock_bank_transfer',
    simulateStatus: 'success',
  });
  await admin.adminMockRefund(bC.booking.id, 'admin@test.com', 'Hủy phòng');

  // Verify Analytics derivation
  const analytics = await admin.getRevenueAnalytics('all');

  assert.equal(analytics.totalBookings, 3, 'Total 3 bookings created');
  assert.equal(analytics.grossSimulatedRevenue, 950000, 'Gross: 500k (A) + 450k (C) = 950k (B failed excluded)');
  assert.equal(analytics.simulatedRefundedAmount, 450000, 'Refunded amount = 450k (C)');
  assert.equal(analytics.netSimulatedRevenue, 500000, 'Net: 950k - 450k = 500k');
  assert.equal(analytics.failedPaymentAttempts, 1, '1 failed attempt from B');

  // CSV Export verification
  const csv = await admin.exportRevenueCsv('all');
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('Mã đơn hàng,Khách hàng'), 'CSV has header columns');
  assert.ok(csv.includes('Khách A'), 'CSV contains Khách A record');
});

test('Data Isolation: User cannot view or pay other users bookings', async () => {
  const env = createBusinessTestEnv();
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
    customerName: 'Alice Nguyen',
    customerPhone: '0987654321',
  });

  // User 2 cannot access user 1 booking
  await assert.rejects(
    async () => {
      await bookingService.getBooking('user-2', booking.booking.id);
    },
    /Không tìm thấy đơn đặt hàng/
  );

  // User 2 cannot pay user 1 booking
  await assert.rejects(
    async () => {
      await bookingService.processMockPayment({
        userId: 'user-2',
        bookingId: booking.booking.id,
        paymentMethod: 'mock_bank_transfer',
        simulateStatus: 'success',
      });
    },
    /Không tìm thấy đơn đặt hàng/
  );
});

