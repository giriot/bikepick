import { NextRequest } from 'next/server';
import { createSession } from '@/lib/auth';
import { emailSchema } from '@/lib/validation';
import { verifyEmailOtp } from '@/lib/email-otp';
import { audit } from '@/lib/audit';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<{ email?: string; code?: string }>(req);
    const email = emailSchema.parse(body.email || '');
    const code = String(body.code || '').trim();
    if (!/^\d{6}$/.test(code)) return fail('Enter the 6-digit verification code', 422, { code: 'Enter 6 digits' });

    const limited = await rateLimit('verify_email_otp', { limit: 8, windowSeconds: 600, key: email });
    if (!limited.ok) return fail(`Too many attempts. Try again in ${limited.retryAfter}s.`, 429);

    const result = await verifyEmailOtp(email, code);
    if (!result.ok) return fail(result.error, 422, { code: result.error });

    const user = await db.get<any>('SELECT id, email, role FROM users WHERE id = ?', [result.userId]);
    if (!user) return fail('Account not found', 404);
    await createSession(user.id);
    await audit(user, 'auth.email_verified', 'user', user.id);

    const redirect = ['admin', 'moderator', 'verifier'].includes(user.role)
      ? '/admin'
      : user.role === 'dealer' ? '/dealer' : '/account';
    return ok({ id: user.id, redirect }, 'Email confirmed');
  } catch (e) {
    return handleError(e);
  }
}
