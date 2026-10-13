import React, { useState, useEffect, useCallback } from "react";
import type {
  AdminQuizCollection,
  AdminQuizChallenge,
  AdminQuizQuestion,
  AdminQuizCategory,
} from "../types";
import { adminApi } from "../services/api";

interface QuizChallengesPageProps {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const QuizChallengesPage: React.FC<QuizChallengesPageProps> = ({ onNotify }) => {
  const [activeTab, setActiveTab] = useState<"challenges" | "collections">("challenges");

  const [challenges, setChallenges] = useState<AdminQuizChallenge[]>([]);
  const [collections, setCollections] = useState<AdminQuizCollection[]>([]);
  const [publishedQuestions, setPublishedQuestions] = useState<AdminQuizQuestion[]>([]);
  const [categories, setCategories] = useState<AdminQuizCategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Challenge Modal
  const [isChModalOpen, setIsChModalOpen] = useState(false);
  const [chTitle, setChTitle] = useState("");
  const [chDesc, setChDesc] = useState("");
  const [chDate, setChDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [chColId, setChColId] = useState("");
  const [chTimeLimit, setChTimeLimit] = useState(300);
  const [chScorePerQ, setChScorePerQ] = useState(10);
  const [chOpeningTime, setChOpeningTime] = useState("00:00");
  const [chClosingTime, setChClosingTime] = useState("23:59");
  const [chSubmitting, setChSubmitting] = useState(false);

  // Collection Modal
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [colTitle, setColTitle] = useState("");
  const [colDesc, setColDesc] = useState("");
  const [colCategory, setColCategory] = useState("");
  const [colDifficulty, setColDifficulty] = useState("mixed");
  const [colMode, setColMode] = useState<"manual" | "auto">("manual");
  const [colSelectedQIds, setColSelectedQIds] = useState<string[]>([]);
  const [colAutoCount, setColAutoCount] = useState(5);
  const [colSubmitting, setColSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [chRes, colRes, catRes, qRes] = await Promise.all([
        adminApi.getQuizChallenges(),
        adminApi.getQuizCollections(),
        adminApi.getQuizCategories(),
        adminApi.getQuizQuestions({ status: "published", limit: 100 }),
      ]);
      setChallenges(chRes.challenges || []);
      setCollections(colRes.collections || []);
      setCategories(catRes.categories || []);
      setPublishedQuestions(qRes.questions || []);

      if (colRes.collections?.length > 0 && !chColId) {
        setChColId(colRes.collections[0].id);
      }
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi tải dữ liệu thử thách");
    } finally {
      setLoading(false);
    }
  }, [chColId, onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chTitle.trim()) {
      onNotify?.("error", "Vui lòng nhập tiêu đề thử thách");
      return;
    }
    if (!chDate) {
      onNotify?.("error", "Vui lòng chọn ngày áp dụng thử thách");
      return;
    }
    if (!chColId) {
      onNotify?.("error", "Vui lòng chọn bộ đề câu hỏi");
      return;
    }

    setChSubmitting(true);
    try {
      await adminApi.createQuizChallenge({
        title: chTitle.trim(),
        description: chDesc.trim() || undefined,
        business_date: chDate,
        collection_id: chColId,
        time_limit_seconds: Number(chTimeLimit) || 300,
        score_per_question: Number(chScorePerQ) || 10,
        opening_time: chOpeningTime ? chOpeningTime + ":00" : "00:00:00",
        closing_time: chClosingTime ? chClosingTime + ":59" : "23:59:59",
        status: "active",
      });
      onNotify?.("success", "Đã tạo thử thách ngày " + chDate);
      setIsChModalOpen(false);
      loadData();
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi tạo thử thách");
    } finally {
      setChSubmitting(false);
    }
  };

  const handleCloseChallenge = async (id: string) => {
    try {
      await adminApi.closeQuizChallenge(id);
      onNotify?.("info", "Đã đóng thử thách");
      loadData();
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi đóng thử thách");
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colTitle.trim()) {
      onNotify?.("error", "Vui lòng nhập tiêu đề bộ đề");
      return;
    }
    if (colMode === "manual" && colSelectedQIds.length === 0) {
      onNotify?.("error", "Vui lòng tích chọn ít nhất 01 câu hỏi cho bộ đề");
      return;
    }

    setColSubmitting(true);
    try {
      await adminApi.createQuizCollection({
        title: colTitle.trim(),
        description: colDesc.trim() || undefined,
        category_id: colCategory || undefined,
        difficulty: colDifficulty,
        selection_mode: colMode,
        question_ids: colMode === "manual" ? colSelectedQIds : undefined,
        question_count: colMode === "auto" ? Number(colAutoCount) : undefined,
      });
      onNotify?.("success", "Đã tạo bộ đề mới thành công");
      setIsColModalOpen(false);
      setColSelectedQIds([]);
      loadData();
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi tạo bộ đề");
    } finally {
      setColSubmitting(false);
    }
  };

