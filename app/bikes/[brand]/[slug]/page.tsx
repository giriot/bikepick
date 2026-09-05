import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProductBySlug, listProducts, listUsedBikes } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { getJsonSetting } from '@/lib/settings';
import { computeScore, DEFAULT_WEIGHTS, type ScoreWeights } from '@/lib/score';
import { runningCostPerKm } from '@/lib/compare';
import { inr, num, yesNo, dateIn, relative, toStrArray } from '@/lib/format';
import { buildMetadata, breadcrumbJsonLd, productJsonLd, JsonLd } from '@/lib/seo';
import { Breadcrumbs, Notice, ScoreRing, SectionHeader, TrustBadge } from '@/components/ui';
import { LeadDialog } from '@/components/LeadDialog';
import { PriceAlertButton } from '@/components/PriceAlertButton';
import { CompareToggle } from '@/components/CompareToggle';
import { SaveButton } from '@/components/SaveButton';
import { VariantTable } from '@/components/VariantTable';
import { FullSpecSheet } from '@/components/FullSpecSheet';
import { ProductGallery } from '@/components/ProductGallery';
import { SpecSuggestionForm } from '@/components/SpecSuggestionForm';
import { featureAdvantage } from '@/lib/spec-dots';
import { AdSlot } from '@/components/AdSlot';
import { AffiliateLink } from '@/components/AffiliateLink';
import { ReviewForm } from '@/components/ReviewForm';
import { batteryTone } from '@/lib/battery-tone';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  const { product, variants, images, bike, ev, offers, reviews } = data;
  const isEv = product.fuel_type === 'electric';

  // On-road (approx.) shown next to ex-showroom — from researched variant on-road prices.
  const onRoadPrices = variants
    .map((v: any) => v.on_road_price)
    .filter((x: any) => typeof x === 'number' && x > 0)
    .sort((a: number, b: number) => a - b);
  const onRoadMin = onRoadPrices[0] ?? null;

  // Per-variant spec rows (variant_id set) for the side-by-side variant table.
  const specTable = isEv ? 'ev_specs' : 'bike_specs';
  const vSpecRows = variants.length
    ? await db.all<any>(`SELECT * FROM ${specTable} WHERE product_id = ? AND variant_id IS NOT NULL`, [product.id])
    : [];
  const vSpecMap: Record<string, any> = {};
  for (const r of vSpecRows) vSpecMap[r.variant_id] = r;
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

  const pros: string[] = toStrArray(product.pros);
  const cons: string[] = toStrArray(product.cons);
  const bestFor: string[] = (typeof product.best_for === 'string' ? product.best_for : '')
    .split(/[,;•]+/).map((s: string) => s.trim()).filter(Boolean);
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
      <div className="container-xl py-6">
        <Breadcrumbs items={crumbs} />

        {/* ------------------------------ HERO ------------------------------ */}
        <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <ProductGallery
              images={images as any}
              isEv={isEv}
              isDemo={product.is_demo === 1}
              brandName={product.brand_name}
              productName={product.name}
            />

            {/* Below the gallery (user-directed): Cost per km → Similar models
                → Pros & cons → Suitable for */}
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5">
                <p className="text-[12.5px] font-semibold">
                  Cost per km <span className="font-normal text-ink-mute">(energy only, {isEv ? 'electricity' : 'fuel'})</span>
                </p>
                <p className="whitespace-nowrap text-[15px] font-bold">
                  {costPerKm ? `₹${costPerKm.toFixed(2)}` : '—'}
                  <span className="ml-1.5 text-[10.5px] font-normal text-ink-mute">estimate</span>
                </p>
              </div>

              <div>
                <h3 className="text-[13.5px] font-semibold">Similar models</h3>
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-white">
                  {similar.items.filter((s) => s.id !== product.id).slice(0, 4).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 p-2.5">
                      <Image src={s.image_url || '/media/commuter.svg'} alt="" width={56} height={36} className="h-9 w-14 shrink-0 object-contain" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/${s.fuel_type === 'electric' ? 'electric' : 'bikes'}/${s.brand_slug}/${s.slug}`} className="block truncate text-[12.5px] font-medium hover:text-brand-600">
                          {s.brand_name} {s.name}
                        </Link>
                        <p className="text-[11px] text-ink-mute">{inr(s.price_min)} · Score {s.score ?? '—'}</p>
                      </div>
                      <Link href={`/compare?ids=${product.id},${s.id}`} className="shrink-0 text-[11px] font-medium text-brand-600 hover:underline">Compare</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-[13.5px] font-semibold">Pros &amp; cons</h3>
                {pros.length > 0 || cons.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {pros.length > 0 && (
                      <p className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[12px] leading-5 text-emerald-900 ring-1 ring-emerald-100">
                        <span className="font-bold text-emerald-700">✓ Works — </span>{pros.join('; ')}
                      </p>
                    )}
                    {cons.length > 0 && (
                      <p className="rounded-md bg-rose-50 px-2.5 py-1.5 text-[12px] leading-5 text-rose-900 ring-1 ring-rose-100">
                        <span className="font-bold text-rose-700">! Consider — </span>{cons.join('; ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11.5px] leading-5 text-ink-mute">
                    Not recorded yet — the admin saves pros &amp; cons from the AI template on the spec sheet.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-[13.5px] font-semibold">Suitable for</h3>
                {bestFor.length > 0 ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bestFor.map((b) => (
                        <span key={b} className="rounded-full bg-surface px-2.5 py-1 text-[12px] text-ink-soft ring-1 ring-line">{b}</span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-ink-mute">From the AI template — saved by the admin.</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-[11.5px] leading-5 text-ink-mute">
                    The admin records this from the AI template when the full specifications are generated.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-brand-600">
              {product.brand_logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.brand_logo as string} alt="" className="max-h-[18px] max-w-[26px] rounded-sm object-contain" />
              )}
              {product.brand_name}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] sm:text-[38px]">{product.name}</h1>
            <p className="mt-2 text-sm leading-6 text-ink-mute">{product.description}</p>

            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Ex-showroom from</p>
                <p className="text-[26px] font-bold tracking-[-0.03em]">{inr(product.price_min)}</p>
                {product.price_max && product.price_max !== product.price_min && (
                  <p className="text-[12px] text-ink-mute">up to {inr(product.price_max)} for the top variant</p>
                )}
                {onRoadMin != null && (
                  <p className="text-[12px] text-ink-mute">
                    On-road approx. <span className="font-semibold text-ink">{inr(onRoadMin)}</span> (est., before personalisation)
                  </p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-4">
                <ScoreRing score={scored.total} showValue={false} />
                <div className="min-w-0 max-w-[160px]">
                  <p className="text-[12px] font-semibold">Bikepick Score</p>
                  <p className="mt-1 flex items-baseline gap-1 text-[22px] font-bold leading-none tracking-tight">
                    {scored.total}
                    <span className="text-[12px] font-medium text-ink-mute">/100</span>
                  </p>
                  <p className="mt-1.5 text-[11px] leading-4 text-ink-mute">Data coverage {scored.coverage}%</p>
                  <a href="#score" className="mt-0.5 inline-block text-[11px] font-medium text-brand-600 hover:underline">How it&apos;s calculated</a>
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

            {/* Dealer offers — right of the ex-showroom price */}
            <section className="mt-5" id="offers">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Dealer offers</h2>
              {offers.length === 0 ? (
                <p className="mt-2 rounded-xl border border-line bg-surface px-3.5 py-3 text-[12px] leading-5 text-ink-mute">
                  No live dealer offers for this model right now — use <strong className="text-ink">Get best price</strong> below
                  and verified dealers in your city will respond.
                </p>
              ) : (
                <ul className="mt-2 space-y-2.5">
                  {offers.slice(0, 4).map((o: any) => (
                    <li key={o.id} className="rounded-xl border border-line bg-white p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-semibold leading-5">{o.business_name}</p>
                          <p className="text-[11.5px] text-ink-mute">{o.dealer_city} · valid till {dateIn(o.end_date)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          {o.featured === 1 && <span className="badge-sponsored">Featured</span>}
                          {o.is_demo === 1 && <span className="badge-demo">Demo</span>}
                        </div>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-5 text-ink-soft">{o.offer_text}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-[11.5px]">
                        {o.discount ? <span><span className="text-ink-mute">Disc. </span><span className="font-semibold text-accent-dark">{inr(o.discount)}</span></span> : null}
                        {o.exchange_bonus ? <span><span className="text-ink-mute">Exchange </span><span className="font-semibold">{inr(o.exchange_bonus)}</span></span> : null}
                        {o.on_road ? <span><span className="text-ink-mute">On-road </span><span className="font-semibold">{inr(o.on_road)}</span></span> : null}
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <LeadDialog leadType="contact_dealer" label="Contact dealer" className="btn-outline btn-sm"
                          title={`Contact ${o.business_name}`} description="Your enquiry is sent straight to this dealer's lead dashboard."
                          productId={product.id} dealerId={o.dealer_id} offerId={o.id} city={o.city} source={`offer:${o.id}`}
                          defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }} />
                        <LeadDialog leadType="request_offer" label="Request offer" className="btn-primary btn-sm"
                          title="Request this offer" description="Dealer offers require confirmation. The dealer will contact you to confirm availability and final pricing."
                          productId={product.id} dealerId={o.dealer_id} offerId={o.id} city={o.city} source={`offer:${o.id}`}
                          defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

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

            {/* Variants — side-by-side comparison table */}
            {variants.length > 0 && (
              <VariantTable
                variants={variants}
                vSpecMap={vSpecMap}
                modelSpec={isEv ? ev : bike}
                isEv={isEv}
                fuelLabel={isEv ? 'Electric' : 'Petrol'}
                priceFrom={product.price_min}
              />
            )}

            {/* Full specification sheet */}
            <FullSpecSheet bike={bike} ev={ev} isEv={isEv} />

            {/* Actions — all real, compact */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <LeadDialog
                leadType="best_price" label="Get best price" className="btn-primary btn-sm"
                title="Get the best price" description={`Share your details and verified dealers for the ${product.name} in your city will contact you with their best offer.`}
                productId={product.id} source={`product:${product.slug}`}
                defaults={{ name: user?.full_name || '', phone: user?.phone || '', email: user?.email || '', city: user?.city || '' }}
              />
              <LeadDialog
                leadType="test_ride" label="Book a test ride" className="btn-outline btn-sm"
                title="Book a test ride" description="We pass your preferred date to a verified dealer in your city. Confirmation depends on dealer availability."
                productId={product.id} source={`product:${product.slug}`}
                extraFields={[{ name: 'preferred_date', label: 'Preferred date', type: 'date', required: true }]}
                defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }}
              />
              <LeadDialog
                leadType="finance" label="Get a finance offer" className="btn-outline btn-sm"
                title="Request a finance offer" description="Your details go to our finance partners and the dealer. Approval, rate and eligibility are decided by the lender — we never guarantee approval."
                productId={product.id} source={`product:${product.slug}`}
                extraFields={[{ name: 'down_payment', label: 'Planned down payment (₹)', type: 'number' }, { name: 'tenure_months', label: 'Preferred tenure', options: ['12', '24', '36', '48', '60'] }]}
                defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }}
              />
              <LeadDialog
                leadType="insurance" label="Get an insurance quote" className="btn-outline btn-sm"
                title="Request an insurance quote" description="Insurance is provided by third-party partners, not by Bikepick.IN. We share your enquiry with them."
                productId={product.id} source={`product:${product.slug}`}
                defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }}
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <CompareToggle productId={product.id} label={`${product.brand_name} ${product.name}`} className="w-full" />
              <PriceAlertButton productId={product.id} currentPrice={product.price_min} signedIn={!!user} />
            </div>
            <div className="mt-2">
              <SaveButton productId={product.id} initialSaved={isSaved} className="btn-outline btn-sm w-full justify-center gap-2" />
            </div>
          </div>
        </div>

        <AdSlot slotKey="product_sidebar" className="mt-8" />

        {/* ------------------------------ SPECS ----------------------------- */}
        <section className="mt-12" id="specifications">
          <SectionHeader title="Full specifications" subtitle="Empty fields mean the value has not been verified — we never guess." />
          {/* Green-dot legend */}
          <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-mute">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            </span>
            Green dot = a class-leading or genuinely useful feature — hover (or long-press on mobile) the dot for its advantage.
          </div>
          {/* Excel-style sheet: ONE table. 6 columns on wide screens (3 ×
              label/value pairs per row, as many rows as required), 2 columns
              (1 pair per row) on mobile. Group bands mark each section. */}
          <div className="card overflow-hidden">
            <div className="grid grid-cols-2 min-[900px]:grid-cols-[1.1fr_1.6fr_1.1fr_1.6fr_1.1fr_1.6fr]">
              {(() => {
                const groups = (isEv
                  ? EV_GROUPS(ev, bike, product, onRoadMin)
                  : BIKE_GROUPS(bike, product, onRoadMin)
                ).filter((g) => g.rows.length > 0);
                const cells: any[] = [];
                for (const group of groups) {
                  cells.push(
                    <div key={`${group.title}-head`} className="col-span-2 min-[900px]:col-span-6 border-b border-line bg-surface px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide">
                      {group.title}
                    </div>,
                  );
                  // Grid-column tracking on desktop (band starts a new row).
                  // `col` = column occupied by the last pushed cell (1–6).
                  let col = 0;
                  for (const [label, value] of group.rows) {
                    col += 1; // label
                    const valueCol = col + 1; // value (2, 4 or 6)
                    const rich = value && typeof value === 'object'
                      ? value as { text: string; badge?: string; cls?: string; note?: string }
                      : null;
                    const text = rich ? rich.text : (value as any);
                    const adv = featureAdvantage(label, typeof text === 'string' ? text : String(text ?? ''));
                    cells.push(
                      <div key={`${group.title}-${label}-dt`} className="border-b border-line px-4 py-1.5 text-[12.5px] text-ink-mute">{label}</div>,
                      <div key={`${group.title}-${label}-dd`} className="border-b border-r border-line px-4 py-1.5 text-[12.5px] font-medium">
                        {rich ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {rich.text}
                            {rich.badge && (
                              <span title={rich.note} className={`cursor-help rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ring-1 ${rich.cls || 'bg-surface text-ink-mute ring-line'}`}>
                                {rich.badge}
                              </span>
                            )}
                          </span>
                        ) : text === 'Yes'
                          ? <span className="font-semibold text-emerald-600">Yes</span>
                          : text === 'No'
                            ? <span className="font-semibold text-rose-600">No</span>
                            : (text || '—')}
                        {adv && (
                          <span
                            title={adv}
                            className="group/dot relative ml-1.5 inline-flex h-4 w-4 cursor-help items-center justify-center align-middle"
                          >
                            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                            <span
                              className={`pointer-events-none absolute bottom-full z-30 mb-2 hidden w-60 rounded-lg bg-ink px-3 py-2 text-left text-[11.5px] font-normal leading-4 text-white shadow-pop group-hover/dot:block ${
                                valueCol === 6 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                              }`}
                            >
                              {adv}
                            </span>
                          </span>
                        )}
                      </div>,
                    );
                    col = valueCol === 6 ? 0 : valueCol;
                  }
                  // (Pros & cons moved out of the sheet — they now sit below the
                  //  Cost per km card in the "Why this scores" section.)
                }
                return cells;
              })()}
            </div>
          </div>
        </section>

        {/* ------------------------- SCORE BREAKDOWN ------------------------
            Below Full specifications (user-directed). Cost per km, Similar
            models, Pros & cons and Suitable for now sit below the bike image
            in the hero. */}
        <section className="mt-12" id="score">
          <SectionHeader
            title={`Why this scores ${scored.total}/100`}
            subtitle="A highlight of this bike — weighted pillars computed only from structured specifications and price."
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {scored.pillars.map((p) => (
              <div key={p.key} className="rounded-lg border border-line bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12.5px] font-semibold">{p.label}</p>
                  <span className="text-[11.5px] font-semibold text-brand-600">{p.score}/100 <span className="font-normal text-ink-mute">· {p.weight}%</span></span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface" role="presentation">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${p.score}%` }} />
                </div>
                <p className="mt-1.5 text-[11.5px] leading-4 text-ink-mute">{p.reason}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] leading-4 text-ink-mute">
            Pillars with no supporting data are excluded and weights re-normalised — {scored.coverage}% coverage. Advertising,
            featured placement and dealer subscriptions can never influence this score.
          </p>
        </section>

        <SpecSuggestionForm productId={product.id} productName={product.name} />

        <AdSlot slotKey="product_below_specs" className="mt-8" />

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

        {/* ------------------------------ USED ------------------------------ */}
        <section className="mt-12">
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

      </div>
    </>
  );
}



