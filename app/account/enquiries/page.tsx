import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { relative, titleCase } from '@/lib/format';
import { Empty } from '@/components/ui';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'My enquiries', description: 'Enquiries you sent.', path: '/account/enquiries', robots: 'noindex,nofollow' });

export default async function EnquiriesPage() {
  const user = await requireUser();
  const rows = await db.all<any>(
    `SELECT l.*, p.name AS product_name, d.business_name
       FROM leads l LEFT JOIN products p ON p.id = l.product_id
       LEFT JOIN dealer_profiles d ON d.id = l.dealer_id
      WHERE l.user_id = ? ORDER BY l.created_at DESC LIMIT 100`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold">My enquiries</h2>
      {rows.length === 0 ? (
        <Empty title="No enquiries yet" body="Ask for a best price, book a test ride or request an inspection — they all show up here."
          action={<Link href="/bikes" className="btn-primary btn-sm">Browse bikes</Link>} />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((l) => (
            <li key={l.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px] font-semibold">{titleCase(l.lead_type.replace(/_/g, ' '))}{l.product_name ? ` · ${l.product_name}` : ''}</p>
                <span className="badge bg-surface text-ink-soft">{l.status}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-ink-mute">
                {l.business_name ? `Sent to ${l.business_name}` : 'Sent to the Bikepick team'} · {relative(l.created_at)}
              </p>
              {l.message && <p className="mt-1.5 text-[12.5px] leading-5 text-ink-soft">{l.message}</p>}
              {l.dealer_note && (
                <div className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-[12.5px] text-brand-800"><strong>Reply:</strong> {l.dealer_note}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
