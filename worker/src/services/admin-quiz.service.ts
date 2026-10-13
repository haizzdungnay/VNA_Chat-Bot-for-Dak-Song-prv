import type {
  Env,
  QuestionType,
  QuestionDifficulty,
  QuestionStatus,
  SourceType,
  ChallengeStatus,
  QuizQuestionRow,
  QuizQuestionOptionRow,
  QuizCollectionRow,
  QuizChallengeRow,
  QuizCategoryRow,
} from "../types";

export interface CreateQuizQuestionInput {
  code?: string;
  question_type: QuestionType;
  category_id: string;
  difficulty: QuestionDifficulty;
  question_text: string;
  explanation: string;
  source_type: SourceType;
  source_reference?: string;
  related_place_id?: string;
  related_article_id?: string;
  image_url?: string;
  options: {
    option_key: string;
    option_text: string;
    is_correct: boolean | number;
    order_index?: number;
  }[];
}

export interface UpdateQuizQuestionInput extends Partial<CreateQuizQuestionInput> {}

export interface CreateQuizCollectionInput {
  title: string;
  description?: string;
  category_id?: string;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  selection_mode?: "manual" | "auto";
  question_ids?: string[];
  question_count?: number;
}

export interface CreateQuizChallengeInput {
  title: string;
  description?: string;
  business_date: string;
  collection_id: string;
  opening_time?: string;
  closing_time?: string;
  time_limit_seconds?: number;
  score_per_question?: number;
  max_attempts?: number;
  status?: ChallengeStatus;
}

function sanitizeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return '"' + str.replace(/"/g, '""') + '"';
}

export class AdminQuizService {
  private env: Env;
  constructor(env: Env) {
    this.env = env;
  }