function parseExtras(s: any): [string, any][] {
  if (!s?.extras) return [];
  try {
    const obj = typeof s.extras === 'string' ? JSON.parse(s.extras) : s.extras;
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).filter(([, v]) => v != null && String(v).trim() !== '').slice(0, 8);
  } catch {
    return [];
  }
}

const STANDARD_LABELS = new Set([
  'Price', 'Ex-showroom from', 'Top variant', 'On-road (approx.)', 'Model year', 'Body type', 'Fuel type',
  'Engine type', 'Displacement', 'Max power', 'Max torque', 'Transmission', 'Clutch', 'Gearbox', 'Top speed',
  'Mileage (claimed)', 'Fuel tank', 'Length', 'Width', 'Height', 'Wheelbase', 'Seat height', 'Ground clearance',
  'Kerb weight', 'Front brake', 'Rear brake', 'ABS', 'CBS', 'Traction control', 'Front suspension', 'Rear suspension',
  'Front tyre', 'Rear tyre', 'Wheel type', 'Headlight', 'Tail light', 'DRL', 'Instrument cluster', 'Bluetooth',
  'Navigation', 'USB charging', 'Keyless start', 'Cruise control', 'Ride modes', 'Hill hold', 'Warranty',
  'Service interval', 'Estimated service cost', 'Colours', 'Accessories',
  'Motor power (continuous)', 'Peak power', 'Torque', 'Reverse mode', 'Regenerative braking', 'Battery capacity',
  'Battery chemistry', 'Battery type', 'Range — manufacturer claimed', 'Range — Bikepick estimate', 'Estimate basis', 'Full charge time',
  'Fast charging', 'Fast charge time', 'Charging connector', 'Home charging', 'Portable charger', 'Battery IP rating',
  'Motor IP rating', 'Vehicle warranty', 'Battery warranty', 'Running cost', 'Estimated battery replacement',
]);

