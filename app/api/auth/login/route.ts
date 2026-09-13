import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createSession, verifyPassword } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit('login', { limit: 8, windowSeconds: 300 });
    if (!limited.ok) return fail(`Too many sign-in attempts. Try again in ${limited.retryAfter}s.`, 429);

    const body = loginSchema.parse(await readJson(req));
    const user = await db.get<any>("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL", [body.email]);

    // Constant-ish response regardless of which part failed.
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      return fail('Email or password is incorrect', 401);
    }
    if (user.status !== 'active') return fail('This account has been suspended. Contact support.', 403);
    if (user.email_verified === 0) {
      const pending = await db.get<any>(
        "SELECT id FROM otp_codes WHERE destination = ? AND purpose = 'register_email' AND consumed = 0 AND expires_at > ? LIMIT 1",
        [user.email, new Date().toISOString()],
      );
      if (pending) return fail('Confirm your email with the verification code before signing in.', 403, { email: 'Email confirmation required' });
    }

    await createSession(user.id);
    await audit(user, 'auth.login', 'user', user.id);

    const redirect = ['admin', 'moderator', 'verifier'].includes(user.role) ? '/admin'
      : user.role === 'dealer' ? '/dealer' : '/account';
    return ok({ id: user.id, role: user.role, redirect }, 'Signed in');
  } catch (e) {
    return handleError(e);
  }
}
