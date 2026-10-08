import DOMPurify from "dompurify";

export function sanitizeArticleHtml(html: string): string {
  if (!html) return "";
  if (typeof window !== "undefined" && typeof DOMPurify?.sanitize === "function") {
    return DOMPurify.sanitize(html, {
      ADD_ATTR: ["target", "rel"],
    });
  }
  // Headless Node.js test / non-DOM fallback
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
    .replace(/(?:href|src)\s*=\s*["']?\s*javascript:[^"'>\s]+/gi, "")
    .replace(/<\/?(iframe|embed|object|form|input|button)\b[^>]*>/gi, "");
}
