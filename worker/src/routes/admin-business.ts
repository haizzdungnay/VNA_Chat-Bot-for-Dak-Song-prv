import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { authenticateAdmin } from "../services/admin-auth.service";
import { AdminBookingService } from "../services/admin-booking.service";

// ==================== TOURS ====================

export const adminToursListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const service = new AdminBookingService(env);
    const tours = await service.listTours(status, search);
    return jsonResponse({ tours }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi lấy danh sách tour.", 500, env);
  }
};

export const adminTourDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID tour.", 400, env);

  try {
    const service = new AdminBookingService(env);
    const tour = await service.getTour(id);
    if (!tour) return errorResponse("Không tìm thấy tour.", 404, env);
    return jsonResponse({ tour }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi lấy chi tiết tour.", 500, env);
  }
};

export const adminTourCreateRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  try {
    const service = new AdminBookingService(env);
    const tour = await service.createTour(body, auth.email || "admin@daksong.vn");
    return jsonResponse({ tour, message: "Tạo tour thành công." }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tạo tour.", 400, env);
  }
};

export const adminTourUpdateRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID tour.", 400, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  try {
    const service = new AdminBookingService(env);
    const tour = await service.updateTour(id, body, auth.email || "admin@daksong.vn");
    return jsonResponse({ tour, message: "Cập nhật tour thành công." }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi cập nhật tour.", 400, env);
  }
};

export const adminTourDeleteRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID tour.", 400, env);

  try {
    const service = new AdminBookingService(env);
    await service.deleteTour(id, auth.email || "admin@daksong.vn");
    return jsonResponse({ success: true, message: "Xóa tour thành công." }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi xóa tour.", 400, env);
  }
};

// ==================== SERVICES & PRICING ====================

export const adminServicesListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const service = new AdminBookingService(env);
    const services = await service.listServices(category, false);
    return jsonResponse({ services }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi lấy danh sách dịch vụ.", 500, env);
  }
};

export const adminServiceCreateRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  try {
    const service = new AdminBookingService(env);
    const item = await service.createService(body, auth.email || "admin@daksong.vn");
    return jsonResponse({ service: item, message: "Tạo dịch vụ thành công." }, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tạo dịch vụ.", 400, env);
  }
};

export const adminServiceUpdateRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID dịch vụ.", 400, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  try {
    const service = new AdminBookingService(env);
    const item = await service.updateService(id, body, auth.email || "admin@daksong.vn");
    return jsonResponse({ service: item, message: "Cập nhật dịch vụ thành công." }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi cập nhật dịch vụ.", 400, env);
  }
};

export const adminServicePriceUpdateRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID dịch vụ.", 400, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  if (body.unitPrice === undefined || !body.pricingMode) {
    return errorResponse("Thiếu unitPrice hoặc pricingMode.", 400, env);
  }

  try {
    const service = new AdminBookingService(env);
    const item = await service.updatePriceRule(
      id,
      body.pricingMode,
      Number(body.unitPrice),
      auth.email || "admin@daksong.vn"
    );
    return jsonResponse({ service: item, message: "Cập nhật giá dịch vụ thành công." }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi cập nhật giá dịch vụ.", 400, env);
  }
};

export const adminServiceToggleRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID dịch vụ.", 400, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  const isActive = Boolean(body.isActive);

  try {
    const service = new AdminBookingService(env);
    await service.toggleServiceActive(id, isActive, auth.email || "admin@daksong.vn");
    return jsonResponse(
      { success: true, message: isActive ? "Đã kích hoạt dịch vụ." : "Đã tạm dừng dịch vụ." },
      200,
      env
    );
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi đổi trạng thái dịch vụ.", 400, env);
  }
};

// ==================== BOOKING MANAGEMENT ====================

export const adminBookingsListRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const bookingStatus = url.searchParams.get("bookingStatus") || undefined;
    const paymentStatus = url.searchParams.get("paymentStatus") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const dateFrom = url.searchParams.get("dateFrom") || undefined;
    const dateTo = url.searchParams.get("dateTo") || undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
    const offset = url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

    const service = new AdminBookingService(env);
    const result = await service.listBookings({
      bookingStatus,
      paymentStatus,
      search,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    return jsonResponse(result, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi lấy danh sách đơn đặt.", 500, env);
  }
};

export const adminBookingDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID đơn đặt.", 400, env);

  try {
    const service = new AdminBookingService(env);
    const detail = await service.getBookingDetail(id);
    if (!detail) return errorResponse("Không tìm thấy đơn đặt.", 404, env);
    return jsonResponse(detail, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi lấy chi tiết đơn đặt.", 500, env);
  }
};

export const adminBookingCancelRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID đơn đặt.", 400, env);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  try {
    const service = new AdminBookingService(env);
    const booking = await service.adminCancelBooking(
      id,
      auth.email || "admin@daksong.vn",
      body.reason
    );
    return jsonResponse({ booking, message: "Hủy đơn đặt thành công." }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi hủy đơn đặt.", 400, env);
  }
};

export const adminBookingMockRefundRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID đơn đặt.", 400, env);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  try {
    const service = new AdminBookingService(env);
    const booking = await service.adminMockRefund(
      id,
      auth.email || "admin@daksong.vn",
      body.reason
    );
    return jsonResponse(
      { booking, message: "Hoàn tiền mô phỏng thành công — Không giao dịch tiền thật." },
      200,
      env
    );
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi xử lý hoàn tiền mô phỏng.", 400, env);
  }
};

// ==================== REVENUE ANALYTICS ====================

export const adminRevenueAnalyticsRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "7d") as any;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    const service = new AdminBookingService(env);
    const analytics = await service.getRevenueAnalytics(range, startDate, endDate);
    return jsonResponse(analytics, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tính toán báo cáo doanh thu.", 500, env);
  }
};

export const adminRevenueExportRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Truy cập bị từ chối.", auth.status || 401, env);
  }

  try {
    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "all") as any;
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    const service = new AdminBookingService(env);
    const csvContent = await service.exportRevenueCsv(range, startDate, endDate);

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bao-cao-doanh-thu-mo-phong.csv"',
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi xuất báo cáo CSV.", 500, env);
  }
};
