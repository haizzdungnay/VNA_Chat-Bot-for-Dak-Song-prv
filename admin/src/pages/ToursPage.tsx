import React, { useState, useEffect, useCallback } from "react";
import type { AdminTourProduct, AdminTourInput, TourStatus } from "../types";
import { adminApi } from "../services/api";
import { ConfirmModal } from "../components/ConfirmModal";

interface ToursPageProps {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const ToursPage: React.FC<ToursPageProps> = ({ onNotify }) => {
  const [tours, setTours] = useState<AdminTourProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTour, setEditingTour] = useState<AdminTourProduct | null>(null);
  const [formData, setFormData] = useState<AdminTourInput>({
    code: "",
    title: "",
    description: "",
    coverImageUrl: "",
    durationDays: 1,
    minTravelers: 1,
    maxTravelers: 20,
    basePrice: 500000,
    status: "published",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatVnd = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num || 0);
  };

  const loadTours = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getTours(statusFilter !== "all" ? statusFilter : undefined, search);
      setTours(res.tours || []);
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi tải danh mục tour.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, onNotify]);

  useEffect(() => {
    loadTours();
  }, [loadTours]);

  const handleOpenCreate = () => {
    setEditingTour(null);
    setFormData({
      code: "TOUR-DS-" + Math.floor(10 + Math.random() * 90),
      title: "",
      description: "",
      coverImageUrl: "https://static.dggv.edu.vn/360/1679365017974_123201-nam-nung-4.jpg",
      durationDays: 1,
      minTravelers: 1,
      maxTravelers: 20,
      basePrice: 500000,
      status: "published",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tour: AdminTourProduct) => {
    setEditingTour(tour);
    setFormData({
      code: tour.code,
      title: tour.title,
      description: tour.description,
      coverImageUrl: tour.coverImageUrl || "",
      durationDays: tour.durationDays,
      minTravelers: tour.minTravelers,
      maxTravelers: tour.maxTravelers,
      basePrice: tour.basePrice,
      status: tour.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      if (onNotify) onNotify("error", "Tiêu đề tour không được để trống.");
      return;
    }
    setFormSubmitting(true);
    try {
      if (editingTour) {
        await adminApi.updateTour(editingTour.id, formData);
        if (onNotify) onNotify("success", "Cập nhật thông tin tour thành công.");
      } else {
        await adminApi.createTour(formData);
        if (onNotify) onNotify("success", "Tạo sản phẩm tour mới thành công.");
      }
      setIsModalOpen(false);
      await loadTours();
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi khi lưu thông tin tour.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await adminApi.deleteTour(deletingId);
      if (onNotify) onNotify("success", "Đã xóa tour thành công.");
      setDeletingId(null);
      await loadTours();
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Không thể xóa tour.");
    }
  };

  return (
    <div className="tab-pane">
      {/* Header Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên tour..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              width: 260,
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              backgroundColor: "#fff",
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="published">Đang mở bán (published)</option>
            <option value="draft">Bản nháp (draft)</option>
            <option value="archived">Lưu trữ (archived)</option>
          </select>
        </div>

        <button onClick={handleOpenCreate} className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
          + Thêm Tour Mới
        </button>
      </div>

      {/* Tour Cards Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Đang tải danh sách tour...</div>
      ) : tours.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Không tìm thấy tour nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {tours.map((tour) => (
            <div
              key={tour.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              {tour.coverImageUrl && (
                <div style={{ height: 160, width: "100%", overflow: "hidden", position: "relative" }}>
                  <img
                    src={tour.coverImageUrl}
                    alt={tour.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      backgroundColor:
                        tour.status === "published"
                          ? "#10b981"
                          : tour.status === "draft"
                          ? "#f59e0b"
                          : "#64748b",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    {tour.status}
                  </div>
                </div>
              )}

              <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>{tour.code}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginTop: 4, marginBottom: 8 }}>
                  {tour.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#64748b",
                    lineHeight: 1.4,
                    flex: 1,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {tour.description}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {tour.durationDays} ngày • {tour.minTravelers}-{tour.maxTravelers} khách
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f766e" }}>
                      {formatVnd(tour.basePrice)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleOpenEdit(tour)}
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => setDeletingId(tour.id)}
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: 12, color: "#ef4444" }}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 520,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {editingTour ? "Chỉnh sửa sản phẩm Tour" : "Thêm sản phẩm Tour mới"}
            </h3>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Mã Tour (Unique)
                </label>
                <input
                  type="text"
                  disabled={Boolean(editingTour)}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    backgroundColor: editingTour ? "#f1f5f9" : "#fff",
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Tên / Tiêu đề Tour
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Mô tả chi tiết
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Link ảnh bìa (Cover Image URL)
                </label>
                <input
                  type="text"
                  value={formData.coverImageUrl || ""}
                  onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Số ngày
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value, 10) || 1 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Min khách
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.minTravelers}
                    onChange={(e) => setFormData({ ...formData, minTravelers: parseInt(e.target.value, 10) || 1 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Max khách
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.maxTravelers}
                    onChange={(e) => setFormData({ ...formData, maxTravelers: parseInt(e.target.value, 10) || 20 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Giá cơ bản (VND / người)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Trạng thái phát hành
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TourStatus })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  >
                    <option value="published">Mở bán (published)</option>
                    <option value="draft">Bản nháp (draft)</option>
                    <option value="archived">Lưu trữ (archived)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                  disabled={formSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "8px 20px", fontSize: 13 }}
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Đang lưu..." : editingTour ? "Lưu thay đổi" : "Tạo Tour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <ConfirmModal
          isOpen={true}
          title="Xác nhận xóa Tour"
          message="Bạn có chắc chắn muốn xóa tour này khỏi hệ thống? Nếu tour đã có đơn đặt hàng, hệ thống sẽ ngăn chặn việc xóa để bảo vệ toàn vẹn dữ liệu."
          confirmText="Xác nhận xóa"
          cancelText="Đóng"
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
          isDanger={true}
        />
      )}
    </div>
  );
};

