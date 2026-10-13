import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { authenticateAdmin } from "../services/admin-auth.service";
import { AdminQuizService } from "../services/admin-quiz.service";

// ==================== CATEGORIES ====================
export const adminQuizCategoriesListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const service = new AdminQuizService(env);
    const categories = await service.listCategories();
    return jsonResponse({ categories }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh mục Quiz.", 500, env);
  }
};

// ==================== QUESTION BANK ====================
export const adminQuizQuestionsListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const url = new URL(req.url);
    const filters = {
      keyword: url.searchParams.get("keyword") || undefined,
      categoryId: url.searchParams.get("categoryId") || undefined,
      difficulty: url.searchParams.get("difficulty") || undefined,
      questionType: url.searchParams.get("questionType") || undefined,
      status: url.searchParams.get("status") || undefined,
      page: parseInt(url.searchParams.get("page") || "1", 10),
      limit: parseInt(url.searchParams.get("limit") || "20", 10),
    };
    const service = new AdminQuizService(env);
    const result = await service.listQuestions(filters);
    return jsonResponse(result, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách câu hỏi.", 500, env);
  }
};

export const adminQuizQuestionDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã câu hỏi.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const question = await service.getQuestion(id);
    if (!question) return errorResponse("Không tìm thấy câu hỏi.", 404, env);
    return jsonResponse({ question }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải chi tiết câu hỏi.", 500, env);
  }
};

export const adminQuizQuestionCreateRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminQuizService(env);
    const question = await service.createQuestion(body as any, auth.email || "admin");
    return jsonResponse({ question }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tạo câu hỏi.", 400, env);
  }
};

export const adminQuizQuestionUpdateRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã câu hỏi.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminQuizService(env);
    const question = await service.updateQuestion(id, body as any, auth.email || "admin");
    return jsonResponse({ question }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi cập nhật câu hỏi.", 400, env);
  }
};

export const adminQuizQuestionPublishRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã câu hỏi.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const question = await service.publishQuestion(id, auth.email || "admin");
    return jsonResponse({ question }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi xuất bản câu hỏi.", 400, env);
  }
};

export const adminQuizQuestionArchiveRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã câu hỏi.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const question = await service.archiveQuestion(id, auth.email || "admin");
    return jsonResponse({ question }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi lưu trữ câu hỏi.", 400, env);
  }
};

export const adminQuizQuestionRestoreRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã câu hỏi.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const question = await service.restoreQuestion(id, auth.email || "admin");
    return jsonResponse({ question }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi khôi phục câu hỏi.", 400, env);
  }
};

export const adminQuizQuestionDuplicateRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã câu hỏi.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const question = await service.duplicateQuestion(id, auth.email || "admin");
    return jsonResponse({ question }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi nhân bản câu hỏi.", 400, env);
  }
};

// ==================== COLLECTIONS ====================
export const adminQuizCollectionsListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const service = new AdminQuizService(env);
    const collections = await service.listCollections();
    return jsonResponse({ collections }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách bộ đề.", 500, env);
  }
};

export const adminQuizCollectionDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã bộ đề.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const collection = await service.getCollection(id);
    if (!collection) return errorResponse("Không tìm thấy bộ đề.", 404, env);
    return jsonResponse({ collection }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải chi tiết bộ đề.", 500, env);
  }
};

export const adminQuizCollectionCreateRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminQuizService(env);
    const collection = await service.createCollection(body as any, auth.email || "admin");
    return jsonResponse({ collection }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tạo bộ đề.", 400, env);
  }
};

// ==================== CHALLENGES ====================
export const adminQuizChallengesListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const service = new AdminQuizService(env);
    const challenges = await service.listChallenges();
    return jsonResponse({ challenges }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách thử thách.", 500, env);
  }
};

export const adminQuizChallengeDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã thử thách.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const challenge = await service.getChallenge(id);
    if (!challenge) return errorResponse("Không tìm thấy thử thách.", 404, env);
    return jsonResponse({ challenge }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải chi tiết thử thách.", 500, env);
  }
};

export const adminQuizChallengeCreateRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminQuizService(env);
    const challenge = await service.createChallenge(body as any, auth.email || "admin");
    return jsonResponse({ challenge }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tạo thử thách.", 400, env);
  }
};

export const adminQuizChallengePublishRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã thử thách.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const challenge = await service.publishChallenge(id, auth.email || "admin");
    return jsonResponse({ challenge }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi xuất bản thử thách.", 400, env);
  }
};

export const adminQuizChallengeCloseRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã thử thách.", 400, env);

  try {
    const service = new AdminQuizService(env);
    const challenge = await service.closeChallenge(id, auth.email || "admin");
    return jsonResponse({ challenge }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi đóng thử thách.", 400, env);
  }
};

// ==================== ANALYTICS & EXPORTS ====================
export const adminQuizAnalyticsRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;
    const service = new AdminQuizService(env);
    const analytics = await service.getAnalytics({ startDate, endDate });
    return jsonResponse(analytics, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải phân tích Quiz.", 500, env);
  }
};

export const adminQuizAttemptsListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const url = new URL(req.url);
    const challengeId = url.searchParams.get("challengeId") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const service = new AdminQuizService(env);
    const result = await service.listAttempts({ challengeId, status, page, limit });
    return jsonResponse(result, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách lượt thi.", 500, env);
  }
};

export const adminQuizExportRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);

  try {
    const service = new AdminQuizService(env);
    const csv = await service.exportAnalyticsCsv();

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="quiz-analytics.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi xuất báo cáo Quiz.", 500, env);
  }
};
