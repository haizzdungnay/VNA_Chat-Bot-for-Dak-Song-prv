import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

test('D1 Local Concurrency: Optimistic lock guard prevents concurrent batch overwrite and rollback works on real SQLite engine', () => {
  // Use a real file-based SQLite database mimicking Wrangler D1 storage engine
  const tempDbPath = path.join(__dirname, 'temp_d1_concurrency.sqlite');
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

  const db = new DatabaseSync(tempDbPath);

  // Apply all 7 migrations
  for (let i = 1; i <= 7; i++) {
    const num = String(i).padStart(4, '0');
    const migFile = fs.readdirSync(path.join(REPO_ROOT, 'worker/migrations')).find((f) => f.startsWith(num));
    const sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations', migFile), 'utf8');
    db.exec(sql);
  }

  // Insert initial itinerary
  const itinId = 'test-itin-concurrency-uuid';
  const userId = 'test-user-concurrency-uuid';
  db.exec(`INSERT INTO users (id, display_name, status) VALUES ('${userId}', 'User Conc', 'active');`);

  db.exec(`
    INSERT INTO travel_itineraries (id, user_id, title, start_date, duration_days, travelers_count, children_count, pace, transportation, budget_preference, status, version)
    VALUES ('${itinId}', '${userId}', 'Initial Itinerary', '2026-11-20', 1, 2, 0, 'moderate', 'car', 'moderate', 'saved', 1);
  `);

  const dayId = 'day-1-concurrency-uuid';
  db.exec(`
    INSERT INTO itinerary_days (id, itinerary_id, day_number, title)
    VALUES ('${dayId}', '${itinId}', 1, 'Day 1');
  `);

  db.exec(`
    INSERT INTO itinerary_items (id, itinerary_id, day_id, item_type, title, duration_minutes, order_index, is_user_selected)
    VALUES ('init-item-1', '${itinId}', '${dayId}', 'place', 'Original Spot', 60, 0, 0);
  `);

  // Define D1-style atomic batch execution function
  function executeD1Batch(updateExpectedVersion, newTitle, newItems) {
    try {
      db.exec('BEGIN IMMEDIATE;');

      // 1. UPDATE master with optimistic version check
      db.prepare(`
        UPDATE travel_itineraries SET
          title = ?, version = version + 1, updated_at = datetime('now')
        WHERE id = ? AND user_id = ? AND version = ?;
      `).run(newTitle, itinId, userId, updateExpectedVersion);

      // 2. Database assertion guard
      db.prepare('INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes());').run();

      // 3. Delete existing child records
      db.prepare('DELETE FROM itinerary_items WHERE itinerary_id = ?;').run(itinId);

      // 4. Insert new child records
      for (let idx = 0; idx < newItems.length; idx++) {
        const it = newItems[idx];
        db.prepare(`
          INSERT INTO itinerary_items (id, itinerary_id, day_id, item_type, title, duration_minutes, order_index, is_user_selected)
          VALUES (?, ?, ?, 'place', ?, 60, ?, 0);
        `).run(it.id, itinId, dayId, it.title, idx);
      }

      // 5. Clean guard in the same transaction
      db.prepare('DELETE FROM optimistic_lock_guard WHERE guard_id = 1;').run();

      db.exec('COMMIT;');
      return { success: true };
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch {}
      return { success: false, error: err.message };
    }
  }

  // Request A attempts update on version 1
  const resA = executeD1Batch(1, 'Title from Request A', [
    { id: 'item-a1', title: 'Activity A1' },
    { id: 'item-a2', title: 'Activity A2' },
  ]);

  // Request B attempts concurrent update on version 1 (which was already bumped)
  const resB = executeD1Batch(1, 'Title from Request B', [
    { id: 'item-b1', title: 'Activity B1' },
    { id: 'item-b2', title: 'Activity B2' },
  ]);

  // Assertions
  assert.equal(resA.success, true, 'Request A must succeed');
  assert.equal(resB.success, false, 'Request B must fail compare-and-swap');
  assert.ok(resB.error.includes('CHECK constraint failed'), 'Request B must fail with CHECK constraint violation');

  // Verify DB state
  const itin = db.prepare('SELECT version, title FROM travel_itineraries WHERE id = ?;').get(itinId);
  assert.equal(itin.version, 2, 'Version must be incremented exactly once to 2');
  assert.equal(itin.title, 'Title from Request A', 'Title must belong to winning Request A');

  const items = db.prepare('SELECT title FROM itinerary_items WHERE itinerary_id = ? ORDER BY order_index ASC;').all(itinId);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Activity A1');
  assert.equal(items[1].title, 'Activity A2');

  const guardRows = db.prepare('SELECT count(*) as count FROM optimistic_lock_guard;').get().count;
  assert.equal(guardRows, 0, 'optimistic_lock_guard table must be completely empty');

  // Clean up test DB file
  db.close();
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
});

