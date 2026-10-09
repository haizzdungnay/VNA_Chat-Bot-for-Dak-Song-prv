export interface AdminAIProfile {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string;
  model: string;
  reasoningEffort: "low" | "medium" | "high" | "none";
  jsonMode: boolean;
  keySuffix: string;
  isActive: boolean;
  testStatus: "untested" | "success" | "failed" | "degraded";
  testError?: string | null;
  lastTestedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAIProfileInput {
  name: string;
  providerType: string;
  baseUrl: string;
  model: string;
  apiKey?: string; // Only provided when creating or updating key
  reasoningEffort: "low" | "medium" | "high" | "none";
  jsonMode: boolean;
}

export interface VisitorConsentProfile {
  id: string;
  displayName?: string | null;
  addressAs?: string | null;
  ageGroup?: string | null;
  consentVersion: string;
  consentedAt: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  actor: string;
  detailsJson?: string | null;
  createdAt: string;
}

export interface TelemetryEventItem {
  id: string;
  eventType: string;
  statusCode: number;
  durationMs: number;
  tokensUsed?: number | null;
  errorType?: string | null;
  createdAt: string;
}

export interface SystemOverview {
  visitorConsentCount: number;
  totalChatRequests: number;
  totalChatErrors: number;
  rateLimit429Count: number;
  upstream503Count: number;
  averageLatencyMs: number;
  telemetryActive: boolean;
  accessConfigured: boolean;
  encryptionKeyConfigured: boolean;
  featureFlagActive: boolean;
  activeProfile: {
    id: string;
    name: string;
    model: string;
    baseUrl: string;
    source: "database" | "env_fallback";
  } | null;
}

export type AdminTab = "overview" | "visitors" | "profiles" | "logs" | "settings";

