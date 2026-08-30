import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { relative, inr } from '@/lib/format';
import { Empty } from '@/components/ui';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Saved comparisons', description: 'Comparisons you saved.', path: '/account/saved', robots: 'noindex,nofollow' });

export default async function SavedPage() {
  const user = await requireUser();
  const rows = await db.all<any>('SELECT * FROM saved_comparisons WHERE user_id = ? ORDER BY created_at DESC', [user.id]);
  const items = await db.all<any>(
    `SELECT s.id, s.created_at,
            p.name AS product_name, p.slug AS product_slug, p.fuel_type, p.price_min,
            b.name AS brand, b.slug AS brand_slug,
            u.brand_name, u.model_name, u.slug AS used_slug, u.asking_price, u.city
       FROM saved_products s
       LEFT JOIN products p ON p.id = s.product_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN used_bikes u ON u.id = s.used_bike_id
      WHERE s.user_id = ? ORDER BY s.created_at DESC`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold">Saved bikes &amp; listings</h2>
        {items.length === 0 ? (
          <Empty title="No saved bikes yet" body="Tap Save on any model or used listing to keep it here."
            action={<Link href="/bikes" className="btn-primary btn-sm">Browse bikes</Link>} />
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {items.map((i) => {
              const href = i.product_slug
                ? `/${i.fuel_type === 'electric' ? 'electric' : 'bikes'}/${i.brand_slug}/${i.product_slug}`
                : `/used-bikes/${i.used_slug}`;
              const title = i.product_slug ? `${i.brand} ${i.product_name}` : `${i.brand_name} ${i.model_name}`;
              const price = i.product_slug ? i.price_min : i.asking_price;
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <Link href={href} className="text-[13.5px] font-semibold hover:text-brand-700">{title}</Link>
                    <p className="text-[12px] text-ink-mute">
                      {price ? inr(price) : 'Price not published'}{i.city ? ` · ${i.city}` : ''} · Saved {relative(i.created_at)}
                    </p>
                  </div>
                  <Link href={href} className="btn-outline btn-sm">View</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <h2 className="text-[15px] font-semibold">Saved comparisons</h2>
      {rows.length === 0 ? (
        <Empty title="Nothing saved yet" body="Compare two to four bikes, then hit “Save this comparison” to keep a shareable link."
          action={<Link href="/compare" className="btn-primary btn-sm">Start comparing</Link>} />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/compare/${c.slug}`} className="text-[13.5px] font-semibold hover:text-brand-700">{c.title}</Link>
                <p className="text-[12px] text-ink-mute">Saved {relative(c.created_at)} · {c.view_count || 0} views</p>
              </div>
              <Link href={`/compare?ids=${c.product_ids}`} className="btn-outline btn-sm">Open</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
