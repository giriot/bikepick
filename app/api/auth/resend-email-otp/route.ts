import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { emailSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { emailVerificationConfigured, sendEmailOtp } from '@/lib/email-otp';

export async function POST(req: NextRequest) {
  try {
    if (!emailVerificationConfigured()) return fail('Email confirmation is not configured yet', 503);
    const body = await readJson<{ email?: string }>(req);
    const email = emailSchema.parse(body.email || '');
    const limited = await rateLimit('register_email_otp', { limit: 3, windowSeconds: 600, key: email });
    if (!limited.ok) return fail(`Too many verification emails. Try again in ${limited.retryAfter}s.`, 429);

    const user = await db.get<any>('SELECT id, email_verified FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
    if (!user) return fail('Account not found', 404);
    if (user.email_verified === 1) return ok({ verified: true }, 'Email is already confirmed');

    const delivery = await sendEmailOtp(email);
    if (!delivery.delivered) return fail('Could not send the confirmation email. Please try again shortly.', 503);
    return ok({ email }, 'A new verification code was sent');
  } catch (e) {
    return handleError(e);
  }
}
