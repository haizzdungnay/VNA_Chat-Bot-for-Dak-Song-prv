import type {
  Env,
  QuizCategoryRow,
  QuizCollectionRow,
  QuizChallengeRow,
  QuizQuestionOptionRow,
  QuizAttemptRow,
  QuizAttemptQuestionRow,
  QuizAttemptAnswerRow,
  QuizUserStatsRow,
  AttemptType,
} from "../types";

export interface StartAttemptInput {
  attemptType: AttemptType;
  challengeId?: string;
  collectionId?: string;
  categoryId?: string;
  difficulty?: string;
  questionCount?: number;
}

export interface SubmitAnswerInput {
  attemptQuestionId: string;
  selectedOptionId: string;
}

export interface VietnamDateTime {
  dateStr: string;
  timeStr: string;
}

export function getVietnamDateTime(nowDate = new Date()): VietnamDateTime {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(nowDate);
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    const dateStr = `${m.year}-${m.month}-${m.day}`;
    const hour = m.hour === "24" ? "00" : m.hour;
    const timeStr = `${hour}:${m.minute}:${m.second}`;
    return { dateStr, timeStr };
  } catch {
    const iso = nowDate.toISOString();
    return { dateStr: iso.slice(0, 10), timeStr: iso.slice(11, 19) };
  }
}

export function normalizeTimeString(timeStr?: string, defaultTime = "00:00:00"): string {
  if (!timeStr || typeof timeStr !== "string") return defaultTime;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return defaultTime;
  const h = match[1].padStart(2, "0");
  const m = match[2];
  const s = match[3] ? match[3] : "00";
  return `${h}:${m}:${s}`;
}

export type ChallengeEffectiveStatus = "draft" | "scheduled" | "active" | "closed" | "archived";

