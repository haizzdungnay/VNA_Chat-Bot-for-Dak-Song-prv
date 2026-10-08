import type { AIProvider, ChatInput, ChatResponse, Env } from "../../types/index.ts";
import { AIProviderError } from "../../utils/errors.ts";

const UPSTREAM_TIMEOUT_MS = 25000;
// Budget 2048: du cho thinking tokens cua gemini-3.8-flash + answer ma khong gay lang phi chi phi token
const DEFAULT_MAX_TOKENS = 2048;

export class OpenAICompatibleProvider implements AIProvider {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async chat(input: ChatInput): Promise<ChatResponse> {
    const baseUrl = this.env.AI_BASE_URL || "https://api.openai.com/v1";
    const apiKey = this.env.AI_API_KEY || "";
    const model = this.env.AI_MODEL || "gpt-4o-mini";
    const useJsonMode = this.env.AI_JSON_MODE === "true" || this.env.AI_JSON_MODE === "1";

    const messages = [
      { role: "system", content: input.systemPrompt },
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: input.message },
    ];

    const bodyPayload: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: DEFAULT_MAX_TOKENS,
    };

    if (useJsonMode) {
      bodyPayload.response_format = { type: "json_object" };
    }

    const reasoningEffort = this.env.AI_REASONING_EFFORT;
    if (reasoningEffort) {
      const isGoogle = baseUrl.includes("generativelanguage.googleapis.com");
      const isReasoningModel = model.includes("gemini") || model.startsWith("o1") || model.startsWith("o3");
      if (isGoogle || isReasoningModel) {
        bodyPayload.reasoning_effort = reasoningEffort;
      }
    }

    let response: Response | null = null;
    const retryDelayMs = typeof this.env.AI_RETRY_DELAY_MS !== "undefined"
      ? Number(this.env.AI_RETRY_DELAY_MS)
      : 1000;

    for (let attempt = 0; attempt <= 1; attempt++) {
      const subController = new AbortController();
      const subTimer = setTimeout(() => subController.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(bodyPayload),
          signal: subController.signal,
        });
      } catch (err: any) {
        clearTimeout(subTimer);
        if (attempt === 0) {
          if (retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }
        if (err?.name === "AbortError") {
          console.error("[OpenAICompatibleProvider] upstream request timeout");
          throw new AIProviderError("Yêu cầu tới dịch vụ AI đã hết thời gian chờ. Vui lòng thử lại.");
        }
        console.error("[OpenAICompatibleProvider] network failure");
        throw new AIProviderError("Không thể kết nối tới dịch vụ AI. Vui lòng kiểm tra lại kết nối mạng.");
      } finally {
        clearTimeout(subTimer);
      }

      if (response && (response.status === 429 || response.status === 503) && attempt === 0) {
        console.warn(`[OpenAICompatibleProvider] transient upstream ${response.status}, retrying in 1200ms...`);
        if (retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
        continue;
      }
      break;
    }
    if (!response) {
      throw new AIProviderError("Không nhận được phản hồi từ dịch vụ AI.");
    }

    if (!response.ok) {
      const status = response.status;
      // Bao mat: khong bao gio log API key hay response body raw upstream ra server log
      console.error(`[OpenAICompatibleProvider] upstream error status: ${status}`);
      if (status === 401 || status === 403) {
        throw new AIProviderError("Lỗi cấu hình xác thực AI.");
      }
      if (status === 404) {
        throw new AIProviderError("Mô hình AI được chỉ định không tồn tại hoặc đã ngừng hỗ trợ.");
      }
      if (status === 429) {
        throw new AIProviderError("Hệ thống AI đang quá tải lượt gọi. Vui lòng thử lại sau giây lát.");
      }
      if (status >= 500) {
        throw new AIProviderError("Dịch vụ AI phía máy chủ gặp sự cố tạm thời. Vui lòng thử lại.");
      }
      throw new AIProviderError("Dịch vụ AI phản hồi lỗi. Vui lòng thử lại.");
    }

    try {
      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content || "";
      return this.parseResponse(content);
    } catch (err: any) {
      if (err instanceof AIProviderError) throw err;
      console.error("[OpenAICompatibleProvider] JSON parse failure from upstream");
      throw new AIProviderError("Không thể đọc phản hồi từ dịch vụ AI. Vui lòng thử lại.");
    }
  }

  private parseResponse(raw: string): ChatResponse {
    const trimmed = (raw || "").trim();
    if (!trimmed) {
      return {
        answer: "Xin lỗi, hiện tại trợ lý chưa nhận được nội dung phản hồi từ mô hình.",
        placeIds: [],
      };
    }

    try {
      const cleaned = trimmed.replace(/^``(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.answer === "string" && parsed.answer.trim()) {
          return {
            answer: parsed.answer.trim(),
            placeIds: Array.isArray(parsed.placeIds)
              ? parsed.placeIds.filter((id: unknown): id is string => typeof id === "string")
              : [],
          };
        }
      }
    } catch {
      // Fallback below
    }

    // ponytail: fallback plain text when LLM fails JSON; upgrade when json schema validation is active
    return {
      answer: trimmed,
      placeIds: [],
    };
  }
}
