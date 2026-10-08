import React from "react";
import { useLocation, useNavigate } from "zmp-ui";
import { NAV_ITEMS } from "../constants";
import { useApp } from "../context/AppContext";
import { WelcomePersonalizationSheet } from "./welcome-sheet";

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme, openWelcomeSheet, toastMessage } = useApp();

  const currentPath = location.pathname;
  // Place detail is immersive, no bottom nav
  const isPlaceDetail = currentPath.startsWith("/place/");
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
