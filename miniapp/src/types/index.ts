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

