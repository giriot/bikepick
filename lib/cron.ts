import 'server-only';
import { NextRequest } from 'next/server';

/**
 * Cron endpoints are protected by a shared secret so they can be called safely by
 * GitHub Actions or Vercel Cron. If CRON_SECRET is unset the endpoints refuse to run
 * rather than silently exposing write operations.
 */
export function authorizeCron(req: NextRequest): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 503, error: 'CRON_SECRET is not configured on this deployment' };
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.nextUrl.searchParams.get('key') || '';
  if (token !== secret) return { ok: false, status: 401, error: 'Invalid cron key' };
  return { ok: true };
}
