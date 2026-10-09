import type { ChatRequest, ChatResponse, Env, Article } from "../types";
import { PlaceRepository } from "../repositories/place.repository";
import { ArticleRepository } from "../repositories/article.repository";
import { createAIProvider } from "./ai";
import { TRAVEL_ASSISTANT_SYSTEM_PROMPT } from "../prompts/travel-assistant";
import { ValidationError } from "../utils/errors";

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 8;

export class ChatService {
  private placeRepo: PlaceRepository;
  private articleRepo: ArticleRepository;

  private env: Env;
  constructor(env: Env) {
    this.env = env;
    this.placeRepo = new PlaceRepository(env.DB);
    this.articleRepo = new ArticleRepository(env.DB);
  }

  async handleChat(body: Partial<ChatRequest>): Promise<ChatResponse> {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ValidationError("Dữ liệu gửi lên không hợp lệ");
    }
    if (typeof body.message !== "string") {
      throw new ValidationError("Tin nhắn phải là chuỗi văn bản");
    }

    const rawMessage = body.message.trim();
    if (!rawMessage) {
      throw new ValidationError("Tin nhắn không được để trống");
    }
    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      throw new ValidationError(`Tin nhắn vượt quá giới hạn ${MAX_MESSAGE_LENGTH} ký tự`);
    }

    if (body.articleSlug !== undefined) {
      if (typeof body.articleSlug !== "string") {
        throw new ValidationError("articleSlug phải là chuỗi văn bản");
      }
      if (body.articleSlug.length > 200) {
        throw new ValidationError("articleSlug không được vượt quá 200 ký tự");
      }
    }

    if (body.history !== undefined) {
      if (!Array.isArray(body.history)) {
        throw new ValidationError("Lịch sử trò chuyện không hợp lệ");
      }
      for (const item of body.history) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          throw new ValidationError("Mục trong lịch sử không hợp lệ");
        }
        if (item.role !== "user" && item.role !== "assistant") {
          throw new ValidationError("Vai trò trong lịch sử phải là user hoặc assistant");
        }
        if (typeof item.content !== "string") {
          throw new ValidationError("Nội dung tin nhắn trong lịch sử phải là chuỗi");
        }
      }
    }

    const sanitizedHistory = (body.history || [])
      .slice(-MAX_HISTORY_MESSAGES)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_MESSAGE_LENGTH),
      }));

    // Nạp toàn bộ địa điểm và bài viết chính thống làm kho tri thức
    const [places, articles] = await Promise.all([
      this.placeRepo.findAll(),
      this.articleRepo.findAll({ limit: 42 }),
    ]);

    // Tìm bài viết theo articleSlug nếu người dùng hỏi từ trang bài viết
    let targetedArticle: Article | undefined;
    if (typeof body.articleSlug === "string" && body.articleSlug.trim()) {
      const cleanSlug = body.articleSlug.trim();
      targetedArticle = articles.find((a) => a.slug === cleanSlug);
    }

    // Thuật toán tìm bài viết liên quan dựa trên từ khóa câu hỏi & nội dung sâu
    const cleanHtml = (str: string) => str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const queryTerms = rawMessage
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .split(/[\s,.;:!?()]+/)
      .filter((t) => t.length >= 2);

    const scoredArticles = articles.map((a) => {
      if (targetedArticle && a.id === targetedArticle.id) {
        return { article: a, score: 999 };
      }
      const normTitle = (a.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d");
      const normQuote = (a.quote || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d");
      const normContent = cleanHtml(a.content || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d");
      let score = 0;
      for (const term of queryTerms) {
        if (normTitle.includes(term)) score += 4;
        if (normQuote.includes(term)) score += 2;
        if (normContent.includes(term)) score += 1;
      }
      return { article: a, score };
    });

    scoredArticles.sort((a, b) => b.score - a.score);
    const topRelevantArticles = scoredArticles.filter((x) => x.score > 0).slice(0, 3).map((x) => x.article);

    const placesContext = places.length > 0
      ? places
          .map(
            (p) =>
              `- ID: ${p.id} | Tên: ${p.name} | Danh mục: ${p.category?.name || "Khác"} | Địa chỉ: ${p.address || "Chưa có"} | Giờ mở cửa: ${p.openingHours || "Chưa cập nhật"} | Tóm tắt: ${p.shortDescription}`
          )
          .join("\n")
      : "Chưa có dữ liệu địa điểm trong hệ thống.";

    const relevantArticlesContext = topRelevantArticles.length > 0
      ? topRelevantArticles
          .map((a) => {
            const isTargeted = targetedArticle && a.id === targetedArticle.id;
            const contentLimit = isTargeted ? 1500 : 800;
            return `- Tiêu đề: "${a.title}" (${a.categoryName})${isTargeted ? " [BÀI VIẾT ĐƯỢC CHỈ ĐỊNH ĐÍCH]" : ""}\n  Tóm tắt: ${a.quote || "Không có tóm tắt"}\n  Nội dung trích đoạn: ${cleanHtml(a.content || "").slice(0, contentLimit)}`;
          })
          .join("\n\n")
      : "Không có bài viết trích đoạn khớp trực tiếp.";

    const allArticlesCatalog = articles.length > 0
      ? articles.map((a) => `- "${a.title}" [${a.categoryName}]`).join("\n")
      : "Chưa có danh mục bài viết.";

    const systemPrompt = `${TRAVEL_ASSISTANT_SYSTEM_PROMPT}

=== BẮT ĐẦU KHO TRI THỨC ĐẮK SONG (UNTRUSTED SOURCE DATA) ===

[DANH SÁCH ĐỊA ĐIỂM CHÍNH THỨC (${places.length} ĐIỂM)]:
${placesContext}

[BÀI VIẾT VĂN HÓA & DU LỊCH TRÍCH ĐOẠN PHÙ HỢP CÂU HỎI]:
${relevantArticlesContext}

[MỤC LỤC TẤT CẢ BÀI VIẾT CÓ TRONG HỆ THỐNG]:
${allArticlesCatalog}

=== KẾT THÚC KHO TRI THỨC ĐẮK SONG ===`;

    const aiProvider = createAIProvider(this.env);
    const result = await aiProvider.chat({
      systemPrompt,
      message: rawMessage,
      history: sanitizedHistory,
      contextPlaces: places,
      contextArticles: articles,
    });

    // Lọc lại placeIds chỉ giữ các ID thực sự có trong database
    const validIds = new Set(places.map((p) => p.id));
    const filteredPlaceIds = (result.placeIds || [])
      .filter((id) => validIds.has(id))
      .slice(0, 3);

    return {
      answer: result.answer,
      placeIds: filteredPlaceIds,
    };
  }
}
