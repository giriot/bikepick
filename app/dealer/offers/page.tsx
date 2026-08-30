import { redirect } from 'next/navigation';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { inr, dateIn } from '@/lib/format';
import { Empty, Notice } from '@/components/ui';
import { OfferForm } from '@/components/OfferForm';
import { OfferActions } from '@/components/OfferActions';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'My offers', description: 'Manage your dealer offers.', path: '/dealer/offers', robots: 'noindex,nofollow' });

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-warn-soft text-[#8A5B00]', approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700', expired: 'bg-surface text-ink-soft', withdrawn: 'bg-surface text-ink-soft',
};

export default async function DealerOffers() {
  const user = await requireUser();
  const dealer = await db.get<any>('SELECT * FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
  if (!dealer) redirect('/dealer/register');
  if (dealer.status !== 'verified') redirect('/dealer');

  const today = nowIso().slice(0, 10);
  const [offers, products, sub] = await Promise.all([
    db.all<any>(
      `SELECT o.*, p.name AS product_name, b.name AS brand_name,
              (SELECT COUNT(*) FROM leads l WHERE l.offer_id = o.id) AS leads
         FROM dealer_offers o JOIN products p ON p.id = o.product_id JOIN brands b ON b.id = p.brand_id
        WHERE o.dealer_id = ? AND o.deleted_at IS NULL ORDER BY o.created_at DESC`, [dealer.id]),
    db.all<any>(
      `SELECT p.id, p.name, p.price_min, b.name AS brand_name FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.status='published' AND p.deleted_at IS NULL ORDER BY b.name, p.name`),
    db.get<any>(
      `SELECT p.offer_limit FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.dealer_id = ? AND s.status='active' ORDER BY s.ends_at DESC LIMIT 1`, [dealer.id]),
  ]);

  const live = offers.filter((o) => ['pending', 'approved'].includes(o.status)).length;
  const limit = sub?.offer_limit ?? 3;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">My offers</h2>
          <p className="text-[12.5px] text-ink-mute">{live} of {limit} live offer slots used on your current plan.</p>
        </div>
        {live < limit
          ? <OfferForm products={products.map((p) => ({ id: p.id, label: `${p.brand_name} ${p.name}`, price: p.price_min }))} city={dealer.city} />
          : <span className="text-[12.5px] text-ink-mute">Slot limit reached — withdraw one or upgrade.</span>}
      </div>

      <Notice tone="info" title="How approval works">
        Every offer is checked by our team before it appears publicly, usually within a working day. Offers expire on their
        end date automatically, so buyers never see a dead deal.
      </Notice>

      {offers.length === 0 ? (
        <Empty title="No offers yet" body="Publish your first offer to start receiving buyer enquiries for that model in your city." />
      ) : (
        <div className="space-y-3">
          {offers.map((o) => {
            const expired = o.end_date && o.end_date < today && o.status === 'approved';
            return (
              <article key={o.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14.5px] font-semibold">{o.brand_name} {o.product_name}</h3>
                      <span className={`badge ${STATUS_TONE[o.status] || 'bg-surface text-ink-soft'}`}>{expired ? 'expired' : o.status}</span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-mute">
                      {o.city}
                      {o.start_date ? ` · from ${dateIn(o.start_date)}` : ''}
                      {o.end_date ? ` · till ${dateIn(o.end_date)}` : ''}
                      {` · ${o.view_count || 0} views · ${o.leads} enquiries`}
                    </p>
                  </div>
                  <div className="text-right">
                    {(o.discount || o.exchange_bonus) ? (
                      <p className="text-[16px] font-bold tracking-[-0.02em] text-brand-700">
                        {inr((o.discount || 0) + (o.exchange_bonus || 0))} off
                      </p>
                    ) : null}
                    {o.on_road ? <p className="text-[12px] text-ink-mute">on-road {inr(o.on_road)}</p> : null}
                  </div>
                </div>

                <p className="mt-2 text-[13px] leading-6 text-ink-soft">{o.offer_text}</p>

                {o.status === 'rejected' && o.rejection_reason && (
                  <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">
                    <strong>Rejected:</strong> {o.rejection_reason}
                  </p>
                )}

                {['pending', 'approved'].includes(o.status) && (
                  <div className="mt-3 flex justify-end"><OfferActions id={o.id} /></div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
