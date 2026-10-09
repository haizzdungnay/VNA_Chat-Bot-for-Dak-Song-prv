import React, { useState } from "react";
import type { VisitorConsentProfile } from "../types";

interface VisitorsPageProps {
  visitors: VisitorConsentProfile[];
  isLoading: boolean;
}

const AGE_LABELS: Record<string, string> = {
  under18: "Dưới 18 tuổi",
  "duoi-18": "Dưới 18 tuổi",
  "18-24": "18 – 24 tuổi",
  "25-34": "25 – 34 tuổi",
  "35-49": "35 – 49 tuổi",
  "35-44": "35 – 44 tuổi",
  "45-54": "45 – 54 tuổi",
  "50plus": "Trên 50 tuổi",
  "55-tro-len": "Trên 55 tuổi",
};

export const VisitorsPage: React.FC<VisitorsPageProps> = ({ visitors, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [ageFilter, setAgeFilter] = useState("all");

  const filtered = visitors.filter((v) => {
    const matchName =
      !searchTerm ||
      (v.displayName && v.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      v.id.includes(searchTerm);
    const matchAge =
      ageFilter === "all" ||
      v.ageGroup === ageFilter ||
      (ageFilter === "under18" && v.ageGroup === "duoi-18") ||
      (ageFilter === "50plus" && v.ageGroup === "55-tro-len");
    return matchName && matchAge;
  });

  return (
    <div>
      {/* Privacy Notice Banner */}
      <div className="notice-box notice-warn">
        <div>
          <strong>Chính sách bảo vệ quyền riêng tư & Consent:</strong>
          <ul style={{ marginTop: 6, paddingLeft: 20 }}>
            <li>Chỉ hiển thị các hồ sơ mà người dùng đã <strong>chủ động đồng ý lưu lên server</strong> (opt-in riêng).</li>
            <li>Tùy chọn <code>allowAIContext</code> trên Mini App chỉ lưu trong safeStorage client, hoàn toàn KHÔNG tự ý đẩy lên server.</li>
            <li>Hệ thống không thu thập số điện thoại, định vị GPS, ID Zalo cá nhân thật hoặc nội dung chat riêng tư.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Danh sách hồ sơ hợp lệ ({filtered.length})</h2>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              type="text"
              className="form-control"
              style={{ width: 220 }}
              placeholder="Tìm theo tên hoặc ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="form-control"
              style={{ width: 140 }}
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
            >
              <option value="all">Tất cả nhóm tuổi</option>
              <option value="under18">Dưới 18 tuổi</option>
              <option value="18-24">18 – 24 tuổi</option>
              <option value="25-34">25 – 34 tuổi</option>
              <option value="35-49">35 – 49 tuổi</option>
              <option value="50plus">Trên 50 tuổi</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">Đang tải dữ liệu hồ sơ...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Chưa có người dùng đồng ý lưu hồ sơ lên máy chủ</div>
            <p>
              Hệ thống tuân thủ nguyên tắc Privacy-by-Default. Hồ sơ chỉ xuất hiện khi khách truy cập chọn opt-in đồng bộ lên máy chủ.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mã định danh ẩn danh</th>
                  <th>Tên / Biệt danh</th>
                  <th>Cách xưng hô</th>
                  <th>Nhóm tuổi</th>
                  <th>Phiên bản Consent</th>
                  <th>Thời điểm đồng ý</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code>{item.id.slice(0, 8)}...{item.id.slice(-4)}</code>
                    </td>
                    <td><strong>{item.displayName || "Chưa đặt tên"}</strong></td>
                    <td>{item.addressAs || "bạn"}</td>
                    <td>{item.ageGroup ? AGE_LABELS[item.ageGroup] || item.ageGroup : "Không rõ"}</td>
                    <td>
                      <span className="badge badge-neutral">v{item.consentVersion}</span>
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>
                      {new Date(item.consentedAt).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

