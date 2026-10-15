import type { AuthUser } from "../types";
import { STORAGE_KEY_AUTH_TOKEN } from "../constants";
import { safeStorage } from "./storage";
import { api } from "./api";

export function isZaloEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator?.userAgent || "";
  return Boolean(
    (window as any).ZMP ||
    ua.includes("Zalo") ||
    ua.includes("ZaloTheme") ||
    ua.includes("ZaloMiniApp")
  );
}

export async function fetchZaloAccessToken(): Promise<string> {
  if (!isZaloEnvironment()) {
    throw new Error("Tính năng đăng nhập Zalo chỉ hoạt động trên ứng dụng Zalo.");
  }

  try {
    // Dynamic import to avoid Node.js test environment crashing on top-level window access in zmp-sdk
    const zmpSdk = await import("zmp-sdk");
    const token = await zmpSdk.getAccessToken();
    if (!token || typeof token !== "string") {
      throw new Error("Không nhận được access token từ Zalo SDK.");
    }
    return token;
  } catch (err: any) {
    throw new Error(err?.message || "Không thể lấy thông tin đăng nhập Zalo.");
  }
}

export const authService = {
  isZalo: isZaloEnvironment,

  getToken(): string | null {
    return safeStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
  },

  setToken(token: string): void {
    safeStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
  },

  clearToken(): void {
    safeStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
  },

  async loginWithZalo(): Promise<AuthUser> {
    const accessToken = await fetchZaloAccessToken();
    const { sessionToken, user } = await api.authZalo(accessToken);
    this.setToken(sessionToken);
    return user;
  },

  async requestEmailOtp(email: string): Promise<{ success: boolean; message: string; challengeId: string }> {
    return await api.authEmailRequest(email);
  },

  async verifyEmailOtp(email: string, code: string): Promise<AuthUser> {
    const { sessionToken, user } = await api.authEmailVerify(email, code);
    this.setToken(sessionToken);
    return user;
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const { user } = await api.getMe();
      return user;
    } catch {
      // Session expired or invalid
      this.clearToken();
      return null;
    }
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    if (token) {
      try {
        await api.logout();
      } catch {
        // Ignore network errors on logout
      }
    }
    this.clearToken();
  },
};
