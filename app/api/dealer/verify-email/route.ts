import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { emailSchema } from '@/lib/validation';
import { verifyDealerEmailOtp } from '@/lib/email-otp';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

const schema = z.object({
  dealer_id: z.string().min(1),
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit verification code'),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await readJson(req));
    const limited = await rateLimit('dealer_verify_email_otp', { limit: 8, windowSeconds: 600, key: user.id });
    if (!limited.ok) return fail(`Too many attempts. Try again in ${limited.retryAfter}s.`, 429);

    const dealer = await db.get<any>(
      'SELECT id, email, email_verified FROM dealer_profiles WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [body.dealer_id, user.id],
    );
    if (!dealer) return fail('Dealer application not found', 404);
    if (dealer.email.toLowerCase() !== body.email) return fail('Use the business email from the application', 422);
    if (dealer.email_verified === 1) return ok({ id: dealer.id, verified: true }, 'Dealer email is already confirmed');

    const result = await verifyDealerEmailOtp(body.email, body.code);
    if (!result.ok) return fail(result.error, 422, { code: result.error });

    await db.run('UPDATE dealer_profiles SET email_verified = 1, updated_at = ? WHERE id = ?', [nowIso(), dealer.id]);
    await audit(user, 'dealer.email_verified', 'dealer_profile', dealer.id);
    await notify({
      userId: user.id, event: 'dealer_verified',
      title: 'Dealer email confirmed',
      body: 'Your dealership application is now in the verification queue.',
      link: '/dealer', email: dealer.email, phone: user.phone,
    });
    return ok({ id: dealer.id, verified: true, redirect: '/dealer' }, 'Dealer email confirmed');
  } catch (e) {
    return handleError(e);
  }
}
