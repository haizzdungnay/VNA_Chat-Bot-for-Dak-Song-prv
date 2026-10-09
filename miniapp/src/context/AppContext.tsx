import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { PersonalizationProfile, ThemeMode, ChatMessage } from "../types";
import {
  STORAGE_KEY_PROFILE,
  STORAGE_KEY_ONBOARDING_SEEN,
  STORAGE_KEY_THEME,
  STORAGE_KEY_CONSENT_TOKEN,
} from "../constants";
import { safeStorage } from "../services/storage";
import { api } from "../services/api";

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Xin chào 👋\nTôi là trợ lý du lịch Đắk Song.\nBạn muốn tìm địa điểm tham quan, ẩm thực hay gợi ý lịch trình mẫu hôm nay?",
  placeIds: [],
  timestamp: "Vừa xong",
};

interface AppContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (t: ThemeMode) => void;

  profile: PersonalizationProfile | null;
  onboardingSeen: boolean;
  saveProfile: (data: {
    displayName?: string;
    addressAs: PersonalizationProfile["addressAs"];
    ageGroup: PersonalizationProfile["ageGroup"];
    allowAIContext: boolean;
    allowServerProfileStorage?: boolean;
  }) => void;
  deleteProfile: () => void;
  dismissOnboarding: () => void;

  isWelcomeSheetOpen: boolean;
  openWelcomeSheet: () => void;
  closeWelcomeSheet: () => void;

  toastMessage: string | null;
  showToast: (msg: string) => void;
  isStoragePersistent: boolean;

  // In-app temporary session memory for AI Chat
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  clearChatMessages: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function getInitialTheme(): ThemeMode {
  const saved = safeStorage.getItem(STORAGE_KEY_THEME);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "system";
}

function resolveSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function getOrCreateConsentToken(): string {
  let token = safeStorage.getItem(STORAGE_KEY_CONSENT_TOKEN);
  if (!token || token.length < 8) {
    token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    safeStorage.setItem(STORAGE_KEY_CONSENT_TOKEN, token);
  }
  return token;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => resolveSystemTheme() === "dark");

  const [profile, setProfile] = useState<PersonalizationProfile | null>(() => {
    const raw = safeStorage.getItem(STORAGE_KEY_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PersonalizationProfile;
    } catch {
      return null;
    }
  });

  const [onboardingSeen, setOnboardingSeen] = useState<boolean>(() => {
    return safeStorage.getItem(STORAGE_KEY_ONBOARDING_SEEN) === "true";
  });

  const [isWelcomeSheetOpen, setIsWelcomeSheetOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // In-app temporary session memory (resets only when app reloads / terminates)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MESSAGE]);

  const clearChatMessages = useCallback(() => {
    setChatMessages([DEFAULT_WELCOME_MESSAGE]);
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemIsDark ? "dark" : "light") : theme;

  // Apply data-theme to documentElement
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolvedTheme);
      if (resolvedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [resolvedTheme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    safeStorage.setItem(STORAGE_KEY_THEME, newTheme);
  }, []);

  const dismissOnboarding = useCallback(() => {
    setOnboardingSeen(true);
    safeStorage.setItem(STORAGE_KEY_ONBOARDING_SEEN, "true");
    setIsWelcomeSheetOpen(false);
  }, []);

  const saveProfile = useCallback(
    (data: {
      displayName?: string;
      addressAs: PersonalizationProfile["addressAs"];
      ageGroup: PersonalizationProfile["ageGroup"];
      allowAIContext: boolean;
      allowServerProfileStorage?: boolean;
    }) => {
      const sanitizedName = data.displayName?.trim().slice(0, 32);
      const consentToken = getOrCreateConsentToken();
      const allowServer = Boolean(data.allowServerProfileStorage);

      const newProfile: PersonalizationProfile = {
        displayName: sanitizedName || undefined,
        addressAs: data.addressAs,
        ageGroup: data.ageGroup,
        allowAIContext: Boolean(data.allowAIContext),
        allowServerProfileStorage: allowServer,
        consentToken,
        updatedAt: new Date().toISOString(),
      };

      setProfile(newProfile);
      safeStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(newProfile));
      setOnboardingSeen(true);
      safeStorage.setItem(STORAGE_KEY_ONBOARDING_SEEN, "true");
      setIsWelcomeSheetOpen(false);

      // Đồng bộ đồng thuận lên máy chủ khi người dùng opt-in riêng
      if (allowServer) {
        api
          .syncVisitorConsent({
            consentToken,
            displayName: sanitizedName || undefined,
            addressAs: data.addressAs,
            ageGroup: data.ageGroup ?? undefined,
            consentVersion: "1.0",
            optIn: true,
          })
          .catch(() => {
            // Không làm gián đoạn trải nghiệm người dùng nếu mạng yếu
          });
      } else {
        // Nếu người dùng không chọn lưu server, rút lại nếu đã từng lưu
        api
          .syncVisitorConsent({
            consentToken,
            consentVersion: "1.0",
            optIn: false,
          })
          .catch(() => {});
      }
    },
    []
  );

  const deleteProfile = useCallback(() => {
    const token = safeStorage.getItem(STORAGE_KEY_CONSENT_TOKEN);
    if (token) {
      api
        .syncVisitorConsent({
          consentToken: token,
          consentVersion: "1.0",
          optIn: false,
        })
        .catch(() => {});
    }
    setProfile(null);
    safeStorage.removeItem(STORAGE_KEY_PROFILE);
    setIsWelcomeSheetOpen(false);
  }, []);

  const openWelcomeSheet = useCallback(() => {
    setIsWelcomeSheetOpen(true);
  }, []);

  const closeWelcomeSheet = useCallback(() => {
    setIsWelcomeSheetOpen(false);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  return (
    <AppContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        profile,
        onboardingSeen,
        saveProfile,
        deleteProfile,
        dismissOnboarding,
        isWelcomeSheetOpen,
        openWelcomeSheet,
        closeWelcomeSheet,
        toastMessage,
        showToast,
        isStoragePersistent: safeStorage.isPersistent(),
        chatMessages,
        setChatMessages,
        clearChatMessages,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return ctx;
};

