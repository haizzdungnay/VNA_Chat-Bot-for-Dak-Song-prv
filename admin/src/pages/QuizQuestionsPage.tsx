import React, { useState, useEffect, useCallback } from "react";
import type {
  AdminQuizQuestion,
  AdminQuizCategory,
  QuestionType,
  QuestionDifficulty,
  SourceType,
} from "../types";
import { adminApi } from "../services/api";

interface QuizQuestionsPageProps {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const QuizQuestionsPage: React.FC<QuizQuestionsPageProps> = ({ onNotify }) => {
  const [questions, setQuestions] = useState<AdminQuizQuestion[]>([]);
  const [categories, setCategories] = useState<AdminQuizCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Filters
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Question Modal (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuizQuestion | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<QuestionType>("single_choice");
  const [formCategory, setFormCategory] = useState("");
  const [formDifficulty, setFormDifficulty] = useState<QuestionDifficulty>("easy");
  const [formText, setFormText] = useState("");
  const [formExplanation, setFormExplanation] = useState("");
  const [formSourceType, setFormSourceType] = useState<SourceType>("manual");
  const [formSourceRef, setFormSourceRef] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formOptions, setFormOptions] = useState<
    { option_key: string; option_text: string; is_correct: boolean }[]
  >([
    { option_key: "A", option_text: "", is_correct: true },
    { option_key: "B", option_text: "", is_correct: false },
    { option_key: "C", option_text: "", is_correct: false },
    { option_key: "D", option_text: "", is_correct: false },
  ]);