function extrasGroup(s: any) {
  // Drop extras that duplicate a standard spec row (e.g. AI wrote "Engine" here and in the engine field).
  const rows = (parseExtras(s) as [string, any][])
    .filter(([k]) => !STANDARD_LABELS.has(k) && !STANDARD_LABELS.has(k.replace(/\s*\(.*\)\s*$/, '').replace(/\s+/g, ' ')));
  return rows.length ? { title: 'Also listed by the manufacturer', rows } : { title: 'Also listed by the manufacturer', rows: [] as [string, any][] };
}

function priceModelGroup(p: any, fuelLabel: string) {
  // Prices here are ex-showroom only — on-road figures live in the variant table.
  return { title: 'Price & model', rows: [
    ['Ex-showroom from', p?.price_min != null ? inr(p.price_min) : null],
    ['Top variant', p?.price_max != null && p.price_max !== p.price_min ? inr(p.price_max) : null],
    ['Model year', p?.model_year != null ? String(p.model_year) : null],
    ['Body type', p?.body_type || null],
    ['Fuel type', fuelLabel],
  ] as [string, any][] };
}

function BIKE_GROUPS(b: any, p: any, onRoadMin: number | null) {
  return [
    priceModelGroup(p, 'Petrol'),
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
    extrasGroup(b),
  ];
}

function EV_GROUPS(e: any, b: any, p: any, onRoadMin: number | null) {
  return [
    priceModelGroup(p, 'Electric'),
    { title: 'Motor & performance', rows: [
      ['Motor power (continuous)', num(e?.motor_power_kw, 'kW')], ['Peak power', num(e?.peak_power_kw, 'kW')],
      ['Torque', num(e?.torque_nm, 'Nm')], ['Top speed', num(e?.top_speed_kmph, 'km/h')],
      ['Ride modes', e?.ride_modes], ['Reverse mode', b?.reverse_mode === null || b?.reverse_mode === undefined ? null : yesNo(b.reverse_mode)],
      ['Regenerative braking', e?.regen_braking === null || e?.regen_braking === undefined ? null : yesNo(e.regen_braking)],
    ] as [string, any][] },
    { title: 'Battery, range & charging', rows: [
      ['Battery capacity', num(e?.battery_capacity_kwh, 'kWh')],
      ['Battery type', (() => {
        const v = e?.battery_chemistry;
        if (!v) return null;
        const bt = batteryTone(v);
        return { text: v, badge: bt?.text, cls: bt?.cls, note: bt?.note };
      })()],
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
    extrasGroup(e),
  ];
}
