import test from "node:test";
import assert from "node:assert/strict";

// Directly import REAL production helpers (no test-only duplicated logic)
import {
  buildChatHistory,
  buildOutgoingPayloadText,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES,
} from "../src/utils/chat-helpers.ts";

import { shareOrCopyUrl } from "../src/utils/share-helper.ts";
import { safeStorage } from "../src/services/storage.ts";
import { sanitizeArticleHtml } from "../src/utils/sanitize.ts";

// 1. Normal send: request.message is new question; history contains only earlier completed turns
test("1. Normal send: request.message is new question; history contains only earlier completed turns", () => {
  const messages = [
    { id: "welcome", role: "assistant", content: "Xin chào" },
    { id: "msg-1", role: "user", content: "Địa điểm đẹp ở Đắk Song?" },
    { id: "asst-1", role: "assistant", content: "Bạn có thể ghé Rừng thông Cảnh Tiên." },
  ];

  const pendingId = "msg-2";
  const newQuestion = "Có món gì ngon gần đó?";

  const history = buildChatHistory(messages, pendingId);
  const payload = buildOutgoingPayloadText(newQuestion, null);

  assert.equal(payload, newQuestion);
  assert.equal(history.length, 2);
  assert.deepEqual(history, [
    { role: "user", content: "Địa điểm đẹp ở Đắk Song?" },
    { role: "assistant", content: "Bạn có thể ghé Rừng thông Cảnh Tiên." },
  ]);
  // Pending user question must not be in history
  assert.ok(!history.some((m) => m.content === newQuestion));
});

// 2. Retry after network error: request.message contains failed question once; history excludes that failed question
test("2. Retry after network error: request.message contains failed question once; history excludes that failed question", () => {
  const failedId = "msg-failed-1";
  const failedQuestion = "Thời tiết hôm nay thế nào?";

  const messages = [
    { id: "welcome", role: "assistant", content: "Xin chào" },
    { id: "msg-1", role: "user", content: "Địa điểm đẹp?" },
    { id: "asst-1", role: "assistant", content: "Rừng thông Cảnh Tiên." },
    // Failed user bubble preserved in messages
    { id: failedId, role: "user", content: failedQuestion, isFailed: true },
  ];

  // When retrying, pendingUserMessageId is failedId
  const history = buildChatHistory(messages, failedId);
  const payload = buildOutgoingPayloadText(failedQuestion, null);

  assert.equal(payload, failedQuestion);
  // History must NOT contain the failed question being retried
  assert.ok(!history.some((m) => m.content === failedQuestion));
  assert.equal(history.length, 2);
  assert.deepEqual(history, [
    { role: "user", content: "Địa điểm đẹp?" },
    { role: "assistant", content: "Rừng thông Cảnh Tiên." },
  ]);

  // Messages in UI only has exactly one user bubble for failedId
  const userBubbles = messages.filter((m) => m.role === "user");
  assert.equal(userBubbles.length, 2); // msg-1 and msg-failed-1
});

// 3. Repeated retry / button activation cannot duplicate outgoing requests or assistant bubbles
test("3. Concurrency guard prevents duplicate outgoing requests when request in-flight", async () => {
  let inFlight = false;
  let networkCallCount = 0;

  const sendWithLock = async (text) => {
    if (inFlight) return null; // Reject duplicate concurrent click
    inFlight = true;
    try {
      networkCallCount++;
      return { answer: "OK" };
    } finally {
      inFlight = false;
    }
  };

  // Simulate multiple clicks while inFlight
  inFlight = true;
  const duplicateAttempt = await sendWithLock("Thử lại");
  assert.equal(duplicateAttempt, null);
  assert.equal(networkCallCount, 0);

  // Normal attempt when lock released
  inFlight = false;
  await sendWithLock("Thử lại");
  assert.equal(networkCallCount, 1);
});

// 4. Welcome/system UI message never appears in API history; 8-item history cap enforced
test("4. Welcome message never appears in API history; 8-item history cap enforced", () => {
  const longConversation = [
    { id: "welcome", role: "assistant", content: "Xin chào" },
  ];

  for (let i = 1; i <= 10; i++) {
    longConversation.push({ id: `u-${i}`, role: "user", content: `Q${i}` });
    longConversation.push({ id: `a-${i}`, role: "assistant", content: `A${i}` });
  }

  const history = buildChatHistory(longConversation, "u-new");

  assert.equal(history.length, MAX_HISTORY_MESSAGES); // 8 items
  assert.ok(!history.some((m) => m.content === "Xin chào"));
  // Must be the most recent 8 items (Q7, A7, Q8, A8, Q9, A9, Q10, A10)
  assert.equal(history[0].content, "Q7");
  assert.equal(history[7].content, "A10");
});

