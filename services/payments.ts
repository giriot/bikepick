/**
 * Payment abstraction. Razorpay-ready: the integration is complete but stays
 * inactive until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set. Card data is
 * never received or stored by this application.
 */
import crypto from 'node:crypto';

export type PaymentStatus = 'created' | 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export interface CreateOrderInput { amount: number; currency?: string; receipt: string; notes?: Record<string, string> }
export interface OrderResult { providerOrderId: string | null; status: PaymentStatus; provider: string; checkout?: Record<string, unknown>; reason?: string }
export interface VerifyInput { orderId: string; paymentId: string; signature: string }

export interface PaymentProvider {
  name: string;
  configured(): boolean;
  createOrder(input: CreateOrderInput): Promise<OrderResult>;
  verify(input: VerifyInput): boolean;
}

const razorpay: PaymentProvider = {
  name: 'razorpay',
  configured: () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  async createOrder({ amount, currency = 'INR', receipt, notes }) {
    if (!this.configured()) {
      return { providerOrderId: null, status: 'pending', provider: 'razorpay', reason: 'not_configured' };
    }
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(amount * 100), currency, receipt, notes }),
    });
    if (!res.ok) return { providerOrderId: null, status: 'failed', provider: 'razorpay', reason: `http_${res.status}` };
    const json = (await res.json()) as { id: string };
    return {
      providerOrderId: json.id,
      status: 'created',
      provider: 'razorpay',
      checkout: { key: process.env.RAZORPAY_KEY_ID, order_id: json.id, amount: Math.round(amount * 100), currency },
    };
  },
  verify({ orderId, paymentId, signature }) {
    if (!process.env.RAZORPAY_KEY_SECRET) return false;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  },
};

let provider: PaymentProvider = razorpay;
export function registerPaymentProvider(p: PaymentProvider) { provider = p; }
export const payments = {
  get providerName() { return provider.name; },
  configured: () => provider.configured(),
  createOrder: (i: CreateOrderInput) => provider.createOrder(i),
  verify: (i: VerifyInput) => provider.verify(i),
};
