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
    if (provider === "gmail" || provider === "gmail_smtp") {
      const hasSmtp = Boolean(this.env.GMAIL_USER?.trim() && this.env.GMAIL_APP_PASSWORD?.trim());
      const hasWebhook = Boolean(this.env.GMAIL_WEBHOOK_URL?.trim());
      return hasSmtp || hasWebhook;
    }
    return false;
  }

  private async sendViaGmailSmtp(
    user: string,
    pass: string,
    opts: SendEmailOptions
  ): Promise<EmailSendResult> {
    let connectFn: any;
    try {
      // @ts-ignore
      const cf = await import("cloudflare:sockets");
      connectFn = cf.connect;
    } catch {
      return {
        success: false,
        error: "Môi trường không hỗ trợ cloudflare:sockets để kết nối SMTP Gmail.",
      };
    }

    const cleanPass = pass.replace(/\s+/g, "");
    let socket: any;
    let reader: any;
    let writer: any;

    try {
      socket = connectFn({ hostname: "smtp.gmail.com", port: 465 }, { secureTransport: "on" });
      reader = socket.readable.getReader();
      writer = socket.writable.getWriter();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      let buf = "";
      const readLine = async (): Promise<string> => {
        while (true) {
          const idx = buf.indexOf("\r\n");
          if (idx !== -1) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            return line;
          }
          const { value, done } = await reader.read();
          if (done) throw new Error("Kết nối tới Gmail SMTP bị ngắt đột ngột.");
          buf += decoder.decode(value, { stream: true });
        }
      };

      const readReply = async (): Promise<{ code: number; text: string }> => {
        let reply = "";
        while (true) {
          const line = await readLine();
          reply += line + "\n";
          if (line.length >= 3 && (line.length === 3 || line[3] === " ")) {
            return { code: parseInt(line.slice(0, 3), 10), text: reply.trim() };
          }
        }
      };

      const sendCmd = async (cmd: string): Promise<{ code: number; text: string }> => {
        await writer.write(encoder.encode(cmd + "\r\n"));
        return await readReply();
      };

      // 1. Initial Gmail greeting
      const greeting = await readReply();
      if (greeting.code !== 220) {
        return { success: false, error: `Gmail chào không hợp lệ: ${greeting.text}` };
      }

      // 2. EHLO handshake
      const ehlo = await sendCmd("EHLO localhost");
      if (ehlo.code !== 250) {
        return { success: false, error: `EHLO thất bại: ${ehlo.text}` };
      }

      // 3. AUTH LOGIN
      const auth = await sendCmd("AUTH LOGIN");
      if (auth.code !== 334) {
        return { success: false, error: `AUTH LOGIN thất bại: ${auth.text}` };
      }

      const userB64 = btoa(unescape(encodeURIComponent(user)));
      const uRes = await sendCmd(userB64);
      if (uRes.code !== 334) {
        return { success: false, error: `Gmail từ chối tài khoản: ${uRes.text}` };
      }

      const passB64 = btoa(cleanPass);
      const pRes = await sendCmd(passB64);
      if (pRes.code !== 235) {
        return {
          success: false,
          error: `Gmail từ chối mật khẩu ứng dụng (Vui lòng kiểm tra lại GMAIL_APP_PASSWORD): ${pRes.text}`,
        };
      }

      // 4. MAIL FROM
      const mailFrom = await sendCmd(`MAIL FROM:<${user}>`);
      if (mailFrom.code !== 250) {
        return { success: false, error: `Lỗi MAIL FROM: ${mailFrom.text}` };
      }

      // 5. RCPT TO
      const rcptTo = await sendCmd(`RCPT TO:<${opts.to}>`);
      if (rcptTo.code !== 250) {
        return { success: false, error: `Lỗi RCPT TO: ${rcptTo.text}` };
      }

      // 6. DATA
      const dataCmd = await sendCmd("DATA");
      if (dataCmd.code !== 354) {
        return { success: false, error: `Lỗi DATA: ${dataCmd.text}` };
      }

      const subB64 = btoa(unescape(encodeURIComponent(opts.subject)));
      const senderFrom = this.env.EMAIL_FROM || `Du Lịch Đắk Song <${user}>`;

      const headers = [
        `From: ${senderFrom}`,
        `To: ${opts.to}`,
        `Subject: =?UTF-8?B?${subB64}?=`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        "",
        opts.html || opts.text,
        ".",
      ].join("\r\n");

      const sendData = await sendCmd(headers);
      if (sendData.code !== 250) {
        return { success: false, error: `Lỗi gửi nội dung email: ${sendData.text}` };
      }

      // 7. QUIT
      try {
        await sendCmd("QUIT");
      } catch {}

      return { success: true, messageId: "gmail-smtp-" + Date.now() };
    } catch (err: any) {
      return { success: false, error: `Lỗi kết nối Gmail SMTP: ${err?.message || String(err)}` };
    } finally {
      try { reader?.releaseLock(); } catch {}
      try { writer?.releaseLock(); } catch {}
      try { await socket?.close(); } catch {}
    }
  }

  private async sendViaGmailWebhook(
    webhookUrl: string,
    opts: SendEmailOptions
  ): Promise<EmailSendResult> {
    const secret = this.env.EMAIL_API_KEY?.trim() || "";

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret,
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
          error: `Gmail Gateway error (${res.status}): ${errText.slice(0, 200)}`,
        };
      }

      const data: any = await res.json().catch(() => ({}));
      if (data && data.error) {
        return { success: false, error: String(data.error) };
      }

      return { success: true, messageId: data?.id || ("gmail-webhook-" + Date.now()) };
    } catch (err: any) {
      return { success: false, error: `Lỗi kết nối tới Gmail Gateway: ${err.message || String(err)}` };
    }
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

    if (provider === "gmail" || provider === "gmail_smtp") {
      const user = this.env.GMAIL_USER?.trim();
      const appPassword = this.env.GMAIL_APP_PASSWORD?.trim();
      if (user && appPassword) {
        return await this.sendViaGmailSmtp(user, appPassword, opts);
      }

      const webhookUrl = this.env.GMAIL_WEBHOOK_URL?.trim();
      if (webhookUrl) {
        return await this.sendViaGmailWebhook(webhookUrl, opts);
      }

      return {
        success: false,
        error: "Thiếu GMAIL_USER và GMAIL_APP_PASSWORD (hoặc GMAIL_WEBHOOK_URL) cho dịch vụ Gmail.",
      };
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
