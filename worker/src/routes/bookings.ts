import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { authenticateUser } from "../services/user-auth.service";
import { BookingService } from "../services/booking.service";
import { AdminBookingService } from "../services/admin-booking.service";

/**
 * GET /api/tours
 * Công khai: Danh sách tour du lịch đang mở bán
 */
export const toursListRoute: RouteHandler = async (req, _params, env) => {
  try {
    const adminService = new AdminBookingService(env);
    const tours = await adminService.listTours("published");
    return jsonResponse({ tours }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách tour.", 500, env);
  }
};

/**
 * GET /api/tours/:id
 * Công khai: Chi tiết tour du lịch
 */
export const tourDetailRoute: RouteHandler = async (req, params, env) => {
  try {
    const id = params.id;
    if (!id) return errorResponse("Thiếu ID tour.", 400, env);

    const adminService = new AdminBookingService(env);
    const tour = await adminService.getTour(id);
    if (!tour || tour.status !== "published") {
      return errorResponse("Không tìm thấy tour du lịch.", 404, env);
    }

    return jsonResponse({ tour }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải chi tiết tour.", 500, env);
  }
};

/**
 * GET /api/services
 * Công khai: Danh sách dịch vụ du lịch đang hoạt động kèm giá
 */
export const servicesListRoute: RouteHandler = async (req, _params, env) => {
  try {
    const adminService = new AdminBookingService(env);
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const services = await adminService.listServices(category, true);
    return jsonResponse({ services }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi tải danh sách dịch vụ.", 500, env);
  }
};

/**
 * POST /api/quotes
 * Yêu cầu xác thực: Lập báo giá chuẩn từ máy chủ
 */
export const createQuoteRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập để nhận báo giá.", auth.status || 401, env);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  try {
    const bookingService = new BookingService(env);
    const res = await bookingService.calculateQuote({
      userId: auth.user.id,
      tourId: body.tourId,
      itineraryId: body.itineraryId,
      selectedServiceIds: body.selectedServiceIds,
      adultsCount: Number(body.adultsCount) || 1,
      childrenCount: Number(body.childrenCount) || 0,
      durationDays: body.durationDays ? Number(body.durationDays) : undefined,
    });

    return jsonResponse(res, 201, env);
  } catch (err: any) {
    return errorResponse(err.message || "Không thể lập báo giá.", 400, env);
  }
};

/**
 * POST /api/bookings
 * Yêu cầu xác thực: Tạo đơn đặt từ báo giá
 */
export const createBookingRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập để đặt tour.", auth.status || 401, env);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  if (!body.quoteReference) {
    return errorResponse("Thiếu thông tin quoteReference.", 400, env);
  }

  try {
    const bookingService = new BookingService(env);
    const res = await bookingService.createBooking({
      userId: auth.user.id,
      quoteReference: body.quoteReference,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      notes: body.notes,
      idempotencyKey: body.idempotencyKey,
    });

    return jsonResponse(res, 201, env);
  } catch (err: any) {
    const msg = err.message || "Không thể tạo đơn đặt.";
    const status = err.status || (msg.includes("Lịch trình đã được chỉnh sửa") ? 409 : 400);
    return errorResponse(msg, status, env);
  }
};

/**
 * GET /api/bookings
 * Yêu cầu xác thực: Lấy danh sách đơn đặt của người dùng hiện tại
 */
export const listUserBookingsRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  try {
    const bookingService = new BookingService(env);
    const bookings = await bookingService.listUserBookings(auth.user.id);
    return jsonResponse({ bookings }, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Lỗi khi lấy danh sách đơn đặt.", 500, env);
  }
};

/**
 * GET /api/bookings/:id
 * Yêu cầu xác thực: Lấy chi tiết đơn đặt của người dùng hiện tại
 */
export const getUserBookingDetailRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID đơn đặt.", 400, env);

  try {
    const bookingService = new BookingService(env);
    const detail = await bookingService.getBooking(auth.user.id, id);
    return jsonResponse(detail, 200, env);
  } catch (err: any) {
    return errorResponse(err.message || "Không tìm thấy đơn đặt.", 404, env);
  }
};

/**
 * POST /api/bookings/:id/pay
 * Yêu cầu xác thực: Xử lý thanh toán mô phỏng (Mock Payment)
 */
export const mockPaymentRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập để thanh toán.", auth.status || 401, env);
  }

  const id = params.id;
  if (!id) return errorResponse("Thiếu ID đơn đặt.", 400, env);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Payload JSON không hợp lệ.", 400, env);
  }

  const simulateStatus = body.simulateStatus === "failed" ? "failed" : "success";
  const paymentMethod = body.paymentMethod || "mock_bank_transfer";

  try {
    const bookingService = new BookingService(env);
    const res = await bookingService.processMockPayment({
      userId: auth.user.id,
      bookingId: id,
      paymentMethod,
      simulateStatus,
      idempotencyKey: body.idempotencyKey,
    });

    return jsonResponse(res, 200, env);
  } catch (err: any) {
    const status = err.status || 400;
    return errorResponse(err.message || "Lỗi khi xử lý thanh toán mô phỏng.", status, env);
  }
};

/**
 * POST /api/bookings/:id/cancel
 * Yêu cầu xác thực: Người dùng tự hủy đơn chưa thanh toán
 */
export const cancelUserBookingRoute: RouteHandler = async (req, params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Yêu cầu đăng nhập.", auth.status || 401, env);
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
    const bookingService = new BookingService(env);
    const booking = await bookingService.cancelBooking(auth.user.id, id, body.reason);
    return jsonResponse({ booking, message: "Hủy đơn đặt thành công." }, 200, env);
  } catch (err: any) {
    const status = err.status || 400;
    return errorResponse(err.message || "Không thể hủy đơn đặt.", status, env);
  }
};
