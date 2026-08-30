import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProductBySlug, listProducts, listUsedBikes } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { getJsonSetting } from '@/lib/settings';
import { computeScore, DEFAULT_WEIGHTS, type ScoreWeights } from '@/lib/score';
import { runningCostPerKm } from '@/lib/compare';
import { inr, num, yesNo, dateIn, relative } from '@/lib/format';
import { buildMetadata, breadcrumbJsonLd, productJsonLd, faqJsonLd, JsonLd } from '@/lib/seo';
import { Breadcrumbs, Notice, ScoreRing, SectionHeader, TrustBadge } from '@/components/ui';
import { LeadDialog } from '@/components/LeadDialog';
import { PriceAlertButton } from '@/components/PriceAlertButton';
import { PriceHistoryChart, PriceHistoryRanges } from '@/components/PriceHistoryChart';
import { CompareToggle } from '@/components/CompareToggle';
import { SaveButton } from '@/components/SaveButton';
import { AdSlot } from '@/components/AdSlot';
import { AffiliateLink } from '@/components/AffiliateLink';
import { ReviewForm } from '@/components/ReviewForm';

export const dynamic = 'force-dynamic';

interface Params { params: { brand: string; slug: string }; searchParams: Record<string, string | undefined> }

export async function generateMetadata({ params }: Params) {
  const data = await getProductBySlug(params.brand, params.slug);
  if (!data) return buildMetadata({ title: 'Model not found', description: 'This model is not available.', path: '/bikes', robots: 'noindex,follow' });
  const { product } = data;
  const isEv = product.fuel_type === 'electric';
  const seo = await db.get<any>("SELECT * FROM seo_metadata WHERE entity_type='product' AND entity_id = ?", [product.id]);
  const path = `/${isEv ? 'electric' : 'bikes'}/${product.brand_slug}/${product.slug}`;
  return buildMetadata({
    title: seo?.title || `${product.brand_name} ${product.name} — Price, Specifications, Mileage & Review`,
    description:
      seo?.description ||
      `${product.brand_name} ${product.name} price from ${inr(product.price_min)} ex-showroom. Full specifications, Bikepick Score, running cost, dealer offers, pros and cons.`,
    path,
    image: data.images[0]?.image_url,
    keywords: [`${product.brand_name} ${product.name}`, `${product.name} price`, `${product.name} specifications`, `${product.name} mileage`],
  });
}

