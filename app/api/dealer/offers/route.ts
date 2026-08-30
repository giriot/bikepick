import { NextRequest } from 'next/server';
import { db, insert, nowIso, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { offerSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { getSetting, isOn } from '@/lib/settings';
import { audit } from '@/lib/audit';

async function dealerFor(userId: string) {
  return db.get<any>("SELECT * FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL", [userId]);
}

/**
 * Dealers submit offers; they publish only after admin approval unless the
 * owner has switched auto-approval on for verified dealers.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const dealer = await dealerFor(user.id);
    if (!dealer) return fail('Register your dealership first', 403);
    if (dealer.status !== 'verified') return fail('Your dealership must be verified before you can publish offers', 403);

    const body = offerSchema.parse(await readJson(req));

    // Plan limit on live offers.
    const sub = await db.get<any>(
      `SELECT s.*, p.offer_limit FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.dealer_id = ? AND s.status='active' ORDER BY s.ends_at DESC LIMIT 1`, [dealer.id],
    );
    const live = await db.get<any>(
      "SELECT COUNT(*) AS c FROM dealer_offers WHERE dealer_id = ? AND status IN ('pending','approved') AND deleted_at IS NULL", [dealer.id],
    );
    const limit = sub?.offer_limit ?? 3;
    if ((live?.c ?? 0) >= limit) {
      return fail(`Your plan allows ${limit} live offers. Expire or remove one, or upgrade your plan.`, 402);
    }

    const autoApprove = isOn(await getSetting('dealer_auto_approve_offers'));
    const expiryDays = Number((await getSetting('offer_auto_expiry_days')) || 30);
    const endDate = body.end_date || new Date(Date.now() + expiryDays * 86400000).toISOString().slice(0, 10);

    const id = await insert('dealer_offers', {
      id: uid('off'), dealer_id: dealer.id, product_id: body.product_id,
      variant_id: body.variant_id || null, city: body.city,
      ex_showroom: body.ex_showroom ?? null, on_road: body.on_road ?? null,
      insurance: body.insurance ?? null, registration: body.registration ?? null,
      discount: body.discount ?? null, exchange_bonus: body.exchange_bonus ?? null,
      finance_offer: body.finance_offer || null, accessories_offer: body.accessories_offer || null,
      offer_text: body.offer_text,
      start_date: body.start_date || nowIso().slice(0, 10),
      end_date: endDate,
      status: autoApprove ? 'approved' : 'pending',
      approved_at: autoApprove ? nowIso() : null,
    });

    await audit(user, 'offer.create', 'dealer_offer', id, { autoApprove });
    return ok({ id, status: autoApprove ? 'approved' : 'pending' },
      autoApprove ? 'Offer published' : 'Offer submitted for approval');
  } catch (e) {
    return handleError(e);
  }
}
