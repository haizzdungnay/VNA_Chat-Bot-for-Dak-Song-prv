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
  id: string;
  role: "user" | "assistant";
  content: string;
  placeIds?: string[];
  timestamp?: string;
  isFailed?: boolean;
}

export interface ChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  articleSlug?: string;
}

export interface ChatResponse {
  answer: string;
  placeIds: string[];
}

export type AddressAs = "anh" | "chi" | "ban" | "em";
export type AgeGroup = "under18" | "18-24" | "25-34" | "35-49" | "50plus" | null;

export interface PersonalizationProfile {
  displayName?: string;
  addressAs: AddressAs;
  ageGroup: AgeGroup;
  allowAIContext: boolean;
  allowServerProfileStorage?: boolean;
  consentToken?: string;
  updatedAt: string;
}

export type ThemeMode = "light" | "dark" | "system";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  providers: string[];
  createdAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isZalo: boolean;
}

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



// Phase 8.3 Business & Booking Types
export interface TourProduct {
  id: string;
  code: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  durationDays: number;
  minTravelers: number;
  maxTravelers: number;
  basePrice: number;
  status: string;
  isDemo: boolean;
  destinations?: Place[];
  createdAt: string;
  updatedAt: string;
}

export interface TourService {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  providerName?: string | null;
  placeId?: string | null;
  isActive: boolean;
  isDemo: boolean;
  pricingRule?: {
    id: string;
    pricingMode: string;
    unitPrice: number;
    currency: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingQuote {
  id: string;
  quote_reference: string;
  user_id: string;
  tour_id?: string | null;
  itinerary_id?: string | null;
  itinerary_version?: number | null;
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

export interface BookingQuoteItem {
  id: string;
  quote_id: string;
  service_id?: string | null;
  item_name: string;
  category: string;
  pricing_mode: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface TourBooking {
  id: string;
  booking_reference: string;
  user_id: string;
  quote_id: string;
  tour_id?: string | null;
  itinerary_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  adults_count: number;
  children_count: number;
  total_amount: number;
  currency: string;
  booking_status: "pending" | "confirmed" | "cancelled" | "completed";
  payment_status: "unpaid" | "paid" | "partially_refunded" | "refunded" | "failed";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourBookingItem {
  id: string;
  booking_id: string;
  service_id?: string | null;
  item_name: string;
  category: string;
  pricing_mode: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface MockPaymentResult {
  success: boolean;
  booking: TourBooking;
  transactionReference: string;
  message: string;
}

// Phase 8.4 Quiz & Daily Challenge Types
export interface QuizCategory {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
}

export interface QuizCollection {
  id: string;
  title: string;
  description?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  difficulty?: string | null;
  question_count: number;
}

export interface QuizDailyChallenge {
  id: string;
  title: string;
  description?: string | null;
  businessDate: string;
  timeLimitSeconds: number;
  scorePerQuestion: number;
  questionCount: number;
  status: string;
  isOpen: boolean;
  hasAttempted: boolean;
  attemptStatus?: string | null;
  attemptId?: string | null;
  score?: number | null;
  maxScore?: number | null;
}

export interface QuizOptionItem {
  id: string;
  key: string;
  text: string;
}

export interface QuizAttemptQuestionItem {
  id: string;
  orderIndex: number;
  questionText: string;
  questionType: "single_choice" | "true_false";
  categoryName?: string;
  difficulty?: string;
  options: QuizOptionItem[];
  selectedOptionId?: string | null;
  correctOptionId?: string;
  isCorrect?: boolean;
  points?: number;
  explanation?: string;
  relatedPlaceId?: string | null;
  relatedPlaceName?: string | null;
  relatedArticleId?: string | null;
  relatedArticleTitle?: string | null;
}

export interface QuizAttemptDetail {
  id: string;
  attemptType: "daily_challenge" | "practice";
  challengeTitle?: string;
  collectionTitle?: string;
  status: "in_progress" | "completed" | "expired" | "abandoned";
  businessDate?: string;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  startedAt: string;
  expiresAt?: string | null;
  completedAt?: string | null;
  questions: QuizAttemptQuestionItem[];
}

export interface QuizUserStats {
  totalAttempts: number;
  completedAttempts: number;
  dailyChallengesCompleted: number;
  totalScore: number;
  totalCorrect: number;
  totalQuestionsAnswered: number;
  bestScore: number;
  lastAttemptAt?: string | null;
}
