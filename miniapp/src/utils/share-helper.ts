export interface ShareResult {
  success: boolean;
  message: string;
}

/**
 * Attempts to copy the place URL to clipboard.
 * Truthful reporting:
 * - If copy succeeds, returns success: true and a confirmation message.
 * - If copy fails or clipboard API is rejected/unavailable, returns success: false and truthful error notice.
 */
export async function shareOrCopyUrl(
  url: string,
  placeName: string,
  clipboardApi?: { writeText: (text: string) => Promise<void> }
): Promise<ShareResult> {
  const targetClipboard =
    clipboardApi || (typeof navigator !== "undefined" ? navigator.clipboard : undefined);

  // 1. Try modern asynchronous Clipboard API
  if (targetClipboard && typeof targetClipboard.writeText === "function") {
    try {
      await targetClipboard.writeText(url);
      return {
        success: true,
        message: `Đã sao chép liên kết địa điểm: ${placeName}`,
      };
    } catch {
      // Proceed to fallback
    }
  }

  // 2. Try legacy document.execCommand('copy') fallback in browser DOM
  if (typeof document !== "undefined" && typeof document.execCommand === "function") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) {
        return {
          success: true,
          message: `Đã sao chép liên kết địa điểm: ${placeName}`,
        };
      }
    } catch {
      // Failed fallback
    }
  }

  // 3. Truthful failure notice
  return {
    success: false,
    message: "Không thể tự động sao chép liên kết trên thiết bị này. Vui lòng thử lại sau.",
  };
}
