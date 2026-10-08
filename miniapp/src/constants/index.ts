import type { AddressAs, AgeGroup } from "../types";

export const STORAGE_KEY_PROFILE = "vna.daksong.personalization.v1";
export const STORAGE_KEY_ONBOARDING_SEEN = "vna.daksong.onboardingSeen.v1";
export const STORAGE_KEY_THEME = "vna.daksong.theme.v1";

export const CHAT_SUGGESTION_CHIPS = [
  {
    emoji: "🌿",
    label: "Đi thiên nhiên",
    prompt: "Gợi ý cho mình 1 điểm tham quan thiên nhiên đẹp và yên tĩnh ở Đắk Song với!",
  },
  {
    emoji: "📸",
    label: "Chỗ chụp ảnh đẹp",
    prompt: "Gợi ý những địa điểm chụp ảnh check-in tuyệt đẹp ở Đắk Song!",
  },
  {
    emoji: "🍜",
    label: "Ăn gì?",
    prompt: "Đắk Song có đặc sản hoặc món ngon ẩm thực gì độc đáo nên thử?",
  },
  {
    emoji: "🗓",
    label: "Lịch trình 1 ngày",
    prompt: "Lập giúp mình lịch trình khám phá Đắk Song trọn vẹn trong 1 ngày",
  },
];

export const ADDRESS_OPTIONS: { value: AddressAs; label: string }[] = [
  { value: "anh", label: "Anh" },
  { value: "chi", label: "Chị" },
  { value: "ban", label: "Bạn" },
  { value: "em", label: "Em" },
];

export const AGE_GROUP_OPTIONS: { value: AgeGroup; label: string }[] = [
  { value: null, label: "Không chia sẻ" },
  { value: "under18", label: "Dưới 18 tuổi" },
  { value: "18-24", label: "18 – 24 tuổi" },
  { value: "25-34", label: "25 – 34 tuổi" },
  { value: "35-49", label: "35 – 49 tuổi" },
  { value: "50plus", label: "Trên 50 tuổi" },
];

export const NAV_ITEMS = [
  { key: "/", label: "Trang chủ", icon: "home", linkTo: "/" },
  { key: "/explore", label: "Khám phá", icon: "explore", linkTo: "/explore" },
  { key: "/chat", label: "Trợ lý AI", icon: "auto_awesome", linkTo: "/chat" },
];

export const CATEGORY_SHORTCUTS = [
  {
    id: "cat-nature",
    name: "Thiên nhiên",
    subtitle: "Rừng & Thác",
    icon: "park",
    bgClass: "cat-nature",
  },
  {
    id: "cat-history",
    name: "Văn hóa",
    subtitle: "Bản sắc địa phương",
    icon: "festival",
    bgClass: "cat-culture",
  },
  {
    id: "cat-food",
    name: "Ẩm thực",
    subtitle: "Đặc sản Tây Nguyên",
    icon: "coffee",
    bgClass: "cat-food",
  },
  {
    id: "cat-checkin",
    name: "Check-in",
    subtitle: "Điểm chụp ảnh đẹp",
    icon: "photo_camera",
    bgClass: "cat-checkin",
  },
];

export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=800&q=80";

