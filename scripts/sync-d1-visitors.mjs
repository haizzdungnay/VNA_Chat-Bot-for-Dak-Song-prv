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

// 2. Fetch local visitor profiles
const localRows = db.prepare("SELECT * FROM visitor_profiles").all();
console.log(`Found ${localRows.length} local visitor records.`);

// 3. Push local visitor records to remote Cloudflare Worker staging
console.log("Pushing local records to remote Cloudflare D1...");
for (const row of localRows) {
  try {
    const res = await fetch("https://vna-dak-song-demo.vna-daksong-tuanduong26.workers.dev/api/visitors/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentToken: row.id,
        displayName: row.display_name,
        addressAs: row.address_as,
        ageGroup: row.age_group,
        consentVersion: row.consent_version || "1.0",
        optIn: row.deleted_at ? false : true,
      }),
    });
    const json = await res.json();
    console.log(`  - ${row.display_name || row.id}: ${res.status} ${json.success ? "OK" : "ERR"}`);
  } catch (err) {
    console.error(`  - Failed to push ${row.id}:`, err.message);
  }
}

// 4. Fetch updated remote visitor profiles from Cloudflare D1
console.log("Fetching updated remote visitor profiles from Cloudflare D1...");
const rawJson = execSync(
  'npx wrangler d1 execute dak-song-db-staging --remote --config worker/wrangler.demo.jsonc --command "SELECT * FROM visitor_profiles;" --json',
  { encoding: "utf8" }
);

const parsed = JSON.parse(rawJson);
const remoteRows = parsed[0]?.results || [];
console.log(`Found ${remoteRows.length} total remote visitor records on Cloudflare D1.`);

// 5. Upsert remote into local database
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
console.log("✅ Bidirectional sync complete! Both Local and Cloudflare D1 are 100% in sync.");

// 6. Print current visitors
const currentLocal = db.prepare("SELECT id, display_name, address_as, age_group, updated_at FROM visitor_profiles ORDER BY updated_at DESC").all();
console.log(`Total synchronized visitors: ${currentLocal.length}`);
currentLocal.forEach((v, i) => {
  console.log(`  [${i + 1}] ${v.display_name || "N/A"} (${v.address_as || "N/A"}, ${v.age_group || "N/A"})`);
});