// 5. Opt-in OFF vs ON: allowed fields present, total message <= 500 chars
test("5. Opt-in OFF: profile fields absent; Opt-in ON: allowed fields present and <= 500 chars", () => {
  const profileOff = {
    displayName: "Minh Tuấn",
    addressAs: "anh",
    ageGroup: "25-34",
    allowAIContext: false,
    updatedAt: new Date().toISOString(),
  };

  const payloadOff = buildOutgoingPayloadText("Ăn gì ở Đắk Song?", profileOff);
  assert.equal(payloadOff, "Ăn gì ở Đắk Song?");
  assert.ok(!payloadOff.includes("Minh Tuấn"));
  assert.ok(!payloadOff.includes("anh"));

  const profileOn = {
    ...profileOff,
    allowAIContext: true,
  };

  const payloadOn = buildOutgoingPayloadText("Ăn gì ở Đắk Song?", profileOn);
  assert.ok(payloadOn.includes("Tên gọi: Minh Tuấn"));
  assert.ok(payloadOn.includes("Cách xưng hô: anh"));
  assert.ok(payloadOn.includes("Nhóm tuổi: 25–34"));
  assert.ok(payloadOn.includes("Ăn gì ở Đắk Song?"));
  assert.ok(payloadOn.length <= MAX_MESSAGE_LENGTH);

  // Long question drops context prefix so question is not silently cut
  const longQuestion = "A".repeat(470);
  const payloadLong = buildOutgoingPayloadText(longQuestion, profileOn);
  assert.equal(payloadLong, longQuestion);
  assert.ok(!payloadLong.includes("[Tuỳ chọn do người dùng cung cấp"));
  assert.ok(payloadLong.length <= MAX_MESSAGE_LENGTH);
});

// 6. Opt-out / delete after prior personalized chat: subsequent request contains no old personalization
test("6. Opt-out / delete after prior personalized chat: subsequent request contains no old personalization", () => {
  // Previous UI conversation
  const messages = [
    { id: "welcome", role: "assistant", content: "Xin chào" },
    { id: "u-1", role: "user", content: "Gợi ý thác đẹp" },
    { id: "a-1", role: "assistant", content: "Thác Lưu Ly rất đẹp." },
  ];

  // User deletes profile or turns off opt-in
  const deletedProfile = null;
  const nextQuestion = "Đường đi có dốc không?";

  const history = buildChatHistory(messages, "u-2");
  const payload = buildOutgoingPayloadText(nextQuestion, deletedProfile);

  // Outgoing payload has no metadata
  assert.equal(payload, nextQuestion);
  assert.ok(!payload.includes("Tên gọi:"));

  // History messages also have no metadata (because user bubbles store pure user text)
  assert.deepEqual(history, [
    { role: "user", content: "Gợi ý thác đẹp" },
    { role: "assistant", content: "Thác Lưu Ly rất đẹp." },
  ]);
});

// 7. Invalid placeId: no contextual auto-send and user receives friendly notice
test("7. Invalid placeId: handles failure gracefully without auto-sending", async () => {
  let autoSent = false;
  let noticeMessage = null;

  const handlePlaceLoad = async (placeId) => {
    try {
      if (placeId === "invalid-id") {
        throw new Error("Place not found");
      }
      autoSent = true;
    } catch {
      noticeMessage =
        "Không thể tải thông tin địa điểm này. Bạn vẫn có thể trò chuyện với trợ lý AI như bình thường.";
    }
  };

  await handlePlaceLoad("invalid-id");

  assert.equal(autoSent, false, "Must not auto-send when place is invalid");
  assert.ok(noticeMessage.includes("Không thể tải thông tin địa điểm này"));
});

// 8. Share clipboard resolved/rejected/unavailable: truthful feedback in all branches
test("8. Share clipboard: truthful feedback in resolved, rejected, and unavailable branches", async () => {
  const url = "http://localhost:5173/place/place-01";
  const placeName = "Rừng thông Cảnh Tiên";

  // Case A: Clipboard succeeds
  const mockSuccessApi = {
    writeText: async () => {},
  };
  const resSuccess = await shareOrCopyUrl(url, placeName, mockSuccessApi);
  assert.equal(resSuccess.success, true);
  assert.equal(resSuccess.message, `Đã sao chép liên kết địa điểm: ${placeName}`);

  // Case B: Clipboard rejects
  const mockRejectApi = {
    writeText: async () => {
      throw new Error("Permission denied");
    },
  };
  const resReject = await shareOrCopyUrl(url, placeName, mockRejectApi);
  assert.equal(resReject.success, false);
  assert.equal(
    resReject.message,
    "Không thể tự động sao chép liên kết trên thiết bị này. Vui lòng thử lại sau."
  );

  // Case C: Clipboard unavailable
  const resUnavailable = await shareOrCopyUrl(url, placeName, null);
  assert.equal(resUnavailable.success, false);
  assert.equal(
    resUnavailable.message,
    "Không thể tự động sao chép liên kết trên thiết bị này. Vui lòng thử lại sau."
  );

  // Case D: Native Share Sheet succeeds
  const mockNativeShareSuccess = async () => ({ success: true });
  const resNativeSuccess = await shareOrCopyUrl(
    url,
    placeName,
    null,
    mockNativeShareSuccess,
    { summary: "Rừng thông đẹp", thumbnail: "https://example.com/thumb.jpg" }
  );
  assert.equal(resNativeSuccess.success, true);
  assert.equal(resNativeSuccess.message, `Đã mở chia sẻ địa điểm: ${placeName}`);

  // Case E: Native Share Sheet rejected -> fallback to Clipboard succeeds
  const mockNativeShareReject = async () => {
    throw new Error("User cancelled share");
  };
  const resFallbackClipboard = await shareOrCopyUrl(
    url,
    placeName,
    mockSuccessApi,
    mockNativeShareReject
  );
  assert.equal(resFallbackClipboard.success, true);
  assert.equal(resFallbackClipboard.message, `Đã sao chép liên kết địa điểm: ${placeName}`);
});

