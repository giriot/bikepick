import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { authorizeCron } from '@/lib/cron';
import { ok, fail, handleError } from '@/lib/api';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** Expires dealer offers past their end date and warns dealers three days ahead. */
export async function GET(req: NextRequest) {
  try {
    const auth = authorizeCron(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    const due = await db.all<any>(
      `SELECT o.id, o.offer_text, d.user_id, d.business_name
         FROM dealer_offers o JOIN dealer_profiles d ON d.id = o.dealer_id
        WHERE o.status = 'approved' AND o.end_date IS NOT NULL AND o.end_date < date('now') AND o.deleted_at IS NULL`,
    );
    for (const o of due) {
      await db.run("UPDATE dealer_offers SET status = 'expired', updated_at = ? WHERE id = ?", [nowIso(), o.id]);
      if (o.user_id) {
        await notify({
          userId: o.user_id, event: 'offer_expiring',
          title: 'An offer has expired',
          body: `Your offer "${o.offer_text || 'dealer offer'}" reached its end date and is no longer shown to buyers.`,
          link: '/dealer/offers',
        });
      }
    }

    const expiring = await db.all<any>(
      `SELECT o.id, o.offer_text, o.end_date, d.user_id
         FROM dealer_offers o JOIN dealer_profiles d ON d.id = o.dealer_id
        WHERE o.status = 'approved' AND o.end_date = date('now','+3 days') AND o.deleted_at IS NULL`,
    );
    for (const o of expiring) {
      if (!o.user_id) continue;
      await notify({
        userId: o.user_id, event: 'offer_expiring',
        title: 'Offer expires in 3 days',
        body: `"${o.offer_text || 'Your offer'}" ends on ${o.end_date}. Extend it to keep receiving leads.`,
        link: '/dealer/offers',
      });
    }

    return ok({ expired: due.length, warned: expiring.length }, `Expired ${due.length}, warned ${expiring.length}`);
  } catch (e) {
    return handleError(e);
  }
}