export function evaluateChallengeSchedule(
  challenge: {
    status: string;
    business_date: string;
    opening_time?: string;
    closing_time?: string;
  },
  vnNow: VietnamDateTime
): {
  effectiveStatus: ChallengeEffectiveStatus;
  isOpen: boolean;
  reason?: string;
} {
  if (challenge.status === "draft" || challenge.status === "archived") {
    return {
      effectiveStatus: challenge.status as ChallengeEffectiveStatus,
      isOpen: false,
      reason: "Thử thách chưa được mở hoặc đã lưu trữ.",
    };
  }

  if (challenge.status === "closed") {
    return {
      effectiveStatus: "closed",
      isOpen: false,
      reason: "Thử thách đã đóng.",
    };
  }

  if (vnNow.dateStr < challenge.business_date) {
    return {
      effectiveStatus: "scheduled",
      isOpen: false,
      reason: `Thử thách chưa đến ngày tổ chức (Ngày mở: ${challenge.business_date}).`,
    };
  }

  if (vnNow.dateStr > challenge.business_date) {
    return {
      effectiveStatus: "closed",
      isOpen: false,
      reason: `Thử thách đã kết thúc ngày ${challenge.business_date}.`,
    };
  }

  const openTime = normalizeTimeString(challenge.opening_time, "00:00:00");
  const closeTime = normalizeTimeString(challenge.closing_time, "23:59:59");

  if (vnNow.timeStr < openTime) {
    return {
      effectiveStatus: "scheduled",
      isOpen: false,
      reason: `Thử thách chưa mở (Thời gian mở: ${openTime}).`,
    };
  }

  if (vnNow.timeStr > closeTime) {
    return {
      effectiveStatus: "closed",
      isOpen: false,
      reason: `Thử thách đã đóng cửa lúc ${closeTime}.`,
    };
  }

  return {
    effectiveStatus: "active",
    isOpen: true,
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export class QuizService {
  private env: Env;
  constructor(env: Env) {
    this.env = env;
  }

  async listCategories(): Promise<QuizCategoryRow[]> {
    const res = await this.env.DB.prepare(
      `SELECT * FROM quiz_categories WHERE is_active = 1 ORDER BY name ASC`
    ).all<QuizCategoryRow>();
    return res.results || [];
  }

  async listCollections(): Promise<QuizCollectionRow[]> {
    const res = await this.env.DB.prepare(
      `SELECT c.*, cat.name as category_name
       FROM quiz_collections c
       LEFT JOIN quiz_categories cat ON c.category_id = cat.id
       WHERE c.status = 'published'
       ORDER BY c.created_at DESC`
    ).all<QuizCollectionRow>();
    return res.results || [];
  }

  async getDailyChallenge(userId?: string): Promise<any | null> {
    const vnNow = getVietnamDateTime();
    const ch = await this.env.DB.prepare(
      `SELECT ch.*, col.title as collection_title, col.question_count
       FROM quiz_challenges ch
       LEFT JOIN quiz_collections col ON ch.collection_id = col.id
       WHERE ch.business_date = ?`
    )
      .bind(vnNow.dateStr)
      .first<any>();

    if (!ch) return null;

    const schedule = evaluateChallengeSchedule(ch, vnNow);

    let hasAttempted = false;
    let existingAttempt: any = null;

    if (userId) {
      existingAttempt = await this.env.DB.prepare(
        `SELECT * FROM quiz_attempts
         WHERE user_id = ? AND (challenge_id = ? OR (business_date = ? AND attempt_type = 'daily_challenge'))`
      )
        .bind(userId, ch.id, vnNow.dateStr)
        .first();

      if (existingAttempt) {
        hasAttempted = true;
      }
    }

    return {
      id: ch.id,
      title: ch.title,
      description: ch.description,
      businessDate: ch.business_date,
      openingTime: ch.opening_time,
      closingTime: ch.closing_time,
      timeLimitSeconds: ch.time_limit_seconds,
      scorePerQuestion: ch.score_per_question,
      questionCount: ch.question_count,
      status: ch.status,
      effectiveStatus: schedule.effectiveStatus,
      isOpen: schedule.isOpen,
      reason: schedule.reason,
      hasAttempted,
      attemptStatus: existingAttempt?.status || null,
      attemptId: existingAttempt?.id || null,
      score: (existingAttempt?.status === "completed") ? existingAttempt.score : null,
      maxScore: existingAttempt?.max_score || ((ch.question_count || 0) * (ch.score_per_question || 10)),
    };
  }

  async startAttempt(userId: string, input: StartAttemptInput): Promise<any> {
    if (!userId) throw new Error("Yêu cầu đăng nhập để tham gia Quiz");

    const attemptType = input.attemptType || "practice";
    let challengeId: string | null = null;
    let collectionId: string | null = null;
    let businessDate: string | null = null;
    let timeLimitSeconds = 0;
    let scorePerQuestion = 10;
    let questionsToSnapshot: any[] = [];

    if (attemptType === "daily_challenge") {
      if (!input.challengeId) throw new Error("Mã thử thách hàng ngày không được để trống");
      const vnNow = getVietnamDateTime();

      const ch = await this.env.DB.prepare(
        `SELECT * FROM quiz_challenges WHERE id = ?`
      )
        .bind(input.challengeId)
        .first<QuizChallengeRow>();

      if (!ch) throw new Error("Thử thách hàng ngày không tồn tại");

      const schedule = evaluateChallengeSchedule(ch, vnNow);
      if (!schedule.isOpen) {
        const err: any = new Error(schedule.reason || "Thử thách hiện không mở");
        err.statusCode = 400;
        throw err;
      }

      // Check existing attempt for user
      const existing = await this.env.DB.prepare(
        `SELECT id, status FROM quiz_attempts
         WHERE user_id = ? AND (challenge_id = ? OR (business_date = ? AND attempt_type = 'daily_challenge'))`
      )
        .bind(userId, ch.id, ch.business_date)
        .first();

      if (existing) {
        const err: any = new Error("Bạn đã mở lượt thi thử thách của ngày hôm nay rồi");
        err.statusCode = 409;
        throw err;
      }

      challengeId = ch.id;
      collectionId = ch.collection_id;
      businessDate = ch.business_date;
      timeLimitSeconds = ch.time_limit_seconds || 0;
      scorePerQuestion = (Number.isSafeInteger(ch.score_per_question) && ch.score_per_question > 0)
        ? ch.score_per_question
        : 10;

      // Fetch questions from collection
      const qRes = await this.env.DB.prepare(
        `SELECT q.*, c.name as category_name
         FROM quiz_collection_questions cq
         JOIN quiz_questions q ON cq.question_id = q.id
         LEFT JOIN quiz_categories c ON q.category_id = c.id
         WHERE cq.collection_id = ? AND q.status = 'published'
         ORDER BY cq.order_index ASC`
      )
        .bind(collectionId)
        .all<any>();

      questionsToSnapshot = qRes.results || [];
      if (questionsToSnapshot.length === 0) {
        throw new Error("Thử thách chưa có câu hỏi nào sẵn sàng");
      }
    } else {
      // Practice mode
      scorePerQuestion = 10;

      if (input.collectionId) {
        collectionId = input.collectionId;
        const qRes = await this.env.DB.prepare(
          `SELECT q.*, c.name as category_name
           FROM quiz_collection_questions cq
           JOIN quiz_questions q ON cq.question_id = q.id
           LEFT JOIN quiz_categories c ON q.category_id = c.id
           WHERE cq.collection_id = ? AND q.status = 'published'
           ORDER BY cq.order_index ASC`
        )
          .bind(collectionId)
          .all<any>();
        questionsToSnapshot = qRes.results || [];
      } else {
        let where = ["q.status = 'published'"];
        let params: any[] = [];
        if (input.categoryId) {
          where.push("q.category_id = ?");
          params.push(input.categoryId);
        }
        if (input.difficulty) {
          where.push("q.difficulty = ?");
          params.push(input.difficulty);
        }
        const count = Math.min(20, Math.max(1, input.questionCount || 5));

        const qRes = await this.env.DB.prepare(
          `SELECT q.*, c.name as category_name
           FROM quiz_questions q
           LEFT JOIN quiz_categories c ON q.category_id = c.id
           WHERE ${where.join(" AND ")}
           ORDER BY RANDOM()
           LIMIT ?`
        )
          .bind(...params, count)
          .all<any>();
        questionsToSnapshot = qRes.results || [];
      }

      if (questionsToSnapshot.length === 0) {
        throw new Error("Không tìm thấy câu hỏi phù hợp với bộ lọc");
      }
    }

    const attemptId = "qz-att-" + crypto.randomUUID();
    const expiresAt = timeLimitSeconds > 0 ? new Date(Date.now() + timeLimitSeconds * 1000).toISOString() : null;
    const maxScore = questionsToSnapshot.length * scorePerQuestion;

    // Fetch options for all questions
    const qIds = questionsToSnapshot.map((q) => q.id);
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

    const stmts: any[] = [];

    // 1. Insert attempt with score_per_question snapshot
    stmts.push(
      this.env.DB.prepare(
        `INSERT INTO quiz_attempts (
          id, user_id, challenge_id, collection_id, attempt_type, business_date,
          total_questions, score_per_question, max_score, status, started_at, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', datetime('now'), ?, datetime('now'), datetime('now'))`
      ).bind(
        attemptId,
        userId,
        challengeId,
        collectionId,
        attemptType,
        businessDate,
        questionsToSnapshot.length,
        scorePerQuestion,
        maxScore,
        expiresAt
      )
    );

    // 2. Insert attempt questions (snapshots with shuffled options)
    const clientQuestions: any[] = [];
    const keys = ["A", "B", "C", "D", "E", "F"];

    questionsToSnapshot.forEach((q, idx) => {
      const attQId = `att-q-${attemptId}-${idx + 1}`;
      const rawOpts = optionsByQ.get(q.id) || [];
      const correctOpt = rawOpts.find((o) => o.is_correct === 1);
      if (!correctOpt) {
        throw new Error(`Câu hỏi ${q.code} thiếu đáp án đúng`);
      }

      const shuffledOpts = shuffleArray(rawOpts);
      const safeOpts = shuffledOpts.map((opt, oIdx) => ({
        id: opt.id,
        key: keys[oIdx] || String(oIdx + 1),
        text: opt.option_text,
      }));

      stmts.push(
        this.env.DB.prepare(
          `INSERT INTO quiz_attempt_questions (
            id, attempt_id, question_id, order_index, question_text, question_type,
            category_name, difficulty, explanation, options_json, correct_option_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          attQId,
          attemptId,
          q.id,
          idx + 1,
          q.question_text,
          q.question_type,
          q.category_name || "Đắk Song",
          q.difficulty,
          q.explanation,
          JSON.stringify(safeOpts),
          correctOpt.id
        )
      );

      clientQuestions.push({
        id: attQId,
        orderIndex: idx + 1,
        questionText: q.question_text,
        questionType: q.question_type,
        categoryName: q.category_name || "Đắk Song",
        difficulty: q.difficulty,
        options: safeOpts,
      });
    });

    try {
      await this.env.DB.batch(stmts);
    } catch (batchErr: any) {
      if (String(batchErr).includes("UNIQUE constraint failed")) {
        const err: any = new Error("Bạn đã mở lượt thi thử thách của ngày hôm nay rồi");
        err.statusCode = 409;
        throw err;
      }
      throw batchErr;
    }

    return {
      attemptId,
      attemptType,
      totalQuestions: questionsToSnapshot.length,
      scorePerQuestion,
      maxScore,
      timeLimitSeconds,
      expiresAt,
      questions: clientQuestions,
    };
  }

  async getAttempt(userId: string, attemptId: string): Promise<any> {
    const attempt = await this.env.DB.prepare(
      `SELECT a.*, ch.title as challenge_title, col.title as collection_title
       FROM quiz_attempts a
       LEFT JOIN quiz_challenges ch ON a.challenge_id = ch.id
       LEFT JOIN quiz_collections col ON a.collection_id = col.id
       WHERE a.id = ?`
    )
      .bind(attemptId)
      .first<any>();

    if (!attempt) {
      const err: any = new Error("Phiên làm bài không tồn tại");
      err.statusCode = 404;
      throw err;
    }

    if (attempt.user_id !== userId) {
      const err: any = new Error("Không có quyền truy cập kết quả này");
      err.statusCode = 403;
      throw err;
    }

    // Check per-attempt expiration if in progress
    if (attempt.status === "in_progress" && attempt.expires_at) {
      if (new Date() > new Date(attempt.expires_at)) {
        await this.finishAttempt(userId, attemptId);
        return await this.getAttempt(userId, attemptId);
      }
    }

    // Fetch questions
    const qRows = await this.env.DB.prepare(
      `SELECT aq.*, q.related_place_id, q.related_article_id, p.name as place_name, a.title as article_title
       FROM quiz_attempt_questions aq
       LEFT JOIN quiz_questions q ON aq.question_id = q.id
       LEFT JOIN places p ON q.related_place_id = p.id
       LEFT JOIN articles a ON q.related_article_id = a.id
       WHERE aq.attempt_id = ?
       ORDER BY aq.order_index ASC`
    )
      .bind(attemptId)
      .all<any>();

    // Fetch submitted answers
    const ansRows = await this.env.DB.prepare(
      `SELECT * FROM quiz_attempt_answers WHERE attempt_id = ?`
    )
      .bind(attemptId)
      .all<QuizAttemptAnswerRow>();

    const answersMap = new Map<string, QuizAttemptAnswerRow>();
    for (const ans of ansRows.results || []) {
      answersMap.set(ans.attempt_question_id, ans);
    }

    const isCompleted = attempt.status === "completed";

    const questions = (qRows.results || []).map((aq) => {
      const parsedOpts = JSON.parse(aq.options_json || "[]");
      const userAns = answersMap.get(aq.id);

      if (!isCompleted) {
        return {
          id: aq.id,
          orderIndex: aq.order_index,
          questionText: aq.question_text,
          questionType: aq.question_type,
          categoryName: aq.category_name,
          difficulty: aq.difficulty,
          options: parsedOpts,
          selectedOptionId: userAns ? userAns.selected_option_id : null,
        };
      }

      return {
        id: aq.id,
        orderIndex: aq.order_index,
        questionText: aq.question_text,
        questionType: aq.question_type,
        categoryName: aq.category_name,
        difficulty: aq.difficulty,
        options: parsedOpts,
        selectedOptionId: userAns ? userAns.selected_option_id : null,
        correctOptionId: aq.correct_option_id,
        isCorrect: userAns ? userAns.is_correct === 1 : false,
        points: userAns ? userAns.points : 0,
        explanation: aq.explanation,
        relatedPlaceId: aq.related_place_id,
        relatedPlaceName: aq.place_name,
        relatedArticleId: aq.related_article_id,
        relatedArticleTitle: aq.article_title,
      };
    });

    const scorePerQ: number = (typeof attempt.score_per_question === "number" && Number.isSafeInteger(attempt.score_per_question) && attempt.score_per_question > 0) ? attempt.score_per_question : 10;
    const maxScore = attempt.max_score || (attempt.total_questions * scorePerQ);
    const percentage = (isCompleted && maxScore > 0) ? Math.round((attempt.score / maxScore) * 100) : null;

    return {
      id: attempt.id,
      attemptType: attempt.attempt_type,
      challengeTitle: attempt.challenge_title,
      collectionTitle: attempt.collection_title,
      status: attempt.status,
      businessDate: attempt.business_date,
      totalQuestions: attempt.total_questions,
      scorePerQuestion: scorePerQ,
      correctCount: isCompleted ? attempt.correct_count : null,
      incorrectCount: isCompleted ? attempt.incorrect_count : null,
      unansweredCount: isCompleted ? attempt.unanswered_count : null,
      answeredCount: answersMap.size,
      score: isCompleted ? attempt.score : null,
      maxScore,
      percentage,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      completedAt: attempt.completed_at,
      questions,
    };
  }

  async submitAnswer(userId: string, attemptId: string, input: SubmitAnswerInput): Promise<any> {
    if (!input.attemptQuestionId || !input.selectedOptionId) {
      throw new Error("Thiếu mã câu hỏi hoặc phương án trả lời");
    }

    const attempt = await this.env.DB.prepare(
      "SELECT * FROM quiz_attempts WHERE id = ?"
    )
      .bind(attemptId)
      .first<QuizAttemptRow>();

    if (!attempt) {
      const err: any = new Error("Phiên làm bài không tồn tại");
      err.statusCode = 404;
      throw err;
    }

    if (attempt.user_id !== userId) {
      const err: any = new Error("Không có quyền thực hiện thao tác");
      err.statusCode = 403;
      throw err;
    }

    if (attempt.status !== "in_progress") {
      const err: any = new Error("Bài thi đã kết thúc, không thể nộp thêm câu trả lời");
      err.statusCode = 400;
      throw err;
    }

    if (attempt.expires_at && new Date() >= new Date(attempt.expires_at)) {
      await this.finishAttempt(userId, attemptId);
      const err: any = new Error("Thời gian làm bài đã kết thúc");
      err.statusCode = 400;
      throw err;
    }

    // Verify question belongs to attempt
    const attQ = await this.env.DB.prepare(
      "SELECT * FROM quiz_attempt_questions WHERE id = ? AND attempt_id = ?"
    )
      .bind(input.attemptQuestionId, attemptId)
      .first<QuizAttemptQuestionRow>();

    if (!attQ) {
      const err: any = new Error("Câu hỏi không hợp lệ trong phiên này");
      err.statusCode = 404;
      throw err;
    }

    // Check option validity
    const options = JSON.parse(attQ.options_json || "[]");
    const validOpt = options.find((o: any) => o.id === input.selectedOptionId);
    if (!validOpt) {
      throw new Error("Phương án trả lời không tồn tại trong danh sách lựa chọn");
    }

    // Pre-read check for existing answer
    const existingAns = await this.env.DB.prepare(
      "SELECT * FROM quiz_attempt_answers WHERE attempt_id = ? AND attempt_question_id = ?"
    )
      .bind(attemptId, input.attemptQuestionId)
      .first<QuizAttemptAnswerRow>();

    if (existingAns) {
      if (existingAns.selected_option_id === input.selectedOptionId) {
        return {
          success: true,
          alreadyAnswered: true,
          answeredAt: existingAns.answered_at,
        };
      }
      const err: any = new Error("Không thể thay đổi phương án đã nộp");
      err.statusCode = 409;
      throw err;
    }

    const scorePerQ: number = (typeof attempt.score_per_question === "number" && Number.isSafeInteger(attempt.score_per_question) && attempt.score_per_question > 0)
      ? attempt.score_per_question
      : 10;
    const isCorrect = input.selectedOptionId === attQ.correct_option_id ? 1 : 0;
    const points = isCorrect ? scorePerQ : 0;
    const ansId = "ans-" + crypto.randomUUID();

    const stmts: any[] = [
      this.env.DB.prepare(
        "INSERT INTO quiz_attempt_answers (id, attempt_id, attempt_question_id, question_id, selected_option_id, is_correct, points, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
      ).bind(
        ansId,
        attemptId,
        input.attemptQuestionId,
        attQ.question_id,
        input.selectedOptionId,
        isCorrect,
        points
      ),

      this.env.DB.prepare(
        "UPDATE quiz_attempts SET correct_count = correct_count + ?, incorrect_count = incorrect_count + ?, score = score + ?, updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'"
      ).bind(isCorrect, isCorrect ? 0 : 1, points, attemptId),

      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"),
      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1")
    ];

    try {
      await this.env.DB.batch(stmts);
    } catch (batchErr: any) {
      const recheck = await this.env.DB.prepare(
        "SELECT * FROM quiz_attempt_answers WHERE attempt_id = ? AND attempt_question_id = ?"
      )
        .bind(attemptId, input.attemptQuestionId)
        .first<QuizAttemptAnswerRow>();

      if (recheck) {
        if (recheck.selected_option_id === input.selectedOptionId) {
          return {
            success: true,
            alreadyAnswered: true,
            answeredAt: recheck.answered_at,
          };
        }
        const err: any = new Error("Không thể thay đổi phương án đã nộp");
        err.statusCode = 409;
        throw err;
      }

      const currentAtt = await this.env.DB.prepare(
        "SELECT status FROM quiz_attempts WHERE id = ?"
      ).bind(attemptId).first<any>();
      if (currentAtt && currentAtt.status !== "in_progress") {
        const err: any = new Error("Bài thi đã kết thúc, không thể nộp thêm câu trả lời");
        err.statusCode = 400;
        throw err;
      }
      throw batchErr;
    }

    return {
      success: true,
      answeredAt: new Date().toISOString(),
    };
  }

  async finishAttempt(userId: string, attemptId: string): Promise<any> {
    const attempt = await this.env.DB.prepare(
      "SELECT * FROM quiz_attempts WHERE id = ?"
    )
      .bind(attemptId)
      .first<QuizAttemptRow>();

    if (!attempt) {
      const err: any = new Error("Phiên làm bài không tồn tại");
      err.statusCode = 404;
      throw err;
    }

    if (attempt.user_id !== userId) {
      const err: any = new Error("Không có quyền thực hiện thao tác");
      err.statusCode = 403;
      throw err;
    }

    if (attempt.status !== "in_progress") {
      return await this.getAttempt(userId, attemptId);
    }

    // P1-QZ-06: Compute all totals atomically inside SQL D1 batch expressions
    // to prevent race conditions where concurrent answers are committed between a pre-batch SELECT and the CAS UPDATE.
    const finishStatements: any[] = [
      this.env.DB.prepare(
        "UPDATE quiz_attempts SET status = 'completed', correct_count = (SELECT COALESCE(SUM(is_correct), 0) FROM quiz_attempt_answers WHERE attempt_id = quiz_attempts.id), incorrect_count = (SELECT COALESCE(SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END), 0) FROM quiz_attempt_answers WHERE attempt_id = quiz_attempts.id), unanswered_count = max(0, quiz_attempts.total_questions - (SELECT COUNT(*) FROM quiz_attempt_answers WHERE attempt_id = quiz_attempts.id)), score = (SELECT COALESCE(SUM(points), 0) FROM quiz_attempt_answers WHERE attempt_id = quiz_attempts.id), max_score = quiz_attempts.total_questions * quiz_attempts.score_per_question, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'in_progress'"
      ).bind(attemptId),

      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"),

      this.env.DB.prepare(
        "INSERT INTO quiz_user_stats (user_id, total_attempts, completed_attempts, daily_challenges_completed, total_score, total_correct, total_questions_answered, best_score, last_attempt_at, updated_at) SELECT qa.user_id, 1, 1, CASE WHEN qa.attempt_type = 'daily_challenge' THEN 1 ELSE 0 END, qa.score, qa.correct_count, qa.correct_count + qa.incorrect_count, qa.score, qa.completed_at, qa.completed_at FROM quiz_attempts qa WHERE qa.id = ? ON CONFLICT(user_id) DO UPDATE SET total_attempts = quiz_user_stats.total_attempts + 1, completed_attempts = quiz_user_stats.completed_attempts + 1, daily_challenges_completed = quiz_user_stats.daily_challenges_completed + excluded.daily_challenges_completed, total_score = quiz_user_stats.total_score + excluded.total_score, total_correct = quiz_user_stats.total_correct + excluded.total_correct, total_questions_answered = quiz_user_stats.total_questions_answered + excluded.total_questions_answered, best_score = MAX(quiz_user_stats.best_score, excluded.best_score), last_attempt_at = excluded.last_attempt_at, updated_at = excluded.updated_at"
      ).bind(attemptId),

      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1")
    ];

    try {
      await this.env.DB.batch(finishStatements);
    } catch (batchErr) {
      const current = await this.env.DB.prepare(
        "SELECT status FROM quiz_attempts WHERE id = ?"
      ).bind(attemptId).first<any>();
      if (current && current.status !== "in_progress") {
        return await this.getAttempt(userId, attemptId);
      }
      throw batchErr;
    }

    return await this.getAttempt(userId, attemptId);
  }

  async reconcileUserStats(userId: string): Promise<any> {
    const userExists = await this.env.DB.prepare(
      "SELECT id FROM users WHERE id = ?"
    ).bind(userId).first<any>();

    if (!userExists) {
      const err: any = new Error("Người dùng không tồn tại");
      err.statusCode = 404;
      throw err;
    }

    // Atomic single-statement calculation & upsert directly in D1:
    // Aligns total_attempts = completed_attempts on graded completed attempts (Phase 8.4.3 & 8.4.4 convention).
    // In-progress attempts do not pollute stats until finalized.
    // last_attempt_at reflects the most recent completed attempt timestamp.
    const reconcileSql = `
      INSERT INTO quiz_user_stats (
        user_id,
        total_attempts,
        completed_attempts,
        daily_challenges_completed,
        total_score,
        total_correct,
        total_questions_answered,
        best_score,
        last_attempt_at,
        updated_at
      )
      SELECT
        ?,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'completed' AND attempt_type = 'daily_challenge' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'completed' THEN score ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'completed' THEN correct_count ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'completed' THEN (correct_count + incorrect_count) ELSE 0 END), 0),
        COALESCE(MAX(CASE WHEN status = 'completed' THEN score ELSE 0 END), 0),
        MAX(CASE WHEN status = 'completed' THEN completed_at ELSE NULL END),
        datetime('now')
      FROM quiz_attempts
      WHERE user_id = ?
      ON CONFLICT(user_id) DO UPDATE SET
        total_attempts = excluded.total_attempts,
        completed_attempts = excluded.completed_attempts,
        daily_challenges_completed = excluded.daily_challenges_completed,
        total_score = excluded.total_score,
        total_correct = excluded.total_correct,
        total_questions_answered = excluded.total_questions_answered,
        best_score = excluded.best_score,
        last_attempt_at = excluded.last_attempt_at,
        updated_at = excluded.updated_at;
    `;

    await this.env.DB.prepare(reconcileSql).bind(userId, userId).run();

    return await this.getUserStats(userId);
  }

  async getUserHistory(userId: string, page = 1, limit = 20): Promise<any> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const offset = (p - 1) * l;

    const countRes = await this.env.DB.prepare(
      "SELECT COUNT(*) as total FROM quiz_attempts WHERE user_id = ?"
    )
      .bind(userId)
      .first<any>();

    const listRes = await this.env.DB.prepare(
      "SELECT a.*, ch.title as challenge_title, col.title as collection_title FROM quiz_attempts a LEFT JOIN quiz_challenges ch ON a.challenge_id = ch.id LEFT JOIN quiz_collections col ON a.collection_id = col.id WHERE a.user_id = ? ORDER BY a.started_at DESC LIMIT ? OFFSET ?"
    )
      .bind(userId, l, offset)
      .all<any>();

    const history = (listRes.results || []).map((row: any) => {
      const isCompleted = row.status === "completed";
      const scorePerQ = (Number.isSafeInteger(row.score_per_question) && row.score_per_question > 0)
        ? row.score_per_question
        : 10;
      const maxScore = row.max_score || (row.total_questions * scorePerQ);
      const percentage = (isCompleted && maxScore > 0) ? Math.round((row.score / maxScore) * 100) : null;

      return {
        id: row.id,
        attemptId: row.id,
        attemptType: row.attempt_type,
        attempt_type: row.attempt_type,
        challengeId: row.challenge_id,
        challenge_id: row.challenge_id,
        collectionId: row.collection_id,
        collection_id: row.collection_id,
        challengeTitle: row.challenge_title || null,
        challenge_title: row.challenge_title || null,
        collectionTitle: row.collection_title || null,
        collection_title: row.collection_title || null,
        businessDate: row.business_date || null,
        business_date: row.business_date || null,
        totalQuestions: row.total_questions,
        total_questions: row.total_questions,
        scorePerQuestion: scorePerQ,
        score_per_question: scorePerQ,
        maxScore,
        max_score: maxScore,
        status: row.status,
        startedAt: row.started_at,
        started_at: row.started_at,
        expiresAt: row.expires_at || null,
        expires_at: row.expires_at || null,
        completedAt: row.completed_at || null,
        completed_at: row.completed_at || null,
        score: isCompleted ? row.score : null,
        percentage: isCompleted ? percentage : null,
        correctCount: isCompleted ? row.correct_count : null,
        correct_count: isCompleted ? row.correct_count : null,
        incorrectCount: isCompleted ? row.incorrect_count : null,
        incorrect_count: isCompleted ? row.incorrect_count : null,
        unansweredCount: isCompleted ? row.unanswered_count : null,
        unanswered_count: isCompleted ? row.unanswered_count : null,
      };
    });

    return {
      history,
      total: countRes?.total || 0,
      page: p,
      limit: l,
    };
  }

  async getUserStats(userId: string): Promise<any> {
    const stats = await this.env.DB.prepare(
      `SELECT * FROM quiz_user_stats WHERE user_id = ?`
    )
      .bind(userId)
      .first<QuizUserStatsRow>();

    if (!stats) {
      return {
        totalAttempts: 0,
        completedAttempts: 0,
        dailyChallengesCompleted: 0,
        totalScore: 0,
        totalCorrect: 0,
        totalQuestionsAnswered: 0,
        bestScore: 0,
        lastAttemptAt: null,
      };
    }

    return {
      totalAttempts: stats.total_attempts,
      completedAttempts: stats.completed_attempts,
      dailyChallengesCompleted: stats.daily_challenges_completed,
      totalScore: stats.total_score,
      totalCorrect: stats.total_correct,
      totalQuestionsAnswered: stats.total_questions_answered,
      bestScore: stats.best_score,
      lastAttemptAt: stats.last_attempt_at,
    };
  }
}