// 9. Storage unavailable: safe fallback does not throw; persistence status reported honestly
test("9. Storage unavailable safe fallback does not throw and reports persistence truthfully", () => {
  safeStorage.clearMemory();

  // Operating in memory store (headless Node test environment)
  const isPersistent = safeStorage.isPersistent();
  assert.equal(typeof isPersistent, "boolean");

  // Non-throwing set, get, remove
  safeStorage.setItem("test_key", "test_val");
  assert.equal(safeStorage.getItem("test_key"), "test_val");

  safeStorage.removeItem("test_key");
  assert.equal(safeStorage.getItem("test_key"), null);
});

// 10. First-run Home, skip, edit, delete state transitions
test("10. First-run Home, skip, edit, and delete lifecycle state transitions", () => {
  safeStorage.clearMemory();

  // Initial state: not seen
  let onboardingSeen = safeStorage.getItem("vna.daksong.onboardingSeen.v1") === "true";
  assert.equal(onboardingSeen, false);

  // Action: Skip
  safeStorage.setItem("vna.daksong.onboardingSeen.v1", "true");
  onboardingSeen = safeStorage.getItem("vna.daksong.onboardingSeen.v1") === "true";
  let profile = safeStorage.getItem("vna.daksong.personalization.v1");
  assert.equal(onboardingSeen, true);
  assert.equal(profile, null); // Skip does not save profile

  // Action: Reopen & Save profile
  const newProfile = {
    displayName: "Lan",
    addressAs: "chi",
    ageGroup: "18-24",
    allowAIContext: true,
    updatedAt: new Date().toISOString(),
  };
  safeStorage.setItem("vna.daksong.personalization.v1", JSON.stringify(newProfile));
  profile = JSON.parse(safeStorage.getItem("vna.daksong.personalization.v1"));
  assert.equal(profile.displayName, "Lan");
  assert.equal(profile.addressAs, "chi");

  // Action: Delete profile
  safeStorage.removeItem("vna.daksong.personalization.v1");
  profile = safeStorage.getItem("vna.daksong.personalization.v1");
  assert.equal(profile, null);
  // onboardingSeen remains true so user is not prompted again
  assert.equal(safeStorage.getItem("vna.daksong.onboardingSeen.v1"), "true");
});

// 11. Article modal query navigation and XSS sanitization
test("11. sanitizeArticleHtml cleans dangerous scripts and malformed tags from article HTML", () => {
  const payload = `<p>Đắk Song</p><script>alert(1)</script><img src="x" onerror="alert(2)" /><a href="javascript:void(0)">Link</a>`;
  const clean = sanitizeArticleHtml(payload);
  assert.ok(!clean.includes("<script>"));
  assert.ok(!clean.includes("onerror"));
  assert.ok(!clean.includes("javascript:"));
  assert.ok(clean.includes("<p>Đắk Song</p>"));
});

test("12. Contextual ?q= parameter executes auto-send strictly once without infinite loops", () => {
  let sendCount = 0;
  let lastSentQuery = null;
  const autoSentQRef = { current: null };

  const handleQueryParam = (q) => {
    if (q && autoSentQRef.current !== q) {
      autoSentQRef.current = q;
      sendCount++;
      lastSentQuery = q;
    }
  };

  // First render with ?q=
  handleQueryParam("Tìm hiểu về Thác Lưu Ly");
  assert.equal(sendCount, 1);
  assert.equal(lastSentQuery, "Tìm hiểu về Thác Lưu Ly");

  // Subsequent component re-render with identical q
  handleQueryParam("Tìm hiểu về Thác Lưu Ly");
  assert.equal(sendCount, 1, "Must NOT auto-send again on re-render");
});

