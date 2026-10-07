import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { ChatService } from "../services/chat.service";
import { ValidationError, AIProviderError } from "../utils/errors";

export const chatRoute: RouteHandler = async (req, _params, env) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ", 400, env);
  }

  try {
    const service = new ChatService(env);
    const response = await service.handleChat(body);
    return jsonResponse(response, 200, env);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400, env);
    }
    if (err instanceof AIProviderError) {
      return errorResponse(err.message, 502, env);
    }
    // Bảo mật: không leak stack trace hoặc raw internal error ra client
    return errorResponse("Đã xảy ra lỗi hệ thống.", 500, env);
  }
};
