import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { ChatService } from "../services/chat.service";

export const chatRoute: RouteHandler = async (req, _params, env) => {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ", 400, env);
    }

    const service = new ChatService(env);
    const response = await service.handleChat(body);
    return jsonResponse(response, 200, env);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : "Lỗi xử lý tin nhắn";
    return errorResponse(message, 400, env);
  }
};
