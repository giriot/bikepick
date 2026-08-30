import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { authorizeCron } from '@/lib/cron';
import { ok, fail, handleError } from '@/lib/api';
import { notify } from '@/lib/notify';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Evaluates active price alerts against the current stored price.
 * Prices come from the database only — no live scraping, no external API.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = authorizeCron(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    const alerts = await db.all<any>(
      `SELECT a.*, p.name, p.slug, p.price_min, p.fuel_type, b.name AS brand, b.slug AS brand_slug
         FROM price_alerts a
         JOIN products p ON p.id = a.product_id
         JOIN brands b ON b.id = p.brand_id
        WHERE a.status = 'active' AND p.deleted_at IS NULL`,
    );

    let triggered = 0;
    for (const a of alerts) {
      const current = a.price_min;
      await db.run('UPDATE price_alerts SET last_checked_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), a.id]);
      if (current == null || a.target_price == null || Number(current) > Number(a.target_price)) continue;

      const path = `/${a.fuel_type === 'electric' ? 'electric' : 'bikes'}/${a.brand_slug}/${a.slug}`;
      await notify({
        userId: a.user_id, event: 'price_drop',
        title: `${a.brand} ${a.name} hit your target price`,
        body: `It is now ${inr(current)}, at or below your target of ${inr(a.target_price)}.`,
        link: path,
      });
      await db.run("UPDATE price_alerts SET status = 'triggered', triggered_at = ?, updated_at = ? WHERE id = ?",
        [nowIso(), nowIso(), a.id]);
      triggered++;
    }

    return ok({ checked: alerts.length, triggered }, `Checked ${alerts.length} alert(s), triggered ${triggered}`);
  } catch (e) {
    return handleError(e);
  }
}
