import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { inr, dateIn } from '@/lib/format';
import { Notice } from '@/components/ui';
import { PlanCheckout } from '@/components/PlanCheckout';
import { payments } from '@/services/payments';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Plan & billing', description: 'Your dealer subscription.', path: '/dealer/subscription', robots: 'noindex,nofollow' });

export default async function SubscriptionPage() {
  const user = await requireUser();
  const dealer = await db.get<any>('SELECT * FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
  if (!dealer) redirect('/dealer/register');

  const [plans, current, history] = await Promise.all([
    db.all<any>('SELECT * FROM subscription_plans WHERE active = 1 ORDER BY sort_order, price'),
    db.get<any>(
      `SELECT s.*, p.name AS plan_name, p.lead_limit, p.offer_limit FROM subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.dealer_id = ? AND s.status='active' ORDER BY s.ends_at DESC LIMIT 1`, [dealer.id]),
    db.all<any>('SELECT * FROM payments WHERE dealer_id = ? ORDER BY created_at DESC LIMIT 10', [dealer.id]),
  ]);

  return (
    <div className="space-y-5">
      {!payments.configured() && (
        <Notice tone="warn" title="Online payment is not switched on">
          This installation has no payment gateway keys configured, so plan purchases are recorded as pending and confirmed
          manually by the site owner. Nothing is charged.
        </Notice>
      )}

      {current && (
        <div className="card p-5">
          <h2 className="text-[15px] font-semibold">Current plan: {current.plan_name}</h2>
          <p className="mt-1 text-[12.5px] text-ink-mute">
            Active until {dateIn(current.ends_at)} · {current.leads_used}/{current.lead_limit} leads used · {current.offer_limit} offer slots
          </p>
        </div>
      )}

      <div>
        <h2 className="text-[15px] font-semibold">Plans</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            let features: string[] = [];
            try { features = JSON.parse(p.features || '[]'); } catch { features = []; }
            const isCurrent = current?.plan_id === p.id;
            return (
              <div key={p.id} className={`card flex flex-col p-5 ${isCurrent ? 'border-brand-400 ring-2 ring-brand-100' : ''}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold">{p.name}</h3>
                  {p.featured_placement === 1 && <span className="badge bg-brand-50 text-brand-700">Featured placement</span>}
                </div>
                <p className="mt-2 text-[26px] font-bold leading-none tracking-[-0.03em]">
                  {p.price > 0 ? inr(p.price) : 'Free'}
                  {p.price > 0 && <span className="text-[12px] font-medium text-ink-mute"> / {p.duration_days} days</span>}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  <li className="flex gap-2 text-[12.5px] text-ink-soft"><span className="text-brand-600">✓</span>{p.lead_limit} leads included</li>
                  <li className="flex gap-2 text-[12.5px] text-ink-soft"><span className="text-brand-600">✓</span>{p.offer_limit} live offers</li>
                  {features.map((f) => <li key={f} className="flex gap-2 text-[12.5px] text-ink-soft"><span className="text-brand-600">✓</span>{f}</li>)}
                </ul>
                <div className="mt-4">
                  <PlanCheckout planId={p.id} label={current ? 'Switch to this plan' : 'Choose plan'} disabled={isCurrent} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5"><h2 className="text-[15px] font-semibold">Payment history</h2></div>
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-[11.5px] uppercase tracking-wide text-ink-mute">
              <tr><th className="px-5 py-2 text-left font-semibold">Date</th><th className="px-4 py-2 text-left font-semibold">Purpose</th><th className="px-4 py-2 text-right font-semibold">Amount</th><th className="px-5 py-2 text-right font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5">{dateIn(p.created_at)}</td>
                  <td className="px-4 py-2.5 capitalize">{p.purpose.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{inr(p.amount)}</td>
                  <td className="px-5 py-2.5 text-right"><span className={`badge ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-ink-soft'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
