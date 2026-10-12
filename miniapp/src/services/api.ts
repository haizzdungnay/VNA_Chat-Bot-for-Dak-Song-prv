import type { Category, Place, Article, ChatRequest, ChatResponse, AuthUser, PlannerRequest, ItineraryOutput } from "../types";
import { STORAGE_KEY_AUTH_TOKEN } from "../constants";
import { safeStorage } from "./storage";

export function getApiBaseUrl(): string {
  // If running in browser on localhost or 127.0.0.1, prioritize local worker
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envUrl && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
      return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
    }
    // Default local worker port for development
    return "http://localhost:8788";
  }

  const raw =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
    "http://localhost:8787";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function safeFetch(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${getApiBaseUrl()}${pathOrUrl}`;
  const token = safeStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await fetch(url, { ...init, headers });
  } catch (err: unknown) {
    const baseUrl = getApiBaseUrl();
    const isLocalhost = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
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
    const res = await safeFetch("/api/categories");
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
    const res = await safeFetch("/api/places" + (qs ? "?" + qs : ""));
    return handleResponse<Place[]>(res);
  },

  async getPlaceById(id: string): Promise<Place> {
    const res = await safeFetch("/api/places/" + encodeURIComponent(id));
    return handleResponse<Place>(res);
  },

  async getArticles(params?: { category?: string; search?: string; limit?: number }): Promise<Article[]> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.search) searchParams.set("q", params.search);
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const qs = searchParams.toString();
    const res = await safeFetch("/api/articles" + (qs ? "?" + qs : ""));
    return handleResponse<Article[]>(res);
  },

  async getArticleBySlug(slug: string): Promise<Article> {
    const res = await safeFetch("/api/articles/" + encodeURIComponent(slug));
    return handleResponse<Article>(res);
  },

  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const res = await safeFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return handleResponse<ChatResponse>(res);
  },

  async syncVisitorConsent(payload: {
    consentToken: string;
    displayName?: string;
    addressAs?: string;
    ageGroup?: string;
    consentVersion: string;
    optIn: boolean;
  }): Promise<{ success: boolean; consented: boolean }> {
    const res = await safeFetch("/api/visitors/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; consented: boolean }>(res);
  },

  // Phase 8.1 User Identity & Authentication APIs
  async authZalo(accessToken: string): Promise<{ sessionToken: string; user: AuthUser }> {
    const res = await safeFetch("/api/auth/zalo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });
    return handleResponse<{ sessionToken: string; user: AuthUser }>(res);
  },

  async authEmailRequest(email: string): Promise<{ success: boolean; message: string; challengeId: string }> {
    const res = await safeFetch("/api/auth/email/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return handleResponse<{ success: boolean; message: string; challengeId: string }>(res);
  },

  async authEmailVerify(email: string, code: string): Promise<{ sessionToken: string; user: AuthUser }> {
    const res = await safeFetch("/api/auth/email/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    return handleResponse<{ sessionToken: string; user: AuthUser }>(res);
  },

  async getMe(): Promise<{ user: AuthUser }> {
    const res = await safeFetch("/api/me", { method: "GET" });
    return handleResponse<{ user: AuthUser }>(res);
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await safeFetch("/api/auth/logout", { method: "POST" });
    return handleResponse<{ success: boolean }>(res);
  },
  // Phase 8.2 AI Travel Planner APIs
  async previewItinerary(request: PlannerRequest): Promise<{ itinerary: ItineraryOutput }> {
    const res = await safeFetch("/api/itineraries/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return handleResponse<{ itinerary: ItineraryOutput }>(res);
  },

  async saveItinerary(itinerary: ItineraryOutput): Promise<{ itinerary: ItineraryOutput }> {
    const res = await safeFetch("/api/itineraries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itinerary),
    });
    return handleResponse<{ itinerary: ItineraryOutput }>(res);
  },

  async listItineraries(): Promise<ItineraryOutput[]> {
    const res = await safeFetch("/api/itineraries", { method: "GET" });
    return handleResponse<ItineraryOutput[]>(res);
  },

  async getItinerary(id: string): Promise<{ itinerary: ItineraryOutput }> {
    const res = await safeFetch(`/api/itineraries/${encodeURIComponent(id)}`, { method: "GET" });
    return handleResponse<{ itinerary: ItineraryOutput }>(res);
  },

  async updateItinerary(id: string, itinerary: ItineraryOutput): Promise<{ itinerary: ItineraryOutput }> {
    const res = await safeFetch(`/api/itineraries/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itinerary),
    });
    return handleResponse<{ itinerary: ItineraryOutput }>(res);
  },

  async deleteItinerary(id: string): Promise<{ success: boolean }> {
    const res = await safeFetch(`/api/itineraries/${encodeURIComponent(id)}`, { method: "DELETE" });
    return handleResponse<{ success: boolean }>(res);
  },
};
