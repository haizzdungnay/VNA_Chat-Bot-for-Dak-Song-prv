import { execSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = require(process.env.APPDATA + "/npm/node_modules/better-sqlite3");
}

// 1. Locate local sqlite database file
const d1Dir = path.resolve("worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const sqliteFiles = fs.readdirSync(d1Dir).filter(f => f.endsWith(".sqlite") && f !== "metadata.sqlite");

if (sqliteFiles.length === 0) {
  console.error("Local SQLite database file not found in", d1Dir);
  process.exit(1);
}

const localDbPath = path.join(d1Dir, sqliteFiles[0]);
console.log("Local SQLite DB:", localDbPath);
const db = new Database(localDbPath);

// 2. Fetch remote visitor profiles from Cloudflare D1
console.log("Fetching remote visitor profiles from dak-song-db-staging...");
const rawJson = execSync(
  'npx wrangler d1 execute dak-song-db-staging --remote --config worker/wrangler.demo.jsonc --command "SELECT * FROM visitor_profiles;" --json',
  { encoding: "utf8" }
);

const parsed = JSON.parse(rawJson);
const remoteRows = parsed[0]?.results || [];
console.log(`Found ${remoteRows.length} remote visitor records.`);

// 3. Upsert into local database
const upsertStmt = db.prepare(`
  INSERT INTO visitor_profiles (id, display_name, address_as, age_group, consent_version, consented_at, updated_at, deleted_at)
  VALUES (@id, @display_name, @address_as, @age_group, @consent_version, @consented_at, @updated_at, @deleted_at)
  ON CONFLICT(id) DO UPDATE SET
    display_name = excluded.display_name,
    address_as = excluded.address_as,
    age_group = excluded.age_group,
    consent_version = excluded.consent_version,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at
`);

const syncTransaction = db.transaction((rows) => {
  for (const row of rows) {
    upsertStmt.run(row);
  }
});

syncTransaction(remoteRows);
console.log("Successfully synchronized remote visitors to local database!");

// 4. Print current local visitors list
const currentLocal = db.prepare("SELECT id, display_name, address_as, age_group, updated_at FROM visitor_profiles ORDER BY updated_at DESC").all();
console.log("Current visitors in local Admin:", currentLocal);

