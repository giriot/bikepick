/**
 * Email service abstraction. Swap the provider by implementing EmailProvider
 * and registering it below — no application code changes required.
 */
export interface EmailMessage { to: string; subject: string; text: string; html?: string }
export interface DeliveryResult {
  delivered: boolean;
  provider: string;
  reason?: string;
  id?: string;
  /** Safe diagnostics; never include credentials or message contents. */
  code?: string;
  responseCode?: number;
  command?: string;
}

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
 * SMTP provider (nodemailer). Outlook.com now requires OAuth2/XOAUTH2 for
 * SMTP AUTH; password/app-password auth is retained only as a compatibility
 * fallback for SMTP providers that still permit it.
 */
function smtpOAuthValues() {
  return [process.env.SMTP_CLIENT_ID, process.env.SMTP_CLIENT_SECRET, process.env.SMTP_REFRESH_TOKEN];
}

function smtpOAuthConfigured() {
  return smtpOAuthValues().every(Boolean);
}

function smtpAuthConfigured() {
  const oauthValues = smtpOAuthValues();
  // Do not silently fall back to a password when an OAuth setup is partially
  // present; that would produce a misleading AUTH LOGIN failure.
  if (oauthValues.some(Boolean)) return oauthValues.every(Boolean);
  return Boolean(process.env.SMTP_PASS);
}

const smtpProvider: EmailProvider = {
  name: 'smtp',
  configured: () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && smtpAuthConfigured()),
  async send(msg) {
    if (!this.configured()) return { delivered: false, provider: 'smtp', reason: 'not_configured' };
    const port = Number(process.env.SMTP_PORT || 587);
    const useOAuth = smtpOAuthConfigured();
    try {
      const nodemailer = require('nodemailer');
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: useOAuth
          ? {
              type: 'OAuth2',
              user: process.env.SMTP_USER,
              clientId: process.env.SMTP_CLIENT_ID,
              clientSecret: process.env.SMTP_CLIENT_SECRET,
              refreshToken: process.env.SMTP_REFRESH_TOKEN,
              accessUrl: process.env.SMTP_OAUTH_ACCESS_URL || 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            }
          : { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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
      const error = e as { message?: string; code?: string; responseCode?: number; command?: string };
      // Keep the client response generic, but leave enough non-secret detail in
      // Vercel logs to distinguish bad credentials from a blocked SMTP socket.
      console.error('[email] SMTP delivery failed', {
        host: process.env.SMTP_HOST,
        port,
        authMode: useOAuth ? 'oauth2' : 'password',
        code: error.code,
        responseCode: error.responseCode,
        command: error.command,
        message: error.message,
      });
      return {
        delivered: false,
        provider: 'smtp',
        reason: error.message || 'smtp_delivery_failed',
        code: error.code,
        responseCode: error.responseCode,
        command: error.command,
      };
    }
  },
};

if (smtpProvider.configured()) provider = smtpProvider;

export const emailService = {
  get providerName() { return provider.name; },
  configured: () => provider.configured(),
  send: (msg: EmailMessage) => provider.send(msg),
};
