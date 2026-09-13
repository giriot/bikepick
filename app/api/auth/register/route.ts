import { NextRequest } from 'next/server';
import { db, insert, nowIso, uid } from '@/lib/db';
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
    const existing = await db.get<any>('SELECT id, deleted_at FROM users WHERE email = ?', [body.email]);
    if (existing && !existing.deleted_at) return fail('An account with this email already exists', 409, { email: 'Already registered' });

    const requiresEmailVerification = emailVerificationConfigured();
    if (requiresEmailVerification) {
      const otpLimited = await rateLimit('register_email_otp', { limit: 3, windowSeconds: 600, key: body.email });
      if (!otpLimited.ok) return fail(`Too many verification emails. Try again in ${otpLimited.retryAfter}s.`, 429);
    }

    const emailVerified = requiresEmailVerification ? 0 : 1;
    let id: string;
    const reactivated = Boolean(existing?.deleted_at);
    if (reactivated) {
      // Users are soft-deleted, while email remains unique. Reuse the deleted
      // row with fresh credentials instead of falsely reporting a live account.
      id = existing.id;
      await db.run('DELETE FROM sessions WHERE user_id = ?', [id]);
      await db.run(
        `UPDATE users SET full_name = ?, phone = ?, city = ?, password_hash = ?,
          role_id = NULL, role = 'user', status = 'active', is_premium = 0,
          premium_until = NULL, phone_verified = 0, email_verified = ?,
          last_login_at = NULL, deleted_at = NULL, updated_at = ? WHERE id = ?`,
        [body.full_name, body.phone || null, body.city || null, hashPassword(body.password), emailVerified, nowIso(), id],
      );
    } else {
      id = await insert('users', {
        id: uid('usr'),
        email: body.email,
        full_name: body.full_name,
        phone: body.phone || null,
        city: body.city || null,
        password_hash: hashPassword(body.password),
        role: 'user',
        status: 'active',
        email_verified: emailVerified,
      });
    }

    await audit({ id, email: body.email, role: 'user' } as any, reactivated ? 'auth.reregister' : 'auth.register', 'user', id);

    if (requiresEmailVerification) {
      const delivery = await sendEmailOtp(body.email);
      if (!delivery.delivered) {
        return fail('Your account was created, but we could not send the confirmation email. Please try again shortly.', 503, { email: 'Confirmation email could not be sent' });
      }
      return ok({ id, email: body.email, needs_email_verification: true }, 'We sent a verification code to your email');
    }

    await createSession(id);
    return ok({ id, redirect: '/account' }, reactivated ? 'Account restored' : 'Account created');
  } catch (e) {
    return handleError(e);
  }
}
