/** SMS / WhatsApp abstraction. Dormant until SMS_API_KEY + SMS_API_URL exist. */
export interface SmsMessage { to: string; message: string; channel?: 'sms' | 'whatsapp' }
export interface SmsResult { delivered: boolean; provider: string; reason?: string }

export interface SmsProvider {
  name: string;
  configured(): boolean;
  send(msg: SmsMessage): Promise<SmsResult>;
}

const httpProvider: SmsProvider = {
  name: 'http',
  configured: () => Boolean(process.env.SMS_API_KEY && process.env.SMS_API_URL),
  async send(msg) {
    if (!this.configured()) return { delivered: false, provider: 'http', reason: 'not_configured' };
    try {
      const res = await fetch(process.env.SMS_API_URL as string, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.SMS_API_KEY}` },
        body: JSON.stringify(msg),
      });
      return res.ok ? { delivered: true, provider: 'http' } : { delivered: false, provider: 'http', reason: `http_${res.status}` };
    } catch (e) {
      return { delivered: false, provider: 'http', reason: (e as Error).message };
    }
  },
};

let provider: SmsProvider = httpProvider;
export function registerSmsProvider(p: SmsProvider) { provider = p; }
export const smsService = {
  get providerName() { return provider.name; },
  configured: () => provider.configured(),
  send: (m: SmsMessage) => provider.send(m),
};
