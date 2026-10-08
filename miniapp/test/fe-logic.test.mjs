import test from "node:test";
import assert from "node:assert/strict";

const MAX_MESSAGE_LENGTH = 500;

function buildOutgoingPayloadText(userQuestion, profile) {
  const cleanQuestion = userQuestion.trim();

  if (!profile || !profile.allowAIContext) {
    return cleanQuestion.slice(0, MAX_MESSAGE_LENGTH);
  }

  const lines = ["[Tuỳ chọn do người dùng cung cấp — chỉ phục vụ cách xưng hô]"];
  if (profile.displayName) {
    const cleanName = profile.displayName.replace(/[\r\n]/g, " ").trim();
    lines.push(`Tên gọi: ${cleanName}`);
  }
  if (profile.addressAs) {
    lines.push(`Cách xưng hô: ${profile.addressAs}`);
  }
  if (profile.ageGroup) {
    const ageLabels = {
      under18: "Dưới 18",
      "18-24": "18–24",
      "25-34": "25–34",
      "35-49": "35–49",
      "50plus": "50+",
    };
    const ageText = ageLabels[profile.ageGroup] || profile.ageGroup;
    lines.push(`Nhóm tuổi: ${ageText}`);
  }
  lines.push("[Nội dung người dùng hỏi]");
  lines.push(cleanQuestion);

  const combined = lines.join("\n");
  if (combined.length <= MAX_MESSAGE_LENGTH) {
    return combined;
  }
  return cleanQuestion.slice(0, MAX_MESSAGE_LENGTH);
}

test("Personalization context omitted when allowAIContext is false", () => {
  const profile = {
    displayName: "Minh",
    addressAs: "anh",
    ageGroup: "25-34",
    allowAIContext: false,
    updatedAt: new Date().toISOString(),
  };

  const payload = buildOutgoingPayloadText("Ăn gì ở Đắk Song?", profile);
  assert.equal(payload, "Ăn gì ở Đắk Song?");
  assert.ok(!payload.includes("Tên gọi:"));
  assert.ok(!payload.includes("Cách xưng hô:"));
});

test("Personalization context prepended when allowAIContext is true", () => {
  const profile = {
    displayName: "Minh",
    addressAs: "anh",
    ageGroup: "25-34",
    allowAIContext: true,
    updatedAt: new Date().toISOString(),
  };

  const payload = buildOutgoingPayloadText("Ăn gì ở Đắk Song?", profile);
  assert.ok(payload.includes("Tên gọi: Minh"));
  assert.ok(payload.includes("Cách xưng hô: anh"));
  assert.ok(payload.includes("Nhóm tuổi: 25–34"));
  assert.ok(payload.includes("Ăn gì ở Đắk Song?"));
  assert.ok(payload.length <= MAX_MESSAGE_LENGTH);
});

test("Personalization drops context prefix if total length exceeds 500 chars", () => {
  const profile = {
    displayName: "Minh",
    addressAs: "anh",
    ageGroup: "25-34",
    allowAIContext: true,
    updatedAt: new Date().toISOString(),
  };

  // 450 char long question
  const longQuestion = "A".repeat(450);
  const payload = buildOutgoingPayloadText(longQuestion, profile);
  assert.equal(payload, longQuestion);
  assert.ok(!payload.includes("[Tuỳ chọn do người dùng cung cấp"));
  assert.ok(payload.length <= MAX_MESSAGE_LENGTH);
});

test("Chat history limits to MAX_HISTORY_MESSAGES = 8 and excludes welcome message", () => {
  const messages = [
    { id: "welcome", role: "assistant", content: "Xin chào" },
    { id: "1", role: "user", content: "Q1" },
    { id: "2", role: "assistant", content: "A1" },
    { id: "3", role: "user", content: "Q2" },
    { id: "4", role: "assistant", content: "A2" },
    { id: "5", role: "user", content: "Q3" },
    { id: "6", role: "assistant", content: "A3" },
    { id: "7", role: "user", content: "Q4" },
    { id: "8", role: "assistant", content: "A4" },
    { id: "9", role: "user", content: "Q5" },
    { id: "10", role: "assistant", content: "A5" },
  ];

  const historyPayload = messages
    .filter((m) => m.id !== "welcome")
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content }));

  assert.equal(historyPayload.length, 8);
  assert.ok(!historyPayload.some((m) => m.content === "Xin chào"));
  assert.equal(historyPayload[0].content, "Q2");
  assert.equal(historyPayload[7].content, "A5");
});
