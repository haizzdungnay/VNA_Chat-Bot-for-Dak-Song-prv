import type { AIProvider, ChatInput, ChatResponse, Env } from "../../types";
import { AIProviderError } from "../../utils/errors";

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private env: Env) {}

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
      max_tokens: 512,
    };

    if (useJsonMode) {
      bodyPayload.response_format = { type: "json_object" };
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(bodyPayload),
      });
    } catch (err: any) {
      console.error("[OpenAICompatibleProvider] network failure");
      throw new AIProviderError();
    }

    if (!response.ok) {
      // Bảo mật: không bao giờ log API key hay expose response body upstream ra ngoài
      console.error(`[OpenAICompatibleProvider] upstream error status: ${response.status}`);
      throw new AIProviderError();
    }

    try {
      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content || "";
      return this.parseResponse(content);
    } catch {
      console.error("[OpenAICompatibleProvider] JSON parse failure from upstream");
      throw new AIProviderError();
    }
  }

  private parseResponse(raw: string): ChatResponse {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.answer === "string") {
          return {
            answer: parsed.answer,
            placeIds: Array.isArray(parsed.placeIds) ? parsed.placeIds : [],
          };
        }
      }
    } catch {
      // Fallback below
    }

    // ponytail: fallback plain text when LLM fails JSON; upgrade when json schema validation is active
    return {
      answer: raw.trim() || "Xin lỗi, hiện tại trợ lý chưa thể xử lý yêu cầu này.",
      placeIds: [],
    };
  }
}
