export interface Env {
  DB: D1Database;
  AI?: any;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  CORS_ALLOW_ORIGIN?: string;
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
  shortDescription: string;
  description: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  mapUrl?: string;
  isFeatured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
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
}

export interface AIProvider {
  chat(input: ChatInput): Promise<ChatResponse>;
}