  const toggleSelectQuestion = (qId: string) => {
    if (colSelectedQIds.includes(qId)) {
      setColSelectedQIds(colSelectedQIds.filter((id) => id !== qId));
    } else {
      setColSelectedQIds([...colSelectedQIds, qId]);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Bộ đề & Thử thách Du lịch Đắk Song</h2>
          <p className="text-secondary" style={{ margin: "4px 0 0" }}>
            Cấu hình bộ đề trắc nghiệm và lịch trình thử thách hàng ngày cho du khách
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {activeTab === "challenges" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setChTitle("Thử thách Du lịch Đắk Song ngày " + chDate);
                setIsChModalOpen(true);
              }}
            >
              + Lên lịch thử thách mới
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setColTitle("");
                setColDesc("");
                setColSelectedQIds([]);
                setIsColModalOpen(true);
              }}
            >
              + Tạo bộ đề mới
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e2e8f0", marginBottom: 16 }}>
        <button
          type="button"
          className={"nav-item " + (activeTab === "challenges" ? "active" : "")}
          style={{ borderRadius: "8px 8px 0 0", padding: "10px 20px" }}
          onClick={() => setActiveTab("challenges")}
        >
          Thử thách hàng ngày ({challenges.length})
        </button>
        <button
          type="button"
          className={"nav-item " + (activeTab === "collections" ? "active" : "")}
          style={{ borderRadius: "8px 8px 0 0", padding: "10px 20px" }}
          onClick={() => setActiveTab("collections")}
        >
          Ngân hàng bộ đề ({collections.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
          Đang tải dữ liệu...
        </div>
      ) : activeTab === "challenges" ? (
        <div className="card">
          {challenges.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
              Chưa có thử thách nào được lên lịch. Nhấn nút &quot;Lên lịch thử thách mới&quot; để tạo.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ngày áp dụng</th>
                    <th>Tiêu đề thử thách</th>
                    <th>Bộ đề áp dụng</th>
                    <th>Số câu</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {challenges.map((ch) => (
                    <tr key={ch.id}>
                      <td>
                        <strong style={{ color: "#0369a1" }}>{ch.business_date}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ch.title}</div>
                        {ch.description && <div style={{ fontSize: 11, color: "#64748b" }}>{ch.description}</div>}
                      </td>
                      <td>{ch.collection_title || ch.collection_id}</td>
                      <td>{ch.question_count || "—"}</td>
                      <td>{ch.time_limit_seconds > 0 ? (ch.time_limit_seconds / 60) + " phút" : "Không giới hạn"}</td>
                      <td>
                        <span className={"status-badge " + (ch.status === "active" ? "active" : "inactive")}>
                          {ch.status === "active" ? "Đang mở" : ch.status === "scheduled" ? "Đã lên lịch" : "Đã đóng"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {ch.status === "active" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCloseChallenge(ch.id)}
                          >
                            Đóng thử thách
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          {collections.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
              Chưa có bộ đề nào. Nhấn &quot;Tạo bộ đề mới&quot; để bắt đầu gom nhóm câu hỏi.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tiêu đề bộ đề</th>
                    <th>Danh mục</th>
                    <th>Độ khó</th>
                    <th>Chế độ chọn</th>
                    <th>Số câu hỏi</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((col) => (
                    <tr key={col.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{col.title}</div>
                        {col.description && <div style={{ fontSize: 11, color: "#64748b" }}>{col.description}</div>}
                      </td>
                      <td>{col.category_name || "Tổng hợp"}</td>
                      <td>{col.difficulty || "Hỗn hợp"}</td>
                      <td>
                        <span style={{ fontSize: 12 }}>
                          {col.selection_mode === "auto" ? "Tự động lọc" : "Chọn thủ công"}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "#16a34a" }}>{col.question_count} câu</strong>
                      </td>
                      <td>
                        <span className="status-badge active">Đã xuất bản</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Challenge Modal */}
      {isChModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 540, width: "100%" }}>
            <div className="modal-header">
              <h3>Lên lịch thử thách du lịch hàng ngày</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsChModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateChallenge} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">Ngày tổ chức (YYYY-MM-DD) *</label>
                <input
                  type="date"
                  className="input"
                  value={chDate}
                  onChange={(e) => {
                    setChDate(e.target.value);
                    setChTitle("Thử thách Du lịch Đắk Song ngày " + e.target.value);
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Tiêu đề thử thách *</label>
                <input
                  type="text"
                  className="input"
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Mô tả ngắn</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Mô tả thông điệp thử thách..."
                  value={chDesc}
                  onChange={(e) => setChDesc(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Chọn bộ đề câu hỏi *</label>
                <select className="input" value={chColId} onChange={(e) => setChColId(e.target.value)} required>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.question_count} câu)
                    </option>
                  ))}
                </select>
              </div>

              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">Giờ mở cửa *</label>
                  <input
                    type="time"
                    className="input"
                    value={chOpeningTime}
                    onChange={(e) => setChOpeningTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Giờ đóng cửa *</label>
                  <input
                    type="time"
                    className="input"
                    value={chClosingTime}
                    onChange={(e) => setChClosingTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label className="label">Thời gian làm bài (giây)</label>
                  <input
                    type="number"
                    className="input"
                    value={chTimeLimit}
                    min={0}
                    step={30}
                    onChange={(e) => setChTimeLimit(Number(e.target.value))}
                  />
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {chTimeLimit > 0 ? (chTimeLimit / 60) + " phút (0 = không giới hạn)" : "Không giới hạn"}
                  </div>
                </div>
                <div>
                  <label className="label">Điểm mỗi câu đúng</label>
                  <input
                    type="number"
                    className="input"
                    value={chScorePerQ}
                    min={1}
                    onChange={(e) => setChScorePerQ(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsChModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={chSubmitting}>
                  {chSubmitting ? "Đang tạo..." : "Kích hoạt thử thách"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {isColModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal-header">
              <h3>Tạo bộ đề câu hỏi du lịch</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsColModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCollection} style={{ overflowY: "auto", padding: 20, flex: 1 }}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">Tiêu đề bộ đề *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="VD: Khám phá Thác nước & Rừng nguyên sinh..."
                  value={colTitle}
                  onChange={(e) => setColTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Mô tả bộ đề</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Mô tả nội dung học tập, tìm hiểu của bộ đề..."
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">Danh mục chủ đề</label>
                  <select className="input" value={colCategory} onChange={(e) => setColCategory(e.target.value)}>
                    <option value="">Tổng hợp tất cả danh mục</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Độ khó</label>
                  <select className="input" value={colDifficulty} onChange={(e) => setColDifficulty(e.target.value)}>
                    <option value="mixed">Hỗn hợp (Tất cả cấp độ)</option>
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Chế độ chọn câu hỏi</label>
                <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="col_mode"
                      checked={colMode === "manual"}
                      onChange={() => setColMode("manual")}
                    />
                    <span>Chọn thủ công từng câu</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="col_mode"
                      checked={colMode === "auto"}
                      onChange={() => setColMode("auto")}
                    />
                    <span>Tự động chọn ngẫu nhiên</span>
                  </label>
                </div>
              </div>

              {colMode === "auto" ? (
                <div style={{ marginBottom: 16 }}>
                  <label className="label">Số lượng câu hỏi cần lấy</label>
                  <input
                    type="number"
                    className="input"
                    value={colAutoCount}
                    min={1}
                    max={20}
                    onChange={(e) => setColAutoCount(Number(e.target.value))}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <label className="label" style={{ margin: 0 }}>
                      Chọn câu hỏi từ Ngân hàng đã duyệt ({colSelectedQIds.length} câu đã chọn):
                    </label>
                  </div>
                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: "auto",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      padding: 8,
                      background: "#f8fafc",
                    }}
                  >
                    {publishedQuestions.length === 0 ? (
                      <div style={{ padding: 16, textAlign: "center", color: "#64748b" }}>
                        Chưa có câu hỏi nào ở trạng thái &quot;Đã xuất bản&quot;. Vui lòng duyệt câu hỏi trước.
                      </div>
                    ) : (
                      publishedQuestions.map((q) => (
                        <label
                          key={q.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "6px 8px",
                            cursor: "pointer",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={colSelectedQIds.includes(q.id)}
                            onChange={() => toggleSelectQuestion(q.id)}
                            style={{ marginTop: 3 }}
                          />
                          <div style={{ fontSize: 13 }}>
                            <strong style={{ color: "#0369a1", marginRight: 6 }}>[{q.code}]</strong>
                            <span>{q.question_text}</span>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsColModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={colSubmitting}>
                  {colSubmitting ? "Đang tạo..." : "Lưu bộ đề"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
