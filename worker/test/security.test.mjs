import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryRateLimiter } from "../src/utils/rate-limiter.ts";
import { getCorsHeaders, errorResponse, jsonResponse } from "../src/utils/response.ts";
import worker from "../src/index.ts";

test("InMemoryRateLimiter blocks requests exceeding threshold", () => {
  const limiter = new InMemoryRateLimiter(60_000, 3);
  const ip = "192.168.1.100";

  assert.equal(limiter.check(ip).allowed, true);
  assert.equal(limiter.check(ip).allowed, true);
  assert.equal(limiter.check(ip).allowed, true);

  const blocked = limiter.check(ip);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSec > 0);
});

test("Security headers are present in responses", () => {
  const headers = getCorsHeaders();
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");

  const res = jsonResponse({ status: "ok" });
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
});

test("Worker blocks oversized POST payloads with 413", async () => {
  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "Content-Length": "15000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "large" }),
  });

  const res = await worker.fetch(req, { CORS_ALLOW_ORIGIN: "*" }, {});
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.match(body.error, /vượt quá giới hạn/);
});

test("Worker blocks chat endpoint when rate limit is exceeded with 429 and Retry-After", async () => {
  const env = { CORS_ALLOW_ORIGIN: "*" };
  // Make 30 rapid requests with IP test-ip
  for (let i = 0; i < 30; i++) {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "CF-Connecting-IP": "10.0.0.1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "hi" }),
    });
    await worker.fetch(req, env, {});
  }

  // 31st request must receive 429
  const blockedReq = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "CF-Connecting-IP": "10.0.0.1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "hi" }),
  });

  const blockedRes = await worker.fetch(blockedReq, env, {});
  assert.equal(blockedRes.status, 429);
  assert.ok(blockedRes.headers.get("Retry-After"));
  const body = await blockedRes.json();
  assert.match(body.error, /quá nhiều yêu cầu/i);
});
