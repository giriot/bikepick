import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { inr, relative } from '@/lib/format';
import { Stat, Empty } from '@/components/ui';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'My account', description: 'Your Bikepick.IN dashboard.', path: '/account', robots: 'noindex,nofollow' });

export default async function AccountHome() {
  const user = await requireUser();
  const [listings, alerts, saved, leads, reviews, notifications] = await Promise.all([
    db.all<any>("SELECT id, slug, brand_name, model_name, asking_price, status, created_at FROM used_bikes WHERE seller_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 3", [user.id]),
    db.get<any>("SELECT COUNT(*) AS c FROM price_alerts WHERE user_id = ? AND status='active'", [user.id]),
    db.get<any>('SELECT COUNT(*) AS c FROM saved_comparisons WHERE user_id = ?', [user.id]),
    db.get<any>('SELECT COUNT(*) AS c FROM leads WHERE user_id = ?', [user.id]),
    db.get<any>('SELECT COUNT(*) AS c FROM reviews WHERE user_id = ? AND deleted_at IS NULL', [user.id]),
    db.all<any>("SELECT * FROM notifications WHERE user_id = ? AND channel='in_app' ORDER BY created_at DESC LIMIT 6", [user.id]),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active price alerts" value={String(alerts?.c ?? 0)} />
        <Stat label="Saved comparisons" value={String(saved?.c ?? 0)} />
        <Stat label="Enquiries sent" value={String(leads?.c ?? 0)} />
        <Stat label="Reviews written" value={String(reviews?.c ?? 0)} />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">My listings</h2>
          <Link href="/account/listings" className="text-[13px] font-semibold text-brand-700 hover:underline">View all</Link>
        </div>
        {listings.length === 0 ? (
          <div className="mt-3">
            <Empty title="No listings yet" body="Sell your two-wheeler with a free, verified listing. It takes about five minutes."
              action={<Link href="/used-bikes/sell" className="btn-primary btn-sm">Sell your bike</Link>} />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/used-bikes/${l.slug}`} className="truncate text-[13.5px] font-medium hover:text-brand-700">
                    {l.brand_name} {l.model_name}
                  </Link>
                  <p className="text-[12px] text-ink-mute">{inr(l.asking_price)} · listed {relative(l.created_at)}</p>
                </div>
                <span className="badge bg-surface text-ink-soft">{String(l.status).replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-mute">Nothing yet. Price drops, listing updates and dealer replies appear here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {notifications.map((n) => (
              <li key={n.id} className="py-2.5">
                <p className="text-[13.5px] font-medium">{n.title}</p>
                {n.body && <p className="text-[12.5px] leading-5 text-ink-mute">{n.body}</p>}
                <p className="mt-0.5 text-[11.5px] text-ink-mute">{relative(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
