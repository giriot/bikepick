import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { listUsedBikes } from '@/lib/queries';
import { inr, relative, titleCase } from '@/lib/format';
import { computeTrust, DEFAULT_TRUST_WEIGHTS, REQUIRED_ANGLES, type TrustWeights } from '@/lib/trust';
import { getJsonSetting } from '@/lib/settings';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';
import { Breadcrumbs, Notice, SectionHeader, TrustBadge } from '@/components/ui';
import { LeadDialog } from '@/components/LeadDialog';
import { SellerPhoneReveal } from '@/components/SellerPhoneReveal';
import { UsedBikeGallery } from '@/components/UsedBikeGallery';
import { SaveButton } from '@/components/SaveButton';
import { AdSlot } from '@/components/AdSlot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function load(slug: string) {
  const bike = await db.get<any>('SELECT * FROM used_bikes WHERE slug = ? AND deleted_at IS NULL', [slug]);
  if (!bike) return null;
  const [images, checks, dealer] = await Promise.all([
    db.all<any>('SELECT * FROM used_bike_images WHERE used_bike_id = ? AND approved = 1 ORDER BY sort_order', [bike.id]),
    db.all<any>("SELECT * FROM verification_records WHERE entity_type='used_bike' AND entity_id = ?", [bike.id]),
    bike.dealer_id ? db.get<any>('SELECT * FROM dealer_profiles WHERE id = ?', [bike.dealer_id]) : Promise.resolve(null),
  ]);
  return { bike, images, checks, dealer };
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await load(params.slug);
  if (!data || data.bike.status !== 'approved') {
    return buildMetadata({ title: 'Listing unavailable', description: 'This used-bike listing is not publicly available.', path: '/used-bikes', robots: 'noindex,follow' });
  }
  const b = data.bike;
  return buildMetadata({
    title: `Used ${b.brand_name} ${b.model_name} ${b.manufacture_year} in ${b.city} — ${inr(b.asking_price)}`,
    description: `${b.manufacture_year} ${b.brand_name} ${b.model_name}, ${Number(b.km_driven).toLocaleString('en-IN')} km, ${b.owners} owner. Trust score ${b.trust_score}/100 based on completed verification checks.`,
    path: `/used-bikes/${b.slug}`,
    image: data.images[0]?.image_url,
  });
}

