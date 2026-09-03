import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleError, ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function dealerFor(userId: string) {
  return db.get<any>('SELECT * FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [userId]);
}

/**
 * Dealer picks a location on the offer form -> auto-find the dealer's own
 * most recent offer for that model in that city (from Bikepick's list) so
 * the form is pre-filled with the dealer's previous numbers.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const dealer = await dealerFor(user.id);
    if (!dealer) return fail('Register your dealership first', 403);

    const productId = req.nextUrl.searchParams.get('product_id') || '';
    const city = (req.nextUrl.searchParams.get('city') || '').trim().toLowerCase();
    if (!productId || !city) return ok({ offer: null });

    const row = await db.get<any>(
      `SELECT on_road, discount, exchange_bonus, insurance, finance_offer, accessories_offer,
              offer_text, end_date, status, created_at
       FROM dealer_offers
       WHERE dealer_id = ? AND product_id = ? AND LOWER(city) = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [dealer.id, productId, city],
    );

    return ok({
      offer: row
        ? {
            on_road: row.on_road, discount: row.discount, exchange_bonus: row.exchange_bonus,
            insurance: row.insurance, finance_offer: row.finance_offer,
            accessories_offer: row.accessories_offer, end_date: row.end_date,
            status: row.status, created_at: row.created_at,
          }
        : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
