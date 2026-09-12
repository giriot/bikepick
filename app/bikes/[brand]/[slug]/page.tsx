import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProductBySlug, listProducts, listUsedBikes } from '@/lib/queries';
import { RoundEthanolBadge } from '@/components/EthanolBadge';
import { getCurrentUser } from '@/lib/auth';
import { getJsonSetting } from '@/lib/settings';
import { computeScore, DEFAULT_WEIGHTS, type ScoreWeights } from '@/lib/score';
import { runningCostPerKm } from '@/lib/compare';
import { projectResale } from '@/lib/calculators';
import { inr, num, yesNo, dateIn, relative, toStrArray } from '@/lib/format';
import { buildMetadata, breadcrumbJsonLd, productJsonLd, JsonLd } from '@/lib/seo';
import { Breadcrumbs, Notice, ScoreRing, SectionHeader, TrustBadge } from '@/components/ui';
import { LeadDialog } from '@/components/LeadDialog';
import { PriceAlertButton } from '@/components/PriceAlertButton';
import { CompareToggle } from '@/components/CompareToggle';
import { SaveButton } from '@/components/SaveButton';
import { VariantTable } from '@/components/VariantTable';
import { ProductGallery } from '@/components/ProductGallery';
import { SpecSuggestionForm } from '@/components/SpecSuggestionForm';
import { SpecsAccordion } from '@/components/SpecsAccordion';
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
  const isCng = product.fuel_type === 'cng' || product.fuel_type === 'hybrid' || product.fuel_type === 'cng_petrol';
  const fuelLabel = isEv ? 'Electric' : isCng ? 'CNG + Petrol' : 'Petrol';

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
  // Estimated value after 5 years + month-by-month depreciation curve (unique, not a repeated spec).
  const resaleCurve = product.price_min != null ? projectResale(product.price_min, 5) : null;
  const resale5 = resaleCurve ? resaleCurve[resaleCurve.length - 1] : null;
  const retention5 = resale5 && product.price_min ? Math.round((resale5.value / product.price_min) * 100) : null;
  const monthlyKm = 800; // typical Indian two-wheeler monthly usage, used only for the "est. monthly" figure
  const lost5 = resale5 && product.price_min ? product.price_min - resale5.value : null;
  const lostPerYear = lost5 != null ? Math.round(lost5 / 5) : null;

  const [similar, usedOfModel, accessories] = await Promise.all([
    listProducts({ category: base, minPrice: (product.price_min || 0) * 0.7, maxPrice: (product.price_min || 0) * 1.35, perPage: 5 }),
    listUsedBikes({ q: product.name, perPage: 3 }),
    db.all<any>("SELECT * FROM affiliate_links WHERE status='active' AND deleted_at IS NULL AND (product_id = ? OR product_id IS NULL) ORDER BY product_id DESC LIMIT 6", [product.id]),
  ]);

  const pros: string[] = toStrArray(product.pros);
  const cons: string[] = toStrArray(product.cons);
  const bestFor: string[] = (typeof product.best_for === 'string' ? product.best_for : '')
    .split(/[,;•]+/).map((s: string) => s.trim()).filter(Boolean);
  // "Segment" = engine capacity for petrol (cc), usable range for electric (km).
  // Same-segment peers are matched on that, never on price alone, so a 125 cc
  // bike is compared with other ~125 cc bikes (not, say, 160 cc machines).
  const isScooter = product.body_type === 'scooter';
  // Body-type scope: a scooter page only suggests scooters, a bike page only bikes.
  const bodyScope = isScooter ? "p.body_type = 'scooter'" : "p.body_type <> 'scooter'";
  const segCc = !isEv && bike?.engine_capacity_cc != null ? Number(bike.engine_capacity_cc) : null;
  const segRange = isEv ? Number(ev?.claimed_range_km ?? ev?.real_world_range_km ?? 0) || null : null;
  const segPeers = segCc != null
    ? await db.all<any>(
        `SELECT p.id, p.name, p.slug, p.price_min, p.fuel_type, p.body_type,
                b.name AS brand_name, b.slug AS brand_slug
           FROM products p
           JOIN brands b ON b.id = p.brand_id
           JOIN bike_specs bs ON bs.product_id = p.id AND bs.variant_id IS NULL
          WHERE p.status = 'published' AND p.deleted_at IS NULL
            AND p.fuel_type = 'petrol' AND p.id <> ? AND ${bodyScope}
            AND bs.engine_capacity_cc IS NOT NULL
            AND bs.engine_capacity_cc >= ? AND bs.engine_capacity_cc <= ?
          ORDER BY p.price_min ASC LIMIT 8`,
        [product.id, segCc * 0.9, segCc * 1.1],
      )
    : segRange != null
      ? await db.all<any>(
          `SELECT p.id, p.name, p.slug, p.price_min, p.fuel_type, p.body_type,
                  b.name AS brand_name, b.slug AS brand_slug
             FROM products p
             JOIN brands b ON b.id = p.brand_id
             JOIN ev_specs es ON es.product_id = p.id AND es.variant_id IS NULL
            WHERE p.status = 'published' AND p.deleted_at IS NULL
              AND p.fuel_type = 'electric' AND p.id <> ? AND ${bodyScope}
              AND COALESCE(es.claimed_range_km, es.real_world_range_km) IS NOT NULL
              AND COALESCE(es.claimed_range_km, es.real_world_range_km) >= ?
              AND COALESCE(es.claimed_range_km, es.real_world_range_km) <= ?
            ORDER BY p.price_min ASC LIMIT 8`,
          [product.id, segRange * 0.8, segRange * 1.2],
        )
      : [];
  const segmentHasOthers = segPeers.length > 0;
  const cheaper = product.price_min != null
    ? segPeers.filter((s) => s.price_min != null && s.price_min < (product.price_min as number)).slice(0, 3)
    : [];
  const segLabel = isEv
    ? (segRange != null ? `EVs · ~${Math.round(segRange)} km range` : 'this segment')
    : (segCc != null ? `~${Math.round(segCc)} cc ${isScooter ? 'scooters' : 'bikes'}` : 'this segment');

  // EVs to consider as a cross-fuel alternative, matched by ex-showroom price:
  //
  //   • Performance bikes (200 cc+) — EV motorcycles nearest this bike's
  //     ex-showroom price (the buyer is shopping a budget, not a fuel type).
  //   • Commuters & scooters in the 50–80 kmpl band — EV scooters nearest
  //     this bike's ex-showroom price.
  // Petrol pages only.
  const bikeKmpL = !isEv ? Number(bike?.mileage_kmpl || 0) || null : null;
  const bikeCc = !isEv ? Number(bike?.engine_capacity_cc || 0) || null : null;
  const bikePrice = !isEv ? (Number(product.price_min) > 0 ? Number(product.price_min) : null) : null;
  const isPerformance = bikeCc != null && bikeCc > 200;
  const evBand = bikeKmpL != null && bikeKmpL >= 50 && bikeKmpL <= 80;
  let evSuggest: any[] = [];
  let evMode: 'bike' | 'scooter' = 'scooter';
  if (!isEv && bikePrice != null && (isPerformance || evBand)) {
    const evs = await db.all<any>(
      `SELECT p.id, p.name, p.slug, p.price_min, p.fuel_type, p.body_type,
              b.name AS brand_name, b.slug AS brand_slug,
              es.running_cost_per_km, es.real_world_range_km, es.claimed_range_km,
              es.battery_capacity_kwh, es.top_speed_kmph, es.peak_power_kw, es.motor_power_kw
         FROM products p
         JOIN brands b ON b.id = p.brand_id
         JOIN ev_specs es ON es.product_id = p.id AND es.variant_id IS NULL
        WHERE p.status = 'published' AND p.deleted_at IS NULL
          AND p.fuel_type = 'electric'`,
    );

    // Cost per km: recorded figure, else battery ÷ real-world range at the
    // same tariff/charger efficiency used in the EV-vs-petrol calculator.
    const evCostKm = (r: any) => {
      const rc = Number(r.running_cost_per_km);
      if (rc > 0) return rc;
      const range = Number(r.real_world_range_km) || (Number(r.claimed_range_km) || 0) * 0.75;
      const kwh = Number(r.battery_capacity_kwh);
      if (range > 0 && kwh > 0) return (kwh / range) * (8 / 0.85);
      return null;
    };

    // Price match: closest ex-showroom price wins (ties broken by lower price).
    const priced = evs
      .filter((r: any) => Number(r.price_min) > 0)
      .map((r: any) => ({ ...r, price: Number(r.price_min), cost_km: evCostKm(r) }));
    const byPrice = (a: any, b: any) =>
      Math.abs(a.price - (bikePrice as number)) - Math.abs(b.price - (bikePrice as number));

    if (isPerformance) {
      // EV motorcycles nearest in price; fall back to any EV if none listed.
      const cycles = priced.filter((r) => r.body_type !== 'scooter');
      const pool = cycles.length ? cycles : priced;
      evSuggest = [...pool].sort(byPrice).slice(0, 2);
      evMode = 'bike';
    } else {
      // EV scooters nearest in price; fall back to any EV if none listed.
      const scooters = priced.filter((r) => r.body_type === 'scooter');
      const pool = scooters.length ? scooters : priced;
      evSuggest = [...pool].sort(byPrice).slice(0, 2);
      evMode = 'scooter';
    }
  }

  // Similar models (below gallery) — same body type only; fall back to any.
  const similarAll = (similar.items || []).filter((s) => s.id !== product.id);
  const similarScoped = similarAll.filter((s) => (isScooter ? s.body_type === 'scooter' : s.body_type !== 'scooter'));
  const similarList = (similarScoped.length ? similarScoped : similarAll).slice(0, 4);
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

            {/* Below the gallery: editorial highlights only (no repeated specs) —
                Similar models → Pros & cons. Suitable for and value numbers live
                in the panel next to the price. */}
            <div className="mt-5 space-y-4">
              <div>
                <h3 className="text-[13.5px] font-semibold">Similar {isScooter ? 'scooters' : 'bikes'}</h3>
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-white">
                  {similarList.map((s) => (
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
                    Not recorded yet — our editorial team is reviewing this model.
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
                {!isEv && (
                  <div className="mt-2.5">
                    <RoundEthanolBadge blend={product.ethanol_blend} />
                  </div>
                )}
                {!isEv && bike?.mileage_kmpl != null && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-line bg-white px-3 py-2 text-[12px]">
                    <span className="font-semibold text-ink-soft">⛽ Mileage</span>
                    <span className="font-bold text-ink">{Math.round(bike.mileage_kmpl)} {isCng ? 'km/kg (CNG)' : 'kmpl'}</span>
                    <span className="text-[11px] text-ink-mute">company claimed</span>
                    {bike.real_world_mileage_kmpl != null && (
                      <span className="text-[11px] text-ink-mute">
                        · real-world ≈ <span className="font-semibold text-emerald-700">{Math.round(bike.real_world_mileage_kmpl)} kmpl</span>
                      </span>
                    )}
                  </div>
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

            {/* Smart value check — unique insight, no repeated specs */}
            {product.price_min != null && (
              <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-card animate-fade-up">
                <div className="flex items-center justify-between gap-2 border-b border-line bg-surface/70 px-4 py-2.5">
                  <h2 className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-soft">
                    <span className="text-brand-500">✦</span> Smart value check
                  </h2>
                  <Link href={`/tools/ownership?a=${product.id}`} className="text-[11px] font-semibold text-brand-600 hover:underline">
                    Full 5-year breakdown →
                  </Link>
                </div>

                <div className="p-4">
                  {/* Value after 5 years — one clean headline number */}
                  <p className="text-[11px] font-medium text-ink-mute">Estimated value after 5 years</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-[28px] font-extrabold leading-none tracking-tight text-brand-600">
                      {resale5 ? inr(resale5.value) : '—'}
                    </span>
                    {retention5 != null && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-dark ring-1 ring-accent/30">
                        keeps ~{retention5}%
                      </span>
                    )}
                  </div>
                  {lostPerYear != null && (
                    <p className="mt-1.5 text-[11px] leading-4 text-ink-mute">
                      vs <span className="font-semibold text-ink">{inr(product.price_min)}</span> ex-showroom today · loses about{' '}
                      <span className="font-semibold text-ink">{inr(lostPerYear)}/yr</span> to depreciation
                    </p>
                  )}

                  <div className="my-3.5 border-t border-line" />

                  {/* Running cost */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-surface px-3 py-2.5">
                      <p className="text-[10px] text-ink-mute">{isEv ? '⚡ Running cost' : '⛽ Running cost'}</p>
                      <p className="mt-0.5 text-[16px] font-bold leading-none">
                        {costPerKm ? `₹${costPerKm.toFixed(2)}` : '—'}
                        <span className="text-[11px] font-medium text-ink-mute">/km</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface px-3 py-2.5">
                      <p className="text-[10px] text-ink-mute">≈ per month</p>
                      <p className="mt-0.5 text-[16px] font-bold leading-none">{costPerKm ? inr(Math.round(costPerKm * monthlyKm)) : '—'}</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[9.5px] leading-4 text-ink-mute">
                    {monthlyKm} km/month typical usage — energy cost only, maintenance excluded.
                  </p>

                  {/* Cheaper in this segment — price-conscious hint */}
                  {cheaper.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-accent/25 bg-accent-soft/60 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-accent-dark">💡 Cheaper {segLabel}</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {cheaper.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
                            <Link
                              href={`/${s.fuel_type === 'electric' ? 'electric' : 'bikes'}/${s.brand_slug}/${s.slug}`}
                              className="min-w-0 truncate font-medium hover:text-brand-600 hover:underline"
                            >
                              {s.brand_name} {s.name}
                            </Link>
                            <span className="shrink-0 text-right">
                              <span className="font-bold text-accent-dark">{inr(s.price_min)}</span>
                              <span className="ml-1 text-[10px] text-ink-mute">
                                save {inr((product.price_min as number) - (s.price_min ?? 0))}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : segmentHasOthers ? (
                    <div className="mt-3 rounded-lg border border-accent/25 bg-accent-soft/60 px-3 py-2.5 text-[12px] leading-5 text-accent-dark">
                      <span className="font-bold">Most affordable {segLabel}</span> — no similar model is listed cheaper right now.
                    </div>
                  ) : null}

                  {/* EVs to consider (cross-fuel suggestion) — matched by ex-showroom price. */}
                  {evSuggest.length > 0 && (
                    <div className="mt-2.5 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">
                        ⚡ {evMode === 'bike'
                          ? 'EV motorcycles at a similar ex-showroom price'
                          : 'EV scooters at a similar ex-showroom price'}
                      </p>
                      <ul className="mt-1.5 space-y-1.5">
                        {evSuggest.map((s) => {
                          const diff = bikePrice != null && s.price != null ? s.price - bikePrice : null;
                          return (
                            <li key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
                              <Link
                                href={`/electric/${s.brand_slug}/${s.slug}`}
                                className="min-w-0 truncate font-medium hover:text-brand-600 hover:underline"
                              >
                                {s.brand_name} {s.name}
                              </Link>
                              <span className="shrink-0 text-right leading-tight">
                                <span className="font-bold text-brand-700">{inr(s.price)}</span>
                                <span className="ml-1 block text-[10px] text-ink-mute">
                                  {diff != null && diff !== 0 && (
                                    <span className={diff > 0 ? 'text-rose-600' : 'text-green-700'}>
                                      {diff > 0 ? `${inr(diff)} more` : `${inr(-diff)} less`}{' '}
                                    </span>
                                  )}
                                  {diff === 0 && <span className="text-ink-mute">≈ same price · </span>}
                                  {s.cost_km != null ? `≈₹${s.cost_km.toFixed(2)}/km` : ''}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-1.5 text-[10px] leading-4 text-ink-mute">
                        {evMode === 'bike'
                          ? `This ${Math.round(bikeCc ?? 0)} cc bike is ${inr(bikePrice ?? 0)} ex-showroom — the EVs above are its closest price match, with honest ≈₹/km running costs.`
                          : `This ${isScooter ? 'scooter' : 'bike'} is ${inr(bikePrice ?? 0)} ex-showroom — the EVs above are its closest price match, with honest ≈₹/km running costs.`}
                      </p>
                    </div>
                  )}

                  <p className="mt-2.5 text-[10px] leading-4 text-ink-mute">
                    {isEv ? 'Assumes a healthy battery. ' : ''}Depreciation uses a standard two-wheeler curve and today&apos;s
                    ex-showroom price — indicative only, not a guaranteed buyback.
                  </p>
                </div>
              </section>
            )}

            {/* Suitable for — moved to the price side for prominence */}
            <section className="mt-5 rounded-2xl border border-line bg-white p-4 shadow-card">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Suitable for</h2>
              {bestFor.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {bestFor.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-800 shadow-sm ring-1 ring-brand-200"
                    >
                      <span className="text-brand-500">✓</span>{b}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[11.5px] leading-5 text-ink-mute">
                  Which riders this model suits best will appear here once the editorial team records it.
                </p>
              )}
            </section>

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

        {/* ------------------------- VARIANT COMPARISON ----------------------
            Multi-variant models get a full-width side-by-side table here,
            directly above the full specification sheet — specs live in ONE
            clear area below the hero (nothing repeated in the sidebar). */}
        {variants.length > 1 && (
          <section className="mt-12" id="variants">
            <VariantTable
              variants={variants}
              vSpecMap={vSpecMap}
              modelSpec={isEv ? ev : bike}
              isEv={isEv}
              fuelLabel={fuelLabel}
              priceFrom={product.price_min}
            />
          </section>
        )}

        {/* ------------------------------ SPECS ----------------------------- */}
        <section className="mt-12" id="specifications">
          <SectionHeader title="Full specifications" subtitle="Empty fields mean the value has not been verified — we never guess." />
          <SpecsAccordion
            groups={(isEv
              ? EV_GROUPS(ev, bike, product, onRoadMin)
              : BIKE_GROUPS(bike, product, onRoadMin)
            ).filter((g) => g.rows.length > 0)}
          />
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

function ethanolSpecRow(p: any) {
  const v = p?.ethanol_blend;
  if (v === 'e20') return { text: 'E20 ready', badge: 'E20', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', note: "Runs on E20 petrol (20% ethanol) — India's standard fuel since 2026." };
  if (v === 'e85') return { text: 'Flex-fuel E20–E85', badge: 'Flex', cls: 'bg-teal-50 text-teal-700 ring-teal-200', note: 'Runs on any ethanol blend from E20 up to E85.' };
  if (v === 'e100') return { text: 'Flex-fuel E20–E100', badge: 'Flex', cls: 'bg-green-50 text-green-700 ring-green-200', note: 'Runs on any ethanol blend from E20 up to E100.' };
  if (v === 'none') return { text: 'No ethanol support', badge: 'Petrol only', cls: 'bg-surface text-ink-mute ring-line', note: "Not certified for ethanol blends — check the owner's manual before using E20." };
  return null;
}

function BIKE_GROUPS(b: any, p: any, onRoadMin: number | null) {
  const isCng = p?.fuel_type === 'cng' || p?.fuel_type === 'hybrid' || p?.fuel_type === 'cng_petrol';
  const priceGroup = priceModelGroup(p, isCng ? 'CNG + Petrol' : 'Petrol');
  priceGroup.rows.push(['Ethanol (blend)', ethanolSpecRow(p)]);
  return [
    priceGroup,
    { title: 'Engine & transmission', rows: [
      ['Engine type', b?.engine_type], ['Displacement', num(b?.engine_capacity_cc, 'cc')],
      ['Max power', b?.max_power_bhp ? `${b.max_power_bhp} bhp${b.max_power_rpm ? ` @ ${b.max_power_rpm} rpm` : ''}` : null],
      ['Max torque', b?.max_torque_nm ? `${b.max_torque_nm} Nm${b.max_torque_rpm ? ` @ ${b.max_torque_rpm} rpm` : ''}` : null],
      ['Transmission', b?.transmission], ['Clutch', b?.clutch], ['Gearbox', b?.gearbox],
      ['Top speed', num(b?.top_speed_kmph, 'km/h')],
      ['Mileage (company claimed)', num(b?.mileage_kmpl, isCng ? 'km/kg (CNG)' : 'kmpl')],
      ['Mileage (real-world)', num(b?.real_world_mileage_kmpl, 'kmpl')],
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
