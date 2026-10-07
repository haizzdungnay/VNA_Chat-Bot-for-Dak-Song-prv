import React, { useEffect, useState } from "react";
import { Page, Header, Box, Text, Button } from "zmp-ui";
import { useNavigate } from "zmp-ui";
import { api } from "../services/api";
import type { Category, Place } from "../types";
import { PlaceCard } from "../components/place-card";
import { LoadingView, ErrorView, EmptyView } from "../components/state-view";

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredPlaces, setFeaturedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cats, places] = await Promise.all([
        api.getCategories(),
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

  return (
    <Page className="bg-gray-50">
      <Header title="Du lịch Đắk Song" showBackIcon={false} />

      <Box p={4}>
        {/* Hero banner placeholder */}
        <div className="banner-placeholder" style={{ marginBottom: 16 }}>
          <Text size="xLarge" bold style={{ color: "#ffffff", marginBottom: 6 }}>
            Khám phá Đắk Song
          </Text>
          <Text size="small" style={{ color: "rgba(255, 255, 255, 0.9)", marginBottom: 14 }}>
            Vẻ đẹp cao nguyên xanh mát, điểm đến văn hoá và cảnh quan đặc sắc.
          </Text>
          <Button
            size="small"
            variant="secondary"
            onClick={() => navigate("/explore")}
          >
            Khám phá ngay
          </Button>
        </div>

        {/* Section CTA cho AI Travel Assistant */}
        <div
          className="card-shadow"
          style={{
            padding: 14,
            marginBottom: 20,
            background: "linear-gradient(135deg, #f0f7ff 0%, #e6f0ff 100%)",
            border: "1px solid #cce3ff",
          }}
        >
          <Box flex alignItems="center" justifyContent="space-between">
            <Box style={{ flex: 1, marginRight: 8 }}>
              <Text bold size="normal" style={{ color: "#0068ff" }}>
                Trợ lý AI Đắk Song
              </Text>
              <Text size="xSmall" style={{ color: "#555", marginTop: 2 }}>
                Gợi ý lịch trình, món ăn & địa điểm nhanh chóng.
              </Text>
            </Box>
            <Button size="small" onClick={() => navigate("/chat")}>
              Trò chuyện
            </Button>
          </Box>
        </div>

        {/* Loading / Error state */}
        {loading && <LoadingView message="Đang tải dữ liệu điểm đến..." />}
        {error && !loading && <ErrorView message={error} onRetry={loadData} />}

        {!loading && !error && (
          <>
            {/* Category shortcuts */}
            <Box mb={4}>
              <Text bold size="large" style={{ marginBottom: 10 }}>
                Danh mục nổi bật
              </Text>
              <Box flex style={{ gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className="chip-btn"
                    onClick={() => navigate(`/explore?categoryId=${cat.id}`)}
                  >
                    {cat.name}
                  </button>
                ))}
              </Box>
            </Box>

            {/* Section Điểm đến nổi bật */}
            <Box mb={4}>
              <Box flex justifyContent="space-between" alignItems="center" mb={2}>
                <Text bold size="large">
                  Điểm đến nổi bật
                </Text>
                <Text
                  size="small"
                  style={{ color: "#0068ff", cursor: "pointer" }}
                  onClick={() => navigate("/explore")}
                >
                  Xem tất cả
                </Text>
              </Box>

              {featuredPlaces.length === 0 ? (
                <EmptyView message="Chưa có địa điểm nổi bật nào" />
              ) : (
                featuredPlaces.map((place) => (
                  <PlaceCard key={place.id} place={place} />
                ))
              )}
            </Box>
          </>
        )}
      </Box>
    </Page>
  );
};

export default HomePage;