export default async function UsedBikePage({ params }: { params: { slug: string } }) {
  const data = await load(params.slug);
  if (!data) notFound();
  const { bike, images, checks, dealer } = data;

  const user = await getCurrentUser();
  const isSaved = user
    ? !!(await db.get<any>('SELECT id FROM saved_products WHERE user_id = ? AND used_bike_id = ?', [user.id, bike.id]))
    : false;
  const isOwner = user?.id === bike.seller_id;
  const isStaff = !!user && ['admin', 'moderator', 'verifier'].includes(user.role);

  // Only approved listings are public (section 30).
  if (bike.status !== 'approved' && !isOwner && !isStaff) notFound();

  const weights = await getJsonSetting<TrustWeights>('trust_weights', DEFAULT_TRUST_WEIGHTS);
  const trust = computeTrust(
    {
      checks: checks.map((c: any) => ({ check_type: c.check_type, result: c.result })),
      photoAngles: images.map((i: any) => i.angle),
      infoFields: {
        insurance_status: bike.insurance_status, rc_available: bike.rc_available,
        loan_status: bike.loan_status, service_history: bike.service_history,
        accident_history: bike.accident_history, tyre_condition: bike.tyre_condition,
        description: bike.description,
      },
    },
    weights,
  );

  const similar = await listUsedBikes({ brand: bike.brand_name, perPage: 4 });
  const crumbs = [
    { name: 'Home', url: '/' },
    { name: 'Used bikes', url: '/used-bikes' },
    { name: bike.brand_name, url: `/used-bikes?brand=${encodeURIComponent(bike.brand_name)}` },
    { name: `${bike.model_name} ${bike.manufacture_year}`, url: `/used-bikes/${bike.slug}` },
  ];

  const verdictTone = bike.price_verdict === 'good_deal' ? 'success' : bike.price_verdict === 'high_price' ? 'warn' : 'info';
  const loginHref = `/login?next=${encodeURIComponent(`/used-bikes/${bike.slug}`)}`;

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      {bike.status !== 'approved' && (
        <div className="mt-4">
          <Notice tone="warn" title={`Listing status: ${titleCase(bike.status)}`}>
            This listing is not publicly visible yet. You can see it because you are the seller or a staff member.
          </Notice>
        </div>
      )}

      <div className="mt-4 grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <UsedBikeGallery
            images={images.map((image: any) => ({ id: image.id, angle: image.angle, image_url: image.image_url }))}
            brandName={bike.brand_name}
            modelName={bike.model_name}
            isElectric={bike.fuel_type === 'electric'}
            isDemo={bike.is_demo === 1}
          />
          <p className="mt-2 text-[11.5px] text-ink-mute">
            {images.length} of {REQUIRED_ANGLES.length} required angles uploaded. Seller documents are stored privately
            and are never shown publicly.
          </p>
        </div>

        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.035em] sm:text-[32px]">
            {bike.brand_name} {bike.model_name}
            {bike.variant_name ? <span className="text-ink-mute"> {bike.variant_name}</span> : null}
          </h1>
          <p className="mt-1 text-sm text-ink-mute">
            {bike.manufacture_year} · {Number(bike.km_driven).toLocaleString('en-IN')} km · {bike.owners} owner{bike.owners > 1 ? 's' : ''} · {bike.city}
          </p>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Asking price</p>
            <p className="text-[30px] font-bold tracking-[-0.03em]">{inr(bike.asking_price)}</p>
            {bike.estimated_price_min && (
              <div className="mt-2">
                <Notice tone={verdictTone as any}>
                  <strong>{bike.price_verdict === 'good_deal' ? 'Good deal' : bike.price_verdict === 'high_price' ? 'Above our estimate' : 'Fair price'}.</strong>{' '}
                  Our estimated market range for this bike is {inr(bike.estimated_price_min)}–{inr(bike.estimated_price_max)}.
                  Estimated market value only. Actual selling price may differ.
                </Notice>
              </div>
            )}
          </div>

          <div className="mt-4"><TrustBadge band={trust.band} score={trust.score} /></div>

          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ['Condition', titleCase(bike.condition_grade)],
              ['Insurance', titleCase(bike.insurance_status || 'not stated')],
              ['RC', titleCase(bike.rc_available || 'not stated')],
              ['Loan status', titleCase(bike.loan_status || 'not stated')],
              ['Service history', titleCase(bike.service_history || 'not stated')],
              ['Accident history', titleCase(bike.accident_history || 'not stated')],
              ['Tyres', titleCase(bike.tyre_condition || 'not stated')],
              ['ABS', bike.abs_equipped === 1 ? 'Yes' : bike.abs_equipped === 0 ? 'No' : 'Not stated'],
              ['Seller', titleCase(bike.seller_type)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line p-3">
                <dt className="text-[10.5px] uppercase tracking-wide text-ink-mute">{k}</dt>
                <dd className="mt-0.5 text-[13px] font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          {bike.description && <p className="mt-4 text-[13.5px] leading-6 text-ink-soft">{bike.description}</p>}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <LeadDialog
              leadType="used_bike_enquiry" label="Contact seller" className="btn-primary"
              title="Contact the seller"
              description="Your details are shared with the seller so they can reach you. Never pay an advance before physically inspecting the vehicle and its documents."
              usedBikeId={bike.id} dealerId={bike.dealer_id || undefined} city={bike.city} source={`used:${bike.slug}`}
              defaults={{ name: user?.full_name || '', phone: user?.phone || '', email: user?.email || '', city: user?.city || '' }}
            />
            <LeadDialog
              leadType="inspection" label="Book an inspection" className="btn-outline"
              title="Book a physical inspection"
              description="A partner inspector examines the vehicle and files a report. The inspection badge only appears on the listing once the inspection is actually completed."
              usedBikeId={bike.id} city={bike.city} source={`used:${bike.slug}`}
              extraFields={[{ name: 'preferred_date', label: 'Preferred date', type: 'date', required: true }]}
              defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }}
            />
            <SaveButton usedBikeId={bike.id} initialSaved={isSaved} className="btn-outline w-full justify-center" />
          </div>
          <div className="mt-3">
            {bike.status === 'approved' ? (
              <SellerPhoneReveal usedBikeId={bike.id} loggedIn={!!user} loginHref={loginHref} />
            ) : (
              <div className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[12px] text-ink-mute">
                Seller phone details become available to signed-in buyers after this listing is approved.
              </div>
            )}
          </div>

          {dealer && (
            <div className="mt-4 rounded-xl border border-line p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Listed by a verified dealer</p>
              <p className="mt-1 text-sm font-semibold">{dealer.business_name}</p>
              <p className="text-[12px] text-ink-mute">{dealer.city}, {dealer.state}</p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------- COMPACT VERIFICATION -------------------- */}
      <section className="mt-8">
        <SectionHeader title="Verification status" subtitle="A tick means the check was passed; a cross means it was not passed or has not been recorded." />
        <div className="card p-3 sm:p-4">
          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2" role="list" aria-label="Verification status">
            {['seller_identity', 'ownership_declaration', 'rc_verification', 'insurance_verification', 'puc_verification', 'loan_status', 'service_history', 'physical_inspection'].map((type) => {
              const rec = checks.find((c: any) => c.check_type === type);
              const passed = rec?.result === 'passed';
              const status = rec ? titleCase(rec.result) : 'Not checked';
              const label = titleCase(type);
              return (
                <div key={type} className="flex min-h-9 items-center justify-between gap-2 bg-white px-3 py-1.5" role="listitem">
                  <span className="text-[12px] font-medium leading-4">{label}</span>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${passed ? 'bg-accent-soft text-accent-dark' : 'bg-danger-soft text-danger'}`}
                    title={status}
                    aria-label={`${label}: ${status}`}
                  >
                    {passed ? (
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="m3 8.5 3.1 3.1L13 4.8" stroke="#00875C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="m4.2 4.2 7.6 7.6M11.8 4.2l-7.6 7.6" stroke="#E11D48" strokeWidth="2.3" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mt-4 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] leading-5 text-ink-soft">
        <strong className="text-ink">Before you buy:</strong> Physically inspect and test-ride the vehicle. Match the
        chassis and engine numbers with the original RC, review the seller’s original documents, insurance, loan/NOC and
        service records, and consider an inspection by a trusted mechanic. Bikepick.IN verification is limited to the
        checks shown above; it is not a mechanical warranty or a guarantee of condition. Never pay an advance before
        verifying the bike and seller.
      </div>

      <AdSlot slotKey="used_list_inline" className="mt-8" />

      {similar.items.filter((s: any) => s.id !== bike.id).length > 0 && (
        <section className="mt-12">
          <SectionHeader title={`More used ${bike.brand_name}`} action={<Link href={`/used-bikes?brand=${encodeURIComponent(bike.brand_name)}`} className="btn-outline btn-sm">See all</Link>} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {similar.items.filter((s: any) => s.id !== bike.id).slice(0, 4).map((s: any) => (
              <Link key={s.id} href={`/used-bikes/${s.slug}`} className="card card-hover p-3">
                <div className="product-stage aspect-[8/5]">
                  <Image src={s.image_url || '/media/used.svg'} alt="" width={300} height={188} loading="lazy" className="h-full w-full object-contain" />
                </div>
                <p className="mt-2 truncate text-[13.5px] font-medium">{s.brand_name} {s.model_name}</p>
                <p className="text-[11.5px] text-ink-mute">{s.manufacture_year} · {Number(s.km_driven).toLocaleString('en-IN')} km · {s.city}</p>
                <p className="mt-1 text-[14px] font-semibold">{inr(s.asking_price)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-[12px] leading-5 text-ink-mute">
        Listing published {relative(bike.approved_at || bike.created_at)}. Prices and availability are set by the seller
        and can change without notice. Read our{' '}
        <Link href="/legal/used-bike-terms" className="underline">used bike terms</Link> and{' '}
        <Link href="/legal/verification-terms" className="underline">verification terms</Link>.
      </p>
    </div>
  );
}
