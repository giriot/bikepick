import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { inr, relative } from '@/lib/format';
import { Empty, Notice, TrustBadge } from '@/components/ui';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'My listings', description: 'Manage your used-bike listings.', path: '/account/listings', robots: 'noindex,nofollow' });

const STATUS_COPY: Record<string, { tone: string; text: string }> = {
  draft: { tone: 'bg-surface text-ink-soft', text: 'Not submitted yet.' },
  submitted: { tone: 'bg-brand-50 text-brand-700', text: 'Received. Queued for verification.' },
  verification_required: { tone: 'bg-warn-soft text-[#8A5B00]', text: 'We need to verify your identity and documents before this goes live.' },
  under_review: { tone: 'bg-brand-50 text-brand-700', text: 'A moderator is reviewing your listing.' },
  approved: { tone: 'bg-emerald-50 text-emerald-700', text: 'Live and visible to buyers.' },
  needs_more_info: { tone: 'bg-warn-soft text-[#8A5B00]', text: 'Action needed — see the note from our team.' },
  rejected: { tone: 'bg-rose-50 text-rose-700', text: 'Not published. See the reason below.' },
  suspended: { tone: 'bg-rose-50 text-rose-700', text: 'Temporarily hidden by our team.' },
  sold: { tone: 'bg-surface text-ink-soft', text: 'Marked as sold.' },
  expired: { tone: 'bg-surface text-ink-soft', text: 'Listing expired.' },
};

export default async function MyListings() {
  const user = await requireUser();
  const rows = await db.all<any>(
    `SELECT u.*, (SELECT COUNT(*) FROM leads l WHERE l.used_bike_id = u.id) AS enquiries
       FROM used_bikes u WHERE u.seller_id = ? AND u.deleted_at IS NULL ORDER BY u.created_at DESC`,
    [user.id],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">My listings ({rows.length})</h2>
        <Link href="/used-bikes/sell" className="btn-primary btn-sm">List another bike</Link>
      </div>

      {rows.length === 0 ? (
        <Empty title="You have not listed a bike yet"
          body="Free listing, honest price guidance, and verification that helps buyers trust you."
          action={<Link href="/used-bikes/sell" className="btn-primary btn-sm">Sell your bike</Link>} />
      ) : (
        rows.map((l) => {
          const s = STATUS_COPY[l.status] || STATUS_COPY.draft;
          return (
            <article key={l.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold">{l.brand_name} {l.model_name} {l.variant_name || ''}</h3>
                    <span className={`badge ${s.tone}`}>{String(l.status).replace(/_/g, ' ')}</span>
                    {l.trust_score != null && <TrustBadge band={l.trust_band} score={l.trust_score} />}
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-mute">
                    {l.manufacture_year} · {Number(l.km_driven).toLocaleString('en-IN')} km · {l.city} · listed {relative(l.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-bold tracking-[-0.02em]">{inr(l.asking_price)}</p>
                  <p className="text-[12px] text-ink-mute">{l.view_count || 0} views · {l.enquiries} enquiries</p>
                </div>
              </div>

              <p className="mt-3 text-[13px] text-ink-soft">{s.text}</p>
              {l.rejection_reason || l.info_request && (
                <div className="mt-2"><Notice tone={l.status === 'rejected' ? 'danger' : 'warn'} title="Note from our team">{l.rejection_reason || l.info_request}</Notice></div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/used-bikes/${l.slug}`} className="btn-outline btn-sm">View listing</Link>
                {l.status === 'approved' && (
                  <form action={`/api/used-bikes/${l.id}/sold`} method="post">
                    <button className="btn-outline btn-sm">Mark as sold</button>
                  </form>
                )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
