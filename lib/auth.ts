import 'server-only';
import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { db, insert, nowIso, uid } from './db';
import type { AppUser, Role } from '@/types';

export const SESSION_COOKIE = 'bp_session';
const SESSION_DAYS = 30;

/* ------------------------------ password ------------------------------- */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

/* ------------------------------- sessions ------------------------------ */
// Fail closed when AUTH_SECRET is missing: each process gets a private random
// secret, so no session can be forged offline and none survives an instance
// restart. Set AUTH_SECRET in production (see .env.example).
const FALLBACK_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
function sessionSecret(): string {
  return process.env.AUTH_SECRET || FALLBACK_SESSION_SECRET;
}
function tokenHash(token: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(token).digest('hex');
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  const h = headers();
  await insert('sessions', {
    id: uid('ses'),
    user_id: userId,
    token_hash: tokenHash(token),
    ip: h.get('x-forwarded-for')?.split(',')[0] || null,
    user_agent: h.get('user-agent')?.slice(0, 250) || null,
    expires_at: expires.toISOString(),
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
  await db.run('UPDATE users SET last_login_at = ? WHERE id = ?', [nowIso(), userId]);
  return token;
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash(token)]);
  cookies().delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db.get<any>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL AND u.status = 'active'`,
    [tokenHash(token), nowIso()],
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    full_name: row.full_name,
    role: row.role as Role,
    city: row.city,
    is_premium: row.is_premium === 1,
    phone_verified: row.phone_verified === 1,
  };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Sign in required', 401);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/* ─────────────────────────── legacy admin console ───────────────────────
   Used by the older JS admin pages (app/admin/page.js, app/admin/dashboard,
   app/api/login, app/api/products). Credentials come ONLY from env vars —
   if any is unset, verification fails closed. Prefer the main user system
   (register + role='admin') for production.
*/
export const LEGACY_ADMIN_COOKIE = 'bp_admin_session';
const LEGACY_MAX_AGE = 60 * 60 * 8; // 8 hours

function legacySecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || null;
}

/** Constant-time credential check. Fails closed if env credentials unset. */
export function legacyVerifyCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  const bu = Buffer.from(String(username));
  const bp = Buffer.from(String(password));
  const ku = Buffer.from(u);
  const kp = Buffer.from(p);
  if (bu.length !== ku.length || bp.length !== kp.length) return false;
  return crypto.timingSafeEqual(bu, ku) && crypto.timingSafeEqual(bp, kp);
}

/** Sign a legacy session token (HMAC of username + expiry). */
export function legacyCreateAdminSession(username: string): string | null {
  const secret = legacySecret();
  if (!secret) return null;
  const expires = Date.now() + LEGACY_MAX_AGE * 1000;
  const body = `${username}.${expires}`;
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `${body}.${sig}`;
}

/** Validate a legacy session token. Returns the username or null. */
export function legacyVerifyAdminSession(token: string | null): string | null {
  const secret = legacySecret();
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [username, expiresStr, sig] = parts;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${username}.${expires}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? username : null;
}

export const LEGACY_ADMIN_SESSION_MAX_AGE = LEGACY_MAX_AGE;
