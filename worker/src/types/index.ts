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
  MOCK_PAYMENT_ENABLED?: string | boolean;
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

// Phase 8.3 Business Operations & Booking Types
export type PricingMode = "fixed" | "per_person" | "per_adult" | "per_child" | "per_group" | "per_day" | "per_night";
export type TourStatus = "draft" | "published" | "archived";
export type ServiceCategory = "guide" | "transport" | "ticket" | "accommodation" | "meal" | "other";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "unpaid" | "paid" | "partially_refunded" | "refunded" | "failed";
export type PaymentMethod = "mock_bank_transfer" | "mock_qr" | "mock_zalo_pay";

export interface TourProductRow {
  id: string;
  code: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  duration_days: number;
  min_travelers: number;
  max_travelers: number;
  base_price: number;
  status: TourStatus;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface TourProductPublic {
  id: string;
  code: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  durationDays: number;
  minTravelers: number;
  maxTravelers: number;
  basePrice: number;
  status: TourStatus;
  isDemo: boolean;
  destinations?: Place[];
  createdAt: string;
  updatedAt: string;
}

export interface TourServiceRow {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory;
  description: string | null;
  provider_name: string | null;
  place_id: string | null;
  is_active: number;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface TourPriceRuleRow {
  id: string;
  service_id: string | null;
  tour_id: string | null;
  pricing_mode: PricingMode;
  unit_price: number;
  currency: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TourServicePublic {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory;
  description?: string | null;
  providerName?: string | null;
  placeId?: string | null;
  isActive: boolean;
  isDemo: boolean;
  pricingRule?: {
    id: string;
    pricingMode: PricingMode;
    unitPrice: number;
    currency: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingQuoteRow {
  id: string;
  quote_reference: string;
  user_id: string;
  tour_id: string | null;
  itinerary_id: string | null;
  itinerary_version: number | null;
  adults_count: number;
  children_count: number;
  duration_days: number;
  subtotal: number;
  total_price: number;
  currency: string;
  expires_at: string;
  status: string;
  created_at: string;
}

export interface BookingQuoteItemRow {
  id: string;
  quote_id: string;
  service_id: string | null;
  item_name: string;
  category: string;
  pricing_mode: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface TourBookingRow {
  id: string;
  booking_reference: string;
  user_id: string;
  quote_id: string;
  tour_id: string | null;
  itinerary_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  adults_count: number;
  children_count: number;
  total_amount: number;
  currency: string;
  booking_status: BookingStatus;
  payment_status: PaymentStatus;
  notes: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourBookingItemRow {
  id: string;
  booking_id: string;
  service_id: string | null;
  item_name: string;
  category: string;
  pricing_mode: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface MockPaymentAttemptRow {
  id: string;
  booking_id: string;
  transaction_reference: string;
  payment_method: PaymentMethod;
  amount: number;
  currency: string;
  status: "success" | "failed" | "refunded";
  idempotency_key: string | null;
  failure_reason: string | null;
  refunded_amount: number;
  created_at: string;
}

export interface BookingStateEventRow {
  id: string;
  booking_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor: string;
  reason: string | null;
  created_at: string;
}

export interface RevenueAnalyticsSummary {
  totalBookings: number;
  pendingBookings: number;
  successfulBookings: number;
  failedPaymentAttempts: number;
  cancelledBookings: number;
  grossSimulatedRevenue: number;
  simulatedRefundedAmount: number;
  netSimulatedRevenue: number;
  averageBookingValue: number;
  dailyTrends: { date: string; revenue: number; bookingsCount: number }[];
  categoryDistribution: { category: string; count: number; totalAmount: number }[];
  statusDistribution: { status: string; count: number }[];
  topProducts: { name: string; type: "tour" | "service"; bookedCount: number; revenue: number }[];
}


export interface MockPaymentRefundRow {
  id: string;
  payment_attempt_id: string;
  booking_id: string;
  amount: number;
  currency: string;
  reason: string | null;
  actor: string;
  idempotency_key: string | null;
  created_at: string;
}

export interface IdempotencyRecordRow {
  id: string;
  user_id: string;
  operation: string;
  idempotency_key: string;
  resource_id: string | null;
  request_hash: string;
  response_json: string | null;
  created_at: string;
}
