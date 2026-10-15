import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { authenticateAdmin } from "../services/admin-auth.service";
import { AdminRewardService } from "../services/admin-reward.service";

// ==================== CAMPAIGNS ====================
export const adminRewardCampaignsListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const status = url.searchParams.get("status") || undefined;

    const service = new AdminRewardService(env);
    const data = await service.listCampaigns(page, limit, status);
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách chiến dịch.", 500, env);
  }
};

export const adminRewardCampaignDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã chiến dịch.", 400, env);

  try {
    const service = new AdminRewardService(env);
    const campaign = await service.getCampaign(id);
    if (!campaign) return errorResponse("Chiến dịch không tồn tại.", 404, env);
    return jsonResponse({ campaign }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải thông tin chiến dịch.", 500, env);
  }
};

export const adminRewardCampaignCreateRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminRewardService(env);
    const campaign = await service.createCampaign({
      ...(body as any),
      createdBy: auth.email || "admin",
    });
    return jsonResponse({ campaign }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tạo chiến dịch.", 400, env);
  }
};

export const adminRewardCampaignUpdateRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã chiến dịch.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminRewardService(env);
    const campaign = await service.updateCampaign(id, body as any);
    return jsonResponse({ campaign }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi cập nhật chiến dịch.", 400, env);
  }
};

export const adminRewardCampaignStatusRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã chiến dịch.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const status = (body as any).status;
    const service = new AdminRewardService(env);
    const campaign = await service.setCampaignStatus(id, status);
    return jsonResponse({ campaign }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi thay đổi trạng thái chiến dịch.", 400, env);
  }
};

// ==================== TEMPLATES ====================
export const adminRewardTemplatesListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId") || undefined;
    const service = new AdminRewardService(env);
    const templates = await service.listTemplates(campaignId);
    return jsonResponse({ templates }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải mẫu voucher.", 500, env);
  }
};

export const adminRewardTemplateCreateRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminRewardService(env);
    const template = await service.createTemplate(body as any);
    return jsonResponse({ template }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tạo mẫu voucher.", 400, env);
  }
};

export const adminRewardTemplateToggleRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã mẫu voucher.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const status = (body as any).status || "active";
    const service = new AdminRewardService(env);
    const template = await service.toggleTemplate(id, status);
    return jsonResponse({ template }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi cập nhật mẫu voucher.", 400, env);
  }
};

// ==================== WHEELS & SEGMENTS ====================
export const adminRewardWheelsListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId") || undefined;
    const service = new AdminRewardService(env);
    const wheels = await service.listWheels(campaignId);
    return jsonResponse({ wheels }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách vòng quay.", 500, env);
  }
};

export const adminRewardWheelDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã vòng quay.", 400, env);

  try {
    const service = new AdminRewardService(env);
    const data = await service.getWheelWithSegments(id);
    if (!data) return errorResponse("Vòng quay không tồn tại.", 404, env);
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải chi tiết vòng quay.", 500, env);
  }
};

export const adminRewardWheelCreateRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminRewardService(env);
    const wheel = await service.createWheel(body as any);
    return jsonResponse({ wheel }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tạo vòng quay.", 400, env);
  }
};

export const adminRewardWheelSegmentsRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã vòng quay.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const segments = (body as any).segments;
    const service = new AdminRewardService(env);
    const data = await service.setWheelSegments(id, segments);
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi cấu hình ô thưởng.", 400, env);
  }
};

export const adminRewardWheelStatusRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã vòng quay.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const status = (body as any).status || "active";
    const service = new AdminRewardService(env);
    const wheel = await service.toggleWheelStatus(id, status);
    return jsonResponse({ wheel }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi cập nhật trạng thái vòng quay.", 400, env);
  }
};

export const adminRewardWheelCloneRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã vòng quay.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const newTitle = (body as any).title;
    const service = new AdminRewardService(env);
    const data = await service.cloneWheel(id, newTitle);
    return jsonResponse(data, 201, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi nhân bản vòng quay.", status, env);
  }
};

// ==================== WALLET & REDEMPTIONS ====================
export const adminRewardWalletListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const campaignId = url.searchParams.get("campaignId") || undefined;

    const service = new AdminRewardService(env);
    const data = await service.listWalletItems(page, limit, { status, search, campaignId });
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách ví voucher.", 500, env);
  }
};

export const adminRewardVoucherRedeemRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã voucher.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const service = new AdminRewardService(env);
    const result = await service.redeemVoucher(auth.email || "admin", id, body as any);
    return jsonResponse({ success: true, voucher: result }, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi xác minh sử dụng voucher.", status, env);
  }
};

export const adminRewardVoucherRevokeRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã voucher.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const reason = (body as any).reason || "Quản trị viên thu hồi";
    const service = new AdminRewardService(env);
    const result = await service.revokeVoucher(auth.email || "admin", id, reason);
    return jsonResponse({ success: true, voucher: result }, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi thu hồi voucher.", status, env);
  }
};

// ==================== GIFT CLAIMS (P1-RWD-02) ====================
export const adminRewardGiftClaimsListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const campaignId = url.searchParams.get("campaignId") || undefined;

    const service = new AdminRewardService(env);
    const data = await service.listGiftClaims(page, limit, { status, search, campaignId });
    return jsonResponse(data, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách phiếu nhận quà.", 500, env);
  }
};

export const adminRewardGiftClaimFulfillRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã phiếu nhận quà.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const notes = (body as any).notes;
    const service = new AdminRewardService(env);
    const claim = await service.fulfillGiftClaim(auth.email || "admin", id, notes);
    return jsonResponse({ success: true, claim }, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi bàn giao quà tặng.", status, env);
  }
};

export const adminRewardGiftClaimRevokeRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu mã phiếu nhận quà.", 400, env);

  try {
    const body = await req.json().catch(() => ({}));
    const reason = (body as any).reason || "Quản trị viên thu hồi";
    const service = new AdminRewardService(env);
    const claim = await service.revokeGiftClaim(auth.email || "admin", id, reason);
    return jsonResponse({ success: true, claim }, 200, env);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return errorResponse(err.message || "Lỗi khi thu hồi phiếu quà.", status, env);
  }
};
// ==================== ANALYTICS & EXPORT ====================
export const adminRewardAnalyticsRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const service = new AdminRewardService(env);
    const analytics = await service.getRewardAnalytics();
    return jsonResponse({ analytics }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải thống kê phần thưởng.", 500, env);
  }
};

export const adminRewardExportRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Không có quyền truy cập.", auth.status || 401, env);
  }

  try {
    const service = new AdminRewardService(env);
    const csv = await service.exportVouchersCsv();
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vna_dak_song_vouchers_${Date.now()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi xuất báo cáo voucher.", 500, env);
  }
};

