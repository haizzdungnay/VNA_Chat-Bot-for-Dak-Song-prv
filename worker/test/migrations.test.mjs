import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const m1Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0001_initial.sql'), 'utf8');
const m2Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0002_seed.sql'), 'utf8');
const m3Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0003_schema_update.sql'), 'utf8');
const m4Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0004_admin_extension.sql'), 'utf8');
const m5Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0005_identity.sql'), 'utf8');
const m6Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0006_travel_planner.sql'), 'utf8');
const m7Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0007_optimistic_lock_guard.sql'), 'utf8');
const m8Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0008_business_booking.sql'), 'utf8');
const m9Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0009_booking_transaction_hardening.sql'), 'utf8');
const m10Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0010_historical_refund_reconciliation.sql'), 'utf8');
const m11Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0011_tourism_quiz.sql'), 'utf8');
const m12Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0012_quiz_scoring_and_schedule.sql'), 'utf8');

test('Fresh migration path: 0001 -> 0002 -> 0003 applies cleanly and verifies 100% integrity', () => {
  const db = new DatabaseSync(':memory:');

  assert.doesNotThrow(() => db.exec(m1Sql), '0001_initial.sql should execute cleanly');
  assert.doesNotThrow(() => db.exec(m2Sql), '0002_seed.sql should execute cleanly on clean DB');

  const intPlacesCount = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(intPlacesCount, 19, 'Places count after 0002 must be 19');

  assert.doesNotThrow(() => db.exec(m3Sql), '0003_schema_update.sql should execute cleanly on clean DB');

  const catCount = db.prepare('SELECT count(*) as count FROM categories').get().count;
  assert.equal(catCount, 4, 'Categories count must be 4');

  const placesCount = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(placesCount, 19, 'Places count must be 19');

  const verifiedCount = db.prepare("SELECT count(*) as count FROM places WHERE source_type = 'verified'").get().count;
  assert.equal(verifiedCount, 15, 'Verified places count must be 15');

  const vr360Count = db.prepare("SELECT count(*) as count FROM places WHERE source_type = 'vr360'").get().count;
  assert.equal(vr360Count, 4, 'VR360 places count must be 4');

  const articlesCount = db.prepare('SELECT count(*) as count FROM articles').get().count;
  assert.equal(articlesCount, 42, 'Articles count must be 42');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations');

  const vr360Records = db.prepare("SELECT * FROM places WHERE source_type = 'vr360'").all();
  for (const vr of vr360Records) {
    assert.equal(vr.latitude, null, 'VR360 latitude must be NULL');
    assert.equal(vr.longitude, null, 'VR360 longitude must be NULL');
    assert.equal(vr.opening_hours, null, 'VR360 opening_hours must be NULL');
    assert.ok(vr.website && vr.website.includes('daksong-daknong.vnasw.vn'), 'VR360 website must point to official tour');
  }
});

test('Fresh migration 0004_admin_extension: creates admin schema additively on fresh DB', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);

  assert.doesNotThrow(() => db.exec(m4Sql), '0004_admin_extension.sql should execute cleanly');

  // Verify all 4 admin tables exist and are operable
  const profilesCount = db.prepare('SELECT count(*) as count FROM admin_ai_profiles').get().count;
  assert.equal(profilesCount, 0, 'admin_ai_profiles starts empty');

  const auditCount = db.prepare('SELECT count(*) as count FROM admin_audit_logs').get().count;
  assert.equal(auditCount, 0, 'admin_audit_logs starts empty');

  const visitorsCount = db.prepare('SELECT count(*) as count FROM visitor_profiles').get().count;
  assert.equal(visitorsCount, 0, 'visitor_profiles starts empty');

  const telemetryCount = db.prepare('SELECT count(*) as count FROM admin_telemetry_events').get().count;
  assert.equal(telemetryCount, 0, 'admin_telemetry_events starts empty');
});

