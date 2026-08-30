import Link from 'next/link';
import { db } from '@/lib/db';
import { relative } from '@/lib/format';
import { Breadcrumbs, Empty, Pagination } from '@/components/ui';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Owner Reviews — Real Experiences from Indian Riders',
  description: 'Moderated owner reviews of bikes, EV bikes and EV scooters in India. Every review is checked before publication and no brand can pay to remove one.',
  path: '/reviews',
});

const PER = 20;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" className={`h-3.5 w-3.5 ${n <= rating ? 'fill-amber-400' : 'fill-line'}`} aria-hidden="true">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.8 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: { page?: string; rating?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const rating = searchParams.rating ? Number(searchParams.rating) : null;
  const where = `r.status='approved' AND r.deleted_at IS NULL${rating ? ' AND r.rating = ?' : ''}`;
  const args = rating ? [rating] : [];

  const [rows, count, summary] = await Promise.all([
    db.all<any>(
      `SELECT r.*, u.full_name, p.name AS product_name, p.slug, p.fuel_type, b.slug AS brand_slug, b.name AS brand_name
         FROM reviews r JOIN products p ON p.id = r.product_id JOIN brands b ON b.id = p.brand_id
         LEFT JOIN users u ON u.id = r.user_id
        WHERE ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [...args, PER, (page - 1) * PER],
    ),
    db.get<any>(`SELECT COUNT(*) AS c FROM reviews r WHERE ${where}`, args),
    db.get<any>("SELECT COUNT(*) AS c, AVG(rating) AS avg FROM reviews WHERE status='approved' AND deleted_at IS NULL"),
  ]);

  const pages = Math.max(1, Math.ceil((count?.c || 0) / PER));
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Reviews', url: '/reviews' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Owner reviews</h1>
          <p className="mt-1.5 text-sm leading-6 text-ink-mute">
            Written by people who actually paid for the bike. Every review passes moderation before it appears, and we do not
            remove negative reviews at a brand&apos;s request.
          </p>
        </div>
        {summary?.c > 0 && (
          <div className="rounded-2xl border border-line bg-white px-5 py-3 text-center">
            <p className="text-[26px] font-bold leading-none tracking-[-0.03em]">{Number(summary.avg).toFixed(1)}</p>
            <Stars rating={Math.round(summary.avg)} />
            <p className="mt-1 text-[11.5px] text-ink-mute">{summary.c} published reviews</p>
          </div>
        )}
      </header>

      <nav className="mt-5 flex flex-wrap gap-2">
        <Link href="/reviews" className={`chip ${!rating ? 'chip-active' : ''}`}>All ratings</Link>
        {[5, 4, 3, 2, 1].map((n) => (
          <Link key={n} href={`/reviews?rating=${n}`} className={`chip ${rating === n ? 'chip-active' : ''}`}>{n} star</Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="mt-6">
          <Empty title="No published reviews yet"
            body="Reviews appear here once an owner submits one and our moderators approve it. Own one of these bikes? Add yours."
            action={<Link href="/bikes" className="btn-primary btn-sm">Find your bike</Link>} />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {rows.map((r) => (
              <article key={r.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/${r.fuel_type === 'electric' ? 'electric' : 'bikes'}/${r.brand_slug}/${r.slug}`}
                      className="text-[14.5px] font-semibold hover:text-brand-700">{r.brand_name} {r.product_name}</Link>
                    {r.variant_name && <p className="text-[12px] text-ink-mute">{r.variant_name}</p>}
                  </div>
                  <Stars rating={r.rating} />
                </div>
                {r.title && <p className="mt-2.5 text-[14px] font-semibold">{r.title}</p>}
                <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">{r.body}</p>
                {(r.pros || r.cons) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {r.pros && <div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Liked</p><p className="mt-0.5 text-[12.5px] leading-5 text-emerald-900">{r.pros}</p></div>}
                    {r.cons && <div className="rounded-xl bg-rose-50 px-3 py-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Disliked</p><p className="mt-0.5 text-[12.5px] leading-5 text-rose-900">{r.cons}</p></div>}
                  </div>
                )}
                <p className="mt-3 text-[11.5px] text-ink-mute">
                  {r.full_name || 'Verified owner'}
                  {r.ownership_months ? ` · owned ${r.ownership_months} months` : ''}
                  {r.km_driven ? ` · ${Number(r.km_driven).toLocaleString('en-IN')} km` : ''}
                  {' · '}{relative(r.created_at)}
                </p>
              </article>
            ))}
          </div>
          <Pagination page={page} pages={pages} base={`/reviews${rating ? `?rating=${rating}` : ""}`} />
        </>
      )}
    </div>
  );
}
