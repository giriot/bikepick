import 'server-only';
import { headers } from 'next/headers';
import { db, nowIso, uid } from './db';

export interface RateLimitResult { ok: boolean; remaining: number; retryAfter: number }

/** Database-backed fixed-window limiter — works on serverless with no extra service. */
export async function rateLimit(
  action: string,
  { limit = 20, windowSeconds = 60, key }: { limit?: number; windowSeconds?: number; key?: string } = {},
): Promise<RateLimitResult> {
  let ident = key;
  if (!ident) {
    try {
      const h = headers();
      ident = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'anonymous';
    } catch {
      ident = 'anonymous';
    }
  }
  const bucket = `${action}:${ident}`;
  const now = Date.now();
  const row = await db.get<any>('SELECT * FROM rate_limits WHERE bucket_key = ?', [bucket]);

  if (!row) {
    await db.run(
      'INSERT INTO rate_limits (id, bucket_key, hits, window_start, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      [uid('rl'), bucket, 1, nowIso(), nowIso(), nowIso()],
    );
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  const started = new Date(row.window_start).getTime();
  const elapsed = (now - started) / 1000;
  if (elapsed > windowSeconds) {
    await db.run('UPDATE rate_limits SET hits = 1, window_start = ?, updated_at = ? WHERE bucket_key = ?', [
      nowIso(), nowIso(), bucket,
    ]);
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (row.hits >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil(windowSeconds - elapsed) };
  }
  await db.run('UPDATE rate_limits SET hits = hits + 1, updated_at = ? WHERE bucket_key = ?', [nowIso(), bucket]);
  return { ok: true, remaining: limit - row.hits - 1, retryAfter: 0 };
}
