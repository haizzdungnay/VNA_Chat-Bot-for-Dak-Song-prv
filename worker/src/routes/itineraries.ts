import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { PlannerService } from "../services/planner.service";
import { authenticateUser } from "../services/user-auth.service";
import { ValidationError } from "../utils/errors";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export const previewItineraryRoute: RouteHandler = async (req, _params, env) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ.", 400, env, NO_STORE);
  }

  const planner = new PlannerService(env);
  try {
    const itinerary = await planner.generatePreview(body);
    return jsonResponse({ itinerary }, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi khi lập kế hoạch chuyến đi.", 500, env, NO_STORE);
  }
};

export const saveItineraryRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Bạn cần đăng nhập để lưu lịch trình.", auth.status || 401, env, NO_STORE);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ.", 400, env, NO_STORE);
  }

  const planner = new PlannerService(env);
  try {
    const saved = await planner.saveItinerary(auth.user.id, body);
    return jsonResponse({ itinerary: saved }, 201, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi khi lưu lịch trình chuyến đi.", 500, env, NO_STORE);
  }
};

export const listItinerariesRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Bạn cần đăng nhập để xem lịch trình.", auth.status || 401, env, NO_STORE);
  }

  const planner = new PlannerService(env);
  try {
    const list = await planner.listItineraries(auth.user.id);
    return jsonResponse(list, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi khi tải danh sách lịch trình.", 500, env, NO_STORE);
  }
};

export const getItineraryRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Bạn cần đăng nhập để xem lịch trình.", auth.status || 401, env, NO_STORE);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID lịch trình.", 400, env, NO_STORE);

  const planner = new PlannerService(env);
  try {
    const itinerary = await planner.getItinerary(auth.user.id, id);
    return jsonResponse({ itinerary }, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi khi tải thông tin lịch trình.", 500, env, NO_STORE);
  }
};

export const updateItineraryRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Bạn cần đăng nhập để cập nhật lịch trình.", auth.status || 401, env, NO_STORE);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID lịch trình.", 400, env, NO_STORE);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ.", 400, env, NO_STORE);
  }

  const planner = new PlannerService(env);
  try {
    const updated = await planner.updateItinerary(auth.user.id, id, body);
    return jsonResponse({ itinerary: updated }, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi khi cập nhật lịch trình.", 500, env, NO_STORE);
  }
};

export const deleteItineraryRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Bạn cần đăng nhập để xóa lịch trình.", auth.status || 401, env, NO_STORE);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID lịch trình.", 400, env, NO_STORE);

  const planner = new PlannerService(env);
  try {
    await planner.deleteItinerary(auth.user.id, id);
    return jsonResponse({ success: true }, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi khi xóa lịch trình.", 500, env, NO_STORE);
  }
};
