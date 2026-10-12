import type { Env } from "../types";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// In-memory registry for local testing adapter
const testInbox: Array<SendEmailOptions & { timestamp: number }> = [];

export function getSentEmailsForTest(): Array<SendEmailOptions & { timestamp: number }> {
  return [...testInbox];
}

export function clearSentEmailsForTest(): void {
  testInbox.length = 0;
}

export class EmailSenderService {
  constructor(private env: Env) {}

  isConfigured(): boolean {
    const provider = this.env.EMAIL_PROVIDER?.trim().toLowerCase();
    if (!provider) return false;
    if (provider === "test") return true;
    if (provider === "resend" || provider === "postmark") {
      return Boolean(this.env.EMAIL_API_KEY?.trim());
    }
    return false;
  }

  async sendEmail(opts: SendEmailOptions): Promise<EmailSendResult> {
    const provider = this.env.EMAIL_PROVIDER?.trim().toLowerCase();

    if (!provider) {
      return {
        success: false,
        error: "Dịch vụ gửi email chưa được cấu hình (EMAIL_PROVIDER is not set).",
      };
    }

    if (provider === "test") {
      const isLocalOrTest = this.env.ENVIRONMENT === "development" || this.env.ENVIRONMENT === "test";
      if (!isLocalOrTest) {
        return {
          success: false,
          error: "Nhà cung cấp email 'test' bị vô hiệu hóa ngoài môi trường development/test.",
        };
      }
      testInbox.push({ ...opts, timestamp: Date.now() });
      if (this.env.ENVIRONMENT === "development") {
        console.log(`[LOCAL DEV EMAIL] To: ${opts.to} | Message: ${opts.text}`);
      }
      return { success: true, messageId: "test-msg-" + Date.now() };
    }

    if (provider === "resend") {
      const apiKey = this.env.EMAIL_API_KEY?.trim();
      if (!apiKey) {
        return { success: false, error: "Thiếu EMAIL_API_KEY cho dịch vụ Resend." };
      }
      const from = this.env.EMAIL_FROM || "Du Lịch Đắk Song <noreply@daksong.vn>";

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from,
            to: opts.to,
            subject: opts.subject,
            text: opts.text,
            html: opts.html || opts.text,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          return {
            success: false,
            error: `Resend API error (${res.status}): ${errText.slice(0, 200)}`,
          };
        }

        const data: any = await res.json();
        return { success: true, messageId: data?.id };
      } catch (err: any) {
        return { success: false, error: `Lỗi mạng khi kết nối Resend: ${err.message || String(err)}` };
      }
    }

    if (provider === "postmark") {
      const apiKey = this.env.EMAIL_API_KEY?.trim();
      if (!apiKey) {
        return { success: false, error: "Thiếu EMAIL_API_KEY cho dịch vụ Postmark." };
      }
      const from = this.env.EMAIL_FROM || "noreply@daksong.vn";

      try {
        const res = await fetch("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": apiKey,
          },
          body: JSON.stringify({
            From: from,
            To: opts.to,
            Subject: opts.subject,
            TextBody: opts.text,
            HtmlBody: opts.html || opts.text,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          return {
            success: false,
            error: `Postmark API error (${res.status}): ${errText.slice(0, 200)}`,
          };
        }

        const data: any = await res.json();
        return { success: true, messageId: data?.MessageID };
      } catch (err: any) {
        return { success: false, error: `Lỗi mạng khi kết nối Postmark: ${err.message || String(err)}` };
      }
    }

    return {
      success: false,
      error: `Nhà cung cấp email '${provider}' không được hỗ trợ.`,
    };
  }
}

