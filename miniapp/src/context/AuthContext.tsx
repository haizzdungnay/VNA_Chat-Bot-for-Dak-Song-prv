import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { AuthUser } from "../types";
import { authService, isZaloEnvironment } from "../services/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isZalo: boolean;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;

  loginWithZalo: () => Promise<void>;
  requestEmailOtp: (email: string) => Promise<{ success: boolean; message: string; challengeId: string }>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const isZalo = isZaloEnvironment();

  useEffect(() => {
    let mounted = true;
    authService
      .getCurrentUser()
      .then((existingUser) => {
        if (mounted) {
          setUser(existingUser);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const loginWithZalo = useCallback(async () => {
    setIsLoading(true);
    try {
      const loggedUser = await authService.loginWithZalo();
      setUser(loggedUser);
      setIsAuthModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestEmailOtp = useCallback(async (email: string) => {
    return await authService.requestEmailOtp(email);
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, code: string) => {
    setIsLoading(true);
    try {
      const loggedUser = await authService.verifyEmailOtp(email, code);
      setUser(loggedUser);
      setIsAuthModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setIsAuthModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        isZalo,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        loginWithZalo,
        requestEmailOtp,
        verifyEmailOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
