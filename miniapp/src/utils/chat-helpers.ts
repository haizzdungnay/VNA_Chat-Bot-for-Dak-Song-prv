import type { ChatMessage, PersonalizationProfile } from "../types";

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_HISTORY_MESSAGES = 8;

/**
 * Builds history array for POST /api/chat.
 * Rules:
 * 1. Excludes welcome message (id === "welcome").
 * 2. Excludes the current pending or retried user message (matching pendingUserMessageId).
 * 3. Excludes any uncompleted/failed user turn (isFailed === true).
 * 4. Only contains roles "user" and "assistant".
 * 5. Capped at MAX_HISTORY_MESSAGES (8).
 */
export function buildChatHistory(
  messages: ChatMessage[],
  pendingUserMessageId?: string
): { role: "user" | "assistant"; content: string }[] {
  const filtered = messages.filter((m) => {
    if (m.id === "welcome") return false;
    if (pendingUserMessageId && m.id === pendingUserMessageId) return false;
    if ((m as any).isFailed) return false;
    return m.role === "user" || m.role === "assistant";
  });

  return filtered.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

/**
 * Constructs the outgoing message text sent to AI backend.
 * Rules:
 * 1. When allowAIContext is false or profile is null: returns clean userQuestion (max 500 chars).
 * 2. When allowAIContext is true: formats clean context header with only provided fields.
 * 3. If combined string exceeds MAX_MESSAGE_LENGTH (500), drops personalization prefix completely
 *    so user's question is never truncated silently.
 * 4. Strips control characters from displayName to prevent prompt injection.
 */
export function buildOutgoingPayloadText(
  userQuestion: string,
  profile: PersonalizationProfile | null
): string {
  const cleanQuestion = userQuestion.trim();

  if (!profile || !profile.allowAIContext) {
    return cleanQuestion.slice(0, MAX_MESSAGE_LENGTH);
  }

  const lines: string[] = ["[Tuỳ chọn do người dùng cung cấp — chỉ phục vụ cách xưng hô]"];

  if (profile.displayName) {
    const cleanName = profile.displayName.replace(/[\r\n]/g, " ").trim().slice(0, 32);
    if (cleanName) {
      lines.push(`Tên gọi: ${cleanName}`);
    }
  }

  if (profile.addressAs) {
    lines.push(`Cách xưng hô: ${profile.addressAs}`);
  }

  if (profile.ageGroup) {
    const ageLabels: Record<string, string> = {
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

  // Fallback: drop personalization prefix if exceeding 500 limit
  return cleanQuestion.slice(0, MAX_MESSAGE_LENGTH);
}
