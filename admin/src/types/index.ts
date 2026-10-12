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

export type AdminTab = "overview" | "revenue" | "tours" | "services" | "bookings" | "visitors" | "profiles" | "logs" | "settings";



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
