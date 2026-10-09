/**
 * Security guards for AI endpoints and SSRF mitigation.
 */

const DEFAULT_ALLOWED_AI_HOSTS = new Set([
  "generativelanguage.googleapis.com",
  "api.openai.com",
  "openrouter.ai",
  "api.groq.com",
  "api.anthropic.com",
]);

function isPrivateIp(hostname: string): boolean {
  // IPv4 private & loopback checks
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const octets = match.slice(1, 5).map(Number);
    if (octets.some((o) => o < 0 || o > 255)) return true;
    const [a, b] = octets;
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 0) return true; // 0.0.0.0/8
  }

  // IPv6 loopback & link-local checks
  if (
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("fe80:") ||
    hostname.startsWith("fc00:") ||
    hostname.startsWith("fd00:")
  ) {
    return true;
  }

  return false;
}

export function validateAiEndpoint(
  urlStr: string,
  customAllowedHosts?: string
): { valid: boolean; error?: string } {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, error: "URL không được để trống." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, error: "Định dạng URL không hợp lệ." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Bắt buộc phải sử dụng giao thức HTTPS an toàn." };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: "Không được nhúng thông tin đăng nhập trong URL." };
  }

  const host = parsed.hostname.toLowerCase();

  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost") ||
    isPrivateIp(host)
  ) {
    return {
      valid: false,
      error: "Không được phép sử dụng địa chỉ mạng nội bộ hoặc máy chủ cục bộ (Chặn SSRF).",
    };
  }

  // Build combined allowlist
  const allowed = new Set(DEFAULT_ALLOWED_AI_HOSTS);
  if (customAllowedHosts) {
    customAllowedHosts
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
      .forEach((h) => allowed.add(h));
  }

  if (!allowed.has(host)) {
    return {
      valid: false,
      error: `Máy chủ '${host}' không nằm trong danh sách AI endpoint tin cậy được phê duyệt.`,
    };
  }

  return { valid: true };
}

