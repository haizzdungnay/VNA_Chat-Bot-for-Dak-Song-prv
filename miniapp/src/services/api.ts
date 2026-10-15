import type { Category, Place, Article, ChatRequest, ChatResponse, AuthUser, PlannerRequest, ItineraryOutput, TourProduct, TourService, BookingQuote, BookingQuoteItem, TourBooking, TourBookingItem, MockPaymentResult,
  QuizCategory,
  QuizCollection,
  QuizDailyChallenge,
  QuizAttemptDetail,
  QuizUserStats,
  RewardCampaign,
  RewardWalletItem,
  RewardSpinEligibility,
  RewardSpinResult,
  RewardSpinSegment,
  RewardSpinWheel,
  RewardGiftClaim,
} from "../types";
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

  // Phase 8.3 Business & Booking APIs
  async getTours(): Promise<{ tours: TourProduct[] }> {
    const res = await safeFetch("/api/tours");
    return handleResponse<{ tours: TourProduct[] }>(res);
  },

  async getTourById(id: string): Promise<{ tour: TourProduct }> {
    const res = await safeFetch(`/api/tours/${encodeURIComponent(id)}`);
    return handleResponse<{ tour: TourProduct }>(res);
  },

  async getServices(category?: string): Promise<{ services: TourService[] }> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    const res = await safeFetch(`/api/services${qs}`);
    return handleResponse<{ services: TourService[] }>(res);
  },

  async requestQuote(payload: {
    tourId?: string | null;
    itineraryId?: string | null;
    selectedServiceIds?: string[];
    adultsCount: number;
    childrenCount: number;
    durationDays?: number;
  }): Promise<{ quote: BookingQuote; items: BookingQuoteItem[] }> {
    const res = await safeFetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ quote: BookingQuote; items: BookingQuoteItem[] }>(res);
  },

  async createBooking(payload: {
    quoteReference: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    notes?: string | null;
    idempotencyKey?: string | null;
  }): Promise<{ booking: TourBooking; items: TourBookingItem[] }> {
    const res = await safeFetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ booking: TourBooking; items: TourBookingItem[] }>(res);
  },

  async getMyBookings(): Promise<{ bookings: TourBooking[] }> {
    const res = await safeFetch("/api/bookings");
    return handleResponse<{ bookings: TourBooking[] }>(res);
  },

  async getMyBookingDetail(id: string): Promise<{
    booking: TourBooking;
    items: TourBookingItem[];
    paymentAttempts: any[];
    events: any[];
  }> {
    const res = await safeFetch(`/api/bookings/${encodeURIComponent(id)}`);
    return handleResponse<{
      booking: TourBooking;
      items: TourBookingItem[];
      paymentAttempts: any[];
      events: any[];
    }>(res);
  },

  async processMockPayment(payload: {
    bookingId: string;
    paymentMethod?: string;
    simulateStatus: "success" | "failed";
    idempotencyKey?: string;
  }): Promise<MockPaymentResult> {
    const res = await safeFetch(`/api/bookings/${encodeURIComponent(payload.bookingId)}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<MockPaymentResult>(res);
  },

  async cancelMyBooking(bookingId: string, reason?: string): Promise<{ booking: TourBooking }> {
    const res = await safeFetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    return handleResponse<{ booking: TourBooking }>(res);
  },


  // ==================== PHASE 8.4 TOURISM QUIZ API ====================
  async getQuizCategories(): Promise<{ categories: QuizCategory[] }> {
    const res = await safeFetch("/api/quiz/categories");
    return handleResponse<{ categories: QuizCategory[] }>(res);
  },

  async getQuizCollections(): Promise<{ collections: QuizCollection[] }> {
    const res = await safeFetch("/api/quiz/collections");
    return handleResponse<{ collections: QuizCollection[] }>(res);
  },

  async getDailyChallenge(): Promise<{ challenge: QuizDailyChallenge | null }> {
    const res = await safeFetch("/api/quiz/daily");
    return handleResponse<{ challenge: QuizDailyChallenge | null }>(res);
  },

  async startQuizAttempt(payload: {
    attemptType: "daily_challenge" | "practice";
    challengeId?: string;
    collectionId?: string;
    categoryId?: string;
    difficulty?: string;
    questionCount?: number;
  }): Promise<{ attempt: { attemptId: string; attemptType: string; totalQuestions: number; timeLimitSeconds: number; expiresAt?: string; questions: any[] } }> {
    const res = await safeFetch("/api/quiz/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ attempt: any }>(res);
  },

  async getQuizAttempt(id: string): Promise<{ attempt: QuizAttemptDetail }> {
    const res = await safeFetch("/api/quiz/attempts/" + encodeURIComponent(id));
    return handleResponse<{ attempt: QuizAttemptDetail }>(res);
  },

  async submitQuizAnswer(attemptId: string, payload: {
    attemptQuestionId: string;
    selectedOptionId: string;
  }): Promise<{ success: boolean; alreadyAnswered?: boolean; isCorrect?: boolean; answeredAt?: string }> {
    const res = await safeFetch("/api/quiz/attempts/" + encodeURIComponent(attemptId) + "/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; alreadyAnswered?: boolean; isCorrect?: boolean; answeredAt?: string }>(res);
  },

  async finishQuizAttempt(attemptId: string): Promise<{ result: QuizAttemptDetail }> {
    const res = await safeFetch("/api/quiz/attempts/" + encodeURIComponent(attemptId) + "/finish", {
      method: "POST",
    });
    return handleResponse<{ result: QuizAttemptDetail }>(res);
  },

  async getQuizHistory(page = 1, limit = 20): Promise<{ history: any[]; total: number; page: number; limit: number }> {
    const res = await safeFetch("/api/quiz/history?page=" + page + "&limit=" + limit);
    return handleResponse<{ history: any[]; total: number; page: number; limit: number }>(res);
  },

  async getQuizUserStats(): Promise<{ stats: QuizUserStats }> {
    const res = await safeFetch("/api/quiz/stats");
    return handleResponse<{ stats: QuizUserStats }>(res);
  },

  // ==================== PHASE 8.5 REWARD & LUCKY SPIN API ====================
  async getRewardCampaigns(): Promise<{ campaigns: RewardCampaign[] }> {
    const res = await safeFetch("/api/rewards/campaigns");
    return handleResponse<{ campaigns: RewardCampaign[] }>(res);
  },

  async getRewardWallet(status?: string, page = 1, limit = 20): Promise<{ items: RewardWalletItem[]; total: number; page: number; limit: number }> {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) q.set("status", status);
    const res = await safeFetch("/api/rewards/wallet?" + q.toString());
    return handleResponse<{ items: RewardWalletItem[]; total: number; page: number; limit: number }>(res);
  },

  async getRewardWalletDetail(id: string): Promise<{ item: RewardWalletItem }> {
    const res = await safeFetch("/api/rewards/wallet/" + encodeURIComponent(id));
    return handleResponse<{ item: RewardWalletItem }>(res);
  },

  async getActiveWheel(campaignId?: string): Promise<{
    wheel: RewardSpinWheel | null;
    campaign: RewardCampaign | null;
    segments: RewardSpinSegment[];
  }> {
    const q = campaignId ? "?campaignId=" + encodeURIComponent(campaignId) : "";
    const res = await safeFetch("/api/rewards/spins/active" + q);
    return handleResponse<{
      wheel: RewardSpinWheel | null;
      campaign: RewardCampaign | null;
      segments: RewardSpinSegment[];
    }>(res);
  },

  async getSpinEligibility(campaignId?: string): Promise<RewardSpinEligibility> {
    const q = campaignId ? "?campaignId=" + encodeURIComponent(campaignId) : "";
    const res = await safeFetch("/api/rewards/spins/eligibility" + q);
    return handleResponse<RewardSpinEligibility>(res);
  },

  async claimDailySpin(campaignId?: string): Promise<{ success: boolean; entitlementId: string; availableTurns: number }> {
    const res = await safeFetch("/api/rewards/spins/claim-daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    return handleResponse<{ success: boolean; entitlementId: string; availableTurns: number }>(res);
  },

  async claimQuizReward(quizAttemptId: string, campaignId?: string): Promise<{ success: boolean; entitlementId: string; message: string }> {
    const res = await safeFetch("/api/rewards/spins/claim-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizAttemptId, campaignId }),
    });
    return handleResponse<{ success: boolean; entitlementId: string; message: string }>(res);
  },

  async executeSpin(payload: {
    wheelId?: string;
    campaignId?: string;
    idempotencyKey?: string;
  }): Promise<RewardSpinResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (payload.idempotencyKey) {
      headers["Idempotency-Key"] = payload.idempotencyKey;
    }
    const res = await safeFetch("/api/rewards/spins", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<RewardSpinResult>(res);
  },

  async getSpinHistory(page = 1, limit = 20): Promise<{ history: any[]; total: number; page: number; limit: number }> {
    const res = await safeFetch("/api/rewards/spins/history?page=" + page + "&limit=" + limit);
    return handleResponse<{ history: any[]; total: number; page: number; limit: number }>(res);
  },

  async getGiftClaims(): Promise<{ claims: RewardGiftClaim[] }> {
    const res = await safeFetch("/api/rewards/gift-claims");
    return handleResponse<{ claims: RewardGiftClaim[] }>(res);
  },
};

