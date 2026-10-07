import type { AIProvider, ChatInput, ChatResponse, Env } from "../../types";
import { AIProviderError } from "../../utils/errors";

const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export class WorkersAIProvider implements AIProvider {
  constructor(private env: Env) {}

  async chat(input: ChatInput): Promise<ChatResponse> {
    if (!this.env.AI) {
      console.error("[WorkersAIProvider] env.AI binding is missing");
      throw new AIProviderError();
    }

    const model = this.env.AI_MODEL || DEFAULT_WORKERS_AI_MODEL;
    const messages = [
      { role: "system", content: input.systemPrompt },
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: input.message },
    ];

    try {
      const aiResponse: any = await this.env.AI.run(model, {
        messages,
        max_tokens: 512,
        temperature: 0.3,
      });

      const rawText = aiResponse?.response || aiResponse?.text || "";
      return this.parseResponse(rawText);
    } catch (err: any) {
      console.error("[WorkersAIProvider] execution failed:", err?.name || "UnknownError");
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

    // ponytail: fallback parsing when LLM outputs plain text instead of JSON; upgrade to structured outputs / json-mode when supported by provider
    return {
      answer: raw.trim() || "Xin lỗi, hiện tại trợ lý chưa thể xử lý yêu cầu này.",
      placeIds: [],
    };
  }
}