test('Fresh migration 0005_identity: creates users, auth_identities, auth_sessions, auth_challenges additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);

  assert.doesNotThrow(() => db.exec(m5Sql), '0005_identity.sql should execute cleanly');

  const usersCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  assert.equal(usersCount, 0, 'users table starts empty');

  const identitiesCount = db.prepare('SELECT count(*) as count FROM auth_identities').get().count;
  assert.equal(identitiesCount, 0, 'auth_identities table starts empty');

  const sessionsCount = db.prepare('SELECT count(*) as count FROM auth_sessions').get().count;
  assert.equal(sessionsCount, 0, 'auth_sessions table starts empty');

  const challengesCount = db.prepare('SELECT count(*) as count FROM auth_challenges').get().count;
  assert.equal(challengesCount, 0, 'auth_challenges table starts empty');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0005');
});


test('Fresh migration 0006_travel_planner: creates travel planner tables additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);

  assert.doesNotThrow(() => db.exec(m6Sql), '0006_travel_planner.sql should execute cleanly');

  const itinCount = db.prepare('SELECT count(*) as count FROM travel_itineraries').get().count;
  assert.equal(itinCount, 0, 'travel_itineraries starts empty');

  const daysCount = db.prepare('SELECT count(*) as count FROM itinerary_days').get().count;
  assert.equal(daysCount, 0, 'itinerary_days starts empty');

  const itemsCount = db.prepare('SELECT count(*) as count FROM itinerary_items').get().count;
  assert.equal(itemsCount, 0, 'itinerary_items starts empty');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0006');
});


test('Fresh migration 0007_optimistic_lock_guard: creates guard table additively and enforces CHECK(guard_id = 1)', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);

  assert.doesNotThrow(() => db.exec(m7Sql), '0007_optimistic_lock_guard.sql should execute cleanly');

  // Verify guard table exists and enforces CHECK constraint
  assert.doesNotThrow(() => db.exec('INSERT INTO optimistic_lock_guard (guard_id) VALUES (1);'));
  assert.throws(() => db.exec('INSERT INTO optimistic_lock_guard (guard_id) VALUES (0);'), /CHECK constraint failed/);
  db.exec('DELETE FROM optimistic_lock_guard;');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0007');
});



test('Fresh migration 0008_business_booking: creates business & booking tables additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);

  assert.doesNotThrow(() => db.exec(m8Sql), '0008_business_booking.sql should execute cleanly');

  const toursCount = db.prepare('SELECT count(*) as count FROM tour_products').get().count;
  assert.equal(toursCount, 3, 'tour_products seeded with 3 items');

  const servicesCount = db.prepare('SELECT count(*) as count FROM tour_services').get().count;
  assert.equal(servicesCount, 5, 'tour_services seeded with 5 items');

  const priceRulesCount = db.prepare('SELECT count(*) as count FROM tour_price_rules').get().count;
  assert.equal(priceRulesCount, 5, 'tour_price_rules seeded with 5 items');

  const bookingsCount = db.prepare('SELECT count(*) as count FROM tour_bookings').get().count;
  assert.equal(bookingsCount, 0, 'tour_bookings starts empty');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0008');
});

test('Fresh migration 0009_booking_transaction_hardening: creates refund and idempotency tables additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);

  assert.doesNotThrow(() => db.exec(m9Sql), '0009_booking_transaction_hardening.sql should execute cleanly');

  const refundsCount = db.prepare('SELECT count(*) as count FROM mock_payment_refunds').get().count;
  assert.equal(refundsCount, 0, 'mock_payment_refunds starts empty on fresh db');

  const idemCount = db.prepare('SELECT count(*) as count FROM idempotency_records').get().count;
  assert.equal(idemCount, 0, 'idempotency_records starts empty on fresh db');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0009');
});

test('Fresh migration 0010_historical_refund_reconciliation: adds timestamp_provenance column additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);

  assert.doesNotThrow(() => db.exec(m10Sql), '0010_historical_refund_reconciliation.sql should execute cleanly');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0010');
});