  private async logAudit(action: string, actor: string, details?: any) {
    try {
      await this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          "log-" + crypto.randomUUID(),
          action,
          actor || "admin",
          details ? JSON.stringify(details) : null
        )
        .run();
    } catch (err) {
      console.error("[AdminQuizService] audit log error:", err);
    }
  }

  // --- CATEGORIES ---
  async listCategories(): Promise<QuizCategoryRow[]> {
    const res = await this.env.DB.prepare(
      `SELECT * FROM quiz_categories WHERE is_active = 1 ORDER BY name ASC`
    ).all<QuizCategoryRow>();
    return res.results || [];
  }

  // --- QUESTION BANK ---
  async listQuestions(filters: {
    keyword?: string;
    categoryId?: string;
    difficulty?: string;
    questionType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ questions: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (filters.keyword && filters.keyword.trim()) {
      whereClauses.push("(q.question_text LIKE ? OR q.code LIKE ?)");
      const term = `%${filters.keyword.trim()}%`;
      params.push(term, term);
    }

    if (filters.categoryId) {
      whereClauses.push("q.category_id = ?");
      params.push(filters.categoryId);
    }

    if (filters.difficulty) {
      whereClauses.push("q.difficulty = ?");
      params.push(filters.difficulty);
    }

    if (filters.questionType) {
      whereClauses.push("q.question_type = ?");
      params.push(filters.questionType);
    }

    if (filters.status) {
      whereClauses.push("q.status = ?");
      params.push(filters.status);
    }

    const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    const countRes = await this.env.DB.prepare(
      `SELECT count(*) as total FROM quiz_questions q ${whereSql}`
    )
      .bind(...params)
      .first<{ total: number }>();

    const total = countRes?.total || 0;

    const listRes = await this.env.DB.prepare(
      `SELECT q.*, c.name as category_name, c.slug as category_slug,
              p.name as related_place_name,
              a.title as related_article_title
       FROM quiz_questions q
       LEFT JOIN quiz_categories c ON q.category_id = c.id
       LEFT JOIN places p ON q.related_place_id = p.id
       LEFT JOIN articles a ON q.related_article_id = a.id
       ${whereSql}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(...params, limit, offset)
      .all<any>();

    const questions = listRes.results || [];

    if (questions.length > 0) {
      const qIds = questions.map((q) => q.id);
      const placeholders = qIds.map(() => "?").join(",");
      const optRes = await this.env.DB.prepare(
        `SELECT * FROM quiz_question_options WHERE question_id IN (${placeholders}) ORDER BY order_index ASC`
      )
        .bind(...qIds)
        .all<QuizQuestionOptionRow>();

      const optionsByQ = new Map<string, QuizQuestionOptionRow[]>();
      for (const opt of optRes.results || []) {
        if (!optionsByQ.has(opt.question_id)) optionsByQ.set(opt.question_id, []);
        optionsByQ.get(opt.question_id)!.push(opt);
      }

      for (const q of questions) {
        q.options = optionsByQ.get(q.id) || [];
      }
    }

    return { questions, total, page, limit };
  }

  async getQuestion(id: string): Promise<any | null> {
    const q = await this.env.DB.prepare(
      `SELECT q.*, c.name as category_name, c.slug as category_slug,
              p.name as related_place_name,
              a.title as related_article_title
       FROM quiz_questions q
       LEFT JOIN quiz_categories c ON q.category_id = c.id
       LEFT JOIN places p ON q.related_place_id = p.id
       LEFT JOIN articles a ON q.related_article_id = a.id
       WHERE q.id = ?`
    )
      .bind(id)
      .first<any>();

    if (!q) return null;

    const optRes = await this.env.DB.prepare(
      `SELECT * FROM quiz_question_options WHERE question_id = ? ORDER BY order_index ASC`
    )
      .bind(id)
      .all<QuizQuestionOptionRow>();

    q.options = optRes.results || [];
    return q;
  }

  private validateQuestionData(input: CreateQuizQuestionInput) {
    if (!input.question_text || typeof input.question_text !== "string" || input.question_text.trim().length < 3) {
      throw new Error("Nội dung câu hỏi không được để trống (tối thiểu 3 ký tự)");
    }
    if (input.question_text.length > 1000) {
      throw new Error("Nội dung câu hỏi vượt quá độ dài cho phép (tối đa 1000 ký tự)");
    }
    if (/<script/i.test(input.question_text)) {
      throw new Error("Nội dung câu hỏi chứa mã không an toàn (XSS)");
    }

    if (!["single_choice", "true_false"].includes(input.question_type)) {
      throw new Error("Loại câu hỏi không hợp lệ (hỗ trợ single_choice, true_false)");
    }

    if (!["easy", "medium", "hard"].includes(input.difficulty)) {
      throw new Error("Độ khó không hợp lệ (easy, medium, hard)");
    }

    if (!input.category_id) {
      throw new Error("Danh mục câu hỏi không được để trống");
    }

    if (!input.explanation || typeof input.explanation !== "string" || input.explanation.trim().length < 3) {
      throw new Error("Giải thích đáp án không được để trống");
    }
    if (input.explanation.length > 2000) {
      throw new Error("Giải thích đáp án vượt quá độ dài tối đa");
    }

    if (!["place", "article", "manual"].includes(input.source_type)) {
      throw new Error("Nguồn tham chiếu không hợp lệ (place, article, manual)");
    }

    if (input.source_type === "place" && !input.related_place_id) {
      throw new Error("Loại nguồn địa điểm yêu cầu chọn địa điểm du lịch cụ thể");
    }

    if (input.source_type === "article" && !input.related_article_id) {
      throw new Error("Loại nguồn bài viết yêu cầu chọn bài viết du lịch cụ thể");
    }

    if (input.image_url && !/^https?:\/\//i.test(input.image_url)) {
      throw new Error("Đường dẫn hình ảnh không hợp lệ (phải bắt đầu bằng http:// hoặc https://)");
    }

    if (!Array.isArray(input.options)) {
      throw new Error("Danh sách phương án trả lời không hợp lệ");
    }

    if (input.question_type === "single_choice" && (input.options.length < 2 || input.options.length > 6)) {
      throw new Error("Câu hỏi trắc nghiệm một lựa chọn cần từ 2 đến 6 phương án trả lời");
    }

    if (input.question_type === "true_false" && input.options.length !== 2) {
      throw new Error("Câu hỏi Đúng / Sai cần chính xác 2 phương án (Đúng / Sai)");
    }

    const textsSet = new Set<string>();
    let correctCount = 0;

    for (const opt of input.options) {
      if (!opt.option_text || !opt.option_text.trim()) {
        throw new Error("Nội dung phương án trả lời không được để trống");
      }
      const trimmed = opt.option_text.trim().toLowerCase();
      if (textsSet.has(trimmed)) {
        throw new Error("Các phương án trả lời không được trùng lặp nội dung");
      }
      textsSet.add(trimmed);

      if (opt.is_correct === true || opt.is_correct === 1) {
        correctCount++;
      }
    }

    if (correctCount !== 1) {
      throw new Error("Phải có chính xác 01 đáp án đúng cho mỗi câu hỏi");
    }
  }

  async createQuestion(input: CreateQuizQuestionInput, actor: string): Promise<any> {
    this.validateQuestionData(input);

    const cat = await this.env.DB.prepare(`SELECT id FROM quiz_categories WHERE id = ?`).bind(input.category_id).first();
    if (!cat) throw new Error("Danh mục câu hỏi không tồn tại");

    if (input.related_place_id) {
      const p = await this.env.DB.prepare(`SELECT id FROM places WHERE id = ?`).bind(input.related_place_id).first();
      if (!p) throw new Error("Địa điểm liên kết không tồn tại");
    }
    if (input.related_article_id) {
      const a = await this.env.DB.prepare(`SELECT id FROM articles WHERE id = ?`).bind(input.related_article_id).first();
      if (!a) throw new Error("Bài viết liên kết không tồn tại");
    }

    const id = "qz-q-" + crypto.randomUUID().slice(0, 8);
    const code = input.code?.trim() || "QZ-" + Math.floor(1000 + Math.random() * 9000);

    const stmts: any[] = [];

    stmts.push(
      this.env.DB.prepare(
        `INSERT INTO quiz_questions (
          id, code, question_type, category_id, difficulty, question_text,
          explanation, source_type, source_reference, related_place_id, related_article_id,
          image_url, status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, datetime('now'), datetime('now'))`
      ).bind(
        id,
        code,
        input.question_type,
        input.category_id,
        input.difficulty,
        input.question_text.trim(),
        input.explanation.trim(),
        input.source_type,
        input.source_reference || null,
        input.related_place_id || null,
        input.related_article_id || null,
        input.image_url || null
      )
    );

    const keys = ["A", "B", "C", "D", "E", "F"];
    input.options.forEach((opt, idx) => {
      const optId = `qz-opt-${id}-${idx + 1}`;
      const optKey = opt.option_key || keys[idx] || String(idx + 1);
      const isCorrect = opt.is_correct === true || opt.is_correct === 1 ? 1 : 0;
      stmts.push(
        this.env.DB.prepare(
          `INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(optId, id, optKey, opt.option_text.trim(), isCorrect, idx + 1)
      );
    });

    await this.env.DB.batch(stmts);
    await this.logAudit("create_quiz_question", actor, { questionId: id, code });

    return await this.getQuestion(id);
  }

  async updateQuestion(id: string, input: UpdateQuizQuestionInput, actor: string): Promise<any> {
    const existing = await this.getQuestion(id);
    if (!existing) throw new Error("Câu hỏi không tồn tại");

    if (existing.status === "archived") {
      throw new Error("Không thể cập nhật câu hỏi đã lưu trữ. Vui lòng khôi phục về nháp trước.");
    }

    const mergedInput: CreateQuizQuestionInput = {
      code: input.code !== undefined ? input.code : existing.code,
      question_type: input.question_type || existing.question_type,
      category_id: input.category_id || existing.category_id,
      difficulty: input.difficulty || existing.difficulty,
      question_text: input.question_text !== undefined ? input.question_text : existing.question_text,
      explanation: input.explanation !== undefined ? input.explanation : existing.explanation,
      source_type: input.source_type || existing.source_type,
      source_reference: input.source_reference !== undefined ? input.source_reference : existing.source_reference,
      related_place_id: input.related_place_id !== undefined ? input.related_place_id : existing.related_place_id,
      related_article_id: input.related_article_id !== undefined ? input.related_article_id : existing.related_article_id,
      image_url: input.image_url !== undefined ? input.image_url : existing.image_url,
      options: input.options || existing.options,
    };

    this.validateQuestionData(mergedInput);

    const stmts: any[] = [];

    stmts.push(
      this.env.DB.prepare(
        `UPDATE quiz_questions
         SET code = ?, question_type = ?, category_id = ?, difficulty = ?,
             question_text = ?, explanation = ?, source_type = ?, source_reference = ?,
             related_place_id = ?, related_article_id = ?, image_url = ?,
             version = version + 1, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(
        mergedInput.code,
        mergedInput.question_type,
        mergedInput.category_id,
        mergedInput.difficulty,
        mergedInput.question_text.trim(),
        mergedInput.explanation.trim(),
        mergedInput.source_type,
        mergedInput.source_reference || null,
        mergedInput.related_place_id || null,
        mergedInput.related_article_id || null,
        mergedInput.image_url || null,
        id
      )
    );

    stmts.push(this.env.DB.prepare(`DELETE FROM quiz_question_options WHERE question_id = ?`).bind(id));

    const keys = ["A", "B", "C", "D", "E", "F"];
    mergedInput.options.forEach((opt, idx) => {
      const optId = `qz-opt-${id}-${idx + 1}-${Date.now().toString().slice(-4)}`;
      const optKey = opt.option_key || keys[idx] || String(idx + 1);
      const isCorrect = opt.is_correct === true || opt.is_correct === 1 ? 1 : 0;
      stmts.push(
        this.env.DB.prepare(
          `INSERT INTO quiz_question_options (id, question_id, option_key, option_text, is_correct, order_index, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(optId, id, optKey, opt.option_text.trim(), isCorrect, idx + 1)
      );
    });

    await this.env.DB.batch(stmts);
    await this.logAudit("update_quiz_question", actor, { questionId: id, code: mergedInput.code });

    return await this.getQuestion(id);
  }

  async publishQuestion(id: string, actor: string): Promise<any> {
    const q = await this.getQuestion(id);
    if (!q) throw new Error("Câu hỏi không tồn tại");

    if (q.status === "published") {
      return q;
    }

    if (!q.options || q.options.length < 2) {
      throw new Error("Không thể xuất bản câu hỏi chưa đủ phương án trả lời");
    }

    const hasCorrect = q.options.some((o: any) => o.is_correct === 1);
    if (!hasCorrect) {
      throw new Error("Không thể xuất bản câu hỏi chưa có đáp án đúng");
    }

    await this.env.DB.prepare(
      `UPDATE quiz_questions SET status = 'published', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(id)
      .run();

    await this.logAudit("publish_quiz_question", actor, { questionId: id, code: q.code });
    return await this.getQuestion(id);
  }

  async archiveQuestion(id: string, actor: string): Promise<any> {
    const q = await this.getQuestion(id);
    if (!q) throw new Error("Câu hỏi không tồn tại");

    await this.env.DB.prepare(
      `UPDATE quiz_questions SET status = 'archived', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(id)
      .run();

    await this.logAudit("archive_quiz_question", actor, { questionId: id, code: q.code });
    return await this.getQuestion(id);
  }

  async restoreQuestion(id: string, actor: string): Promise<any> {
    const q = await this.getQuestion(id);
    if (!q) throw new Error("Câu hỏi không tồn tại");

    await this.env.DB.prepare(
      `UPDATE quiz_questions SET status = 'draft', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(id)
      .run();

    await this.logAudit("restore_quiz_question", actor, { questionId: id, code: q.code });
    return await this.getQuestion(id);
  }

  async duplicateQuestion(id: string, actor: string): Promise<any> {
    const q = await this.getQuestion(id);
    if (!q) throw new Error("Câu hỏi gốc không tồn tại");

    const newCode = `${q.code}-COPY-${Math.floor(100 + Math.random() * 900)}`;
    const clonedInput: CreateQuizQuestionInput = {
      code: newCode,
      question_type: q.question_type,
      category_id: q.category_id,
      difficulty: q.difficulty,
      question_text: `[Bản sao] ${q.question_text}`,
      explanation: q.explanation,
      source_type: q.source_type,
      source_reference: q.source_reference,
      related_place_id: q.related_place_id,
      related_article_id: q.related_article_id,
      image_url: q.image_url,
      options: q.options.map((opt: any) => ({
        option_key: opt.option_key,
        option_text: opt.option_text,
        is_correct: opt.is_correct === 1,
        order_index: opt.order_index,
      })),
    };

    return await this.createQuestion(clonedInput, actor);
  }

  // --- COLLECTIONS ---
  async listCollections(): Promise<QuizCollectionRow[]> {
    const res = await this.env.DB.prepare(
      `SELECT c.*, cat.name as category_name
       FROM quiz_collections c
       LEFT JOIN quiz_categories cat ON c.category_id = cat.id
       ORDER BY c.created_at DESC`
    ).all<QuizCollectionRow>();
    return res.results || [];
  }

  async getCollection(id: string): Promise<any | null> {
    const col = await this.env.DB.prepare(
      `SELECT c.*, cat.name as category_name
       FROM quiz_collections c
       LEFT JOIN quiz_categories cat ON c.category_id = cat.id
       WHERE c.id = ?`
    )
      .bind(id)
      .first<any>();

    if (!col) return null;

    const qRes = await this.env.DB.prepare(
      `SELECT q.*, cq.order_index as collection_order
       FROM quiz_collection_questions cq
       JOIN quiz_questions q ON cq.question_id = q.id
       WHERE cq.collection_id = ?
       ORDER BY cq.order_index ASC`
    )
      .bind(id)
      .all<any>();

    col.questions = qRes.results || [];
    return col;
  }

  async createCollection(input: CreateQuizCollectionInput, actor: string): Promise<any> {
    if (!input.title || !input.title.trim()) {
      throw new Error("Tiêu đề bộ đề không được để trống");
    }

    const id = "col-" + crypto.randomUUID().slice(0, 8);
    const mode = input.selection_mode || "manual";
    let questionIds: string[] = [];

    if (mode === "manual") {
      if (!Array.isArray(input.question_ids) || input.question_ids.length === 0) {
        throw new Error("Chế độ thủ công yêu cầu chọn ít nhất 01 câu hỏi");
      }
      questionIds = input.question_ids;
      const placeholders = questionIds.map(() => "?").join(",");
      const checkRes = await this.env.DB.prepare(
        `SELECT id, status FROM quiz_questions WHERE id IN (${placeholders})`
      )
        .bind(...questionIds)
        .all<any>();

      const found = checkRes.results || [];
      if (found.length !== questionIds.length) {
        throw new Error("Một số câu hỏi được chọn không tồn tại");
      }
      const unpublished = found.filter((q) => q.status !== "published");
      if (unpublished.length > 0) {
        throw new Error("Tất cả câu hỏi trong bộ đề phải ở trạng thái đã xuất bản (published)");
      }
    } else {
      const count = Math.max(1, Math.min(50, input.question_count || 5));
      let where = ["status = 'published'"];
      let params: any[] = [];
      if (input.category_id) {
        where.push("category_id = ?");
        params.push(input.category_id);
      }
      if (input.difficulty && input.difficulty !== "mixed") {
        where.push("difficulty = ?");
        params.push(input.difficulty);
      }
      const autoRes = await this.env.DB.prepare(
        `SELECT id FROM quiz_questions WHERE ${where.join(" AND ")} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(...params, count)
        .all<any>();

      const autoFound = autoRes.results || [];
      if (autoFound.length === 0) {
        throw new Error("Không có câu hỏi đã xuất bản nào phù hợp với bộ lọc tự động");
      }
      questionIds = autoFound.map((q) => q.id);
    }

    const stmts: any[] = [];
    stmts.push(
      this.env.DB.prepare(
        `INSERT INTO quiz_collections (id, title, description, category_id, difficulty, selection_mode, question_count, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'))`
      ).bind(
        id,
        input.title.trim(),
        input.description || null,
        input.category_id || null,
        input.difficulty || "mixed",
        mode,
        questionIds.length
      )
    );

    questionIds.forEach((qId, idx) => {
      stmts.push(
        this.env.DB.prepare(
          `INSERT INTO quiz_collection_questions (id, collection_id, question_id, order_index, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`
        ).bind(`cq-${id}-${idx + 1}`, id, qId, idx + 1)
      );
    });

    await this.env.DB.batch(stmts);
    await this.logAudit("create_quiz_collection", actor, { collectionId: id, title: input.title });

    return await this.getCollection(id);
  }

  // --- CHALLENGES ---
  async listChallenges(): Promise<QuizChallengeRow[]> {
    const res = await this.env.DB.prepare(
      `SELECT ch.*, col.title as collection_title, col.question_count
       FROM quiz_challenges ch
       LEFT JOIN quiz_collections col ON ch.collection_id = col.id
       ORDER BY ch.business_date DESC`
    ).all<QuizChallengeRow>();
    return res.results || [];
  }

  async getChallenge(id: string): Promise<any | null> {
    const ch = await this.env.DB.prepare(
      `SELECT ch.*, col.title as collection_title, col.question_count
       FROM quiz_challenges ch
       LEFT JOIN quiz_collections col ON ch.collection_id = col.id
       WHERE ch.id = ?`
    )
      .bind(id)
      .first<any>();

    if (!ch) return null;
    ch.collection = await this.getCollection(ch.collection_id);
    return ch;
  }

  async createChallenge(input: CreateQuizChallengeInput, actor: string): Promise<any> {
    if (!input.title || !input.title.trim()) {
      throw new Error("Tiêu đề thử thách không được để trống");
    }
    if (!input.business_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.business_date)) {
      throw new Error("Ngày áp dụng thử thách không hợp lệ (định dạng YYYY-MM-DD)");
    }
    if (!input.collection_id) {
      throw new Error("Bộ đề câu hỏi không được để trống");
    }

    const col = await this.getCollection(input.collection_id);
    if (!col) throw new Error("Bộ đề được chọn không tồn tại");
    if (!col.questions || col.questions.length === 0) {
      throw new Error("Bộ đề được chọn không có câu hỏi nào");
    }

    const existing = await this.env.DB.prepare(
      `SELECT id FROM quiz_challenges WHERE business_date = ?`
    )
      .bind(input.business_date)
      .first();

    if (existing) {
      throw new Error(`Đã tồn tại thử thách ngày ${input.business_date}. Mỗi ngày chỉ có 01 thử thách chính thức.`);
    }

    const id = "ch-" + input.business_date;
    const openingTime = input.opening_time || "00:00:00";
    const closingTime = input.closing_time || "23:59:59";
    const timeLimit = Math.max(0, input.time_limit_seconds || 300);
    const scorePerQ = Math.max(1, input.score_per_question || 10);
    const status = input.status || "active";

    await this.env.DB.prepare(
      `INSERT INTO quiz_challenges (
        id, title, description, business_date, collection_id, opening_time, closing_time,
        time_limit_seconds, score_per_question, max_attempts, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
    )
      .bind(
        id,
        input.title.trim(),
        input.description || null,
        input.business_date,
        input.collection_id,
        openingTime,
        closingTime,
        timeLimit,
        scorePerQ,
        status
      )
      .run();

    await this.logAudit("create_quiz_challenge", actor, { challengeId: id, businessDate: input.business_date });
    return await this.getChallenge(id);
  }

  async publishChallenge(id: string, actor: string): Promise<any> {
    const ch = await this.getChallenge(id);
    if (!ch) throw new Error("Thử thách không tồn tại");

    await this.env.DB.prepare(
      `UPDATE quiz_challenges SET status = 'active', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(id)
      .run();

    await this.logAudit("publish_quiz_challenge", actor, { challengeId: id, businessDate: ch.business_date });
    return await this.getChallenge(id);
  }

  async closeChallenge(id: string, actor: string): Promise<any> {
    const ch = await this.getChallenge(id);
    if (!ch) throw new Error("Thử thách không tồn tại");

    await this.env.DB.prepare(
      `UPDATE quiz_challenges SET status = 'closed', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(id)
      .run();

    await this.logAudit("close_quiz_challenge", actor, { challengeId: id });
    return await this.getChallenge(id);
  }

  // --- ANALYTICS ---
  async getAnalytics(dateFilter?: { startDate?: string; endDate?: string }): Promise<any> {
    const qCounts = await this.env.DB.prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
         SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
       FROM quiz_questions`
    ).first<any>();

    const chCount = await this.env.DB.prepare(
      `SELECT COUNT(*) as active FROM quiz_challenges WHERE status IN ('active', 'scheduled')`
    ).first<any>();

    let attemptWhere: string[] = [];
    let attemptParams: any[] = [];
    if (dateFilter?.startDate) {
      attemptWhere.push("started_at >= ?");
      attemptParams.push(dateFilter.startDate);
    }
    if (dateFilter?.endDate) {
      attemptWhere.push("started_at <= ?");
      attemptParams.push(dateFilter.endDate + " 23:59:59");
    }
    const whereSql = attemptWhere.length > 0 ? "WHERE " + attemptWhere.join(" AND ") : "";

    const attStats = await this.env.DB.prepare(
      `SELECT
         COUNT(*) as total_attempts,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_attempts,
         COUNT(DISTINCT user_id) as unique_participants,
         AVG(CASE WHEN status = 'completed' THEN score ELSE NULL END) as avg_score,
         SUM(correct_count) as total_correct,
         SUM(incorrect_count) as total_incorrect
       FROM quiz_attempts ${whereSql}`
    )
      .bind(...attemptParams)
      .first<any>();

    const totalAttempts = attStats?.total_attempts || 0;
    const completedAttempts = attStats?.completed_attempts || 0;
    const uniqueParticipants = attStats?.unique_participants || 0;
    const avgScore = Math.round((attStats?.avg_score || 0) * 10) / 10;
    const totalCorrect = attStats?.total_correct || 0;
    const totalIncorrect = attStats?.total_incorrect || 0;
    const totalAnswered = totalCorrect + totalIncorrect;
    const accuracyRate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 1000) / 10 : 0;
    const completionRate = totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 1000) / 10 : 0;

    const qualityRes = await this.env.DB.prepare(
      `SELECT
         q.id, q.code, q.question_text, q.difficulty, q.status,
         c.name as category_name,
         COUNT(a.id) as attempts_count,
         SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
         SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END) as incorrect_count
       FROM quiz_questions q
       LEFT JOIN quiz_attempt_answers a ON q.id = a.question_id
       LEFT JOIN quiz_categories c ON q.category_id = c.id
       GROUP BY q.id
       ORDER BY incorrect_count DESC, attempts_count DESC
       LIMIT 10`
    ).all<any>();

    const questionQuality = (qualityRes.results || []).map((row) => {
      const att = row.attempts_count || 0;
      const cor = row.correct_count || 0;
      const rate = att > 0 ? Math.round((cor / att) * 1000) / 10 : 0;
      return {
        id: row.id,
        code: row.code,
        questionText: row.question_text,
        categoryName: row.category_name,
        difficulty: row.difficulty,
        status: row.status,
        attemptsCount: att,
        correctCount: cor,
        incorrectCount: row.incorrect_count || 0,
        accuracyRate: rate,
      };
    });

    const dailyRes = await this.env.DB.prepare(
      `SELECT
         SUBSTR(started_at, 1, 10) as date,
         COUNT(*) as attempts_count,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
         AVG(CASE WHEN status = 'completed' THEN score ELSE 0 END) as avg_score
       FROM quiz_attempts
       GROUP BY SUBSTR(started_at, 1, 10)
       ORDER BY date DESC
       LIMIT 14`
    ).all<any>();

    const dailyTrends = (dailyRes.results || []).reverse().map((r) => ({
      date: r.date,
      attemptsCount: r.attempts_count,
      completedCount: r.completed_count,
      avgScore: Math.round((r.avg_score || 0) * 10) / 10,
    }));

    return {
      kpis: {
        totalPublishedQuestions: qCounts?.published || 0,
        draftQuestions: qCounts?.draft || 0,
        archivedQuestions: qCounts?.archived || 0,
        activeChallenges: chCount?.active || 0,
        totalAttempts,
        completedAttempts,
        uniqueParticipants,
        averageScore: avgScore,
        accuracyRate,
        completionRate,
      },
      questionQuality,
      dailyTrends,
    };
  }

  async listAttempts(filters: { challengeId?: string; status?: string; page?: number; limit?: number }): Promise<any> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let where: string[] = [];
    let params: any[] = [];
    if (filters.challengeId) {
      where.push("a.challenge_id = ?");
      params.push(filters.challengeId);
    }
    if (filters.status) {
      where.push("a.status = ?");
      params.push(filters.status);
    }
    const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

    const countRes = await this.env.DB.prepare(`SELECT COUNT(*) as total FROM quiz_attempts a ${whereSql}`)
      .bind(...params)
      .first<any>();

    const total = countRes?.total || 0;

    const listRes = await this.env.DB.prepare(
      `SELECT a.*, u.display_name, u.email, ch.title as challenge_title, col.title as collection_title
       FROM quiz_attempts a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN quiz_challenges ch ON a.challenge_id = ch.id
       LEFT JOIN quiz_collections col ON a.collection_id = col.id
       ${whereSql}
       ORDER BY a.started_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(...params, limit, offset)
      .all<any>();

    return { attempts: listRes.results || [], total, page, limit };
  }

  async exportAnalyticsCsv(): Promise<string> {
    const analytics = await this.getAnalytics();
    const rows: string[] = [];

    rows.push("BÁO CÁO THỐNG KÊ QUIZ DU LỊCH ĐẮK SONG");
    rows.push("");
    rows.push("1. CHỈ SỐ HOẠT ĐỘNG CHUNG (KPIs)");
    rows.push("Chỉ số,Giá trị");
    rows.push(`${sanitizeCsv("Tổng câu hỏi đã xuất bản")},${analytics.kpis.totalPublishedQuestions}`);
    rows.push(`${sanitizeCsv("Câu hỏi chờ duyệt (nháp)")},${analytics.kpis.draftQuestions}`);
    rows.push(`${sanitizeCsv("Thử thách đang mở")},${analytics.kpis.activeChallenges}`);
    rows.push(`${sanitizeCsv("Tổng lượt tham gia")},${analytics.kpis.totalAttempts}`);
    rows.push(`${sanitizeCsv("Lượt hoàn thành")},${analytics.kpis.completedAttempts}`);
    rows.push(`${sanitizeCsv("Người tham gia duy nhất")},${analytics.kpis.uniqueParticipants}`);
    rows.push(`${sanitizeCsv("Điểm trung bình")},${analytics.kpis.averageScore}`);
    rows.push(`${sanitizeCsv("Tỷ lệ trả lời đúng (%)")},${analytics.kpis.accuracyRate}%`);
    rows.push(`${sanitizeCsv("Tỷ lệ hoàn thành (%)")},${analytics.kpis.completionRate}%`);
    rows.push("");

    rows.push("2. PHÂN TÍCH CHẤT LƯỢNG CÂU HỎI (CÂU HỎI SAI NHIỀU NHẤT)");
    rows.push("Mã câu hỏi,Nội dung câu hỏi,Danh mục,Độ khó,Lượt làm,Lượt đúng,Lượt sai,Tỷ lệ đúng (%)");

    for (const q of analytics.questionQuality) {
      rows.push(
        [
          sanitizeCsv(q.code),
          sanitizeCsv(q.questionText),
          sanitizeCsv(q.categoryName),
          sanitizeCsv(q.difficulty),
          q.attemptsCount,
          q.correctCount,
          q.incorrectCount,
          `${q.accuracyRate}%`,
        ].join(",")
      );
    }

    return "\uFEFF" + rows.join("\r\n");
  }
}
