import type {
  AdminAIProfile,
  AdminAIProfileInput,
  VisitorConsentProfile,
  AuditLogItem,
  TelemetryEventItem,
  SystemOverview,
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
  return "https://vna-dak-song-demo.vna-daksong-tuanduong26.workers.dev";
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
};


