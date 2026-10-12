import React, { useState, useEffect, useCallback } from "react";
import type { AdminTourService, AdminTourServiceInput, PricingMode, ServiceCategory } from "../types";
import { adminApi } from "../services/api";

interface ServicesPageProps {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({ onNotify }) => {
  const [services, setServices] = useState<AdminTourService[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Create Service Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<AdminTourServiceInput>({
    code: "",
    name: "",
    category: "guide",
    description: "",
    providerName: "Trung tâm XTTM&DL Đắk Song",
    pricingMode: "per_day",
    unitPrice: 500000,
  });

  // Price Modal
  const [priceModalService, setPriceModalService] = useState<AdminTourService | null>(null);
  const [priceMode, setPriceMode] = useState<PricingMode>("per_person");
  const [unitPrice, setUnitPrice] = useState<number>(100000);
  const [priceSubmitting, setPriceSubmitting] = useState(false);

  const formatVnd = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num || 0);
  };

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getServices(categoryFilter !== "all" ? categoryFilter : undefined);
      setServices(res.services || []);
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi tải danh mục dịch vụ.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, onNotify]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleOpenPriceModal = (service: AdminTourService) => {
    setPriceModalService(service);
    setPriceMode(service.pricingRule?.pricingMode || "per_person");
    setUnitPrice(service.pricingRule?.unitPrice || 100000);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModalService) return;
    setPriceSubmitting(true);
    try {
      await adminApi.updateServicePrice(priceModalService.id, priceMode, unitPrice);
      if (onNotify) {
        onNotify(
          "success",
          `Đã cập nhật bảng giá mới cho "${priceModalService.name}". Các báo giá/đơn đặt cũ vẫn giữ nguyên snapshot.`
        );
      }
      setPriceModalService(null);
      await loadServices();
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi khi cập nhật giá.");
    } finally {
      setPriceSubmitting(false);
    }
  };

  const handleToggleActive = async (service: AdminTourService) => {
    try {
      await adminApi.toggleService(service.id, !service.isActive);
      if (onNotify) {
        onNotify("info", service.isActive ? "Đã tạm dừng dịch vụ." : "Đã kích hoạt lại dịch vụ.");
      }
      await loadServices();
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi đổi trạng thái dịch vụ.");
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) {
      if (onNotify) onNotify("error", "Tên dịch vụ không được để trống.");
      return;
    }
    try {
      await adminApi.createService(createFormData);
      if (onNotify) onNotify("success", "Tạo dịch vụ du lịch mới thành công.");
      setIsCreateModalOpen(false);
      await loadServices();
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi khi tạo dịch vụ.");
    }
  };

  const getModeLabel = (mode?: PricingMode) => {
    switch (mode) {
      case "fixed":
        return "Cố định / trọn gói";
      case "per_person":
        return "/ người";
      case "per_adult":
        return "/ người lớn";
      case "per_child":
        return "/ trẻ em";
      case "per_day":
        return "/ ngày";
      case "per_night":
        return "/ đêm";
      case "per_group":
        return "/ đoàn khách";
      default:
        return mode || "Chưa cấu hình";
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
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              backgroundColor: "#fff",
            }}
          >
            <option value="all">Tất cả phân loại</option>
            <option value="guide">Hướng dẫn viên (guide)</option>
            <option value="transport">Vận chuyển / Xe (transport)</option>
            <option value="ticket">Vé tham quan (ticket)</option>
            <option value="accommodation">Lưu trú / Khách sạn (accommodation)</option>
            <option value="meal">Ăn uống / Ẩm thực (meal)</option>
            <option value="other">Dịch vụ khác (other)</option>
          </select>
        </div>

        <button
          onClick={() => {
            setCreateFormData({
              code: "SRV-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
              name: "",
              category: "guide",
              description: "",
              providerName: "Trung tâm XTTM&DL Đắk Song",
              pricingMode: "per_day",
              unitPrice: 500000,
            });
            setIsCreateModalOpen(true);
          }}
          className="btn-primary"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          + Thêm Dịch Vụ Mới
        </button>
      </div>

      {/* Services Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Đang tải danh mục dịch vụ...</div>
      ) : services.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Chưa có dịch vụ nào trong phân loại này.
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "12px 16px" }}>Mã & Tên dịch vụ</th>
                <th style={{ padding: "12px 16px" }}>Phân loại</th>
                <th style={{ padding: "12px 16px" }}>Nhà cung cấp</th>
                <th style={{ padding: "12px 16px" }}>Bảng giá hiện hành</th>
                <th style={{ padding: "12px 16px" }}>Trạng thái</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {services.map((srv) => (
                <tr key={srv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 700, color: "#1e293b" }}>{srv.name}</div>
                    <div style={{ fontSize: 11, color: "#0f766e", fontWeight: 600 }}>{srv.code}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {srv.category}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#64748b" }}>
                    {srv.providerName || "Trung tâm XTTM&DL Đắk Song"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {srv.pricingRule ? (
                      <div>
                        <div style={{ fontWeight: 800, color: "#0f766e" }}>
                          {formatVnd(srv.pricingRule.unitPrice)}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {getModeLabel(srv.pricingRule.pricingMode)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "#ef4444", fontSize: 12 }}>Chưa có giá</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: srv.isActive ? "#ecfdf5" : "#fef2f2",
                        color: srv.isActive ? "#059669" : "#dc2626",
                      }}
                    >
                      {srv.isActive ? "Hoạt động" : "Tạm dừng"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleOpenPriceModal(srv)}
                        className="btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 12, color: "#0f766e", fontWeight: 600 }}
                      >
                        Đổi giá
                      </button>
                      <button
                        onClick={() => handleToggleActive(srv)}
                        className="btn-secondary"
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          color: srv.isActive ? "#ef4444" : "#10b981",
                        }}
                      >
                        {srv.isActive ? "Tạm dừng" : "Kích hoạt"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Change Price Modal */}
      {priceModalService && (
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
              maxWidth: 440,
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Cập nhật bảng giá dịch vụ</h3>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              {priceModalService.name} ({priceModalService.code})
            </div>

            <form onSubmit={handleSavePrice} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Chế độ tính giá (Pricing Mode)
                </label>
                <select
                  value={priceMode}
                  onChange={(e) => setPriceMode(e.target.value as PricingMode)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                >
                  <option value="fixed">Cố định / trọn gói (fixed)</option>
                  <option value="per_person">Theo người (per_person)</option>
                  <option value="per_adult">Theo người lớn (per_adult)</option>
                  <option value="per_child">Theo trẻ em (per_child)</option>
                  <option value="per_day">Theo ngày (per_day)</option>
                  <option value="per_night">Theo đêm (per_night)</option>
                  <option value="per_group">Theo đoàn (per_group)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Đơn giá mới (VND)
                </label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseInt(e.target.value, 10) || 0)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  required
                />
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#0f766e",
                  backgroundColor: "#f0fdfa",
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccfbf1",
                }}
              >
                ℹ️ Giá mới chỉ áp dụng cho các báo giá và đơn đặt trong tương lai. Dữ liệu các đơn cũ luôn giữ nguyên lịch sử giá.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setPriceModalService(null)}
                  className="btn-secondary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                  disabled={priceSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: "8px 20px", fontSize: 13 }}
                  disabled={priceSubmitting}
                >
                  {priceSubmitting ? "Đang lưu..." : "Xác nhận đổi giá"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Service Modal */}
      {isCreateModalOpen && (
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
              maxWidth: 480,
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Thêm dịch vụ du lịch mới</h3>

            <form onSubmit={handleCreateService} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Mã dịch vụ (Unique)
                </label>
                <input
                  type="text"
                  value={createFormData.code}
                  onChange={(e) => setCreateFormData({ ...createFormData, code: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Tên dịch vụ
                </label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Phân loại
                  </label>
                  <select
                    value={createFormData.category}
                    onChange={(e) => setCreateFormData({ ...createFormData, category: e.target.value as ServiceCategory })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  >
                    <option value="guide">Hướng dẫn viên</option>
                    <option value="transport">Vận chuyển / Xe</option>
                    <option value="ticket">Vé tham quan</option>
                    <option value="accommodation">Lưu trú / Khách sạn</option>
                    <option value="meal">Ăn uống / Ẩm thực</option>
                    <option value="other">Dịch vụ khác</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Nhà cung cấp
                  </label>
                  <input
                    type="text"
                    value={createFormData.providerName || ""}
                    onChange={(e) => setCreateFormData({ ...createFormData, providerName: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Chế độ giá
                  </label>
                  <select
                    value={createFormData.pricingMode}
                    onChange={(e) => setCreateFormData({ ...createFormData, pricingMode: e.target.value as PricingMode })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                  >
                    <option value="fixed">Cố định</option>
                    <option value="per_person">Theo người</option>
                    <option value="per_adult">Theo người lớn</option>
                    <option value="per_child">Theo trẻ em</option>
                    <option value="per_day">Theo ngày</option>
                    <option value="per_night">Theo đêm</option>
                    <option value="per_group">Theo đoàn</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    Đơn giá (VND)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={createFormData.unitPrice}
                    onChange={(e) => setCreateFormData({ ...createFormData, unitPrice: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary" style={{ padding: "8px 20px", fontSize: 13 }}>
                  Tạo dịch vụ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
