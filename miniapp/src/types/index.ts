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
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  placeIds?: string[];
}

export interface ChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface ChatResponse {
  answer: string;
  placeIds: string[];
}
