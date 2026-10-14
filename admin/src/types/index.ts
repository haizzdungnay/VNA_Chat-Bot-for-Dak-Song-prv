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
  display_name?: string | null;
  addressAs?: string | null;
  address_as?: string | null;
  ageGroup?: string | null;
  age_group?: string | null;
  consentVersion?: string;
  consent_version?: string;
  consentedAt?: string;
  consented_at?: string;
  updatedAt?: string;
  updated_at?: string;
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

export type AdminTab =
  | "overview"
  | "revenue"
  | "tours"
  | "services"
  | "bookings"
  | "quiz_questions"
  | "quiz_challenges"
  | "quiz_analytics"
  | "reward_campaigns"
  | "reward_spins"
  | "reward_redemptions"
  | "reward_analytics"
  | "visitors"
  | "profiles"
  | "logs"
  | "settings";



// Phase 8.3 Business & Booking Types for Admin
export type PricingMode = "fixed" | "per_person" | "per_adult" | "per_child" | "per_group" | "per_day" | "per_night";
export type TourStatus = "draft" | "published" | "archived";
export type ServiceCategory = "guide" | "transport" | "ticket" | "accommodation" | "meal" | "other";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "unpaid" | "paid" | "partially_refunded" | "refunded" | "failed";

export interface AdminTourProduct {
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
  destinations?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminTourInput {
  code: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  durationDays: number;
  minTravelers?: number;
  maxTravelers?: number;
  basePrice: number;
  status?: TourStatus;
}

export interface AdminTourService {
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

export interface AdminTourServiceInput {
  code: string;
  name: string;
  category: ServiceCategory;
  description?: string | null;
  providerName?: string | null;
  pricingMode: PricingMode;
  unitPrice: number;
}

export interface AdminBookingItem {
  id: string;
  booking_reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  adults_count: number;
  children_count: number;
  total_amount: number;
  currency: string;
  booking_status: BookingStatus;
  payment_status: PaymentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Phase 8.5 Admin Reward & Voucher Management Types
export interface AdminRewardCampaign {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  campaign_type: "standard" | "lucky_spin" | "quiz_reward" | "seasonal";
  status: "draft" | "published" | "paused" | "closed" | "archived";
  start_at: string;
  end_at?: string | null;
  total_quota: number;
  per_user_limit: number;
  eligibility_rules_json: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AdminRewardVoucherTemplate {
  id: string;
  campaign_id?: string | null;
  code_prefix: string;
  title: string;
  discount_display: string;
  discount_type: "percentage" | "fixed_amount" | "free_service" | "gift";
  discount_value: number;
  min_order_value: number;
  category: "all" | "food" | "stay" | "tour" | "gift";
  category_label: string;
  description: string;
  terms_conditions: string;
  validity_days: number;
  total_stock: number;
  issued_count: number;
  status: "draft" | "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
}

export interface AdminRewardSpinWheel {
  id: string;
  campaign_id: string;
  title: string;
  description?: string | null;
  status: "draft" | "active" | "paused" | "archived";
  cost_entitlement_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AdminRewardSpinSegment {
  id: string;
  wheel_id: string;
  order_index: number;
  label: string;
  segment_type: "voucher" | "no_win" | "gift_item";
  voucher_template_id?: string | null;
  weight: number;
  total_inventory: number;
  awarded_count: number;
  color?: string | null;
}

export interface AdminRewardWalletItem {
  id: string;
  user_id: string;
  voucher_code: string;
  title: string;
  discount_display: string;
  category: string;
  terms_conditions_snapshot: string;
  status: "issued" | "redeemed" | "expired" | "revoked";
  source_type: string;
  issued_at: string;
  expires_at: string;
  redeemed_at?: string | null;
  revoked_at?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  campaign_title?: string | null;
}

export interface AdminRewardAnalytics {
  campaigns: {
    total: number;
    published: number;
  };
  vouchers: {
    totalIssued: number;
    totalRedeemed: number;
    totalRevoked: number;
    totalExpired: number;
    uniqueHolders: number;
    redemptionRate: number;
  };
  spins: {
    totalSpins: number;
    totalWins: number;
    totalNoWins: number;
    uniqueSpinners: number;
    winRate: number;
  };
}

export interface AdminBookingDetail {
  booking: AdminBookingItem;
  items: {
    id: string;
    item_name: string;
    category: string;
    pricing_mode: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
  paymentAttempts: {
    id: string;
    transaction_reference: string;
    payment_method: string;
    amount: number;
    status: string;
    refunded_amount: number;
    failure_reason?: string | null;
    created_at: string;
  }[];
  events: {
    id: string;
    event_type: string;
    from_status?: string | null;
    to_status?: string | null;
    actor: string;
    reason?: string | null;
    created_at: string;
  }[];
}

export interface RevenueAnalyticsData {
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


// Phase 8.4 Tourism Quiz & Daily Challenge Types
export type QuestionType = "single_choice" | "true_false";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuestionStatus = "draft" | "published" | "archived";
export type SourceType = "place" | "article" | "manual";
export type ChallengeStatus = "draft" | "scheduled" | "active" | "closed" | "archived";

export interface AdminQuizOption {
  id?: string;
  option_key: string;
  option_text: string;
  is_correct: number | boolean;
  order_index?: number;
}

export interface AdminQuizQuestion {
  id: string;
  code: string;
  question_type: QuestionType;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  difficulty: QuestionDifficulty;
  question_text: string;
  explanation: string;
  source_type: SourceType;
  source_reference?: string | null;
  related_place_id?: string | null;
  related_place_name?: string | null;
  related_article_id?: string | null;
  related_article_title?: string | null;
  image_url?: string | null;
  status: QuestionStatus;
  version: number;
  options: AdminQuizOption[];
  created_at: string;
  updated_at: string;
}

export interface AdminQuizCategory {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  is_active: number;
}

export interface AdminQuizCollection {
  id: string;
  title: string;
  description?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  difficulty?: string | null;
  selection_mode: "manual" | "auto";
  question_count: number;
  status: "draft" | "published" | "archived";
  questions?: AdminQuizQuestion[];
  created_at: string;
}

export interface AdminQuizChallenge {
  id: string;
  title: string;
  description?: string | null;
  business_date: string;
  collection_id: string;
  collection_title?: string;
  question_count?: number;
  opening_time: string;
  closing_time: string;
  time_limit_seconds: number;
  score_per_question: number;
  max_attempts: number;
  status: ChallengeStatus;
  created_at: string;
}

export interface AdminQuizAnalytics {
  kpis: {
    totalPublishedQuestions: number;
    draftQuestions: number;
    archivedQuestions: number;
    activeChallenges: number;
    totalAttempts: number;
    completedAttempts: number;
    uniqueParticipants: number;
    averageScore: number;
    accuracyRate: number;
    completionRate: number;
  };
  questionQuality: {
    id: string;
    code: string;
    questionText: string;
    categoryName?: string;
    difficulty: string;
    status: string;
    attemptsCount: number;
    correctCount: number;
    incorrectCount: number;
    accuracyRate: number;
  }[];
  dailyTrends: {
    date: string;
    attemptsCount: number;
    completedCount: number;
    avgScore: number;
  }[];
}
