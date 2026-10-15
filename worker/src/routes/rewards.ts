import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { authenticateUser } from "../services/user-auth.service";
import { RewardService } from "../services/reward.service";

/**
 * GET /api/rewards/campaigns
 * Danh sách chiến dịch ưu đãi công khai
 */
export const rewardCampaignsRoute: RouteHandler = async (_req, _params, env) => {
  try {
    const service = new RewardService(env);
    const campaigns = await service.listPublicCampaigns();
    return jsonResponse({ campaigns }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách chiến dịch.", 500, env);
  }
};

/**
 * GET /api/rewards/wallet
 * Danh sách voucher trong ví của người dùng hiện tại
 */
export const rewardWalletListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập để xem ví ưu đãi.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const status = url.searchParams.get("status") || undefined;

    const service = new RewardService(env);
    const data = await service.getUserWallet(auth.user.id, status, page, limit);
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải ví voucher.", 500, env);
  }
};

/**
 * GET /api/rewards/wallet/:id
 * Chi tiết voucher của người dùng
 */
export const rewardWalletDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã voucher.", 400, env);

  try {
    const service = new RewardService(env);
    const item = await service.getWalletItemDetail(auth.user.id, id);
    if (!item) return errorResponse("Không tìm thấy voucher trong ví.", 404, env);
    return jsonResponse({ item }, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 500;
    return errorResponse(err.message || "Lỗi khi tải chi tiết voucher.", status, env);
  }
};

/**
 * GET /api/rewards/spins/active
 * Thông tin vòng quay may mắn đang hoạt động và danh sách ô thưởng công khai
 */
export const rewardActiveWheelRoute: RouteHandler = async (req, _params, env) => {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId") || undefined;

    const service = new RewardService(env);
    const data = await service.getActiveWheel(campaignId);
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải vòng quay.", 500, env);
  }
};

/**
 * GET /api/rewards/spins/eligibility
 * Kiểm tra số lượt quay và điều kiện quay của người dùng
 */
export const rewardSpinEligibilityRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId") || undefined;

    const service = new RewardService(env);
    const data = await service.getUserSpinEligibility(auth.user.id, campaignId);
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi kiểm tra điều kiện quay.", 500, env);
  }
};

/**
 * POST /api/rewards/spins/claim-daily
 * Nhận lượt quay miễn phí trong ngày (nếu campaign cho phép)
 */
export const rewardClaimDailySpinRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const service = new RewardService(env);
    const result = await service.claimDailySpin(auth.user.id, (body as any).campaignId);
    return jsonResponse(result, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi nhận lượt quay hàng ngày.", status, env);
  }
};

/**
 * POST /api/rewards/spins/claim-quiz
 * Nhận lượt quay may mắn từ kết quả bài thi Quiz hoàn thành
 */
export const rewardClaimQuizRewardRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const quizAttemptId = (body as any).quizAttemptId;
    const campaignId = (body as any).campaignId;

    const service = new RewardService(env);
    const result = await service.claimQuizReward(auth.user.id, quizAttemptId, campaignId);
    return jsonResponse(result, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi nhận thưởng từ Quiz.", status, env);
  }
};

/**
 * POST /api/rewards/spins
 * Thực hiện quay vòng quay may mắn (Server-authoritative, atomic D1 batch)
 */
export const rewardExecuteSpinRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập để quay thưởng.", auth.status || 401, env);
  }

  try {
    const headerIdem = req.headers.get("idempotency-key");
    const body = await req.json().catch(() => ({}));
    const idempotencyKey = headerIdem || (body as any).idempotencyKey;

    const service = new RewardService(env);
    const result = await service.executeSpin(auth.user.id, {
      wheelId: (body as any).wheelId,
      campaignId: (body as any).campaignId,
      idempotencyKey,
    });
    return jsonResponse(result, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi thực hiện quay thưởng.", status, env);
  }
};

/**
 * GET /api/rewards/spins/history
 * Lịch sử các lần quay của người dùng
 */
export const rewardSpinHistoryRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const service = new RewardService(env);
    const data = await service.getSpinHistory(auth.user.id, page, limit);
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải lịch sử quay.", 500, env);
  }
};

/**
 * GET /api/rewards/gift-claims
 * Danh sách quà tặng trúng thưởng của người dùng (P1-RWD-02)
 */
export const rewardGiftClaimsRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const service = new RewardService(env);
    const claims = await service.getUserGiftClaims(auth.user.id);
    return jsonResponse({ claims }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách quà tặng.", 500, env);
  }
};

