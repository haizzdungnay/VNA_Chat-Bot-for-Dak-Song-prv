import React, { useEffect, useState, useTransition } from "react";
import { Page, Header, Box, Input } from "zmp-ui";
import { useSearchParams } from "zmp-ui";
import { api } from "../services/api";
import type { Category, Place } from "../types";
import { PlaceCard } from "../components/place-card";
import { LoadingView, ErrorView, EmptyView } from "../components/state-view";

const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategoryId = searchParams.get("categoryId") || "";

  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategoryId);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadCategories = async () => {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
    } catch {
      // Ignore category load error fallback
    }
  };

  const loadPlaces = async (catId: string, search: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPlaces({
        categoryId: catId || undefined,
        search: search || undefined,
      });
      setPlaces(data);
    } catch (err: any) {
      setError(err?.message || "Không thể tải danh sách địa điểm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadPlaces(selectedCategory, searchTerm);
  }, [selectedCategory, searchTerm]);

  const handleSelectCategory = (catId: string) => {
    const next = selectedCategory === catId ? "" : catId;
    setSelectedCategory(next);
    if (next) {
      setSearchParams({ categoryId: next });
    } else {
      setSearchParams({});
    }
  };

  const handleSearchChange = (val: string) => {
    startTransition(() => {
      setSearchTerm(val);
    });
  };

  return (
    <Page>
      <Header title="Khám phá Đắk Song" showBackIcon={false} />

      <Box p={4}>
        {/* Search Input */}
        <Box mb={3}>
          <Input.Search
            placeholder="Tìm kiếm địa điểm du lịch..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            clearable
          />
        </Box>

        {/* Category Filters */}
        <Box mb={4} flex style={{ gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <button
            className="chip-btn"
            style={{
              backgroundColor: selectedCategory === "" ? "#0068ff" : "#ffffff",
              color: selectedCategory === "" ? "#ffffff" : "#333333",
              borderColor: selectedCategory === "" ? "#0068ff" : "#e2e4e8",
            }}
            onClick={() => handleSelectCategory("")}
          >
            Tất cả
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                className="chip-btn"
                style={{
                  backgroundColor: isSelected ? "#0068ff" : "#ffffff",
                  color: isSelected ? "#ffffff" : "#333333",
                  borderColor: isSelected ? "#0068ff" : "#e2e4e8",
                }}
                onClick={() => handleSelectCategory(cat.id)}
              >
                {cat.name}
              </button>
            );
          })}
        </Box>

        {/* Places List / States */}
        {loading && <LoadingView message="Đang tìm kiếm địa điểm..." />}
        {error && !loading && (
          <ErrorView
            message={error}
            onRetry={() => loadPlaces(selectedCategory, searchTerm)}
          />
        )}
        {!loading && !error && places.length === 0 && (
          <EmptyView
            message="Không tìm thấy địa điểm phù hợp"
            actionText="Xem tất cả địa điểm"
            onAction={() => {
              setSelectedCategory("");
              setSearchTerm("");
            }}
          />
        )}
        {!loading && !error && places.length > 0 && (
          places.map((place) => <PlaceCard key={place.id} place={place} />)
        )}
      </Box>
    </Page>
  );
};

export default ExplorePage;
