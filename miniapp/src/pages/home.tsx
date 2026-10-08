import React, { useEffect, useState } from "react";
import { useNavigate } from "zmp-ui";
import { api } from "../services/api";
import type { Category, Place } from "../types";
import { PlaceCard } from "../components/place-card";
import { LoadingView, ErrorView, EmptyView } from "../components/state-view";
import { useApp } from "../context/AppContext";
import { CATEGORY_SHORTCUTS, DEFAULT_HERO_IMAGE } from "../constants";

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, onboardingSeen, openWelcomeSheet } = useApp();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredPlaces, setFeaturedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // First-run welcome bottom sheet trigger explicitly on Home entry only
  useEffect(() => {
    if (!onboardingSeen) {
      const timer = setTimeout(() => {
        openWelcomeSheet();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [onboardingSeen, openWelcomeSheet]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cats, places] = await Promise.all([
        api.getCategories().catch(() => []),
        api.getPlaces({ featured: true }),
      ]);
      setCategories(cats);
      setFeaturedPlaces(places);
    } catch (err: any) {
      setError(err?.message || "Không thể tải dữ liệu trang chủ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map category click to matching API category id
  const handleCategoryClick = (shortcutId: string, shortcutName: string) => {
    const matched = categories.find(
      (c) =>
        c.id === shortcutId ||
        c.name.toLowerCase().includes(shortcutName.toLowerCase())
    );
    const catId = matched ? matched.id : shortcutId;
    navigate(`/explore?categoryId=${encodeURIComponent(catId)}`);
  };

  const heroImage =
    featuredPlaces[0]?.imageUrl || DEFAULT_HERO_IMAGE;

  return (
    <div style={{ padding: "14px 16px 24px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 1. Header Location & Personalized Welcome */}
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="location-status-badge">
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--color-secondary)" }}>
              location_on
            </span>
            <span>Huyện Đắk Song, Đắk Nông</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--color-text-secondary)",
              fontWeight: 500,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--color-secondary)" }}>
              verified
            </span>
            <span>Cổng thông tin</span>
          </div>
        </div>

        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--color-primary)",
              margin: 0,
              letterSpacing: "-0.015em",
            }}
          >
            {profile?.displayName
              ? `Chào ${profile.displayName}! Khám phá Đắk Song`
              : "Khám phá Đắk Song"}
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              margin: "3px 0 0 0",
              lineHeight: 1.4,
            }}
          >
            Ứng dụng thông tin quảng bá thiên nhiên, văn hóa và điểm đến
          </p>
        </div>
      </section>

      {/* 2. Hero Banner Card */}
      <section className="hero-banner-card">
        <div
          className="hero-media-wrapper"
          style={{ backgroundImage: `url('${heroImage}')` }}
        >
          <div className="hero-media-overlay" />
          <span className="hero-tag-pill">
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--color-secondary)" }}>
              eco
            </span>
            Bản sắc Tây Nguyên
          </span>
        </div>

        <div className="hero-content">
          <div>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Khám phá vẻ đẹp Đắk Song
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "var(--color-ochre)",
                fontWeight: 600,
                margin: "4px 0 0 0",
              }}
            >
              Thiên nhiên • Văn hóa • Ẩm thực
            </p>
          </div>

          <button
            type="button"
            className="eco-btn-primary"
            onClick={() => navigate("/explore")}
          >
            <span>Khám phá ngay</span>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_forward
            </span>
          </button>
        </div>
      </section>

      {/* 3. Category Shortcuts (2x2 Grid) */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 5,
              height: 16,
              borderRadius: 3,
              backgroundColor: "var(--color-secondary)",
            }}
          />
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Khám phá theo sở thích
          </h3>
        </div>

        <div className="category-grid">
          {CATEGORY_SHORTCUTS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="category-card-btn"
              onClick={() => handleCategoryClick(cat.id, cat.name)}
            >
              <div className={`category-icon-box ${cat.bgClass}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  {cat.icon}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    display: "block",
                    lineHeight: 1.25,
                  }}
                >
                  {cat.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    display: "block",
                    marginTop: 2,
                    lineHeight: 1.2,
                  }}
                >
                  {cat.subtitle}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 4. AI Travel Assistant CTA Banner */}
      <section className="ai-cta-card">
        <div className="ai-accent-bar" />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div className="ai-badge-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              auto_awesome
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-ochre)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Trợ lý du lịch AI
            </span>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: "2px 0 0 0",
              }}
            >
              Hôm nay bạn muốn đi đâu?
            </h3>
          </div>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          Chưa biết bắt đầu từ đâu? Hãy để trợ lý AI gợi ý địa điểm tham quan và gợi mở lịch trình phù hợp nhất với nhu cầu của bạn.
        </p>

        <button
          type="button"
          className="eco-btn-ochre"
          onClick={() => navigate("/chat")}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            forum
          </span>
          <span>Hỏi trợ lý AI ngay</span>
        </button>
      </section>

      {/* 5. Featured Destinations Section */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 5,
                height: 16,
                borderRadius: 3,
                backgroundColor: "var(--color-primary)",
              }}
            />
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Điểm đến nổi bật
            </h3>
          </div>

          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {featuredPlaces.length} địa danh
          </span>
        </div>

        {loading && <LoadingView message="Đang tải điểm đến nổi bật..." />}
        {error && !loading && <ErrorView message={error} onRetry={loadData} />}

        {!loading && !error && (
          <div>
            {featuredPlaces.length === 0 ? (
              <EmptyView message="Chưa có địa điểm nổi bật nào" />
            ) : (
              featuredPlaces.map((place) => (
                <PlaceCard key={place.id} place={place} />
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
