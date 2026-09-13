import { NextRequest } from 'next/server';
import { authorizeCron } from '@/lib/cron';
import { ok, fail, handleError } from '@/lib/api';
import { getSetting } from '@/lib/settings';
import { sweepStagedUploads } from '@/lib/media-staging';

export const dynamic = 'force-dynamic';

/**
 * Reclaims abandoned staged uploads.
 *
 * Seller photos wait in `private-docs/staging/…` until approval. Objects
 * older than the TTL (default 24 h) that no live listing references — wizard
 * uploads never submitted, or listings that were rejected, expired, sold or
 * deleted — are removed so storage is never permanently lost to orphans.
 * Photos referenced by an in-flight listing are kept regardless of age.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = authorizeCron(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    const hours = Number((await getSetting('staging_ttl_hours')) ?? 24);
    if (!Number.isFinite(hours) || hours <= 0) return ok({ scanned: 0, removed: 0 }, 'Staging sweep is disabled in settings');

    const result = await sweepStagedUploads(hours);
    return ok({ ...result, ttl_hours: hours }, `Swept ${result.removed} staged object(s)`);
  } catch (e) {
    return handleError(e);
  }
}
