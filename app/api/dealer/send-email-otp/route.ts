import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { emailSchema } from '@/lib/validation';
import { emailVerificationConfigured, sendDealerEmailOtp } from '@/lib/email-otp';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!emailVerificationConfigured()) return fail('Email confirmation is not configured yet', 503);
    const body = await readJson<{ email?: string }>(req);
    const email = emailSchema.parse(body.email || '');
    const limited = await rateLimit('dealer_email_otp', { limit: 3, windowSeconds: 600, key: user.id });
    if (!limited.ok) return fail(`Too many verification emails. Try again in ${limited.retryAfter}s.`, 429);

    const delivery = await sendDealerEmailOtp(email);
    if (!delivery.delivered) return fail('Could not send the dealer confirmation email. Please try again shortly.', 503);
    return ok({ email }, 'A 6-digit verification code was sent to the dealer email');
  } catch (e) {
    return handleError(e);
  }
}
