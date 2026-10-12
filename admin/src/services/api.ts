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
};