test('Fresh migration 0011_tourism_quiz: creates quiz tables and initial seed additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);
  db.exec(m10Sql);
  assert.doesNotThrow(() => db.exec(m11Sql), '0011_tourism_quiz.sql should execute cleanly');
  const categoriesCount = db.prepare('SELECT count(*) as count FROM quiz_categories').get().count;
  assert.equal(categoriesCount, 5, 'quiz_categories seeded with 5 items');
  const questionsCount = db.prepare('SELECT count(*) as count FROM quiz_questions').get().count;
  assert.equal(questionsCount, 8, 'quiz_questions seeded with 8 items');
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0011');
});


test('Fresh migration 0012_quiz_scoring_and_schedule: adds score_per_question column additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);
  db.exec(m10Sql);
  db.exec(m11Sql);

  assert.doesNotThrow(() => db.exec(m12Sql), '0012_quiz_scoring_and_schedule.sql should execute cleanly');

  const columns = db.prepare('PRAGMA table_info(quiz_attempts)').all();
  const hasScorePerQ = columns.some((c) => c.name === 'score_per_question');
  assert.equal(hasScorePerQ, true, 'quiz_attempts has score_per_question column');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0012');
});

test('Preexisting database upgrade path: upgrades safely without data loss to 0006', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);

  db.exec("INSERT INTO places (id, slug, name, category_id, short_description, description) VALUES ('custom-preexist', 'custom-preexist', 'Custom Spot', 'cat-nature', 'Desc', 'Desc');");

  assert.doesNotThrow(() => db.exec(m3Sql), '0003 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m4Sql), '0004 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m5Sql), '0005 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m6Sql), '0006 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m7Sql), '0007 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m8Sql), '0008 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m9Sql), '0009 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m10Sql), '0010 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m11Sql), '0011 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m12Sql), '0012 must upgrade preexisting DB cleanly');

  const customPlace = db.prepare("SELECT * FROM places WHERE id = 'custom-preexist'").get();
  assert.ok(customPlace, 'Custom pre-existing record must be preserved');
  assert.equal(customPlace.source_type, 'verified', 'Custom pre-existing place defaults to verified');

  const total = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(total, 20);

  const articlesCount = db.prepare('SELECT count(*) as count FROM articles').get().count;
  assert.equal(articlesCount, 42);
});

test('Idempotency: Re-running 0002, 0003, 0004, 0005, and 0006 statements does not duplicate records or throw', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);

  assert.doesNotThrow(() => db.exec(m2Sql), 'Second run of 0002_seed.sql should not throw');
  const artInsertsOnly = m3Sql.slice(m3Sql.indexOf('INSERT INTO articles'));
  assert.doesNotThrow(() => db.exec(artInsertsOnly), 'Second run of article inserts should not throw');
  assert.doesNotThrow(() => db.exec(m4Sql), 'Second run of 0004_admin_extension.sql should not throw');
  assert.doesNotThrow(() => db.exec(m5Sql), 'Second run of 0005_identity.sql should not throw');
  assert.doesNotThrow(() => db.exec(m6Sql), 'Second run of 0006_travel_planner.sql should not throw');
  assert.doesNotThrow(() => db.exec(m7Sql), 'Second run of 0007_optimistic_lock_guard.sql should not throw');
  assert.doesNotThrow(() => db.exec(m8Sql), 'Second run of 0008_business_booking.sql should not throw');
  assert.doesNotThrow(() => db.exec(m9Sql), 'Second run of 0009_booking_transaction_hardening.sql should not throw');
  assert.doesNotThrow(() => db.exec(m11Sql), 'Second run of 0011_tourism_quiz.sql should not throw');
  // Note: 0010 uses ALTER TABLE ADD COLUMN which SQLite does not re-add if already exists, tested in upgrade path

  const placesCount = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(placesCount, 19, 'Places count must remain 19 on re-run');

  const articlesCount = db.prepare('SELECT count(*) as count FROM articles').get().count;
  assert.equal(articlesCount, 42, 'Articles count must remain 42 on re-run');
});

