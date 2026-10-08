export interface ShareResult {
  success: boolean;
  message: string;
}

export interface ShareOptions {
  summary?: string;
  thumbnail?: string;
}

export type NativeShareFn = (args: any) => Promise<unknown>;

/**
 * Attempts to share place using native Zalo Mini App Share Sheet first.
 * If native share fails or is unavailable, falls back to Clipboard API and execCommand.
 * Truthful reporting:
 * - If native share or copy succeeds, returns success: true and confirmation message.
 * - If all methods fail or are rejected, returns success: false and truthful error notice.
 */
export async function shareOrCopyUrl(
  url: string,
  placeName: string,
  clipboardApi?: { writeText: (text: string) => Promise<void> } | null,
  nativeShareApi?: NativeShareFn | null,
  options?: ShareOptions
): Promise<ShareResult> {
  // 1. Try native Zalo Mini App Share Sheet if available
  let targetNativeShare = nativeShareApi;
  if (targetNativeShare === undefined && typeof window !== "undefined") {
    try {
      const zmp = await import("zmp-sdk");
      if (typeof zmp.openShareSheet === "function") {
        targetNativeShare = zmp.openShareSheet;
      }
    } catch {
      // SDK not available in standalone/test environment
    }
  }

  if (targetNativeShare && typeof targetNativeShare === "function") {
    try {
      if (options?.thumbnail) {
        await targetNativeShare({
          type: "zmp",
          data: {
            title: placeName,
            description: options.summary || `Khám phá ${placeName} tại Đắk Song`,
            thumbnail: options.thumbnail,
          },
        });
      } else {
        await targetNativeShare({
          type: "link",
          data: {
            link: url,
            chatOnly: false,
          },
        });
      }
      return {
        success: true,
        message: `Đã mở chia sẻ địa điểm: ${placeName}`,
      };
    } catch {
      // Proceed to clipboard fallback if native share cancelled or unsupported
    }
  }

  const targetClipboard =
    clipboardApi === null
      ? null
      : clipboardApi || (typeof navigator !== "undefined" ? navigator.clipboard : undefined);

  // 2. Try modern asynchronous Clipboard API
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

  // 3. Try legacy document.execCommand('copy') fallback in browser DOM
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

  // 4. Truthful failure notice
  return {
    success: false,
    message: "Không thể tự động sao chép liên kết trên thiết bị này. Vui lòng thử lại sau.",
  };
}
