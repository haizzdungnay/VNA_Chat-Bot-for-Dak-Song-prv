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

test('Preexisting database upgrade path: upgrades safely without data loss to 0004', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);

  db.exec("INSERT INTO places (id, slug, name, category_id, short_description, description) VALUES ('custom-preexist', 'custom-preexist', 'Custom Spot', 'cat-nature', 'Desc', 'Desc');");

  assert.doesNotThrow(() => db.exec(m3Sql), '0003 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m4Sql), '0004 must upgrade preexisting DB cleanly');

  const customPlace = db.prepare("SELECT * FROM places WHERE id = 'custom-preexist'").get();
  assert.ok(customPlace, 'Custom pre-existing record must be preserved');
  assert.equal(customPlace.source_type, 'verified', 'Custom pre-existing place defaults to verified');

  const total = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(total, 20);

  const articlesCount = db.prepare('SELECT count(*) as count FROM articles').get().count;
  assert.equal(articlesCount, 42);
});

test('Idempotency: Re-running 0002, 0003, and 0004 statements does not duplicate records or throw', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);

  assert.doesNotThrow(() => db.exec(m2Sql), 'Second run of 0002_seed.sql should not throw');
  const artInsertsOnly = m3Sql.slice(m3Sql.indexOf('INSERT INTO articles'));
  assert.doesNotThrow(() => db.exec(artInsertsOnly), 'Second run of article inserts should not throw');
  assert.doesNotThrow(() => db.exec(m4Sql), 'Second run of 0004_admin_extension.sql should not throw');

  const placesCount = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(placesCount, 19, 'Places count must remain 19 on re-run');

  const articlesCount = db.prepare('SELECT count(*) as count FROM articles').get().count;
  assert.equal(articlesCount, 42, 'Articles count must remain 42 on re-run');
});

