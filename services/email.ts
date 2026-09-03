/**
 * Email service abstraction. Swap the provider by implementing EmailProvider
 * and registering it below — no application code changes required.
 */
export interface EmailMessage { to: string; subject: string; text: string; html?: string }
export interface DeliveryResult { delivered: boolean; provider: string; reason?: string; id?: string }

export interface EmailProvider {
  name: string;
  configured(): boolean;
  send(msg: EmailMessage): Promise<DeliveryResult>;
}

/** Default provider: generic HTTP transactional API driven by EMAIL_API_KEY. */
const httpProvider: EmailProvider = {
  name: 'http',
  configured: () => Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_API_URL),
  async send(msg) {
    if (!this.configured()) return { delivered: false, provider: 'http', reason: 'not_configured' };
    try {
      const res = await fetch(process.env.EMAIL_API_URL as string, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.EMAIL_API_KEY}` },
        body: JSON.stringify(msg),
      });
      if (!res.ok) return { delivered: false, provider: 'http', reason: `http_${res.status}` };
      return { delivered: true, provider: 'http' };
    } catch (e) {
      return { delivered: false, provider: 'http', reason: (e as Error).message };
    }
  },
};

let provider: EmailProvider = httpProvider;
export function registerEmailProvider(p: EmailProvider) { provider = p; }

/**
 * SMTP provider (nodemailer) — used when SMTP_HOST + SMTP_USER + SMTP_PASS
 * are configured. For Outlook/Hotmail: SMTP_HOST=smtp-mail.outlook.com,
 * SMTP_PORT=587, SMTP_USER=you@outlook.com, SMTP_PASS=<app password>.
 * Takes priority over the generic HTTP provider when configured.
 */
const smtpProvider: EmailProvider = {
  name: 'smtp',
  configured: () =>
    Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  async send(msg) {
    if (!this.configured()) return { delivered: false, provider: 'smtp', reason: 'not_configured' };
    try {
      const nodemailer = require('nodemailer');
      const port = Number(process.env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const info = await transport.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      return { delivered: true, provider: 'smtp', id: info.messageId };
    } catch (e) {
      return { delivered: false, provider: 'smtp', reason: (e as Error).message };
    }
  },
};

if (smtpProvider.configured()) provider = smtpProvider;

export const emailService = {
  get providerName() { return provider.name; },
  configured: () => provider.configured(),
  send: (msg: EmailMessage) => provider.send(msg),
};
