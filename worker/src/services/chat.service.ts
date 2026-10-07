import type { ChatRequest, ChatResponse, Env } from "../types";
import { PlaceRepository } from "../repositories/place.repository";
import { createAIProvider } from "./ai";
import { TRAVEL_ASSISTANT_SYSTEM_PROMPT } from "../prompts/travel-assistant";

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 8;

export class ChatService {
  private placeRepo: PlaceRepository;

  constructor(private env: Env) {
    this.placeRepo = new PlaceRepository(env.DB);
  }

  async handleChat(body: Partial<ChatRequest>): Promise<ChatResponse> {
    const rawMessage = (body.message || "").trim();
    if (!rawMessage) {
      throw new Error("Tin nhắn không được để trống");
    }
    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Tin nhắn vượt quá giới hạn ${MAX_MESSAGE_LENGTH} ký tự`);
    }

    const sanitizedHistory = (body.history || [])
      .slice(-MAX_HISTORY_MESSAGES)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_MESSAGE_LENGTH),
      }));

    // Lấy danh sách địa điểm mẫu từ D1 làm context
    const places = await this.placeRepo.findAll({ limit: 10 });
    const placesContext = places.length > 0
      ? places
          .map(
            (p) =>
              `- ID: ${p.id} | Tên: ${p.name} | Danh mục: ${p.category?.name || "Khác"} | Tóm tắt: ${p.shortDescription} | Địa chỉ: ${p.address || "Chưa có"}`
          )
          .join("\n")
      : "Chưa có dữ liệu địa điểm trong hệ thống.";

    const systemPrompt = `${TRAVEL_ASSISTANT_SYSTEM_PROMPT}

CONTEXT ĐỊA ĐIỂM ĐẮK SONG HIỆN CÓ:
${placesContext}`;

    const aiProvider = createAIProvider(this.env);
    const result = await aiProvider.chat({
      systemPrompt,
      message: rawMessage,
      history: sanitizedHistory,
      contextPlaces: places,
    });

    // Lọc lại placeIds chỉ giữ các ID thực sự có trong database
    const validIds = new Set(places.map((p) => p.id));
    const filteredPlaceIds = result.placeIds.filter((id) => validIds.has(id));

    return {
      answer: result.answer,
      placeIds: filteredPlaceIds,
    };
  }
}
