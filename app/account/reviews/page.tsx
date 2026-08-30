import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { relative } from '@/lib/format';
import { Empty } from '@/components/ui';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'My reviews', description: 'Reviews you wrote.', path: '/account/reviews', robots: 'noindex,nofollow' });

export default async function MyReviews() {
  const user = await requireUser();
  const rows = await db.all<any>(
    `SELECT r.*, p.name, p.slug, p.fuel_type, b.slug AS brand_slug, b.name AS brand_name
       FROM reviews r JOIN products p ON p.id = r.product_id JOIN brands b ON b.id = p.brand_id
      WHERE r.user_id = ? AND r.deleted_at IS NULL ORDER BY r.created_at DESC`,
    [user.id],
  );
  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold">My reviews</h2>
      {rows.length === 0 ? (
        <Empty title="No reviews yet" body="Owned one of these bikes? Your honest experience helps the next buyer."
          action={<Link href="/bikes" className="btn-primary btn-sm">Find your bike</Link>} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/${r.fuel_type === 'electric' ? 'electric' : 'bikes'}/${r.brand_slug}/${r.slug}`} className="text-[13.5px] font-semibold hover:text-brand-700">
                  {r.brand_name} {r.name}
                </Link>
                <span className={`badge ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : r.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-warn-soft text-[#8A5B00]'}`}>
                  {r.status === 'pending' ? 'awaiting moderation' : r.status}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-ink-mute">{r.rating}/5 · {relative(r.created_at)}</p>
              {r.title && <p className="mt-1.5 text-[13.5px] font-medium">{r.title}</p>}
              <p className="mt-1 text-[12.5px] leading-5 text-ink-soft">{r.body}</p>
              {r.rejection_reason && <p className="mt-2 text-[12px] text-rose-700">Moderator note: {r.rejection_reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
