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
  GMAIL_WEBHOOK_URL?: string;
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

export interface RewardUserCampaignSpinsRow {
  campaign_id: string;
  user_id: string;
  completed_spins: number;
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
  timestamp_provenance?: string;
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

// Phase 8.4 Tourism Quiz & Daily Challenge Types
export type QuestionType = "single_choice" | "true_false";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuestionStatus = "draft" | "published" | "archived";
export type SourceType = "place" | "article" | "manual";
export type ChallengeStatus = "draft" | "scheduled" | "active" | "closed" | "archived";
export type AttemptType = "daily_challenge" | "practice";
export type AttemptStatus = "in_progress" | "completed" | "expired" | "abandoned";

export interface QuizCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestionRow {
  id: string;
  code: string;
  question_type: QuestionType;
  category_id: string;
  difficulty: QuestionDifficulty;
  question_text: string;
  explanation: string;
  source_type: SourceType;
  source_reference: string | null;
  related_place_id: string | null;
  related_article_id: string | null;
  image_url: string | null;
  status: QuestionStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestionOptionRow {
  id: string;
  question_id: string;
  option_key: string;
  option_text: string;
  is_correct: number;
  order_index: number;
  created_at: string;
}

export interface QuizCollectionRow {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  difficulty: "easy" | "medium" | "hard" | "mixed" | null;
  selection_mode: "manual" | "auto";
  question_count: number;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
}

export interface QuizChallengeRow {
  id: string;
  title: string;
  description: string | null;
  business_date: string;
  collection_id: string;
  opening_time: string;
  closing_time: string;
  time_limit_seconds: number;
  score_per_question: number;
  max_attempts: number;
  status: ChallengeStatus;
  created_at: string;
  updated_at: string;
}

export interface QuizAttemptRow {
  id: string;
  user_id: string;
  challenge_id: string | null;
  collection_id: string | null;
  attempt_type: AttemptType;
  business_date: string | null;
  total_questions: number;
  score_per_question?: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  score: number;
  max_score: number;
  status: AttemptStatus;
  started_at: string;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizAttemptQuestionRow {
  id: string;
  attempt_id: string;
  question_id: string;
  order_index: number;
  question_text: string;
  question_type: QuestionType;
  category_name: string | null;
  difficulty: string | null;
  explanation: string;
  options_json: string;
  correct_option_id: string;
  created_at: string;
}

export interface QuizAttemptAnswerRow {
  id: string;
  attempt_id: string;
  attempt_question_id: string;
  question_id: string;
  selected_option_id: string;
  is_correct: number;
  points: number;
  answered_at: string;
}

export interface QuizUserStatsRow {
  user_id: string;
  total_attempts: number;
  completed_attempts: number;
  daily_challenges_completed: number;
  total_score: number;
  total_correct: number;
  total_questions_answered: number;
  best_score: number;
  last_attempt_at: string | null;
  updated_at: string;
}

// Phase 8.5 Reward Management, Voucher Wallet & Lucky Spin Types
export type RewardCampaignType = "standard" | "lucky_spin" | "quiz_reward" | "seasonal";
export type RewardCampaignStatus = "draft" | "published" | "paused" | "closed" | "archived";
export type RewardDiscountType = "percentage" | "fixed_amount" | "free_service" | "gift";
export type RewardVoucherCategory = "all" | "food" | "stay" | "tour" | "gift";
export type RewardTemplateStatus = "draft" | "active" | "paused" | "archived";
export type RewardWalletItemStatus = "issued" | "redeemed" | "expired" | "revoked";
export type RewardWalletSourceType = "lucky_spin" | "quiz_completed" | "admin_grant" | "campaign_claim";
export type RewardWheelStatus = "draft" | "active" | "paused" | "archived";
export type RewardSegmentType = "voucher" | "no_win" | "gift_item";
export type RewardEntitlementGrantType = "free_daily" | "quiz_completed" | "admin_grant" | "campaign_claim";

export interface RewardCampaignRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  campaign_type: RewardCampaignType;
  status: RewardCampaignStatus;
  start_at: string;
  end_at: string | null;
  total_quota: number;
  per_user_limit: number;
  total_spins_count: number;
  eligibility_rules_json: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RewardVoucherTemplateRow {
  id: string;
  campaign_id: string | null;
  code_prefix: string;
  title: string;
  discount_display: string;
  discount_type: RewardDiscountType;
  discount_value: number;
  min_order_value: number;
  category: RewardVoucherCategory;
  category_label: string;
  description: string;
  terms_conditions: string;
  validity_days: number;
  total_stock: number;
  issued_count: number;
  status: RewardTemplateStatus;
  created_at: string;
  updated_at: string;
}

export interface RewardWalletItemRow {
  id: string;
  user_id: string;
  template_id: string | null;
  campaign_id: string | null;
  voucher_code: string;
  title: string;
  discount_display: string;
  category: string;
  terms_conditions_snapshot: string;
  status: RewardWalletItemStatus;
  source_type: RewardWalletSourceType;
  source_reference_id: string | null;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RewardSpinWheelRow {
  id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  status: RewardWheelStatus;
  cost_entitlement_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RewardSpinSegmentRow {
  id: string;
  wheel_id: string;
  order_index: number;
  label: string;
  segment_type: RewardSegmentType;
  voucher_template_id: string | null;
  weight: number;
  total_inventory: number;
  awarded_count: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface RewardEntitlementRow {
  id: string;
  user_id: string;
  campaign_id: string;
  wheel_id: string | null;
  grant_type: RewardEntitlementGrantType;
  source_event_key: string | null;
  total_granted: number;
  consumed_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RewardSpinAttemptRow {
  id: string;
  user_id: string;
  wheel_id: string;
  entitlement_id: string | null;
  segment_id: string;
  result_type: RewardSegmentType;
  voucher_id: string | null;
  result_snapshot_json: string;
  idempotency_key: string | null;
  status: "completed" | "failed";
  created_at: string;
}

export interface RewardRedemptionRow {
  id: string;
  voucher_id: string;
  actor: string;
  actor_role: string;
  status: "success" | "failed";
  reason: string | null;
  notes: string | null;
  idempotency_key: string | null;
  created_at: string;
}

export interface RewardAuditEventRow {
  id: string;
  actor: string;
  actor_type: "admin" | "tourist" | "system";
  action: string;
  resource_type: string;
  resource_id: string;
  payload_json: string | null;
  created_at: string;
}

export type RewardGiftClaimStatus = "pending" | "fulfilled" | "revoked";

export interface RewardGiftClaimRow {
  id: string;
  user_id: string;
  campaign_id: string;
  wheel_id: string;
  segment_id: string;
  spin_attempt_id: string;
  claim_code: string;
  title: string;
  description: string | null;
  status: RewardGiftClaimStatus;
  awarded_at: string;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
