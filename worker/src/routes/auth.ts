import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { IdentityService } from "../services/identity.service";
import { authenticateUser, extractBearerToken } from "../services/user-auth.service";
import { ValidationError } from "../utils/errors";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export const zaloAuthRoute: RouteHandler = async (req, _params, env) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ.", 400, env, NO_STORE);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Yêu cầu không hợp lệ.", 400, env, NO_STORE);
  }

  const { accessToken } = body;
  if (!accessToken || typeof accessToken !== "string") {
    return errorResponse("Thiếu mã truy cập Zalo (accessToken).", 400, env, NO_STORE);
  }

  const userAgent = req.headers.get("user-agent") || undefined;
  const ipAddress = req.headers.get("cf-connecting-ip") || undefined;

  const identityService = new IdentityService(env);
  try {
    const result = await identityService.loginWithZalo(accessToken, { userAgent, ipAddress });
    return jsonResponse(result, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi hệ thống khi xác thực Zalo.", 500, env, NO_STORE);
  }
};

export const emailRequestRoute: RouteHandler = async (req, _params, env) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ.", 400, env, NO_STORE);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Yêu cầu không hợp lệ.", 400, env, NO_STORE);
  }

  const { email } = body;
  if (!email || typeof email !== "string") {
    return errorResponse("Thiếu địa chỉ email.", 400, env, NO_STORE);
  }

  const ipAddress = req.headers.get("cf-connecting-ip") || undefined;

  const identityService = new IdentityService(env);
  try {
    const result = await identityService.requestEmailOtp(email, ipAddress);
    return jsonResponse(result, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi hệ thống khi xử lý yêu cầu gửi email.", 500, env, NO_STORE);
  }
};

export const emailVerifyRoute: RouteHandler = async (req, _params, env) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ.", 400, env, NO_STORE);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Yêu cầu không hợp lệ.", 400, env, NO_STORE);
  }

  const { email, code } = body;
  if (!email || typeof email !== "string" || !code || typeof code !== "string") {
    return errorResponse("Thiếu email hoặc mã xác thực (code).", 400, env, NO_STORE);
  }

  const userAgent = req.headers.get("user-agent") || undefined;
  const ipAddress = req.headers.get("cf-connecting-ip") || undefined;

  const identityService = new IdentityService(env);
  try {
    const result = await identityService.verifyEmailOtp(email, code, { userAgent, ipAddress });
    return jsonResponse(result, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, err.statusCode || 400, env, NO_STORE);
    }
    return errorResponse("Lỗi hệ thống khi xác thực mã OTP.", 500, env, NO_STORE);
  }
};

export const meRoute: RouteHandler = async (req, _params, env) => {
  const auth = await authenticateUser(req, env);
  if (!auth.authenticated || !auth.user) {
    return errorResponse(auth.error || "Chưa đăng nhập.", auth.status || 401, env, NO_STORE);
  }

  return jsonResponse({ user: auth.user }, 200, env, NO_STORE);
};

export const logoutRoute: RouteHandler = async (req, _params, env) => {
  const token = extractBearerToken(req);
  if (token) {
    const identityService = new IdentityService(env);
    await identityService.logout(token);
  }

  return jsonResponse({ success: true }, 200, env, NO_STORE);
};
