import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { inr, relative } from '@/lib/format';
import { Stat, Empty } from '@/components/ui';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Dealer dashboard', description: 'Your dealership performance.', path: '/dealer', robots: 'noindex,nofollow' });

export default async function DealerDashboard() {
  const user = await requireUser();
  const dealer = await db.get<any>('SELECT * FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
  if (!dealer) redirect('/dealer/register');

  const today = nowIso().slice(0, 10);
  const [leadsTotal, leadsNew, leadsConverted, liveOffers, recentLeads, sub, expiring] = await Promise.all([
    db.get<any>('SELECT COUNT(*) AS c FROM leads WHERE dealer_id = ?', [dealer.id]),
    db.get<any>("SELECT COUNT(*) AS c FROM leads WHERE dealer_id = ? AND status='new'", [dealer.id]),
    db.get<any>("SELECT COUNT(*) AS c FROM leads WHERE dealer_id = ? AND status='converted'", [dealer.id]),
    db.get<any>("SELECT COUNT(*) AS c FROM dealer_offers WHERE dealer_id = ? AND status='approved' AND deleted_at IS NULL", [dealer.id]),
    db.all<any>(
      `SELECT l.*, p.name AS product_name FROM leads l LEFT JOIN products p ON p.id = l.product_id
        WHERE l.dealer_id = ? ORDER BY l.created_at DESC LIMIT 6`, [dealer.id]),
    db.get<any>(
      `SELECT s.*, p.name AS plan_name, p.lead_limit, p.offer_limit FROM subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.dealer_id = ? AND s.status='active' ORDER BY s.ends_at DESC LIMIT 1`, [dealer.id]),
    db.all<any>(
      `SELECT o.*, p.name AS product_name FROM dealer_offers o JOIN products p ON p.id = o.product_id
        WHERE o.dealer_id = ? AND o.status='approved' AND o.end_date IS NOT NULL AND o.end_date <= ?
        ORDER BY o.end_date LIMIT 5`,
      [dealer.id, new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)]),
  ]);

  const conversion = leadsTotal?.c ? Math.round(((leadsConverted?.c || 0) / leadsTotal.c) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total leads" value={String(leadsTotal?.c ?? 0)} />
        <Stat label="Awaiting response" value={String(leadsNew?.c ?? 0)} hint={leadsNew?.c ? 'Respond today' : 'All caught up'} />
        <Stat label="Converted" value={String(leadsConverted?.c ?? 0)} hint={`${conversion}% conversion`} />
        <Stat label="Live offers" value={String(liveOffers?.c ?? 0)} />
      </div>

      {sub ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">{sub.plan_name} plan</h2>
              <p className="text-[12.5px] text-ink-mute">
                Renews {new Date(sub.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ·
                {' '}{sub.leads_used}/{sub.lead_limit} leads used · up to {sub.offer_limit} live offers
              </p>
            </div>
            <Link href="/dealer/subscription" className="btn-outline btn-sm">Manage plan</Link>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (sub.leads_used / Math.max(1, sub.lead_limit)) * 100)}%` }} />
          </div>
        </section>
      ) : (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-[15px] font-semibold">No active plan</h2>
            <p className="text-[12.5px] text-ink-mute">You are on the free tier: 3 live offers and a capped lead allowance.</p>
          </div>
          <Link href="/dealer/subscription" className="btn-primary btn-sm">See plans</Link>
        </section>
      )}

      {expiring.length > 0 && (
        <section className="card border-amber-200 bg-amber-50/60 p-5">
          <h2 className="text-[15px] font-semibold text-amber-900">Offers expiring within 7 days</h2>
          <ul className="mt-2 space-y-1.5">
            {expiring.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 text-[13px] text-amber-900">
                <span>{o.product_name} · {o.city}</span>
                <span className="font-medium">ends {o.end_date}</span>
              </li>
            ))}
          </ul>
          <Link href="/dealer/offers" className="btn-outline btn-sm mt-3">Renew offers</Link>
        </section>
      )}

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Latest leads</h2>
          <Link href="/dealer/leads" className="text-[13px] font-semibold text-brand-700 hover:underline">View all</Link>
        </div>
        {recentLeads.length === 0 ? (
          <div className="mt-3"><Empty title="No leads yet" body="Publish competitive offers and your listings start receiving buyer enquiries." action={<Link href="/dealer/offers" className="btn-primary btn-sm">Create an offer</Link>} /></div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {recentLeads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-[13.5px] font-medium">{l.name} · {l.phone}</p>
                  <p className="text-[12px] text-ink-mute">
                    {l.lead_type.replace(/_/g, ' ')}{l.product_name ? ` · ${l.product_name}` : ''} · {relative(l.created_at)}
                  </p>
                </div>
                <span className={`badge ${l.status === 'new' ? 'bg-brand-50 text-brand-700' : 'bg-surface text-ink-soft'}`}>{l.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
