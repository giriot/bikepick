import 'server-only';
import { db, nowIso } from './db';
import { storage, STAGING_PREFIX, isStagingKey, contentTypeFromKey, type StoredObject } from '@/services/storage';

/**
 * Staged upload lifecycle for used-bike photos.
 *
 * 1. Upload   — seller photos land in `private-docs/staging/…` (never public).
 * 2. Approve  — `promoteUsedBikeImages` copies each staged object into
 *               `public-media`, rewrites the stored URL and marks the image
 *               row `approved = 1`. Public pages only ever read approved
 *               images of approved listings.
 * 3. Sweep    — a daily cron removes staged objects older than the TTL that
 *               are not referenced by a live listing (abandoned wizard
 *               uploads, rejected/expired/sold listings).
 */

/** Listing states whose staged photos must NOT be swept. Rejected, expired,
 *  sold and deleted listings intentionally release their staged objects. */
export const STAGING_KEEP_STATUSES = [
  'draft', 'submitted', 'verification_required', 'under_review',
  'needs_more_info', 'suspended', 'approved',
] as const;

/** Stable public location for a promoted photo. */
export function promotedKey(usedBikeId: string, stagedKey: string): string {
  const filename = stagedKey.split('/').pop() || 'photo.jpg';
  return `used_bike_photo/${usedBikeId}/${filename}`;
}

export interface PromoteResult { promoted: number; alreadyPublic: number; missing: number; failed: number }

/**
 * Move a listing's staged photos into public storage and approve them.
 * Idempotent and non-throwing: a storage hiccup never blocks approval —
 * the affected rows simply stay unapproved and invisible until retried.
 */
export async function promoteUsedBikeImages(usedBikeId: string): Promise<PromoteResult> {
  const result: PromoteResult = { promoted: 0, alreadyPublic: 0, missing: 0, failed: 0 };
  const images = await db.all<{ id: string; image_url: string }>(
    'SELECT id, image_url FROM used_bike_images WHERE used_bike_id = ?', [usedBikeId],
  );
  const store = storage();

  for (const image of images) {
    if (!isStagingKey(image.image_url)) {
      // Public URL already (legacy listing, admin/demo data) — just approve it.
      await db.run('UPDATE used_bike_images SET approved = 1, updated_at = ? WHERE id = ? AND approved = 0', [nowIso(), image.id]);
      result.alreadyPublic += 1;
      continue;
    }
    try {
      const body = await store.read('private-docs', image.image_url);
      if (!body) { result.missing += 1; continue; } // swept or deleted — nothing to publish
      const put = await store.put({
        bucket: 'public-media',
        key: promotedKey(usedBikeId, image.image_url),
        body,
        contentType: contentTypeFromKey(image.image_url),
      });
      if (!put.url) { result.failed += 1; continue; }
      await db.run(
        'UPDATE used_bike_images SET image_url = ?, approved = 1, updated_at = ? WHERE id = ?',
        [put.url, nowIso(), image.id],
      );
      await store.remove('private-docs', image.image_url).catch(() => {}); // best effort; TTL sweep is the fallback
      result.promoted += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

/* --------------------------------- sweep --------------------------------- */

/** Pure decision core of the sweeper (unit-testable, no I/O). */
export function selectSweepCandidates(
  objects: StoredObject[],
  protectedKeys: ReadonlySet<string>,
  cutoffIso: string,
): StoredObject[] {
  return objects.filter((o) => o.createdAt < cutoffIso && !protectedKeys.has(o.key));
}

export interface SweepResult { scanned: number; removed: number; failed: number; kept: number }

/** Remove staged objects older than `ttlHours` that no live listing references. */
export async function sweepStagedUploads(ttlHours: number): Promise<SweepResult> {
  const store = storage();
  const objects = await store.list('private-docs', STAGING_PREFIX);

  const rows = await db.all<{ image_url: string }>(
    `SELECT i.image_url FROM used_bike_images i
       JOIN used_bikes u ON u.id = i.used_bike_id
      WHERE i.image_url LIKE ? AND u.deleted_at IS NULL
        AND u.status IN (${STAGING_KEEP_STATUSES.map(() => '?').join(',')})`,
    [`${STAGING_PREFIX}%`, ...STAGING_KEEP_STATUSES],
  );
  const protectedKeys = new Set(rows.map((r) => r.image_url));

  const cutoffIso = new Date(Date.now() - ttlHours * 3_600_000).toISOString();
  const candidates = selectSweepCandidates(objects, protectedKeys, cutoffIso);

  let removed = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      await store.remove('private-docs', candidate.key); // already-gone counts as reclaimed
      removed += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: objects.length, removed, failed, kept: objects.length - candidates.length };
}
