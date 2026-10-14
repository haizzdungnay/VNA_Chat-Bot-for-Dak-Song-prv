import type {
  AdminAIProfile,
  AdminAIProfileInput,
  VisitorConsentProfile,
  AuditLogItem,
  TelemetryEventItem,
  SystemOverview,
  AdminTourProduct,
  AdminTourInput,
  AdminTourService,
  AdminTourServiceInput,
  AdminBookingItem,
  AdminBookingDetail,
  RevenueAnalyticsData,
    PricingMode,
  AdminQuizQuestion,
  AdminQuizCategory,
  AdminQuizCollection,
  AdminQuizChallenge,
  AdminQuizAnalytics,
  AdminRewardCampaign,
  AdminRewardVoucherTemplate,
  AdminRewardSpinWheel,
  AdminRewardSpinSegment,
  AdminRewardWalletItem,
  AdminRewardAnalytics,
} from "../types";

export class AdminApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

export function getApiBaseUrl(): string {
  const envUrl =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_BACKEND_URL) ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL);
  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }
  return "http://127.0.0.1:8788";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const url = path.startsWith("http") ? path : `${getApiBaseUrl()}${path}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status} ${res.statusText}`;
    let code: string | undefined;
    try {
      const data = await res.json();
      if (data && data.error) {
        errMsg = typeof data.error === "string" ? data.error : data.error.message || errMsg;
        code = data.error.code;
      }
    } catch {
      // ignore json parse error
    }
    throw new AdminApiError(errMsg, res.status, code);
  }

  return (await res.json()) as T;
}

