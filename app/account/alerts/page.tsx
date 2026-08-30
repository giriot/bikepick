import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { inr, relative } from '@/lib/format';
import { Empty } from '@/components/ui';
import { AlertRowActions } from '@/components/AlertRowActions';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Price alerts', description: 'Your price alerts.', path: '/account/alerts', robots: 'noindex,nofollow' });

export default async function AlertsPage() {
  const user = await requireUser();
  const rows = await db.all<any>(
    `SELECT a.*, p.name, p.slug, p.price_min, p.fuel_type, b.slug AS brand_slug, b.name AS brand_name
       FROM price_alerts a JOIN products p ON p.id = a.product_id JOIN brands b ON b.id = p.brand_id
      WHERE a.user_id = ? ORDER BY a.status='active' DESC, a.created_at DESC`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold">Price alerts</h2>
      <p className="text-[13px] text-ink-mute">
        We check prices whenever our data pipeline updates a model. If the price reaches your target you get a notification —
        and an email if you have enabled email notifications.
      </p>
      {rows.length === 0 ? (
        <Empty title="No price alerts yet" body="Open any bike page and tap “Set price alert” to track it."
          action={<Link href="/bikes" className="btn-primary btn-sm">Browse bikes</Link>} />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/${a.fuel_type === 'electric' ? 'electric' : 'bikes'}/${a.brand_slug}/${a.slug}`} className="text-[13.5px] font-semibold hover:text-brand-700">
                  {a.brand_name} {a.name}
                </Link>
                <p className="text-[12px] text-ink-mute">
                  Target {inr(a.target_price)} · current {inr(a.price_min)}
                  {a.city ? ` · ${a.city}` : ''} · created {relative(a.created_at)}
                </p>
                {a.status === 'triggered' && <p className="text-[12px] font-semibold text-emerald-700">Triggered {relative(a.triggered_at)}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="badge bg-surface text-ink-soft">{a.status}</span>
                {a.status === 'active' && <AlertRowActions id={a.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
