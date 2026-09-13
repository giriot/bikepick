import { NextRequest } from 'next/server';
import { db, insert, uid } from '@/lib/db';
import { createSession, hashPassword } from '@/lib/auth';
import { registerSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { emailVerificationConfigured, sendEmailOtp } from '@/lib/email-otp';

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit('register', { limit: 5, windowSeconds: 600 });
    if (!limited.ok) return fail(`Too many attempts. Try again in ${limited.retryAfter}s.`, 429);

    const body = registerSchema.parse(await readJson(req));
    const existing = await db.get<any>('SELECT id FROM users WHERE email = ?', [body.email]);
    if (existing) return fail('An account with this email already exists', 409, { email: 'Already registered' });

    const requiresEmailVerification = emailVerificationConfigured();
    if (requiresEmailVerification) {
      const otpLimited = await rateLimit('register_email_otp', { limit: 3, windowSeconds: 600, key: body.email });
      if (!otpLimited.ok) return fail(`Too many verification emails. Try again in ${otpLimited.retryAfter}s.`, 429);
    }

    const id = await insert('users', {
      id: uid('usr'),
      email: body.email,
      full_name: body.full_name,
      phone: body.phone || null,
      city: body.city || null,
      password_hash: hashPassword(body.password),
      role: 'user',
      status: 'active',
      email_verified: requiresEmailVerification ? 0 : 1,
    });

    await audit({ id, email: body.email, role: 'user' } as any, 'auth.register', 'user', id);

    if (requiresEmailVerification) {
      const delivery = await sendEmailOtp(body.email);
      if (!delivery.delivered) {
        return fail('Your account was created, but we could not send the confirmation email. Please try again shortly.', 503, { email: 'Confirmation email could not be sent' });
      }
      return ok({ id, email: body.email, needs_email_verification: true }, 'We sent a verification code to your email');
    }

    await createSession(id);
    return ok({ id, redirect: '/account' }, 'Account created');
  } catch (e) {
    return handleError(e);
  }
}
