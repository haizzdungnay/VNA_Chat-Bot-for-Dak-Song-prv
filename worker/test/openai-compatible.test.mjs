import test from "node:test";
import assert from "node:assert/strict";
import { OpenAICompatibleProvider } from "../src/services/ai/openai-compatible.provider.ts";
import { AIProviderError } from "../src/utils/errors.ts";

function createMockEnv(overrides = {}) {
  return {
    DB: {},
    AI_PROVIDER: "openai-compatible",
    AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai",
    AI_MODEL: "gemini-3.8-flash",
    AI_REASONING_EFFORT: "low",
    AI_JSON_MODE: "true",
    AI_API_KEY: "test-secret-key-12345",
    AI_RETRY_DELAY_MS: "0",
    ...overrides,
  };
}

test("OpenAICompatibleProvider sends correct URL, Bearer header, model, and reasoning_effort", async () => {
  let capturedUrl = "";
  let capturedHeaders = {};
  let capturedBody = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capturedUrl = url;
    capturedHeaders = init?.headers || {};
    capturedBody = JSON.parse(init?.body || "{}");
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer: "Chào bạn đến với Đắk Song!",
                placeIds: ["place-01"],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const env = createMockEnv();
    const provider = new OpenAICompatibleProvider(env);
    const result = await provider.chat({
      systemPrompt: "You are an assistant.",
      message: "Có chỗ nào đẹp không?",
      history: [
        { role: "user", content: "Xin chào" },
        { role: "assistant", content: "Chào bạn!" },
      ],
      contextPlaces: [],
    });

    assert.strictEqual(
      capturedUrl,
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    );
    assert.ok(capturedHeaders["Authorization"]?.startsWith("Bearer "));
    assert.strictEqual(capturedBody.model, "gemini-3.8-flash");
    assert.strictEqual(capturedBody.reasoning_effort, "low");
    assert.strictEqual(capturedBody.response_format?.type, "json_object");

    // Message order: system prompt -> sanitized history -> current message
    assert.strictEqual(capturedBody.messages.length, 4);
    assert.strictEqual(capturedBody.messages[0].role, "system");
    assert.strictEqual(capturedBody.messages[0].content, "You are an assistant.");
    assert.strictEqual(capturedBody.messages[1].role, "user");
    assert.strictEqual(capturedBody.messages[1].content, "Xin chào");
    assert.strictEqual(capturedBody.messages[2].role, "assistant");
    assert.strictEqual(capturedBody.messages[2].content, "Chào bạn!");
    assert.strictEqual(capturedBody.messages[3].role, "user");
    assert.strictEqual(capturedBody.messages[3].content, "Có chỗ nào đẹp không?");

    assert.strictEqual(result.answer, "Chào bạn đến với Đắk Song!");
    assert.deepStrictEqual(result.placeIds, ["place-01"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAICompatibleProvider parses Markdown codefence JSON and plain text fallback", async () => {
  const originalFetch = globalThis.fetch;

  // Case 1: Markdown codefence JSON
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "```json\n{\"answer\": \"Đồi thông Gia Nghĩa gần Đắk Song.\", \"placeIds\": [\"place-02\"]}\n```",
            },
          },
        ],
      }),
      { status: 200 }
    );
  };

  try {
    const provider = new OpenAICompatibleProvider(createMockEnv());
    const res1 = await provider.chat({
      systemPrompt: "sys",
      message: "q1",
      history: [],
      contextPlaces: [],
    });
    assert.strictEqual(res1.answer, "Đồi thông Gia Nghĩa gần Đắk Song.");
    assert.deepStrictEqual(res1.placeIds, ["place-02"]);

    // Case 2: Plain text answer fallback without valid JSON
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Đắk Song có khí hậu mát mẻ quanh năm.",
              },
            },
          ],
        }),
        { status: 200 }
      );
    };

    const res2 = await provider.chat({
      systemPrompt: "sys",
      message: "q2",
      history: [],
      contextPlaces: [],
    });
    assert.strictEqual(res2.answer, "Đắk Song có khí hậu mát mẻ quanh năm.");
    assert.deepStrictEqual(res2.placeIds, []);

    // Case 3: Empty string content
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "   " } }],
        }),
        { status: 200 }
      );
    };

    const res3 = await provider.chat({
      systemPrompt: "sys",
      message: "q3",
      history: [],
      contextPlaces: [],
    });
    assert.ok(res3.answer.length > 0);
    assert.deepStrictEqual(res3.placeIds, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAICompatibleProvider differentiates upstream HTTP error codes", async () => {
  const originalFetch = globalThis.fetch;

  try {
    const provider = new OpenAICompatibleProvider(createMockEnv());

    // 401 / 403
    globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });
    await assert.rejects(
      async () => provider.chat({ systemPrompt: "", message: "hi", history: [], contextPlaces: [] }),
      (err) => err instanceof AIProviderError && err.message.includes("xác thực")
    );

    // 404
    globalThis.fetch = async () => new Response("Not Found", { status: 404 });
    await assert.rejects(
      async () => provider.chat({ systemPrompt: "", message: "hi", history: [], contextPlaces: [] }),
      (err) => err instanceof AIProviderError && err.message.includes("không tồn tại")
    );

    // 429
    globalThis.fetch = async () => new Response("Too Many Requests", { status: 429 });
    await assert.rejects(
      async () => provider.chat({ systemPrompt: "", message: "hi", history: [], contextPlaces: [] }),
      (err) => err instanceof AIProviderError && err.message.includes("quá tải")
    );

    // 503
    globalThis.fetch = async () => new Response("Service Unavailable", { status: 503 });
    await assert.rejects(
      async () => provider.chat({ systemPrompt: "", message: "hi", history: [], contextPlaces: [] }),
      (err) => err instanceof AIProviderError && err.message.includes("tạm thời")
    );

    // Network failure
    globalThis.fetch = async () => {
      throw new Error("DNS resolution failed");
    };
    await assert.rejects(
      async () => provider.chat({ systemPrompt: "", message: "hi", history: [], contextPlaces: [] }),
      (err) => err instanceof AIProviderError && err.message.includes("kết nối")
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
