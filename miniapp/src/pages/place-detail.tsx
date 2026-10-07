import React, { useEffect, useState } from "react";
import { Page, Header, Box, Text, Button } from "zmp-ui";
import { useParams, useNavigate } from "zmp-ui";
import { api } from "../services/api";
import type { Place } from "../types";
import { LoadingView, ErrorView } from "../components/state-view";

const PlaceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadDetail = async (placeId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPlaceById(placeId);
      setPlace(data);
    } catch (err: any) {
      setError(err?.message || "Không tìm thấy địa điểm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadDetail(id);
    }
  }, [id]);

  // ponytail: Abstraction placeholder for Zalo Maps / Navigation SDK; integrate with zmp-sdk openLocation when ready
  const handleOpenDirections = (targetPlace: Place) => {
    if (targetPlace.mapUrl) {
      window.open(targetPlace.mapUrl, "_blank");
      return;
    }
    setToastMessage(`Chức năng chỉ đường tới ${targetPlace.name} sẽ cập nhật tọa độ chính xác sau.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ponytail: Abstraction placeholder for Zalo Share SDK; integrate with openShareSheet / zmp-sdk shareCurrentPage when ready
  const handleSharePlace = (targetPlace: Place) => {
    setToastMessage(`Đã sao chép liên kết chia sẻ địa điểm: ${targetPlace.name}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <Page>
      <Header
        title={place ? place.name : "Chi tiết địa điểm"}
        showBackIcon={true}
        onBackClick={() => navigate(-1)}
      />

      {loading && <LoadingView message="Đang tải thông tin địa điểm..." />}
      {error && !loading && (
        <ErrorView
          message={error}
          onRetry={() => id && loadDetail(id)}
        />
      )}

      {!loading && !error && place && (
        <div>
          {place.imageUrl && (
            <img
              src={place.imageUrl}
              alt={place.name}
              style={{
                width: "100%",
                height: 220,
                objectFit: "cover",
                backgroundColor: "#e9ecef",
              }}
            />
          )}

          <Box p={4}>
            {place.category?.name && (
              <span className="category-badge" style={{ marginBottom: 8 }}>
                {place.category.name}
              </span>
            )}

            <Text size="xLarge" bold style={{ marginBottom: 8, marginTop: 4 }}>
              {place.name}
            </Text>

            {place.address && (
              <Box flex alignItems="center" mb={3}>
                <Text size="small" style={{ color: "#767a7f" }}>
                  📍 {place.address}
                </Text>
              </Box>
            )}

            {toastMessage && (
              <div
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#e6f0ff",
                  color: "#0068ff",
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {toastMessage}
              </div>
            )}

            {/* Action buttons placeholder */}
            <Box flex style={{ gap: 10, marginBottom: 20 }}>
              <Button
                style={{ flex: 1 }}
                onClick={() => handleOpenDirections(place)}
              >
                Chỉ đường
              </Button>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                onClick={() => handleSharePlace(place)}
              >
                Chia sẻ
              </Button>
            </Box>

            {/* Descriptions */}
            <Box mb={4}>
              <Text bold size="large" style={{ marginBottom: 8 }}>
                Giới thiệu
              </Text>
              <Text size="normal" style={{ lineHeight: 1.6, color: "#333333" }}>
                {place.description}
              </Text>
            </Box>

            {place.isFeatured && (
              <div
                style={{
                  padding: 10,
                  backgroundColor: "#fff8e6",
                  borderRadius: 8,
                  border: "1px solid #ffe58f",
                  fontSize: 12,
                  color: "#d48806",
                }}
              >
                ★ Điểm đến tiêu biểu của du lịch Đắk Song
              </div>
            )}
          </Box>
        </div>
      )}
    </Page>
  );
};

export default PlaceDetailPage;
