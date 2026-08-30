import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleError, ok, fail } from '@/lib/api';
import { audit } from '@/lib/audit';

/** A dealer may withdraw their own offer at any time. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const row = await db.get<any>(
      `SELECT o.id FROM dealer_offers o JOIN dealer_profiles d ON d.id = o.dealer_id
        WHERE o.id = ? AND d.user_id = ?`, [params.id, user.id],
    );
    if (!row) return fail('Offer not found', 404);
    await db.run("UPDATE dealer_offers SET status='withdrawn', updated_at=? WHERE id=?", [nowIso(), params.id]);
    await audit(user, 'offer.withdraw', 'dealer_offer', params.id);
    return ok({ id: params.id }, 'Offer withdrawn');
  } catch (e) {
    return handleError(e);
  }
}
