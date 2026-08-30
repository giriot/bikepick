import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, insert, nowIso, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { payments } from '@/services/payments';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

const schema = z.object({
  payment_id: z.string().min(1),
  provider_payment_id: z.string().min(1),
  signature: z.string().min(1),
});

/** Signature-verified confirmation. An unverified signature never activates anything. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const b = schema.parse(await readJson(req));

    const payment = await db.get<any>('SELECT * FROM payments WHERE id = ? AND user_id = ?', [b.payment_id, user.id]);
    if (!payment) return fail('Payment not found', 404);
    if (payment.status === 'paid') return ok({ id: payment.id }, 'Already confirmed');

    const valid = payments.verify({
      orderId: payment.provider_order_id, paymentId: b.provider_payment_id, signature: b.signature,
    });
    if (!valid) {
      await db.run("UPDATE payments SET status='failed', failure_reason='signature_mismatch', updated_at=? WHERE id=?", [nowIso(), payment.id]);
      await audit(user, 'payment.verify_failed', 'payment', payment.id);
      return fail('Payment could not be verified', 400);
    }

    await db.run("UPDATE payments SET status='paid', provider_payment_id=?, updated_at=? WHERE id=?",
      [b.provider_payment_id, nowIso(), payment.id]);

    if (payment.purpose === 'subscription' && payment.dealer_id) {
      const plan = await db.get<any>('SELECT * FROM subscription_plans WHERE id = ?', [payment.reference_id]);
      if (plan) {
        await db.run("UPDATE subscriptions SET status='expired', updated_at=? WHERE dealer_id=? AND status='active'", [nowIso(), payment.dealer_id]);
        await insert('subscriptions', {
          id: uid('sub'), dealer_id: payment.dealer_id, user_id: user.id, plan_id: plan.id,
          status: 'active', starts_at: nowIso(),
          ends_at: new Date(Date.now() + plan.duration_days * 86400000).toISOString(),
          leads_used: 0, payment_id: payment.id, auto_renew: 0,
        });
      }
    }
    if (payment.purpose === 'featured_listing') {
      await db.run('UPDATE used_bikes SET featured=1, featured_until=?, updated_at=? WHERE id=?',
        [new Date(Date.now() + 30 * 86400000).toISOString(), nowIso(), payment.reference_id]);
    }
    if (payment.purpose === 'inspection') {
      await db.run("UPDATE inspections SET status='scheduled', payment_id=?, updated_at=? WHERE id=?", [payment.id, nowIso(), payment.reference_id]);
    }

    await insert('revenue_events', {
      id: uid('rev'), stream: payment.purpose, amount: payment.amount, currency: 'INR',
      reference_type: 'payment', reference_id: payment.id, dealer_id: payment.dealer_id,
      user_id: user.id, occurred_at: nowIso(),
    });

    await notify({ userId: user.id, event: 'payment_received', title: 'Payment confirmed', body: `We received ₹${payment.amount}.`, link: '/account' });
    await audit(user, 'payment.verified', 'payment', payment.id);
    return ok({ id: payment.id }, 'Payment confirmed');
  } catch (e) {
    return handleError(e);
  }
}
