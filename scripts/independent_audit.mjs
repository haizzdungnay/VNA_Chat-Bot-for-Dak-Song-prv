/**
 * INDEPENDENT QA & SECURITY AUDITOR TEST SUITE
 * Phase 8 Business Operations, Booking Platform & Mock Payment
 * Adversarial Testing & Database Invariant Verification
 */

import { execSync } from "node:child_process";

const BASE_URL = "http://127.0.0.1:8788";
const USER_A_TOKEN = "e4d88a106d58c69736975121f931ed550293926ee9464474fed4f4ceefb8c6c0";
const USER_A_ID = "f8f813bf-ed92-4e0e-a73f-021d52407f4c";

const USER_B_TOKEN = "c1a909f02383178ca1c3cf0890a000f5763e6b632748142c1d6fdeca1fb970b5";
const USER_B_ID = "bdae1737-eb1e-457d-8827-cc2bedd4d29a";

function queryD1(sql) {
  const cleanSql = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute dak-song-db --local --config worker/wrangler.jsonc --command "${cleanSql}"`;
  try {
    const raw = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    // Parse JSON output from wrangler
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
      return parsed[0]?.results || [];
    }
    return [];
  } catch (err) {
    console.error("D1 Query Error:", err.message);
    return [];
  }
}

async function request(path, options = {}, retries = 2) {
  const url = `${BASE_URL}${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      let data;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { status: res.status, headers: res.headers, data };
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

const userAHeaders = { Authorization: `Bearer ${USER_A_TOKEN}` };
const userBHeaders = { Authorization: `Bearer ${USER_B_TOKEN}` };

console.log("=== STARTING INDEPENDENT AUDIT & ADVERSARIAL ATTACKS ===");

export {
  request,
  queryD1,
  userAHeaders,
  userBHeaders,
  USER_A_ID,
  USER_B_ID,
  BASE_URL,
};
