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
  // Phase 8.1 Identity & Authentication
  ZALO_APP_ID?: string;
  ZALO_APP_SECRET?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
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

// Phase 8.1 User Identity & Authentication Types
export interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AuthIdentityRow {
  id: string;
  user_id: string;
  provider: "zalo" | "email";
  provider_user_id: string;
  provider_metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_active_at: string;
  user_agent: string | null;
  ip_address: string | null;
}

export interface AuthChallengeRow {
  id: string;
  identifier: string;
  challenge_type: string;
  code_hash: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  providers: string[];
  createdAt: string;
}

// Phase 8.2 AI Travel Planner Types
export type TravelPace = "relaxed" | "moderate" | "active";
export type TransportationType = "car" | "motorbike" | "shuttle";
export type BudgetPreference = "economy" | "moderate" | "luxury";
export type ItineraryItemType = "place" | "meal" | "rest" | "transport";

export interface PlannerRequest {
  selectedPlaceIds?: string[];
  travelersCount: number;
  childrenCount: number;
  startDate: string;
  departureTime?: string;
  durationDays: number;
  interests?: string[];
  transportation?: TransportationType;
  pace?: TravelPace;
  budgetPreference?: BudgetPreference;
}

export interface ItineraryItemOutput {
  id?: string;
  placeId?: string | null;
  itemType: ItineraryItemType;
  title: string;
  plannedTime?: string;
  durationMinutes: number;
  notes?: string;
  orderIndex: number;
  isUserSelected: boolean;
  estimatedTravelMinutes?: number | null;
  place?: Place;
}

export interface ItineraryDayOutput {
  id?: string;
  dayNumber: number;
  date?: string;
  title?: string;
  notes?: string;
  items: ItineraryItemOutput[];
}

export interface ItineraryOutput {
  id?: string;
  userId?: string;
  title: string;
  startDate: string;
  departureTime?: string;
  durationDays: number;
  travelersCount: number;
  childrenCount: number;
  pace: TravelPace;
  transportation: TransportationType;
  budgetPreference: BudgetPreference;
  interests: string[];
  summary?: string;
  status: "draft" | "saved" | "archived";
  version: number;
  days: ItineraryDayOutput[];
  warnings?: string[];
  isFallback?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

