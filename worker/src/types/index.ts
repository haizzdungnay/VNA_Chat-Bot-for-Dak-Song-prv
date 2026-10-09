export interface Env {
  DB: D1Database;
  AI?: any;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_JSON_MODE?: string;
  AI_REASONING_EFFORT?: string;
  CORS_ALLOW_ORIGIN?: string;
  AI_RETRY_DELAY_MS?: string | number;

  // Phase 5A Admin Dashboard & Dynamic AI Config
  ADMIN_ENCRYPTION_KEY?: string;
  ADMIN_AI_CONFIG_ENABLED?: string | boolean;
  CF_ACCESS_TEAM_NAME?: string;
  CF_ACCESS_AUD?: string;
  ADMIN_EMAIL_ALLOWLIST?: string;
  ADMIN_DEV_MOCK_AUTH?: string | boolean;
  ENVIRONMENT?: string;
  ALLOWED_AI_HOSTS?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon?: string;
}

export interface Place {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  category?: Category;
  sourceType?: "verified" | "vr360";
  shortDescription: string;
  description: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  images?: string[];
  mapUrl?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  isFeatured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  categoryName: string;
  quote?: string;
  content?: string;
  imageUrl?: string;
  publishDate?: string;
  viewCount?: number;
  createdAt?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  articleSlug?: string;
}

export interface ChatResponse {
  answer: string;
  placeIds: string[];
}

export interface ChatInput {
  systemPrompt: string;
  message: string;
  history: ChatMessage[];
  contextPlaces: Place[];
  contextArticles?: Article[];
}

export interface AIProvider {
  chat(input: ChatInput): Promise<ChatResponse>;
}

// Admin Dashboard Types
export interface AdminAIProfileRow {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  model: string;
  reasoning_effort: string | null;
  json_mode: number;
  encrypted_api_key: string;
  key_suffix: string;
  is_active: number;
  test_status: string;
  test_error: string | null;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAIProfilePublic {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string;
  model: string;
  reasoningEffort: string;
  jsonMode: boolean;
  keySuffix: string;
  isActive: boolean;
  testStatus: string;
  testError?: string | null;
  lastTestedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLogRow {
  id: string;
  action: string;
  actor: string;
  details_json: string | null;
  created_at: string;
}

export interface VisitorProfileRow {
  id: string;
  display_name: string | null;
  address_as: string | null;
  age_group: string | null;
  consent_version: string;
  consented_at: string;
  updated_at: string;
  deleted_at: string | null;
  displayName?: string | null;
  addressAs?: string | null;
  ageGroup?: string | null;
  consentVersion?: string;
  consentedAt?: string;
}

export interface AdminTelemetryEventRow {
  id: string;
  event_type: string;
  status_code: number;
  duration_ms: number;
  tokens_used: number | null;
  error_type: string | null;
  created_at: string;
}



