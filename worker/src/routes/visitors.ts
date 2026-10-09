import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { AdminService } from "../services/admin.service";
import { ValidationError } from "../utils/errors";

const ALLOWED_ADDRESS_AS = new Set(["anh", "chi", "em", "ban", "toi"]);
const ALLOWED_AGE_GROUPS = new Set([
  "duoi-18",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-tro-len",
  "under18",
  "35-49",
  "50plus",
]);

export const visitorConsentRoute: RouteHandler = async (req, _params, env) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không phải JSON hợp lệ", 400, env);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Yêu cầu không hợp lệ", 400, env);
  }

  const { consentToken, displayName, addressAs, ageGroup, consentVersion, optIn } = body;

  if (!consentToken || typeof consentToken !== "string" || consentToken.trim().length < 8) {
    return errorResponse("consentToken định danh ẩn danh bắt buộc (tối thiểu 8 ký tự)", 400, env);
  }

  const cleanToken = consentToken.trim();

  // If user requests withdrawal/opt-out
  if (optIn === false) {
    await env.DB.prepare(
      "UPDATE visitor_profiles SET deleted_at = datetime('now') WHERE id = ?"
    )
      .bind(cleanToken)
      .run();

    return jsonResponse({ success: true, consented: false }, 200, env);
  }

  // Validate consent version
  const cleanVersion = typeof consentVersion === "string" ? consentVersion.trim().slice(0, 20) : "1.0";

  // Sanitize fields
  const cleanName = typeof displayName === "string" ? displayName.trim().slice(0, 50) : undefined;
  const cleanAddress = typeof addressAs === "string" && ALLOWED_ADDRESS_AS.has(addressAs.trim())
    ? addressAs.trim()
    : undefined;
  const cleanAge = typeof ageGroup === "string" && ALLOWED_AGE_GROUPS.has(ageGroup.trim())
    ? ageGroup.trim()
    : undefined;

  const adminService = new AdminService(env);
  await adminService.saveVisitorConsent({
    id: cleanToken,
    displayName: cleanName,
    addressAs: cleanAddress,
    ageGroup: cleanAge,
    consentVersion: cleanVersion,
  });

  return jsonResponse({ success: true, consented: true }, 200, env);
};

