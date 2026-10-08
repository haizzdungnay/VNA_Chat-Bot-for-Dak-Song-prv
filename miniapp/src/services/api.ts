import type { Category, Place, Article, ChatRequest, ChatResponse } from "../types";

const rawBaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "http://localhost:8787";
const API_BASE_URL = rawBaseUrl.endsWith("/") ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err: unknown) {
    const isLocalhost = API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1");
    const isMobileOrExternal =
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";

    if (isLocalhost && isMobileOrExternal) {
      throw new Error(
        "Không thể kết nối máy chủ local từ thiết bị di động. Vui lòng cấu hình VITE_API_BASE_URL tới server backend."
      );
    }
    const message = err instanceof Error ? err.message : "Lỗi kết nối mạng, vui lòng thử lại sau.";
    throw new Error(message);
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = "Yêu cầu thất bại với mã lỗi " + res.status;
    try {
      const data = await res.json();
      if (data?.error) errorMsg = data.error;
    } catch {
      // Ignore JSON parse error on non-ok response
    }
    throw new Error(errorMsg);
  }
  return (await res.json()) as T;
}

export const api = {
  async getCategories(): Promise<Category[]> {
    const res = await safeFetch(API_BASE_URL + "/api/categories");
    return handleResponse<Category[]>(res);
  },

  async getPlaces(params?: {
    categoryId?: string;
    search?: string;
    featured?: boolean;
  }): Promise<Place[]> {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.set("categoryId", params.categoryId);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.featured !== undefined) searchParams.set("featured", String(params.featured));

    const qs = searchParams.toString();
    const url = API_BASE_URL + "/api/places" + (qs ? "?" + qs : "");
    const res = await safeFetch(url);
    return handleResponse<Place[]>(res);
  },

  async getPlaceById(id: string): Promise<Place> {
    const res = await safeFetch(API_BASE_URL + "/api/places/" + encodeURIComponent(id));
    return handleResponse<Place>(res);
  },

  async getArticles(params?: { category?: string; search?: string; limit?: number }): Promise<Article[]> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.search) searchParams.set("q", params.search);
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const qs = searchParams.toString();
    const url = API_BASE_URL + "/api/articles" + (qs ? "?" + qs : "");
    const res = await safeFetch(url);
    return handleResponse<Article[]>(res);
  },

  async getArticleBySlug(slug: string): Promise<Article> {
    const res = await safeFetch(API_BASE_URL + "/api/articles/" + encodeURIComponent(slug));
    return handleResponse<Article>(res);
  },

  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const res = await safeFetch(API_BASE_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return handleResponse<ChatResponse>(res);
  },
};
