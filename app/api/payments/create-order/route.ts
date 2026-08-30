import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, insert, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { payments } from '@/services/payments';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  purpose: z.enum(['subscription', 'featured_listing', 'inspection']),
  reference_id: z.string().min(1),
});

/**
 * Creates a payment record and, when a gateway is configured, a provider order.
 * With no gateway configured the payment stays `pending` and the owner can mark
 * it paid manually in Admin — the platform never pretends money moved.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await readJson(req));

    let amount = 0;
    let dealerId: string | null = null;

    if (body.purpose === 'subscription') {
      const plan = await db.get<any>('SELECT * FROM subscription_plans WHERE id = ? AND active = 1', [body.reference_id]);
      if (!plan) return fail('Plan not found', 404);
      amount = plan.price;
      const dealer = await db.get<any>('SELECT id FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
      if (!dealer) return fail('Register your dealership first', 403);
      dealerId = dealer.id;
    } else if (body.purpose === 'inspection') {
      const inspection = await db.get<any>('SELECT * FROM inspections WHERE id = ?', [body.reference_id]);
      if (!inspection) return fail('Inspection not found', 404);
      amount = inspection.fee || 0;
    } else {
      const listing = await db.get<any>('SELECT id FROM used_bikes WHERE id = ? AND seller_id = ?', [body.reference_id, user.id]);
      if (!listing) return fail('Listing not found', 404);
      const setting = await db.get<any>("SELECT value FROM settings WHERE key='featured_listing_price'");
      amount = Number(setting?.value || 0);
    }

    if (amount <= 0) return fail('Nothing to pay for this item', 400);

    const id = uid('pay');
    const order = await payments.createOrder({ amount, receipt: id, notes: { purpose: body.purpose, reference: body.reference_id } });

    await insert('payments', {
      id, provider: order.provider, provider_order_id: order.providerOrderId,
      user_id: user.id, dealer_id: dealerId, purpose: body.purpose, reference_id: body.reference_id,
      amount, currency: 'INR', status: order.status, failure_reason: order.reason || null,
      receipt: id,
    });

    await audit(user, 'payment.create_order', 'payment', id, { purpose: body.purpose, amount, configured: payments.configured() });

    return ok({
      payment_id: id, amount, configured: payments.configured(),
      checkout: order.checkout ?? null,
      message: payments.configured()
        ? 'Complete the payment in the checkout window.'
        : 'Online payment is not switched on for this site yet. Your request is recorded and the site owner will confirm it manually.',
    });
  } catch (e) {
    return handleError(e);
  }
}
