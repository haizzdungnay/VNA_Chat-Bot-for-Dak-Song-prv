import type { Category, Place, ChatRequest, ChatResponse } from "../types";

const API_BASE_URL = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "http://localhost:8787"
).replace(/\/$/, "");

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Yêu cầu thất bại với mã lỗi ${res.status}`;
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
    const res = await fetch(`${API_BASE_URL}/api/categories`);
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
    const url = `${API_BASE_URL}/api/places${qs ? `?${qs}` : ""}`;
    const res = await fetch(url);
    return handleResponse<Place[]>(res);
  },

  async getPlaceById(id: string): Promise<Place> {
    const res = await fetch(`${API_BASE_URL}/api/places/${encodeURIComponent(id)}`);
    return handleResponse<Place>(res);
  },

  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return handleResponse<ChatResponse>(res);
  },
};
