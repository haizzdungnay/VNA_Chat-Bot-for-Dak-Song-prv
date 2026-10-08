import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "zmp-ui";
import { api } from "../services/api";
import type { Category, Place } from "../types";
import { PlaceCard } from "../components/place-card";
import { LoadingView, ErrorView, EmptyView } from "../components/state-view";

const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategoryId = searchParams.get("categoryId") || "";

  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(urlCategoryId);
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stale request guard counter
  const latestReqIdRef = useRef<number>(0);

  // Sync selectedCategory when URL changes
  useEffect(() => {
    setSelectedCategory(urlCategoryId);
  }, [urlCategoryId]);

  // Debounce search input (~300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load categories on mount
  useEffect(() => {
    let mounted = true;
    api
      .getCategories()
      .then((data) => {
        if (mounted) setCategories(data);
      })
      .catch(() => {
        // Fallback or ignore
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch places with stale response guard
  useEffect(() => {
    const reqId = ++latestReqIdRef.current;
    setLoading(true);
    setError(null);

    api
      .getPlaces({
        categoryId: selectedCategory || undefined,
        search: debouncedSearch || undefined,
      })
      .then((data) => {
        if (reqId === latestReqIdRef.current) {
          setPlaces(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (reqId === latestReqIdRef.current) {
          setError(err?.message || "Không thể tải danh sách địa điểm");
          setLoading(false);
        }
      });
  }, [selectedCategory, debouncedSearch]);

  const handleSelectCategory = (catId: string) => {
    const next = selectedCategory === catId ? "" : catId;
    setSelectedCategory(next);
    if (next) {
      setSearchParams({ categoryId: next });
    } else {
      setSearchParams({});
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setDebouncedSearch("");
  };

  const getCategoryIcon = (slugOrName: string) => {
    const lower = slugOrName.toLowerCase();
    if (lower.includes("thien-nhien") || lower.includes("thiên")) return "park";
    if (lower.includes("lich-su") || lower.includes("văn") || lower.includes("tự")) return "temple_buddhist";
    if (lower.includes("thuc") || lower.includes("ẩm") || lower.includes("ăn")) return "coffee";
    if (lower.includes("checkin") || lower.includes("ảnh") || lower.includes("chụp")) return "photo_camera";
    return "category";
  };

  return (
    <div style={{ padding: "14px 16px 24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Header Section */}
      <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            margin: 0,
            letterSpacing: "-0.015em",
          }}
        >
          Khám phá địa điểm
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          Tìm kiếm danh lam thắng cảnh, văn hóa bản địa & ẩm thực tại Đắk Song
        </p>
      </section>

      {/* 2. Search Input Bar */}
      <section>
        <div className="search-bar-container">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 22, color: "var(--color-secondary)" }}
          >
            search
          </span>
          <input
            type="text"
            className="search-bar-input"
            placeholder="Tìm kiếm địa điểm du lịch..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClearSearch}
              aria-label="Xoá tìm kiếm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                close
              </span>
            </button>
          )}
        </div>
      </section>

      {/* 3. Category Filter Chips (Horizontal Carousel) */}
      <section>
        <div className="filter-chip-row no-scrollbar">
          <button
            type="button"
            className={"filter-chip " + (selectedCategory === "" ? "active" : "")}
            onClick={() => handleSelectCategory("")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              travel_explore
            </span>
            <span>Tất cả</span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const iconName = getCategoryIcon(cat.slug || cat.name);
            return (
              <button
                key={cat.id}
                type="button"
                className={"filter-chip " + (isSelected ? "active" : "")}
                onClick={() => handleSelectCategory(cat.id)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {iconName}
                </span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Destinations List / Status Views */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {loading && <LoadingView message="Đang tìm kiếm địa điểm..." />}

        {error && !loading && (
          <ErrorView
            message={error}
            onRetry={() => {
              const reqId = ++latestReqIdRef.current;
              setLoading(true);
              setError(null);
              api
                .getPlaces({
                  categoryId: selectedCategory || undefined,
                  search: debouncedSearch || undefined,
                })
                .then((data) => {
                  if (reqId === latestReqIdRef.current) {
                    setPlaces(data);
                    setLoading(false);
                  }
                })
                .catch((err: any) => {
                  if (reqId === latestReqIdRef.current) {
                    setError(err?.message || "Lỗi tải địa điểm");
                    setLoading(false);
                  }
                });
            }}
          />
        )}

        {!loading && !error && places.length === 0 && (
          <EmptyView
            message="Không tìm thấy địa điểm phù hợp"
            actionText="Xem tất cả địa điểm"
            onAction={() => {
              setSelectedCategory("");
              setSearchInput("");
              setDebouncedSearch("");
              setSearchParams({});
            }}
          />
        )}

        {!loading && !error && places.length > 0 && (
          <div>
            {places.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ExplorePage;