export default async function ProductPage({ params, searchParams }: Params) {
  const data = await getProductBySlug(params.brand, params.slug);
  if (!data || data.product.status !== 'published' || data.product.deleted_at) notFound();

  const { product, variants, images, bike, ev, sources, offers, reviews, priceHistory } = data;
  const isEv = product.fuel_type === 'electric';
  const base = isEv ? 'electric' : 'bikes';
  const user = await getCurrentUser();
  const isSaved = user
    ? !!(await db.get<any>('SELECT id FROM saved_products WHERE user_id = ? AND product_id = ?', [user.id, product.id]))
    : false;

  // Recompute the score live from the current specs + admin weights.
  const weights = await getJsonSetting<ScoreWeights>('score_weights', DEFAULT_WEIGHTS);
  const medianRow = await db.get<any>(
    `SELECT price_min FROM products WHERE status='published' AND category_id = ? AND price_min IS NOT NULL
      ORDER BY price_min LIMIT 1 OFFSET (SELECT COUNT(*)/2 FROM products WHERE status='published' AND category_id = ? AND price_min IS NOT NULL)`,
    [product.category_id, product.category_id],
  );
  const scored = computeScore(
    { price: product.price_min, fuelType: product.fuel_type, bike, ev, segment: { medianPrice: medianRow?.price_min } },
    weights,
  );

  const entity = { id: product.id, name: product.name, brand: product.brand_name, slug: product.slug, brandSlug: product.brand_slug, image: null, price: product.price_min, fuelType: product.fuel_type, score: scored.total, bike, ev };
  const costPerKm = runningCostPerKm(entity as any);

  const [similar, usedOfModel, accessories] = await Promise.all([
    listProducts({ category: base, minPrice: (product.price_min || 0) * 0.7, maxPrice: (product.price_min || 0) * 1.35, perPage: 5 }),
    listUsedBikes({ q: product.name, perPage: 3 }),
    db.all<any>("SELECT * FROM affiliate_links WHERE status='active' AND deleted_at IS NULL AND (product_id = ? OR product_id IS NULL) ORDER BY product_id DESC LIMIT 6", [product.id]),
  ]);

  const pros: string[] = product.pros ? JSON.parse(product.pros) : [];
  const cons: string[] = product.cons ? JSON.parse(product.cons) : [];
  const approvedReviews = reviews;
  const avgRating = approvedReviews.length
    ? approvedReviews.reduce((a: number, r: any) => a + r.rating, 0) / approvedReviews.length
    : null;

  const crumbs = [
    { name: 'Home', url: '/' },
    { name: isEv ? 'Electric' : 'Bikes & Scooters', url: `/${base}` },
    { name: product.brand_name, url: `/${base}?brand=${product.brand_slug}` },
    { name: product.name, url: `/${base}/${product.brand_slug}/${product.slug}` },
  ];

  const faqs = [
    { question: `What is the price of the ${product.brand_name} ${product.name}?`, answer: `The ${product.brand_name} ${product.name} starts at ${inr(product.price_min)} ex-showroom in our database${product.is_demo ? ' (demo dataset — not a live market price)' : ''}. On-road price varies by city, insurance and registration charges.` },
    ...(isEv
      ? [{ question: `What is the real-world range of the ${product.name}?`, answer: ev?.real_world_range_km ? `The manufacturer claims ${num(ev.claimed_range_km, 'km')}. Our own estimate for mixed city riding is about ${num(ev.real_world_range_km, 'km')}. ${ev.range_basis || ''}` : 'A real-world range estimate has not been recorded for this model yet.' }]
      : [{ question: `What mileage does the ${product.name} deliver?`, answer: bike?.mileage_kmpl ? `The recorded mileage figure is ${bike.mileage_kmpl} kmpl, which works out to roughly ₹${costPerKm?.toFixed(2)} per kilometre at ₹104.5 per litre. Real mileage varies with riding style, load and traffic.` : 'A mileage figure has not been recorded for this model yet.' }]),
    { question: `Does the ${product.name} have ABS?`, answer: bike?.abs_type ? `Yes — ${bike.abs_type} ABS is recorded for this model.` : bike?.cbs === 1 ? 'This model is recorded with CBS (combined braking), not ABS.' : 'No ABS or CBS information has been recorded for this model.' },
    { question: `How is the Bikepick Score of ${scored.total}/100 calculated?`, answer: `The score combines seven weighted pillars — value, features, performance, safety, running cost, comfort and maintenance — computed only from structured specifications and price. Advertising and dealer payments can never influence it.` },
  ];

  const range = (searchParams.range as string) || '1y';

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={productJsonLd({
        name: `${product.brand_name} ${product.name}`,
        description: product.description || `${product.brand_name} ${product.name} specifications and price.`,
        brand: product.brand_name,
        image: images[0]?.image_url, url: `/${base}/${product.brand_slug}/${product.slug}`,
        price: product.price_min, offerCount: offers.length,
        reviewCount: approvedReviews.length, ratingValue: avgRating, isDemo: product.is_demo === 1,
      })} />
      <JsonLd data={faqJsonLd(faqs)} />

      <div className="container-xl py-6">
        <Breadcrumbs items={crumbs} />

        {/* ------------------------------ HERO ------------------------------ */}
        <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="product-stage aspect-[8/5] border border-line">
              <Image
                src={images[0]?.image_url || `/media/${isEv ? 'ev-scooter' : 'street'}.svg`}
                alt={images[0]?.alt_text || `${product.brand_name} ${product.name}`}
                width={880} height={550} priority
                sizes="(max-width: 1024px) 100vw, 620px"
                className="h-full w-full object-contain"
              />
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                {isEv && <span className="badge-ev">Electric</span>}
                {product.is_demo === 1 && <span className="badge-demo">Demo data</span>}
              </div>
            </div>
            {images.length > 1 && (
              <ul className="mt-3 grid grid-cols-5 gap-2">
                {images.slice(0, 5).map((img: any) => (
                  <li key={img.id} className="product-stage aspect-[4/3] border border-line">
                    <Image src={img.image_url} alt={img.alt_text || ''} width={160} height={120} loading="lazy" className="h-full w-full object-contain" />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11.5px] leading-5 text-ink-mute">
              {images[0]?.license_status === 'owned_placeholder'
                ? 'Image shown is an original Bikepick illustration placeholder, not an official manufacturer photograph. An administrator can upload licensed photography from the admin panel.'
                : `Image source: ${images[0]?.source_name || 'not recorded'} · Licence status: ${images[0]?.license_status || 'unknown'}`}
            </p>
          </div>

          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-600">{product.brand_name}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] sm:text-[38px]">{product.name}</h1>
            <p className="mt-2 text-sm leading-6 text-ink-mute">{product.description}</p>

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Ex-showroom from</p>
                <p className="text-[26px] font-bold tracking-[-0.03em]">{inr(product.price_min)}</p>
                {product.price_max && product.price_max !== product.price_min && (
                  <p className="text-[12px] text-ink-mute">up to {inr(product.price_max)} for the top variant</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-3">
                <ScoreRing score={scored.total} />
                <div className="max-w-[130px]">
                  <p className="text-[12px] font-semibold">Bikepick Score</p>
                  <p className="text-[11px] leading-4 text-ink-mute">Data coverage {scored.coverage}%</p>
                  <a href="#score" className="text-[11px] font-medium text-brand-600 hover:underline">How it&apos;s calculated</a>
                </div>
              </div>
            </div>

            {product.is_demo === 1 && (
              <div className="mt-3">
                <Notice tone="warn" title="Demo record">
                  This model is part of the seeded demo dataset. The price shown is illustrative for testing and is not a
                  live market price. Replace it with an authorised feed or CSV import before launch.
                </Notice>
              </div>
            )}

            {/* Key specs */}
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(isEv
                ? [
                    ['Claimed range', num(ev?.claimed_range_km, 'km')],
                    ['Our estimate', num(ev?.real_world_range_km, 'km')],
                    ['Battery', num(ev?.battery_capacity_kwh, 'kWh')],
                    ['Top speed', num(ev?.top_speed_kmph, 'km/h')],
                  ]
                : [
                    ['Engine', num(bike?.engine_capacity_cc, 'cc')],
                    ['Power', num(bike?.max_power_bhp, 'bhp')],
                    ['Mileage', num(bike?.mileage_kmpl, 'kmpl')],
                    ['Kerb weight', num(bike?.kerb_weight_kg, 'kg')],
                  ]
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line p-3">
                  <dt className="text-[10.5px] uppercase tracking-wide text-ink-mute">{k}</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            {/* Variants */}
            {variants.length > 0 && (
              <div className="mt-5">
                <h2 className="mb-2 text-sm font-semibold">Variants</h2>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {variants.map((v: any) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div>
                        <p className="text-[13.5px] font-medium">{v.name}</p>
                        {v.colours && <p className="text-[11.5px] text-ink-mute">{v.colours}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[13.5px] font-semibold">{inr(v.price)}</p>
                        <p className="text-[11px] text-ink-mute">est. on-road {inr(v.on_road_price)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions — all real */}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <LeadDialog
                leadType="best_price" label="Get best price" className="btn-primary"
                title="Get the best price" description={`Share your details and verified dealers for the ${product.name} in your city will contact you with their best offer.`}
                productId={product.id} source={`product:${product.slug}`}
                defaults={{ name: user?.full_name || '', phone: user?.phone || '', email: user?.email || '', city: user?.city || '' }}
              />
              <LeadDialog
                leadType="test_ride" label="Book a test ride" className="btn-outline"
                title="Book a test ride" description="We pass your preferred date to a verified dealer in your city. Confirmation depends on dealer availability."
                productId={product.id} source={`product:${product.slug}`}
                extraFields={[{ name: 'preferred_date', label: 'Preferred date', type: 'date', required: true }]}
                defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }}
              />
              <LeadDialog
                leadType="finance" label="Get a finance offer" className="btn-outline"
                title="Request a finance offer" description="Your details go to our finance partners and the dealer. Approval, rate and eligibility are decided by the lender — we never guarantee approval."
                productId={product.id} source={`product:${product.slug}`}
                extraFields={[{ name: 'down_payment', label: 'Planned down payment (₹)', type: 'number' }, { name: 'tenure_months', label: 'Preferred tenure', options: ['12', '24', '36', '48', '60'] }]}
                defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }}
              />
              <LeadDialog
                leadType="insurance" label="Get an insurance quote" className="btn-outline"
                title="Request an insurance quote" description="Insurance is provided by third-party partners, not by Bikepick.IN. We share your enquiry with them."
                productId={product.id} source={`product:${product.slug}`}
                defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }}
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <CompareToggle productId={product.id} label={`${product.brand_name} ${product.name}`} />
              <PriceAlertButton productId={product.id} currentPrice={product.price_min} signedIn={!!user} />
              <SaveButton productId={product.id} initialSaved={isSaved} className="btn-outline w-full justify-center" />
            </div>
          </div>
        </div>

        {/* --------------------------- DEALER OFFERS ------------------------ */}
        <section className="mt-12" id="offers">
          <SectionHeader
            title="Dealer offers"
            subtitle="Published by verified dealers and reviewed before going live. Expired offers are removed automatically."
          />
          {offers.length === 0 ? (
            <div className="card p-5 text-sm text-ink-mute">
              No live dealer offers for this model right now. Use <strong className="text-ink">Get best price</strong> above
              and verified dealers in your city will respond.
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {offers.map((o: any) => (
                <li key={o.id} className="card flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{o.business_name}</p>
                      <p className="text-[12px] text-ink-mute">{o.dealer_city} · valid till {dateIn(o.end_date)}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {o.featured === 1 && <span className="badge-sponsored">Featured</span>}
                      {o.is_demo === 1 && <span className="badge-demo">Demo</span>}
                    </div>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-6 text-ink-soft">{o.offer_text}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                    <div><dt className="text-[10px] uppercase text-ink-mute">Discount</dt><dd className="text-[13px] font-semibold text-accent-dark">{inr(o.discount)}</dd></div>
                    <div><dt className="text-[10px] uppercase text-ink-mute">Exchange</dt><dd className="text-[13px] font-semibold">{o.exchange_bonus ? inr(o.exchange_bonus) : '—'}</dd></div>
                    <div><dt className="text-[10px] uppercase text-ink-mute">Est. on-road</dt><dd className="text-[13px] font-semibold">{inr(o.on_road)}</dd></div>
                  </dl>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <LeadDialog leadType="contact_dealer" label="Contact dealer" className="btn-outline btn-sm"
                      title={`Contact ${o.business_name}`} description="Your enquiry is sent straight to this dealer's lead dashboard."
                      productId={product.id} dealerId={o.dealer_id} offerId={o.id} city={o.city} source={`offer:${o.id}`}
                      defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }} />
                    <LeadDialog leadType="request_offer" label="Request this offer" className="btn-primary btn-sm"
                      title="Request this offer" description="Dealer offers require confirmation. The dealer will contact you to confirm availability and final pricing."
                      productId={product.id} dealerId={o.dealer_id} offerId={o.id} city={o.city} source={`offer:${o.id}`}
                      defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AdSlot slotKey="product_sidebar" className="mt-8" />

        {/* ---------------------------- SCORE DETAIL ------------------------ */}
        <section className="mt-12" id="score">
          <SectionHeader title={`Why this scores ${scored.total}/100`} subtitle="Seven weighted pillars computed only from structured specifications and price." />
          <div className="grid gap-3 md:grid-cols-2">
            {scored.pillars.map((p) => (
              <div key={p.key} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{p.label}</p>
                  <span className="text-[13px] font-semibold text-brand-600">{p.score}/100 <span className="font-normal text-ink-mute">· {p.weight}% weight</span></span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface" role="presentation">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${p.score}%` }} />
                </div>
                <p className="mt-2 text-[12.5px] leading-5 text-ink-mute">{p.reason}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-mute">
            Pillars with no supporting data are excluded and the remaining weights re-normalised — this record has {scored.coverage}% coverage.
            Advertising, featured placement and dealer subscriptions can never influence this score.
          </p>
        </section>

        {/* ------------------------------ SPECS ----------------------------- */}
        <section className="mt-12" id="specifications">
          <SectionHeader title="Full specifications" subtitle="Empty fields mean the value has not been verified — we never guess." />
          <div className="grid gap-4 lg:grid-cols-2">
            {(isEv ? EV_GROUPS(ev, bike) : BIKE_GROUPS(bike)).map((group) => (
              <div key={group.title} className="card overflow-hidden">
                <h3 className="border-b border-line bg-surface px-4 py-2.5 text-[13px] font-semibold">{group.title}</h3>
                <dl className="divide-y divide-line">
                  {group.rows.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                      <dt className="text-[13px] text-ink-mute">{label}</dt>
                      <dd className="max-w-[58%] text-right text-[13px] font-medium">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <AdSlot slotKey="product_below_specs" className="mt-8" />

        {/* --------------------------- PROS / CONS -------------------------- */}
        {(pros.length > 0 || cons.length > 0) && (
          <section className="mt-12">
            <SectionHeader title="Pros and cons" subtitle="Editorial assessment based on the recorded specification set." />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-accent-dark">
                  <span aria-hidden="true">✓</span> What works
                </h3>
                <ul className="mt-3 space-y-2">
                  {pros.map((p) => <li key={p} className="flex gap-2 text-[13.5px] leading-6 text-ink-soft"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />{p}</li>)}
                </ul>
              </div>
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
                  <span aria-hidden="true">!</span> What to consider
                </h3>
                <ul className="mt-3 space-y-2">
                  {cons.map((c) => <li key={c} className="flex gap-2 text-[13.5px] leading-6 text-ink-soft"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />{c}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[['Best for', product.best_for], ['Who should buy', product.who_should_buy], ['Who should avoid', product.who_should_avoid]].map(([k, v]) => v ? (
                <div key={k as string} className="rounded-xl border border-line bg-surface p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{k}</p>
                  <p className="mt-1 text-[13px] leading-6 text-ink-soft">{v}</p>
                </div>
              ) : null)}
            </div>
          </section>
        )}

        {/* --------------------------- RUNNING COST ------------------------- */}
        <section className="mt-12">
          <SectionHeader title="Running cost" subtitle="Estimates based on the recorded efficiency figures and default fuel/electricity prices." />
          <div className="card grid gap-4 p-5 sm:grid-cols-4">
            <Metric label="Cost per km" value={costPerKm ? `₹${costPerKm.toFixed(2)}` : '—'} note="estimate" />
            <Metric label="500 km / month" value={costPerKm ? inr(costPerKm * 500) : '—'} note="energy only" />
            <Metric label="1,000 km / month" value={costPerKm ? inr(costPerKm * 1000) : '—'} note="energy only" />
            <Metric label="Service interval" value={bike?.service_interval_km ? `${bike.service_interval_km.toLocaleString('en-IN')} km` : '—'} note={bike?.est_service_cost ? `~${inr(bike.est_service_cost)} per service` : 'cost not recorded'} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/tools/ev-vs-petrol" className="chip">Compare against an EV →</Link>
            <Link href="/tools/emi" className="chip">Calculate EMI →</Link>
          </div>
        </section>

        {/* --------------------------- PRICE HISTORY ------------------------ */}
        <section className="mt-12" id="price-history">
          <SectionHeader title="Price history" subtitle="Every recorded price point with its source and date." action={<PriceHistoryRanges active={range} />} />
          <div className="card p-5">
            <PriceHistoryChart points={priceHistory} range={range} />
          </div>
        </section>

        {/* ------------------------------ REVIEWS --------------------------- */}
        <section className="mt-12" id="reviews">
          <SectionHeader
            title="Owner reviews"
            subtitle={approvedReviews.length ? `${approvedReviews.length} approved review${approvedReviews.length > 1 ? 's' : ''} · average ${avgRating?.toFixed(1)}/5` : 'No approved reviews yet. We never publish fabricated reviews.'}
          />
          {approvedReviews.length > 0 && (
            <ul className="grid gap-3 md:grid-cols-2">
              {approvedReviews.map((r: any) => (
                <li key={r.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{r.title || 'Owner review'}</p>
                    <span className="badge bg-brand-50 text-brand-700">{r.rating}/5</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-mute">
                    {r.full_name || 'Verified account'} · {r.variant_name || 'variant not stated'} · {r.km_driven ? `${Number(r.km_driven).toLocaleString('en-IN')} km` : 'km not stated'} · {relative(r.created_at)}
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-ink-soft">{r.body}</p>
                  {(r.pros || r.cons) && (
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                      {r.pros && <div><dt className="font-semibold text-accent-dark">Pros</dt><dd className="text-ink-mute">{r.pros}</dd></div>}
                      {r.cons && <div><dt className="font-semibold text-danger">Cons</dt><dd className="text-ink-mute">{r.cons}</dd></div>}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <ReviewForm productId={product.id} signedIn={!!user} variants={variants.map((v: any) => v.name)} />
          </div>
        </section>

        {/* --------------------------- ACCESSORIES -------------------------- */}
        {accessories.length > 0 && (
          <section className="mt-12">
            <SectionHeader title="Recommended accessories" subtitle="Affiliate links — we may earn a commission at no extra cost to you." />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accessories.map((a: any) => (
                <li key={a.id}><AffiliateLink link={a} /></li>
              ))}
            </ul>
          </section>
        )}

        {/* ------------------------- SIMILAR + USED ------------------------- */}
        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div>
            <SectionHeader title="Similar models" subtitle="Comparable options in the same price band." />
            <ul className="card divide-y divide-line">
              {similar.items.filter((s) => s.id !== product.id).slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3">
                  <Image src={s.image_url || '/media/commuter.svg'} alt="" width={64} height={40} className="h-10 w-16 object-contain" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/${s.fuel_type === 'electric' ? 'electric' : 'bikes'}/${s.brand_slug}/${s.slug}`} className="block truncate text-[13.5px] font-medium hover:text-brand-600">
                      {s.brand_name} {s.name}
                    </Link>
                    <p className="text-[11.5px] text-ink-mute">{inr(s.price_min)} · Score {s.score ?? '—'}</p>
                  </div>
                  <Link href={`/compare?ids=${product.id},${s.id}`} className="btn-outline btn-sm">Compare</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeader title={`Used ${product.name}`} subtitle="Approved listings currently on the marketplace." />
            {usedOfModel.items.length === 0 ? (
              <div className="card p-5 text-sm text-ink-mute">
                No approved used listings for this model right now.{' '}
                <Link href="/used-bikes" className="text-brand-600 underline">Browse all used bikes</Link>.
              </div>
            ) : (
              <ul className="card divide-y divide-line">
                {usedOfModel.items.map((u: any) => (
                  <li key={u.id} className="flex items-center gap-3 p-3">
                    <Image src={u.image_url || '/media/used.svg'} alt="" width={64} height={40} className="h-10 w-16 object-contain" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/used-bikes/${u.slug}`} className="block truncate text-[13.5px] font-medium hover:text-brand-600">
                        {u.brand_name} {u.model_name} · {u.manufacture_year}
                      </Link>
                      <p className="text-[11.5px] text-ink-mute">{u.city} · {Number(u.km_driven).toLocaleString('en-IN')} km</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13.5px] font-semibold">{inr(u.asking_price)}</p>
                      <TrustBadge band={u.trust_band} score={u.trust_score} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* -------------------------------- FAQ ----------------------------- */}
        <section className="mt-12">
          <SectionHeader title="Frequently asked questions" />
          <div className="card divide-y divide-line">
            {faqs.map((f) => (
              <details key={f.question} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-[14px] font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {f.question}
                    <span className="text-ink-mute transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-[13px] leading-6 text-ink-mute">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ------------------------- SOURCE INFORMATION --------------------- */}
        <section className="mt-12">
          <SectionHeader title="Source information" subtitle="Where this record came from and how confident we are in it." />
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-mute">
                <tr><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5">Scope</th><th className="px-4 py-2.5">Extracted</th><th className="px-4 py-2.5">Confidence</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sources.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-4 text-ink-mute">No source recorded for this product yet.</td></tr>
                ) : sources.map((s: any) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-medium">
                      {s.source_url ? <a href={s.source_url} rel="nofollow noopener" target="_blank" className="text-brand-600 underline">{s.source_name}</a> : s.source_name}
                    </td>
                    <td className="px-4 py-2.5 text-ink-mute">{s.field_scope || '—'}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{dateIn(s.extracted_at)}</td>
                    <td className="px-4 py-2.5">{s.confidence != null ? `${Math.round(s.confidence * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-ink-mute">
            Specifications can vary by variant, model year and market. Prices change frequently and exclude insurance,
            registration and dealer handling unless stated. Always confirm with the dealer before purchase.
          </p>
        </section>
      </div>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-[-0.02em]">{value}</p>
      <p className="text-[11.5px] text-ink-mute">{note}</p>
    </div>
  );
}

function BIKE_GROUPS(b: any) {
  return [
    { title: 'Engine & transmission', rows: [
      ['Engine type', b?.engine_type], ['Displacement', num(b?.engine_capacity_cc, 'cc')],
      ['Max power', b?.max_power_bhp ? `${b.max_power_bhp} bhp${b.max_power_rpm ? ` @ ${b.max_power_rpm} rpm` : ''}` : null],
      ['Max torque', b?.max_torque_nm ? `${b.max_torque_nm} Nm${b.max_torque_rpm ? ` @ ${b.max_torque_rpm} rpm` : ''}` : null],
      ['Transmission', b?.transmission], ['Clutch', b?.clutch], ['Gearbox', b?.gearbox],
      ['Top speed', num(b?.top_speed_kmph, 'km/h')], ['Mileage (claimed)', num(b?.mileage_kmpl, 'kmpl')],
      ['Fuel tank', num(b?.fuel_tank_l, 'L')],
    ] as [string, any][] },
    { title: 'Dimensions & weight', rows: [
      ['Length', num(b?.length_mm, 'mm')], ['Width', num(b?.width_mm, 'mm')], ['Height', num(b?.height_mm, 'mm')],
      ['Wheelbase', num(b?.wheelbase_mm, 'mm')], ['Seat height', num(b?.seat_height_mm, 'mm')],
      ['Ground clearance', num(b?.ground_clearance_mm, 'mm')], ['Kerb weight', num(b?.kerb_weight_kg, 'kg')],
    ] as [string, any][] },
    { title: 'Brakes, tyres & suspension', rows: [
      ['Front brake', b?.front_brake], ['Rear brake', b?.rear_brake], ['ABS', b?.abs_type || null],
      ['CBS', b?.cbs === null || b?.cbs === undefined ? null : yesNo(b.cbs)],
      ['Traction control', b?.traction_control === null || b?.traction_control === undefined ? null : yesNo(b.traction_control)],
      ['Front suspension', b?.suspension_front], ['Rear suspension', b?.suspension_rear],
      ['Front tyre', b?.front_tyre], ['Rear tyre', b?.rear_tyre], ['Wheel type', b?.wheel_type],
    ] as [string, any][] },
    { title: 'Features & technology', rows: [
      ['Headlight', b?.headlight], ['Tail light', b?.tail_light],
      ['DRL', b?.drl === null || b?.drl === undefined ? null : yesNo(b.drl)],
      ['Instrument cluster', b?.instrument_cluster],
      ['Bluetooth', b?.bluetooth === null || b?.bluetooth === undefined ? null : yesNo(b.bluetooth)],
      ['Navigation', b?.navigation === null || b?.navigation === undefined ? null : yesNo(b.navigation)],
      ['USB charging', b?.usb_charging === null || b?.usb_charging === undefined ? null : yesNo(b.usb_charging)],
      ['Keyless start', b?.keyless_start === null || b?.keyless_start === undefined ? null : yesNo(b.keyless_start)],
      ['Cruise control', b?.cruise_control === null || b?.cruise_control === undefined ? null : yesNo(b.cruise_control)],
      ['Ride modes', b?.ride_modes],
      ['Hill hold', b?.hill_hold === null || b?.hill_hold === undefined ? null : yesNo(b.hill_hold)],
    ] as [string, any][] },
    { title: 'Ownership', rows: [
      ['Warranty', b?.warranty], ['Service interval', b?.service_interval_km ? `${b.service_interval_km.toLocaleString('en-IN')} km` : null],
      ['Estimated service cost', b?.est_service_cost ? inr(b.est_service_cost) : null],
      ['Colours', b?.colours], ['Accessories', b?.accessories],
    ] as [string, any][] },
  ];
}

function EV_GROUPS(e: any, b: any) {
  return [
    { title: 'Motor & performance', rows: [
      ['Motor power (continuous)', num(e?.motor_power_kw, 'kW')], ['Peak power', num(e?.peak_power_kw, 'kW')],
      ['Torque', num(e?.torque_nm, 'Nm')], ['Top speed', num(e?.top_speed_kmph, 'km/h')],
      ['Ride modes', e?.ride_modes], ['Reverse mode', b?.reverse_mode === null || b?.reverse_mode === undefined ? null : yesNo(b.reverse_mode)],
      ['Regenerative braking', e?.regen_braking === null || e?.regen_braking === undefined ? null : yesNo(e.regen_braking)],
    ] as [string, any][] },
    { title: 'Battery, range & charging', rows: [
      ['Battery capacity', num(e?.battery_capacity_kwh, 'kWh')], ['Battery chemistry', e?.battery_chemistry],
      ['Range — manufacturer claimed', num(e?.claimed_range_km, 'km')],
      ['Range — Bikepick estimate', num(e?.real_world_range_km, 'km')],
      ['Estimate basis', e?.range_basis],
      ['Full charge time', num(e?.charging_time_hours, 'hrs')],
      ['Fast charging', e?.fast_charging === null || e?.fast_charging === undefined ? null : yesNo(e.fast_charging)],
      ['Fast charge time', e?.fast_charge_time_min ? `${e.fast_charge_time_min} min` : null],
      ['Charging connector', e?.charging_connector],
      ['Home charging', e?.home_charging === null || e?.home_charging === undefined ? null : yesNo(e.home_charging)],
      ['Portable charger', e?.portable_charger === null || e?.portable_charger === undefined ? null : yesNo(e.portable_charger)],
      ['Battery IP rating', e?.battery_ip_rating], ['Motor IP rating', e?.motor_ip_rating],
    ] as [string, any][] },
    { title: 'Chassis & features', rows: [
      ['Kerb weight', num(e?.kerb_weight_kg || b?.kerb_weight_kg, 'kg')],
      ['Seat height', num(b?.seat_height_mm, 'mm')], ['Ground clearance', num(b?.ground_clearance_mm, 'mm')],
      ['Front brake', b?.front_brake], ['Rear brake', b?.rear_brake],
      ['CBS', b?.cbs === null || b?.cbs === undefined ? null : yesNo(b.cbs)],
      ['Front suspension', b?.suspension_front], ['Rear suspension', b?.suspension_rear],
      ['Instrument cluster', b?.instrument_cluster],
      ['Bluetooth', b?.bluetooth === null || b?.bluetooth === undefined ? null : yesNo(b.bluetooth)],
      ['Navigation', b?.navigation === null || b?.navigation === undefined ? null : yesNo(b.navigation)],
    ] as [string, any][] },
    { title: 'Ownership & cost', rows: [
      ['Vehicle warranty', e?.warranty], ['Battery warranty', e?.battery_warranty],
      ['Running cost', e?.running_cost_per_km ? `₹${e.running_cost_per_km}/km (estimate)` : null],
      ['Estimated battery replacement', e?.est_battery_replacement_cost ? inr(e.est_battery_replacement_cost) : null],
    ] as [string, any][] },
  ];
}
