import crypto from 'node:crypto';
import { db, insert, nowIso, uid } from './db';
import { emailService, type DeliveryResult } from '@/services/email';

export const EMAIL_OTP_PURPOSE = 'register_email';
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function emailVerificationConfigured(): boolean {
  return emailService.configured();
}

export async function sendEmailOtp(email: string): Promise<DeliveryResult> {
  const destination = email.trim().toLowerCase();
  const now = nowIso();
  await db.run(
    'UPDATE otp_codes SET consumed = 1, updated_at = ? WHERE destination = ? AND purpose = ? AND consumed = 0',
    [now, destination, EMAIL_OTP_PURPOSE],
  );

  const code = String(crypto.randomInt(100000, 1000000));
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  const id = uid('otp');
  await insert('otp_codes', {
    id,
    purpose: EMAIL_OTP_PURPOSE,
    destination,
    code_hash: hashCode(code),
    consumed: 0,
    attempts: 0,
    expires_at: expires,
  });

  const delivery = await emailService.send({
    to: destination,
    subject: 'Confirm your Bikepick.IN account',
    text: `Your Bikepick.IN email verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. If you did not create this account, ignore this email.`,
  });
  if (!delivery.delivered) {
    await db.run('UPDATE otp_codes SET consumed = 1, updated_at = ? WHERE id = ?', [nowIso(), id]);
  }
  return delivery;
}

export async function verifyEmailOtp(email: string, code: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const destination = email.trim().toLowerCase();
  const row = await db.get<any>(
    `SELECT * FROM otp_codes
      WHERE destination = ? AND purpose = ? AND consumed = 0
      ORDER BY created_at DESC LIMIT 1`,
    [destination, EMAIL_OTP_PURPOSE],
  );
  if (!row) return { ok: false, error: 'That code has expired. Request a new code.' };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.run('UPDATE otp_codes SET consumed = 1, updated_at = ? WHERE id = ?', [nowIso(), row.id]);
    return { ok: false, error: 'That code has expired. Request a new code.' };
  }
  if (Number(row.attempts) >= MAX_ATTEMPTS) {
    await db.run('UPDATE otp_codes SET consumed = 1, updated_at = ? WHERE id = ?', [nowIso(), row.id]);
    return { ok: false, error: 'Too many incorrect attempts. Request a new code.' };
  }

  if (!sameHash(row.code_hash, hashCode(code))) {
    await db.run('UPDATE otp_codes SET attempts = attempts + 1, updated_at = ? WHERE id = ?', [nowIso(), row.id]);
    return { ok: false, error: 'The verification code is incorrect.' };
  }

  const user = await db.get<any>('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [destination]);
  if (!user) return { ok: false, error: 'Account not found. Please register again.' };

  await db.run('UPDATE otp_codes SET consumed = 1, updated_at = ? WHERE id = ?', [nowIso(), row.id]);
  await db.run('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?', [nowIso(), user.id]);
  return { ok: true, userId: user.id };
}
