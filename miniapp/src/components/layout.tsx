import React from "react";
import { useLocation, useNavigate } from "zmp-ui";
import { NAV_ITEMS } from "../constants";
import { useApp } from "../context/AppContext";
import { WelcomePersonalizationSheet } from "./welcome-sheet";
import { AuthModal } from "./auth-modal";
import { useAuth } from "../context/AuthContext";

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme, openWelcomeSheet, toastMessage } = useApp();
  const { isAuthenticated, user, openAuthModal } = useAuth();

  const currentPath = location.pathname;
  // Place detail is immersive, no bottom nav
  const isPlaceDetail = currentPath.startsWith("/place/") || currentPath.startsWith("/quiz/play");
  const showBottomNav = !isPlaceDetail;

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="page-wrapper">
      {/* Top Eco Header */}
      {!isPlaceDetail && (
        <header className="eco-header pt-safe">
          <div className="eco-header-content">
            <div className="eco-header-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              <div className="eco-logo-badge">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  forest
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span className="eco-header-title">Du lịch Đắk Song</span>
                <span className="eco-header-subtitle">Cổng thông tin du lịch</span>
              </div>
            </div>

            <div className="eco-header-actions">
                            {/* Quiz Challenges Button */}
              <button
                type="button"
                className="eco-icon-btn"
                onClick={() => navigate("/quiz")}
                title="Thử thách Quiz Du lịch"
                aria-label="Quiz Du lịch"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  quiz
                </span>
              </button>
              {/* AI Travel Planner Button */}
              <button
                type="button"
                className="eco-icon-btn"
                onClick={() => navigate("/planner")}
                title="Lập lịch trình AI"
                aria-label="Lịch trình AI"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  calendar_month
                </span>
              </button>
              {/* Theme Toggle Button */}
              <button
                type="button"
                className="eco-icon-btn"
                onClick={toggleTheme}
                title={resolvedTheme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
                aria-label="Đổi giao diện"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {resolvedTheme === "dark" ? "light_mode" : "dark_mode"}
                </span>
              </button>

              {/* Account / Authentication Button */}
              <button
                type="button"
                className="eco-icon-btn"
                onClick={openAuthModal}
                title={isAuthenticated ? "Tài khoản (" + (user?.displayName || "Đã đăng nhập") + ")" : "Đăng nhập tài khoản"}
                aria-label="Tài khoản"
                style={{ position: "relative" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {isAuthenticated ? "account_circle" : "login"}
                </span>
                {isAuthenticated && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: "var(--color-primary)",
                    }}
                  />
                )}
              </button>
              {/* Personalization / Profile Button */}
              <button
                type="button"
                className="eco-icon-btn"
                onClick={openWelcomeSheet}
                title="Cá nhân hóa trải nghiệm"
                aria-label="Cá nhân hóa"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  person
                </span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content View */}
      <main
        style={{
          paddingTop: !isPlaceDetail ? "calc(56px + env(safe-area-inset-top, 0px))" : "0",
        }}
        className={showBottomNav ? "page-content-padding" : ""}
      >
        {children}
      </main>

      {/* 3-Tab Bottom Navigation */}
      {showBottomNav && (
        <nav className="eco-bottom-nav">
          <div className="eco-bottom-nav-inner">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.linkTo === "/"
                  ? currentPath === "/"
                  : currentPath.startsWith(item.linkTo);

              return (
                <button
                  key={item.key}
                  type="button"
                  className={"eco-nav-item " + (isActive ? "active" : "")}
                  onClick={() => navigate(item.linkTo)}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 24,
                      color: isActive
                        ? "var(--color-primary)"
                        : item.linkTo === "/chat"
                        ? "var(--color-ochre)"
                        : "var(--color-text-secondary)",
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Welcome & Personalization Bottom Sheet */}
      <WelcomePersonalizationSheet />
      {/* Account Modal */}
      <AuthModal />

      {/* Global Feedback Toast */}
      {toastMessage && (
        <div className="eco-toast">
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--color-primary)" }}>
            info
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
