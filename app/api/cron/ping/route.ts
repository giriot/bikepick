import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Keep-warm ping (called by Vercel Cron every 5 minutes).
 *
 * Deliberately public and side-effect free: it runs a read-only `SELECT 1`
 * through the shared connection pool and returns a single byte of JSON.
 * No secrets, no data, no writes — so no auth is required and nothing can
 * leak. Its only job is to keep this function's server runtime (and its
 * database connection) warm, so that real page loads — especially the
 * admin dashboard on first access — do not pay a multi-second cold start.
 */
export async function GET() {
  try {
    await db.get('SELECT 1 AS ok');
    return Response.json({ ok: true });
  } catch {
    // Even if the DB is unreachable the endpoint answers 200 so the cron
    // run never shows up as a failing deployment event.
    return Response.json({ ok: false });
  }
}