  const loadCategories = async () => {
    try {
      const res = await adminApi.getQuizCategories();
      setCategories(res.categories || []);
      if (res.categories && res.categories.length > 0 && !formCategory) {
        setFormCategory(res.categories[0].id);
      }
    } catch {
      // Ignored
    }
  };

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getQuizQuestions({
        keyword: keyword || undefined,
        categoryId: categoryId || undefined,
        difficulty: difficulty || undefined,
        questionType: questionType || undefined,
        status: statusFilter || undefined,
        page,
        limit: 15,
      });
      setQuestions(res.questions || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi tải danh sách câu hỏi");
    } finally {
      setLoading(false);
    }
  }, [keyword, categoryId, difficulty, questionType, statusFilter, page, onNotify]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setFormCode("");
    setFormType("single_choice");
    setFormCategory(categories[0]?.id || "cat-quiz-nature");
    setFormDifficulty("easy");
    setFormText("");
    setFormExplanation("");
    setFormSourceType("manual");
    setFormSourceRef("");
    setFormImageUrl("");
    setFormOptions([
      { option_key: "A", option_text: "", is_correct: true },
      { option_key: "B", option_text: "", is_correct: false },
      { option_key: "C", option_text: "", is_correct: false },
      { option_key: "D", option_text: "", is_correct: false },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (q: AdminQuizQuestion) => {
    setEditingQuestion(q);
    setFormCode(q.code);
    setFormType(q.question_type);
    setFormCategory(q.category_id);
    setFormDifficulty(q.difficulty);
    setFormText(q.question_text);
    setFormExplanation(q.explanation);
    setFormSourceType(q.source_type);
    setFormSourceRef(q.source_reference || "");
    setFormImageUrl(q.image_url || "");
    setFormOptions(
      (q.options || []).map((opt) => ({
        option_key: opt.option_key,
        option_text: opt.option_text,
        is_correct: opt.is_correct === 1 || opt.is_correct === true,
      }))
    );
    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: QuestionType) => {
    setFormType(newType);
    if (newType === "true_false") {
      setFormOptions([
        { option_key: "A", option_text: "Đúng", is_correct: true },
        { option_key: "B", option_text: "Sai", is_correct: false },
      ]);
    } else if (formOptions.length < 4) {
      setFormOptions([
        { option_key: "A", option_text: "", is_correct: true },
        { option_key: "B", option_text: "", is_correct: false },
        { option_key: "C", option_text: "", is_correct: false },
        { option_key: "D", option_text: "", is_correct: false },
      ]);
    }
  };

  const setCorrectOption = (index: number) => {
    setFormOptions(
      formOptions.map((opt, idx) => ({
        ...opt,
        is_correct: idx === index,
      }))
    );
  };

  const updateOptionText = (index: number, text: string) => {
    setFormOptions(
      formOptions.map((opt, idx) => (idx === index ? { ...opt, option_text: text } : opt))
    );
  };

  const addOption = () => {
    if (formOptions.length >= 6) return;
    const keys = ["A", "B", "C", "D", "E", "F"];
    const nextKey = keys[formOptions.length] || String(formOptions.length + 1);
    setFormOptions([...formOptions, { option_key: nextKey, option_text: "", is_correct: false }]);
  };

  const removeOption = (index: number) => {
    if (formOptions.length <= 2) return;
    const remaining = formOptions.filter((_, idx) => idx !== index);
    if (!remaining.some((o) => o.is_correct)) {
      remaining[0].is_correct = true;
    }
    const keys = ["A", "B", "C", "D", "E", "F"];
    setFormOptions(remaining.map((o, idx) => ({ ...o, option_key: keys[idx] })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) {
      onNotify?.("error", "Vui lòng nhập nội dung câu hỏi");
      return;
    }
    if (!formExplanation.trim()) {
      onNotify?.("error", "Vui lòng nhập phần giải thích đáp án");
      return;
    }
    if (formOptions.some((o) => !o.option_text.trim())) {
      onNotify?.("error", "Vui lòng điền đầy đủ nội dung tất cả các phương án");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        code: formCode.trim() || undefined,
        question_type: formType,
        category_id: formCategory,
        difficulty: formDifficulty,
        question_text: formText.trim(),
        explanation: formExplanation.trim(),
        source_type: formSourceType,
        source_reference: formSourceRef.trim() || undefined,
        image_url: formImageUrl.trim() || undefined,
        options: formOptions.map((o) => ({
          option_key: o.option_key,
          option_text: o.option_text.trim(),
          is_correct: o.is_correct ? 1 : 0,
        })),
      };

      if (formSourceType === "place" && formSourceRef) {
        payload.related_place_id = formSourceRef;
      } else if (formSourceType === "article" && formSourceRef) {
        payload.related_article_id = formSourceRef;
      }

      if (editingQuestion) {
        await adminApi.updateQuizQuestion(editingQuestion.id, payload);
        onNotify?.("success", "Cập nhật câu hỏi thành công");
      } else {
        await adminApi.createQuizQuestion(payload);
        onNotify?.("success", "Tạo mới câu hỏi nháp thành công");
      }
      setIsModalOpen(false);
      loadQuestions();
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi lưu câu hỏi");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await adminApi.publishQuizQuestion(id);
      onNotify?.("success", "Đã xuất bản câu hỏi chính thức");
      loadQuestions();
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi xuất bản câu hỏi");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await adminApi.archiveQuizQuestion(id);
      onNotify?.("info", "Đã chuyển câu hỏi vào lưu trữ");
      loadQuestions();
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi lưu trữ câu hỏi");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await adminApi.restoreQuizQuestion(id);
      onNotify?.("success", "Đã khôi phục câu hỏi về trạng thái nháp");
      loadQuestions();
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi khôi phục câu hỏi");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await adminApi.duplicateQuizQuestion(id);
      onNotify?.("success", "Đã nhân bản câu hỏi thành công");
      loadQuestions();
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi nhân bản câu hỏi");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <span className="status-badge active">Đã xuất bản</span>;
      case "draft":
        return <span className="status-badge draft">Bản nháp</span>;
      case "archived":
        return <span className="status-badge inactive">Lưu trữ</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case "easy":
        return <span style={{ color: "#16a34a", fontWeight: 600 }}>Dễ</span>;
      case "medium":
        return <span style={{ color: "#d97706", fontWeight: 600 }}>Trung bình</span>;
      case "hard":
        return <span style={{ color: "#dc2626", fontWeight: 600 }}>Khó</span>;
      default:
        return <span>{diff}</span>;
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Ngân hàng câu hỏi Du lịch Đắk Song</h2>
          <p className="text-secondary" style={{ margin: "4px 0 0" }}>
            Quản lý, biên tập và kiểm định nguồn tư liệu câu hỏi trắc nghiệm du lịch ({total} câu)
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          + Thêm câu hỏi mới
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <input
            type="text"
            className="input"
            placeholder="Tìm theo nội dung / mã câu..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            style={{ width: 220 }}
          />

          <select
            className="input"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            style={{ width: 170 }}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setPage(1);
            }}
            style={{ width: 130 }}
          >
            <option value="">Độ khó</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>

          <select
            className="input"
            value={questionType}
            onChange={(e) => {
              setQuestionType(e.target.value);
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <option value="">Loại câu hỏi</option>
            <option value="single_choice">Trắc nghiệm</option>
            <option value="true_false">Đúng / Sai</option>
          </select>

          <select
            className="input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: 140 }}
          >
            <option value="">Trạng thái</option>
            <option value="published">Đã xuất bản</option>
            <option value="draft">Bản nháp</option>
            <option value="archived">Lưu trữ</option>
          </select>

          {(keyword || categoryId || difficulty || questionType || statusFilter) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setKeyword("");
                setCategoryId("");
                setDifficulty("");
                setQuestionType("");
                setStatusFilter("");
                setPage(1);
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Đang tải danh sách câu hỏi...</div>
        ) : questions.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
            Không tìm thấy câu hỏi nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Mã</th>
                  <th>Nội dung câu hỏi</th>
                  <th style={{ width: 140 }}>Danh mục</th>
                  <th style={{ width: 90 }}>Độ khó</th>
                  <th style={{ width: 110 }}>Loại</th>
                  <th style={{ width: 110 }}>Trạng thái</th>
                  <th style={{ width: 180, textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{q.code}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{q.question_text}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Nguồn: {q.source_type === "place" ? "Địa điểm: " + (q.related_place_name || q.related_place_id) : q.source_type === "article" ? "Bài viết: " + (q.related_article_title || q.related_article_id) : "Tư liệu địa phương"}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12 }}>{q.category_name || "Đắk Song"}</span>
                    </td>
                    <td>{getDifficultyBadge(q.difficulty)}</td>
                    <td>
                      <span style={{ fontSize: 12 }}>
                        {q.question_type === "single_choice" ? "Trắc nghiệm" : "Đúng / Sai"}
                      </span>
                    </td>
                    <td>{getStatusBadge(q.status)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(q)}
                        >
                          Sửa
                        </button>
                        {q.status === "draft" && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePublish(q.id)}
                          >
                            Duyệt
                          </button>
                        )}
                        {q.status === "published" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleArchive(q.id)}
                          >
                            Lưu trữ
                          </button>
                        )}
                        {q.status === "archived" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRestore(q.id)}
                          >
                            Khôi phục
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="Nhân bản câu hỏi"
                          onClick={() => handleDuplicate(q.id)}
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 15 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Hiển thị {(page - 1) * 15 + 1} - {Math.min(page * 15, total)} trên tổng số {total} câu
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Trước
              </button>
              <span style={{ padding: "4px 8px", fontSize: 12, fontWeight: 600 }}>{page}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page * 15 >= total}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 720, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal-header">
              <h3>{editingQuestion ? "Chỉnh sửa câu hỏi (" + editingQuestion.code + ")" : "Tạo mới câu hỏi du lịch"}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: 20, flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="label">Mã câu hỏi (tùy chọn)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="VD: QZ-001 (để trống sẽ tự sinh)"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Loại câu hỏi</label>
                  <select
                    className="input"
                    value={formType}
                    onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                  >
                    <option value="single_choice">Trắc nghiệm 1 đáp án</option>
                    <option value="true_false">Đúng / Sai</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="label">Danh mục du lịch *</label>
                  <select
                    className="input"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Độ khó *</label>
                  <select
                    className="input"
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as QuestionDifficulty)}
                    required
                  >
                    <option value="easy">Dễ (Dành cho đại chúng)</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó (Khám phá sâu)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label">Nội dung câu hỏi *</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Nhập nội dung câu hỏi về danh lam, văn hóa, ẩm thực Đắk Song..."
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  required
                />
              </div>

              {/* Options */}
              <div style={{ marginBottom: 16, background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label className="label" style={{ margin: 0 }}>
                    Phương án trả lời (chọn nút tròn cho đáp án đúng) *
                  </label>
                  {formType === "single_choice" && formOptions.length < 6 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addOption}>
                      + Thêm phương án
                    </button>
                  )}
                </div>

                {formOptions.map((opt, idx) => (
                  <div key={opt.option_key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <input
                      type="radio"
                      name="correct_option"
                      checked={opt.is_correct}
                      onChange={() => setCorrectOption(idx)}
                      title="Chọn làm đáp án đúng"
                      style={{ cursor: "pointer", width: 18, height: 18 }}
                    />
                    <span style={{ fontWeight: 700, width: 20 }}>{opt.option_key}.</span>
                    <input
                      type="text"
                      className="input"
                      placeholder={"Nội dung phương án " + opt.option_key + "..."}
                      value={opt.option_text}
                      onChange={(e) => updateOptionText(idx, e.target.value)}
                      required
                      style={{ flex: 1 }}
                    />
                    {formType === "single_choice" && formOptions.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => removeOption(idx)}
                        title="Xóa phương án này"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label">Giải thích chi tiết đáp án đúng *</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Giải thích nguồn gốc, ý nghĩa văn hóa hoặc đặc điểm du lịch..."
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="label">Loại nguồn tham chiếu</label>
                  <select
                    className="input"
                    value={formSourceType}
                    onChange={(e) => setFormSourceType(e.target.value as SourceType)}
                  >
                    <option value="manual">Tư liệu kiểm định</option>
                    <option value="place">Địa danh / Điểm đến</option>
                    <option value="article">Bài viết du lịch</option>
                  </select>
                </div>
                <div>
                  <label className="label">Mã ID hoặc ghi chú nguồn</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Mã địa điểm hoặc tài liệu xác thực..."
                    value={formSourceRef}
                    onChange={(e) => setFormSourceRef(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview */}
              <div style={{ marginTop: 20, padding: 16, background: "#ecfdf5", borderRadius: 8, border: "1px solid #a7f3d0" }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#065f46", marginBottom: 6, textTransform: "uppercase" }}>
                  Xem trước hiển thị du khách
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", marginBottom: 10 }}>
                  {formText || "Chưa nhập nội dung câu hỏi..."}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {formOptions.map((o) => (
                    <div
                      key={o.option_key}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: o.is_correct ? "2px solid #059669" : "1px solid #cbd5e1",
                        background: o.is_correct ? "#f0fdf4" : "#ffffff",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <strong style={{ color: o.is_correct ? "#059669" : "#64748b" }}>{o.option_key}.</strong>
                      <span>{o.option_text || "..."}</span>
                      {o.is_correct && <span style={{ marginLeft: "auto", fontSize: 11, color: "#059669", fontWeight: 700 }}>[Đáp án đúng]</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Đang lưu..." : editingQuestion ? "Lưu thay đổi" : "Lưu bản nháp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
