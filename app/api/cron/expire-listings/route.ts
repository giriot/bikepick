import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { authorizeCron } from '@/lib/cron';
import { ok, fail, handleError } from '@/lib/api';
import { notify } from '@/lib/notify';
import { getSetting } from '@/lib/settings';
import { isoDaysAgo } from '@/lib/iso';

export const dynamic = 'force-dynamic';

/** Expires approved used-bike listings older than the configured window. */
export async function GET(req: NextRequest) {
  try {
    const auth = authorizeCron(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    const days = Number((await getSetting('used_bike_listing_expiry_days')) ?? 60);
    if (!Number.isFinite(days) || days <= 0) return ok({ expired: 0 }, 'Listing expiry is disabled in settings');

    const due = await db.all<any>(
      `SELECT id, brand_name, model_name, seller_id, slug FROM used_bikes
        WHERE status = 'approved' AND deleted_at IS NULL
          AND COALESCE(approved_at, created_at) < ?`,
      [isoDaysAgo(Math.floor(days))],
    );

    for (const l of due) {
      await db.run("UPDATE used_bikes SET status = 'expired', updated_at = ? WHERE id = ?", [nowIso(), l.id]);
      if (l.seller_id) {
        await notify({
          userId: l.seller_id, event: 'used_bike_info_required',
          title: 'Your listing has expired',
          body: `"${l.brand_name} ${l.model_name}" was live for ${Math.floor(days)} days. Relist it from your account if the bike is still available.`,
          link: '/account/listings',
        });
      }
    }
    return ok({ expired: due.length, days }, `Expired ${due.length} listing(s)`);
  } catch (e) {
    return handleError(e);
  }
}
