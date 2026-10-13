import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { authenticateUser, extractBearerToken } from "../services/user-auth.service";
import { IdentityService } from "../services/identity.service";
import { QuizService } from "../services/quiz.service";

/**
 * GET /api/quiz/categories
 * Danh mục câu hỏi du lịch
 */
export const quizCategoriesRoute: RouteHandler = async (req, _params, env) => {
  try {
    const service = new QuizService(env);
    const categories = await service.listCategories();
    return jsonResponse({ categories }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh mục Quiz.", 500, env);
  }
};

/**
 * GET /api/quiz/collections
 * Danh sách bộ đề du lịch
 */
export const quizCollectionsRoute: RouteHandler = async (req, _params, env) => {
  try {
    const service = new QuizService(env);
    const collections = await service.listCollections();
    return jsonResponse({ collections }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách bộ đề.", 500, env);
  }
};

/**
 * GET /api/quiz/daily
 * Thông tin thử thách hàng ngày hôm nay
 */
export const quizDailyRoute: RouteHandler = async (req, _params, env) => {
  try {
    let userId: string | undefined;
    const token = extractBearerToken(req);
    if (token) {
      const identityService = new IdentityService(env);
      const session = await identityService.authenticateSession(token);
      if (session && session.user) {
        userId = session.user.id;
      }
    }

    const service = new QuizService(env);
    const challenge = await service.getDailyChallenge(userId);
    return jsonResponse({ challenge }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi lấy thông tin thử thách hàng ngày.", 500, env);
  }
};

/**
 * POST /api/quiz/attempts
 * Bắt đầu một lượt thi (Practice hoặc Daily Challenge)
 */
export const quizStartAttemptRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const service = new QuizService(env);
    const attempt = await service.startAttempt(auth.user.id, body as any);
    return jsonResponse({ attempt }, 201, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi bắt đầu lượt thi.", status, env);
  }
};

/**
 * GET /api/quiz/attempts/:id
 * Lấy trạng thái / câu hỏi / kết quả của một lượt thi
 */
export const quizGetAttemptRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã lượt thi.", 400, env);

  try {
    const service = new QuizService(env);
    const attempt = await service.getAttempt(auth.user.id, id);
    return jsonResponse({ attempt }, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 500;
    return errorResponse(err.message || "Lỗi khi tải thông tin bài thi.", status, env);
  }
};

/**
 * POST /api/quiz/attempts/:id/answers
 * Nộp đáp án cho 1 câu hỏi trong lượt thi
 */
export const quizSubmitAnswerRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã lượt thi.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const service = new QuizService(env);
    const result = await service.submitAnswer(auth.user.id, id, body as any);
    return jsonResponse(result, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi gửi đáp án.", status, env);
  }
};

/**
 * POST /api/quiz/attempts/:id/finish
 * Hoàn thành bài thi và chấm điểm chính thức
 */
export const quizFinishAttemptRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã lượt thi.", 400, env);

  try {
    const service = new QuizService(env);
    const result = await service.finishAttempt(auth.user.id, id);
    return jsonResponse({ result }, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 500;
    return errorResponse(err.message || "Lỗi khi hoàn thành bài thi.", status, env);
  }
};

/**
 * GET /api/quiz/history
 * Lịch sử làm bài thi của người dùng hiện tại
 */
export const quizHistoryRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const service = new QuizService(env);
    const data = await service.getUserHistory(auth.user.id, page, limit);
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải lịch sử bài thi.", 500, env);
  }
};

/**
 * GET /api/quiz/stats
 * Thống kê tổng hợp cá nhân của người dùng
 */
export const quizStatsRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const service = new QuizService(env);
    const stats = await service.getUserStats(auth.user.id);
    return jsonResponse({ stats }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải thống kê Quiz.", 500, env);
  }
};
