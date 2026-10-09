import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryRateLimiter, chatRateLimiter } from "../src/utils/rate-limiter.ts";
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

test("Worker blocks oversized POST payloads with 413 when Content-Length header is present", async () => {
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

test("Worker blocks oversized POST body > 10KB even WITHOUT Content-Length header", async () => {
  const largePayload = JSON.stringify({ message: "A".repeat(11000) });
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  // Omit Content-Length header completely

  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    headers,
    body: largePayload,
  });
  // Delete header if environment auto-set it
  req.headers.delete("content-length");

  const res = await worker.fetch(req, { CORS_ALLOW_ORIGIN: "*" }, {});
  assert.equal(res.status, 413, "Must return 413 when body exceeds 10KB without header");
  const body = await res.json();
  assert.match(body.error, /vượt quá giới hạn/);
});

test("Worker blocks oversized POST body when Content-Length header is falsely under-reported", async () => {
  const largePayload = JSON.stringify({ message: "B".repeat(11000) });
  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "Content-Length": "50", // Falsely under-reported
      "Content-Type": "application/json",
    },
    body: largePayload,
  });

  const res = await worker.fetch(req, { CORS_ALLOW_ORIGIN: "*" }, {});
  assert.equal(res.status, 413, "Must return 413 when actual streamed bytes exceed 10KB");
});

test("Worker allows valid body under 10KB with multibyte UTF-8 Vietnamese characters", async () => {
  const vietnamesePayload = JSON.stringify({
    message: "Đắk Song có Thác Lưu Ly tuyệt đẹp giữa đại ngàn Tây Nguyên hùng vĩ."
  });

  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "172.16.0.1",
    },
    body: vietnamesePayload,
  });

  // ChatRoute will fail gracefully with AI error / mock, but NOT 413
  const res = await worker.fetch(req, { CORS_ALLOW_ORIGIN: "*" }, {});
  assert.notEqual(res.status, 413, "Valid Vietnamese payload under 10KB must not trigger 413");
});

test("Worker blocks chat endpoint when rate limit is exceeded with 429 and Retry-After", async () => {
  const env = { CORS_ALLOW_ORIGIN: "*" };
  for (let i = 0; i < 30; i++) {
    chatRateLimiter.check("10.0.0.1");
  }

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
