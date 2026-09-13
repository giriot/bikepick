import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { emailVerificationConfigured, sendDealerEmailOtp } from '@/lib/email-otp';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';

const schema = z.object({ dealer_id: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!emailVerificationConfigured()) return fail('Email confirmation is not configured yet', 503);
    const body = schema.parse(await readJson(req));
    const limited = await rateLimit('dealer_email_otp', { limit: 3, windowSeconds: 600, key: user.id });
    if (!limited.ok) return fail(`Too many verification emails. Try again in ${limited.retryAfter}s.`, 429);

    const dealer = await db.get<any>(
      'SELECT id, email, email_verified FROM dealer_profiles WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [body.dealer_id, user.id],
    );
    if (!dealer) return fail('Dealer application not found', 404);
    if (dealer.email_verified === 1) return ok({ verified: true }, 'Dealer email is already confirmed');

    const delivery = await sendDealerEmailOtp(dealer.email);
    if (!delivery.delivered) return fail('Could not send the confirmation email. Please try again shortly.', 503);
    return ok({ email: dealer.email }, 'A new dealer email verification code was sent');
  } catch (e) {
    return handleError(e);
  }
}
