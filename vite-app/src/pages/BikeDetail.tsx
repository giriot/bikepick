import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  getModelBySlug, getVariants, getColours, getImages, getSpecsForModel, getFeatures,
  getPros, getCons, getSimilarModels, getReviewsForModel, getOffersForModel, publicImageUrl,
  createReview,
} from '../lib/api';
import type { BikeColour, BikeImage, BikeModel, BikeSpec, BikeVariant, Review } from '../lib/types';
import { inr, inrRange, kmpl, kmRange, cc, fuelShort, titleCase, formatDate } from '../lib/format';
import { useSEO, bikeJsonLd, breadcrumbJsonLd } from '../lib/seo';
import {
  Badge, Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal,
  RatingStars, Select, StatusBadge, Textarea, VerifiedBadge,
} from '../components/ui';
import BikeCard, { loadModelImages } from '../components/BikeCard';
import EnquiryModal from '../components/EnquiryModal';
import { useNavigate } from 'react-router-dom';

export default function BikeDetail() {
  const { brand: brandSlug, model: modelSlug } = useParams();
  const { hasFav, toggleFav, hasCompare, addCompare, removeCompare, isAuthed, toast } = useApp();
  const navigate = useNavigate();

  const [model, setModel] = useState<BikeModel | null>(null);
  const [variants, setVariants] = useState<BikeVariant[]>([]);
  const [colours, setColours] = useState<BikeColour[]>([]);
  const [images, setImages] = useState<BikeImage[]>([]);
  const [specs, setSpecs] = useState<BikeSpec[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [similar, setSimilar] = useState<BikeModel[]>([]);
  const [similarImages, setSimilarImages] = useState<Record<string, { path: string; bucket: string } | null>>({});
  const [offers, setOffers] = useState<Awaited<ReturnType<typeof getOffersForModel>>>([]);
  const [reviews, setReviews] = useState<{ rows: Review[]; avg: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeColour, setActiveColour] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const m = await getModelBySlug(brandSlug!, modelSlug!);
      if (!m) {
        setNotFound(true);
        return;
      }
      setModel(m);
      const [varr, cols, imgs, sp, feats, prs, cns, sim] = await Promise.all([
        getVariants(m.id),
        getColours(m.id),
        getImages(m.id),
        getSpecsForModel(m.id),
        getFeatures(m.id),
        getPros(m.id),
        getCons(m.id),
        getSimilarModels(m.id, 4),
      ]);
      setVariants(varr);
      setColours(cols);
      setImages(imgs);
      setSpecs(sp);
      setFeatures(feats.filter((f) => f.included).map((f) => f.name));
      setPros(prs.map((p) => p.text));
      setCons(cns.map((c) => c.text));
      setSimilar(sim);
      setSimilarImages(await loadModelImages(sim));
      getOffersForModel(m.id).then(setOffers).catch(() => setOffers([]));
      getReviewsForModel(m.id).then((r) => setReviews(r)).catch(() => null);
      setActiveVariant(varr.find((v) => v.is_default)?.id || varr[0]?.id || null);

      // primary image
      const primary = imgs.find((i) => i.is_primary) || imgs[0];
      if (primary) {
        setMainImage(publicImageUrl(primary.bucket || 'bike-images', (primary.processing_status === 'failed' ? null : primary.processed_path) || primary.original_path || primary.storage_path));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug, modelSlug]);

  // colour → image switching: colour-specific image where available
  useEffect(() => {
    if (!model) return;
    if (!activeColour) {
      const primary = images.find((i) => i.is_primary) || images[0];
      if (primary) setMainImage(publicImageUrl(primary.bucket || 'bike-images', (primary.processing_status === 'failed' ? null : primary.processed_path) || primary.original_path || primary.storage_path));
      return;
    }
    const colour = colours.find((c) => c.id === activeColour);
    const colourImg = images.find((i) => i.colour_id === activeColour);
    if (colourImg) {
      setMainImage(publicImageUrl(colourImg.bucket || 'bike-images', (colourImg.processing_status === 'failed' ? null : colourImg.processed_path) || colourImg.original_path || colourImg.storage_path));
    } else if (colour?.image_path) {
      setMainImage(publicImageUrl('bike-images', colour.image_path));
    }
  }, [activeColour, images, colours, model]);

  // variant → swap in variant-level spec values
  const visibleSpecs = useMemo(() => {
    if (!activeVariant) return specs;
    const merged: BikeSpec[] = [];
    const seen = new Set<string>();
    for (const s of specs) {
      if (s.variant_id) continue;
      const override = specs.find((o) => o.variant_id === activeVariant && o.specification_id === s.specification_id);
      merged.push(override || s);
      seen.add(s.specification_id);
    }
    for (const s of specs) {
      if (s.variant_id === activeVariant && !seen.has(s.specification_id)) merged.push(s);
    }
    return merged;
  }, [specs, activeVariant]);

  const groupedSpecs = useMemo(() => {
    const groups: Record<string, BikeSpec[]> = {};
    for (const s of visibleSpecs) {
      const g = s.spec_group || 'Other';
      (groups[g] ||= []).push(s);
    }
    return groups;
  }, [visibleSpecs]);

  useSEO(
    model
      ? {
          title: model.seo_title || `${model.brand_name} ${model.name} price, specs, reviews — CompareBike`,
          description: model.seo_description || `Check ${model.brand_name} ${model.name} price from ${inr(model.price_start)}, specs, mileage, reviews and dealer offers.`,
          image: (model.og_image_path ? publicImageUrl('bike-images', model.og_image_path) : null) || mainImage || undefined,
          jsonLd: [
            bikeJsonLd({
              name: model.name,
              brand: model.brand_name || '',
              price: model.price_start,
              image: mainImage,
              mileage: model.mileage_kmpl,
              range: model.range_km,
              engine: model.engine_cc,
              description: model.overview,
            }),
            breadcrumbJsonLd([
              { name: 'Home', url: '/' },
              { name: 'New Bikes', url: '/new-bikes' },
              { name: model.brand_name || 'Brand', url: `/new-bikes?brand=${model.brand_slug}` },
              { name: model.name, url: `/new-bikes/${model.brand_slug}/${model.slug}` },
            ]),
          ],
        }
      : { title: 'Loading…' },
  );

  if (loading) return <LoadingBlock label="Loading bike details…" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (notFound || !model) {
    return (
      <div className="container-x py-16">
        <EmptyState
          title="Bike not found"
          desc="This model may have been unpublished or the link is incorrect."
          action={<Link to="/new-bikes" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Browse new bikes</Link>}
        />
      </div>
    );
  }

  const saved = hasFav('bike', model.id);
  const comparing = hasCompare(model.id);
  const colourName = colours.find((c) => c.id === activeColour)?.name;
  const gallery = images.filter((i) => !i.is_primary).slice(0, 8);
  const ev = model.fuel_type === 'electric';

  const specValue = (s: BikeSpec): string => {
    if (s.data_type === 'boolean' || s.value_boolean != null) return s.value_boolean ? 'Yes' : 'No';
    if (s.value_numeric != null) return `${s.value_numeric}${s.spec_unit ? ` ${s.spec_unit}` : ''}`;
    if (s.value_text) return s.value_text;
    return 'N/A';
  };

  return (
    <div className="container-x py-6 md:py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-ink-400">
        <Link to="/" className="hover:text-primary-600">Home</Link><span className="mx-1.5">/</span>
        <Link to="/new-bikes" className="hover:text-primary-600">New Bikes</Link><span className="mx-1.5">/</span>
        <Link to={`/new-bikes?brand=${model.brand_slug}`} className="hover:text-primary-600">{model.brand_name}</Link><span className="mx-1.5">/</span>
        <span className="font-semibold text-ink-700">{model.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-ink-900 md:text-3xl">{model.brand_name} {model.name}</h1>
            <StatusBadge status={model.status} />
            {model.status === 'upcoming' && <Badge tone="blue">Launching {formatDate(model.launch_date)}</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-2xl font-extrabold text-ink-900">{inrRange(model.price_start, model.price_end)} <span className="text-xs font-medium text-ink-400">ex-showroom, indicative</span></p>
            {model.rating_avg != null && model.review_count ? (
              <span className="flex items-center gap-1.5"><RatingStars value={model.rating_avg} showValue /> <span className="text-xs text-ink-400">({model.review_count} reviews)</span></span>
            ) : (
              <span className="text-sm text-ink-400">No reviews yet</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => (comparing ? removeCompare(model.id) : addCompare(model.id))} variant={comparing ? 'primary' : 'outline'}>
              {comparing ? '✓ In Compare' : '⚖ Add to Compare'}
            </Button>
            <Button variant={saved ? 'primary' : 'outline'} onClick={() => toggleFav('bike', model.id)}>
              {saved ? '♥ Saved' : '♡ Save'}
            </Button>
            <Button variant="dark" onClick={() => setEnquiryOpen(true)}>Request Callback</Button>
          </div>
        </div>
      </div>

      {/* Gallery + colours + variants */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="aspect-[16/10] bg-gradient-to-br from-ink-100 to-ink-200">
              {mainImage ? (
                <img src={mainImage} alt={`${model.brand_name} ${model.name}${colourName ? ` in ${colourName}` : ''}`} className="h-full w-full object-contain p-4" />
              ) : (
                <span className="flex h-full items-center justify-center text-ink-300">
                  <svg className="h-24 w-24" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 40c0-8 6-14 14-14h10l6-8h8l-7 10c4 3 6 8 6 12" /><circle cx="18" cy="44" r="7" /><circle cx="46" cy="44" r="7" /><path d="M25 44h14" />
                  </svg>
                </span>
              )}
            </div>
            {gallery.length > 0 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-ink-100 p-3">
                {gallery.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setMainImage(publicImageUrl(g.bucket || 'bike-images', (g.processing_status === 'failed' ? null : g.processed_path) || g.original_path || g.storage_path))}
                    className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-ink-200 bg-ink-50"
                  >
                    <img src={publicImageUrl(g.bucket || 'bike-images', g.original_path || g.storage_path) || undefined} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Colour selector */}
          {colours.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-bold text-ink-700">
                Colour: <span className="text-ink-500">{colourName || 'Default'}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveColour(null)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${!activeColour ? 'bg-ink-900 text-white' : 'border border-ink-300 bg-white text-ink-700'}`}
                >
                  Default
                </button>
                {colours.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveColour(c.id)}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${activeColour === c.id ? 'bg-ink-900 text-white' : 'border border-ink-300 bg-white text-ink-700'}`}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border border-ink-300" style={{ background: c.hex_code || '#999' }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick facts + variants */}
        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-400">Quick facts</p>
            <dl className="space-y-2.5 text-sm">
              <Fact label="Fuel" value={fuelShort(model.fuel_type)} />
              {model.engine_cc ? <Fact label="Engine" value={cc(model.engine_cc)} /> : null}
              {model.power_ps ? <Fact label="Power" value={`${model.power_ps} PS`} /> : null}
              {model.torque_nm ? <Fact label="Torque" value={`${model.torque_nm} Nm`} /> : null}
              {!ev && model.mileage_kmpl ? <Fact label="Mileage" value={kmpl(model.mileage_kmpl)} /> : null}
              {ev && model.range_km ? <Fact label="Range" value={kmRange(model.range_km)} /> : null}
              {ev && model.battery_kwh ? <Fact label="Battery" value={`${model.battery_kwh} kWh`} /> : null}
              {ev && model.charging_time ? <Fact label="Charging" value={model.charging_time} /> : null}
              <Fact label="ABS" value={model.abs_enabled ? 'Yes' : model.abs_enabled === false ? 'No' : 'N/A'} />
              {model.top_speed_kmph ? <Fact label="Top speed" value={`${model.top_speed_kmph} kmph`} /> : null}
            </dl>
          </Card>

          {variants.length > 0 && (
            <Card className="p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-400">Variants</p>
              <div className="space-y-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setActiveVariant(v.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition ${activeVariant === v.id ? 'border-primary-500 bg-primary-50' : 'border-ink-200 hover:border-ink-300'}`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-ink-900">{v.name}</span>
                      <span className="text-xs capitalize text-ink-400">{v.availability.replace('_', ' ')}</span>
                    </span>
                    <span className="text-sm font-extrabold text-ink-900">{v.price != null ? inr(v.price) : 'N/A'}</span>
                  </button>
                ))}
              </div>
              {activeVariant && (
                <p className="mt-2 text-xs text-ink-400">
                  Showing specs for <strong>{variants.find((v) => v.id === activeVariant)?.name}</strong>.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Overview + pros/cons */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-2 text-lg font-black text-ink-900">Overview</h2>
          <p className="text-sm leading-relaxed text-ink-600">{model.overview || 'No overview published yet for this model.'}</p>
        </Card>
        <div className="space-y-4">
          {pros.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-emerald-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Pros
              </h3>
              <ul className="space-y-1.5 text-sm text-ink-700">{pros.map((p, i) => <li key={i}>• {p}</li>)}</ul>
            </Card>
          )}
          {cons.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-red-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Cons
              </h3>
              <ul className="space-y-1.5 text-sm text-ink-700">{cons.map((c, i) => <li key={i}>• {c}</li>)}</ul>
            </Card>
          )}
        </div>
      </div>

      {/* Specifications (dynamic, grouped) */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-black text-ink-900">Full Specifications</h2>
        {Object.keys(groupedSpecs).length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(groupedSpecs).map(([group, rows]) => (
              <Card key={group} className="overflow-hidden">
                <p className="border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-ink-500">{group}</p>
                <dl>
                  {rows.map((s) => (
                    <div key={s.id} className="flex items-start justify-between gap-3 border-b border-ink-50 px-4 py-2.5 last:border-b-0">
                      <dt className="text-sm text-ink-500">{s.spec_name}</dt>
                      <dd className={`text-right text-sm font-semibold ${specValue(s) === 'N/A' ? 'text-ink-300' : 'text-ink-900'}`}>{specValue(s)}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Specifications coming soon" desc="Detailed specs added by the administrator appear here." />
        )}
      </div>

      {/* Features */}
      {features.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-black text-ink-900">Features</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-ink-700 ring-1 ring-ink-200">
                <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dealer offers */}
      <div id="offers" className="mt-10 scroll-mt-20">
        <h2 className="mb-1 text-xl font-black text-ink-900">Dealer Offers</h2>
        <p className="mb-4 text-sm text-ink-500">All offers below are admin-approved by verified dealers.</p>
        {offers.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between">
                  <p className="font-bold text-ink-900">{o.dealer_name}</p>
                  <VerifiedBadge label="Verified" />
                </div>
                <p className="text-xs text-ink-500">{o.location_city}{o.location_state ? `, ${o.location_state}` : ''} {o.variant_name ? `· ${o.variant_name}` : ''}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-ink-900">{inr(o.final_offer_price || o.ex_showroom_price)}</span>
                  {o.ex_showroom_price && o.final_offer_price && o.final_offer_price < o.ex_showroom_price && (
                    <span className="text-xs text-ink-400 line-through">{inr(o.ex_showroom_price)}</span>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-ink-600">
                  {o.discount_amount ? <li>• Discount {inr(o.discount_amount)}</li> : null}
                  {o.exchange_bonus ? <li>• Exchange bonus {inr(o.exchange_bonus)}</li> : null}
                  {o.finance_offer ? <li>• {o.finance_offer}</li> : null}
                  {o.insurance_offer ? <li>• {o.insurance_offer}</li> : null}
                  {o.accessories ? <li>• Accessories: {o.accessories}</li> : null}
                  {o.valid_until ? <li className="text-ink-400">Valid till {formatDate(o.valid_until)}</li> : null}
                </ul>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setEnquiryOpen(true)}
                >
                  Get this offer
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No dealer offers yet" desc="Once approved offers exist for this bike, they'll appear here." />
        )}
      </div>

      {/* Reviews */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-ink-900">Owner Reviews</h2>
          <Button size="sm" variant="outline" onClick={() => (isAuthed ? setReviewOpen(true) : navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`))}>
            Write a review
          </Button>
        </div>
        {reviews && reviews.rows.length ? (
          <div className="space-y-3">
            <div className="card flex items-center gap-4 p-4">
              <p className="text-4xl font-black text-ink-900">{reviews.avg?.toFixed(1) ?? '–'}</p>
              <div>
                <RatingStars value={reviews.avg || 0} />
                <p className="text-xs text-ink-400">{reviews.rows.length} approved review(s)</p>
              </div>
            </div>
            {reviews.rows.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-black text-white">
                      {(r.user_name || 'U').charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink-900">{r.user_name}</p>
                      <p className="text-[11px] text-ink-400">{formatDate(r.created_at)} · Verified buyer</p>
                    </div>
                  </div>
                  <RatingStars value={r.rating} showValue />
                </div>
                {r.title && <p className="mt-2 font-semibold text-ink-800">{r.title}</p>}
                {r.comment && <p className="mt-1 text-sm leading-relaxed text-ink-600">{r.comment}</p>}
                {r.pros && <p className="mt-2 text-xs text-emerald-700"><strong>Pros:</strong> {r.pros}</p>}
                {r.cons && <p className="mt-0.5 text-xs text-red-600"><strong>Cons:</strong> {r.cons}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-ink-500">
                  {r.mileage_rating ? <span>Mileage {r.mileage_rating}/5</span> : null}
                  {r.comfort_rating ? <span>Comfort {r.comfort_rating}/5</span> : null}
                  {r.performance_rating ? <span>Performance {r.performance_rating}/5</span> : null}
                  {r.maintenance_rating ? <span>Maintenance {r.maintenance_rating}/5</span> : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No reviews yet" desc="Own this bike? Be the first to share your experience — reviews are moderated before publishing." />
        )}
      </div>

      {/* Similar */}
      {similar.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-black text-ink-900">Similar Bikes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <BikeCard key={s.id} model={s} image={similarImages[s.id]} />
            ))}
          </div>
        </div>
      )}

      {/* Callback enquiry */}
      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        ctx={{
          type: 'dealer_offer',
          title: 'Request a callback / dealer offer',
          subject: `You asked for a callback or best price on ${model.brand_name} ${model.name}.`,
          bike_model_id: model.id,
        }}
      />

      {/* Write review */}
      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} modelId={model.id} onSaved={() => load()} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`font-semibold ${value === 'N/A' ? 'text-ink-300' : 'text-ink-900'}`}>{value}</dd>
    </div>
  );
}

function ReviewModal({ open, onClose, modelId, onSaved }: { open: boolean; onClose: () => void; modelId: string; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [rating, setRating] = useState(0);
  const [mileageR, setMileageR] = useState(0);
  const [comfortR, setComfortR] = useState(0);
  const [perfR, setPerfR] = useState(0);
  const [maintR, setMaintR] = useState(0);
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useApp();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setError('Please give an overall star rating.');
    if (comment.trim().length < 20) return setError('Please write at least a short review (20+ characters).');
    setBusy(true);
    setError(null);
    try {
      await createReview({
        bike_model_id: modelId,
        title: title.trim() || null,
        rating,
        mileage_rating: mileageR || null,
        comfort_rating: comfortR || null,
        performance_rating: perfR || null,
        maintenance_rating: maintR || null,
        pros: pros.trim() || null,
        cons: cons.trim() || null,
        comment: comment.trim(),
      });
      toast('Review submitted! It will appear after admin moderation.', 'success');
      setTitle(''); setRating(0); setMileageR(0); setComfortR(0); setPerfR(0); setMaintR(0); setPros(''); setCons(''); setComment('');
      onClose();
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Could not submit the review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Write a review" wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title (optional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a line" />
        </Field>
        <Field label="Overall rating" required>
          <RatingStars value={rating} size="h-7 w-7" onChange={setRating} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Mileage"><RatingStars value={mileageR} onChange={setMileageR} /></Field>
          <Field label="Comfort"><RatingStars value={comfortR} onChange={setComfortR} /></Field>
          <Field label="Performance"><RatingStars value={perfR} onChange={setPerfR} /></Field>
          <Field label="Maintenance"><RatingStars value={maintR} onChange={setMaintR} /></Field>
        </div>
        <Field label="What do you like?">
          <Textarea value={pros} onChange={(e) => setPros(e.target.value)} placeholder="Pros…" />
        </Field>
        <Field label="What could be better?">
          <Textarea value={cons} onChange={(e) => setCons(e.target.value)} placeholder="Cons…" />
        </Field>
        <Field label="Your review" required>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your ownership experience — handling, cost of ownership, service experience…" />
        </Field>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Submit for moderation</Button>
        </div>
        <p className="text-xs text-ink-400">Reviews are published after admin moderation. Be honest — reviews help other riders decide.</p>
      </form>
    </Modal>
  );
}
