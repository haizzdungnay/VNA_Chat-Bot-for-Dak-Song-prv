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