export const adminApi = {
  getOverview(): Promise<SystemOverview> {
    return request<SystemOverview>("/api/admin/overview");
  },

  getProfiles(): Promise<AdminAIProfile[]> {
    return request<AdminAIProfile[]>("/api/admin/ai-profiles");
  },

  createProfile(input: AdminAIProfileInput): Promise<AdminAIProfile> {
    return request<AdminAIProfile>("/api/admin/ai-profiles", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateProfile(id: string, input: Partial<AdminAIProfileInput>): Promise<AdminAIProfile> {
    return request<AdminAIProfile>(`/api/admin/ai-profiles/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteProfile(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/admin/ai-profiles/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  testProfile(id: string): Promise<{ status: "success" | "failed"; latencyMs: number; error?: string }> {
    return request<{ status: "success" | "failed"; latencyMs: number; error?: string }>(
      `/api/admin/ai-profiles/${encodeURIComponent(id)}/test`,
      { method: "POST" }
    );
  },

  activateProfile(id: string): Promise<{ success: boolean; activeProfileId: string }> {
    return request<{ success: boolean; activeProfileId: string }>(
      `/api/admin/ai-profiles/${encodeURIComponent(id)}/activate`,
      { method: "POST" }
    );
  },

  rollbackToEnv(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>("/api/admin/ai-profiles/rollback", {
      method: "POST",
    });
  },

  getVisitors(): Promise<VisitorConsentProfile[]> {
    return request<VisitorConsentProfile[]>("/api/admin/visitors");
  },

  getLogs(): Promise<{ auditLogs: AuditLogItem[]; telemetryEvents: TelemetryEventItem[] }> {
    return request<{ auditLogs: AuditLogItem[]; telemetryEvents: TelemetryEventItem[] }>("/api/admin/logs");
  },

  getSystemStatus(): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>("/api/admin/system");
  },

  // Phase 8.3 Business Operations
  getTours(status?: string, search?: string): Promise<{ tours: AdminTourProduct[] }> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    return request<{ tours: AdminTourProduct[] }>(
      `/api/admin/tours${params.toString() ? "?" + params.toString() : ""}`
    );
  },

  createTour(input: AdminTourInput): Promise<{ tour: AdminTourProduct }> {
    return request<{ tour: AdminTourProduct }>("/api/admin/tours", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateTour(id: string, input: Partial<AdminTourInput>): Promise<{ tour: AdminTourProduct }> {
    return request<{ tour: AdminTourProduct }>(`/api/admin/tours/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteTour(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/admin/tours/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  getServices(category?: string): Promise<{ services: AdminTourService[] }> {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    return request<{ services: AdminTourService[] }>(
      `/api/admin/services${params.toString() ? "?" + params.toString() : ""}`
    );
  },

  createService(input: AdminTourServiceInput): Promise<{ service: AdminTourService }> {
    return request<{ service: AdminTourService }>("/api/admin/services", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateService(id: string, input: Partial<AdminTourServiceInput>): Promise<{ service: AdminTourService }> {
    return request<{ service: AdminTourService }>(`/api/admin/services/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  updateServicePrice(id: string, pricingMode: PricingMode, unitPrice: number): Promise<{ service: AdminTourService }> {
    return request<{ service: AdminTourService }>(`/api/admin/services/${encodeURIComponent(id)}/price`, {
      method: "PUT",
      body: JSON.stringify({ pricingMode, unitPrice }),
    });
  },

  toggleService(id: string, isActive: boolean): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/admin/services/${encodeURIComponent(id)}/toggle`, {
      method: "PUT",
      body: JSON.stringify({ isActive }),
    });
  },

  getBookings(filter: {
    bookingStatus?: string;
    paymentStatus?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{ items: AdminBookingItem[]; total: number }> {
    const params = new URLSearchParams();
    if (filter.bookingStatus) params.set("bookingStatus", filter.bookingStatus);
    if (filter.paymentStatus) params.set("paymentStatus", filter.paymentStatus);
    if (filter.search) params.set("search", filter.search);
    if (filter.dateFrom) params.set("dateFrom", filter.dateFrom);
    if (filter.dateTo) params.set("dateTo", filter.dateTo);
    return request<{ items: AdminBookingItem[]; total: number }>(
      `/api/admin/bookings${params.toString() ? "?" + params.toString() : ""}`
    );
  },

  getBookingDetail(id: string): Promise<AdminBookingDetail> {
    return request<AdminBookingDetail>(`/api/admin/bookings/${encodeURIComponent(id)}`);
  },

  cancelBooking(id: string, reason?: string): Promise<{ booking: AdminBookingItem }> {
    return request<{ booking: AdminBookingItem }>(`/api/admin/bookings/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  mockRefundBooking(id: string, reason?: string): Promise<{ booking: AdminBookingItem; message: string }> {
    return request<{ booking: AdminBookingItem; message: string }>(`/api/admin/bookings/${encodeURIComponent(id)}/mock-refund`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  getRevenueAnalytics(range: string = "7d", startDate?: string, endDate?: string): Promise<RevenueAnalyticsData> {
    const params = new URLSearchParams({ range });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return request<RevenueAnalyticsData>(`/api/admin/revenue/analytics?${params.toString()}`);
  },

  getRevenueExportUrl(range: string = "all", startDate?: string, endDate?: string): string {
    const params = new URLSearchParams({ range });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return `${getApiBaseUrl()}/api/admin/revenue/export?${params.toString()}`;
  },

  // ==================== PHASE 8.4 QUIZ API ====================
  getQuizCategories(): Promise<{ categories: AdminQuizCategory[] }> {
    return request<{ categories: AdminQuizCategory[] }>("/api/admin/quiz/categories");
  },

  getQuizQuestions(filters?: {
    keyword?: string;
    categoryId?: string;
    difficulty?: string;
    questionType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ questions: AdminQuizQuestion[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (filters?.keyword) params.set("keyword", filters.keyword);
    if (filters?.categoryId) params.set("categoryId", filters.categoryId);
    if (filters?.difficulty) params.set("difficulty", filters.difficulty);
    if (filters?.questionType) params.set("questionType", filters.questionType);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    return request<{ questions: AdminQuizQuestion[]; total: number; page: number; limit: number }>(
      "/api/admin/quiz/questions?" + params.toString()
    );
  },

  getQuizQuestion(id: string): Promise<{ question: AdminQuizQuestion }> {
    return request<{ question: AdminQuizQuestion }>("/api/admin/quiz/questions/" + encodeURIComponent(id));
  },

  createQuizQuestion(input: any): Promise<{ question: AdminQuizQuestion }> {
    return request<{ question: AdminQuizQuestion }>("/api/admin/quiz/questions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateQuizQuestion(id: string, input: any): Promise<{ question: AdminQuizQuestion }> {
    return request<{ question: AdminQuizQuestion }>("/api/admin/quiz/questions/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  publishQuizQuestion(id: string): Promise<{ question: AdminQuizQuestion }> {
    return request<{ question: AdminQuizQuestion }>("/api/admin/quiz/questions/" + encodeURIComponent(id) + "/publish", {
      method: "POST",
    });
  },

  archiveQuizQuestion(id: string): Promise<{ question: AdminQuizQuestion }> {
    return request<{ question: AdminQuizQuestion }>("/api/admin/quiz/questions/" + encodeURIComponent(id) + "/archive", {
      method: "POST",
    });
  },

  restoreQuizQuestion(id: string): Promise<{ question: AdminQuizQuestion }> {
    return request<{ question: AdminQuizQuestion }>("/api/admin/quiz/questions/" + encodeURIComponent(id) + "/restore", {
      method: "POST",
    });
  },

  duplicateQuizQuestion(id: string): Promise<{ question: AdminQuizQuestion }> {
    return request<{ question: AdminQuizQuestion }>("/api/admin/quiz/questions/" + encodeURIComponent(id) + "/duplicate", {
      method: "POST",
    });
  },

  getQuizCollections(): Promise<{ collections: AdminQuizCollection[] }> {
    return request<{ collections: AdminQuizCollection[] }>("/api/admin/quiz/collections");
  },

  getQuizCollection(id: string): Promise<{ collection: AdminQuizCollection }> {
    return request<{ collection: AdminQuizCollection }>("/api/admin/quiz/collections/" + encodeURIComponent(id));
  },

  createQuizCollection(input: any): Promise<{ collection: AdminQuizCollection }> {
    return request<{ collection: AdminQuizCollection }>("/api/admin/quiz/collections", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getQuizChallenges(): Promise<{ challenges: AdminQuizChallenge[] }> {
    return request<{ challenges: AdminQuizChallenge[] }>("/api/admin/quiz/challenges");
  },

  getQuizChallenge(id: string): Promise<{ challenge: AdminQuizChallenge }> {
    return request<{ challenge: AdminQuizChallenge }>("/api/admin/quiz/challenges/" + encodeURIComponent(id));
  },

  createQuizChallenge(input: any): Promise<{ challenge: AdminQuizChallenge }> {
    return request<{ challenge: AdminQuizChallenge }>("/api/admin/quiz/challenges", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  publishQuizChallenge(id: string): Promise<{ challenge: AdminQuizChallenge }> {
    return request<{ challenge: AdminQuizChallenge }>("/api/admin/quiz/challenges/" + encodeURIComponent(id) + "/publish", {
      method: "POST",
    });
  },

  closeQuizChallenge(id: string): Promise<{ challenge: AdminQuizChallenge }> {
    return request<{ challenge: AdminQuizChallenge }>("/api/admin/quiz/challenges/" + encodeURIComponent(id) + "/close", {
      method: "POST",
    });
  },

  getQuizAnalytics(startDate?: string, endDate?: string): Promise<AdminQuizAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return request<AdminQuizAnalytics>("/api/admin/quiz/analytics?" + params.toString());
  },

  getQuizAttempts(filters?: { challengeId?: string; status?: string; page?: number; limit?: number }): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.challengeId) params.set("challengeId", filters.challengeId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    return request<any>("/api/admin/quiz/attempts?" + params.toString());
  },

  getQuizExportUrl(startDate?: string, endDate?: string): string {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return getApiBaseUrl() + "/api/admin/quiz/export?" + params.toString();
  },

  // ==================== PHASE 8.5 REWARD & LUCKY SPIN ====================
  getRewardCampaigns(page = 1, limit = 20, status?: string): Promise<{ campaigns: AdminRewardCampaign[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set("status", status);
    return request("/api/admin/rewards/campaigns?" + params.toString());
  },

  getRewardCampaignDetail(id: string): Promise<{ campaign: AdminRewardCampaign }> {
    return request("/api/admin/rewards/campaigns/" + encodeURIComponent(id));
  },

  createRewardCampaign(payload: any): Promise<{ campaign: AdminRewardCampaign }> {
    return request("/api/admin/rewards/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateRewardCampaign(id: string, payload: any): Promise<{ campaign: AdminRewardCampaign }> {
    return request("/api/admin/rewards/campaigns/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  setRewardCampaignStatus(id: string, status: string): Promise<{ campaign: AdminRewardCampaign }> {
    return request("/api/admin/rewards/campaigns/" + encodeURIComponent(id) + "/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  },

  getRewardTemplates(campaignId?: string): Promise<{ templates: AdminRewardVoucherTemplate[] }> {
    const q = campaignId ? "?campaignId=" + encodeURIComponent(campaignId) : "";
    return request("/api/admin/rewards/templates" + q);
  },

  createRewardTemplate(payload: any): Promise<{ template: AdminRewardVoucherTemplate }> {
    return request("/api/admin/rewards/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  toggleRewardTemplate(id: string, status: string): Promise<{ template: AdminRewardVoucherTemplate }> {
    return request("/api/admin/rewards/templates/" + encodeURIComponent(id) + "/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  },

  getRewardWheels(campaignId?: string): Promise<{ wheels: AdminRewardSpinWheel[] }> {
    const q = campaignId ? "?campaignId=" + encodeURIComponent(campaignId) : "";
    return request("/api/admin/rewards/wheels" + q);
  },

  getRewardWheelDetail(id: string): Promise<{ wheel: AdminRewardSpinWheel; segments: AdminRewardSpinSegment[] }> {
    return request("/api/admin/rewards/wheels/" + encodeURIComponent(id));
  },

  createRewardWheel(payload: any): Promise<{ wheel: AdminRewardSpinWheel }> {
    return request("/api/admin/rewards/wheels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  setRewardWheelSegments(wheelId: string, segments: any[]): Promise<{ wheel: AdminRewardSpinWheel; segments: AdminRewardSpinSegment[] }> {
    return request("/api/admin/rewards/wheels/" + encodeURIComponent(wheelId) + "/segments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments }),
    });
  },

  toggleRewardWheelStatus(wheelId: string, status: string): Promise<{ wheel: AdminRewardSpinWheel }> {
    return request("/api/admin/rewards/wheels/" + encodeURIComponent(wheelId) + "/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  },

  getRewardWalletItems(filters?: { page?: number; limit?: number; status?: string; search?: string; campaignId?: string }): Promise<{ items: AdminRewardWalletItem[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.status) params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.campaignId) params.set("campaignId", filters.campaignId);
    return request("/api/admin/rewards/wallet?" + params.toString());
  },

  redeemRewardVoucher(voucherId: string, payload?: { reason?: string; notes?: string; idempotencyKey?: string }): Promise<{ success: boolean; voucher: AdminRewardWalletItem }> {
    return request("/api/admin/rewards/wallet/" + encodeURIComponent(voucherId) + "/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
  },

  revokeRewardVoucher(voucherId: string, reason: string): Promise<{ success: boolean; voucher: AdminRewardWalletItem }> {
    return request("/api/admin/rewards/wallet/" + encodeURIComponent(voucherId) + "/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  },

  getRewardAnalytics(): Promise<{ analytics: AdminRewardAnalytics }> {
    return request("/api/admin/rewards/analytics");
  },

  getRewardExportUrl(): string {
    return getApiBaseUrl() + "/api/admin/rewards/export";
  },
};
