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

export const emailService = {
  get providerName() { return provider.name; },
  configured: () => provider.configured(),
  send: (msg: EmailMessage) => provider.send(msg),
};
