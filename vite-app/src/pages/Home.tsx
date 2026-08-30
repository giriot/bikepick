import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  getBrands, getFeaturedOffers, getArticles, getFaqs, queryModels, queryUsedBikes, getReviewsForModel,
} from '../lib/api';
import type { Article, Brand, BikeModel, Faq, UsedBike, DealerOffer, FuelType } from '../lib/types';
import { inr, inrRange, fuelShort, formatDate } from '../lib/format';
import { useSEO } from '../lib/seo';
import { publicImageUrl } from '../lib/api';
import { BoltIcon, EmptyState, ErrorBlock, FuelPumpIcon, FlameIcon, LoadingBlock, Section, VerifiedBadge, ScaleIcon } from '../components/ui';
import BikeCard, { loadModelImages } from '../components/BikeCard';
import FuelFinder from '../components/FuelFinder';
import HelpMeChoose from '../components/HelpMeChoose';

interface HomeData {
  brands: Brand[];
  popular: BikeModel[];
  releases: BikeModel[];
  mileageIce: BikeModel[];
  mileageEv: BikeModel[];
  offers: DealerOffer[];
  used: UsedBike[];
  articles: Article[];
  faqs: Faq[];
  images: Record<string, { path: string; bucket: string } | null>;
  error: string | null;
  retry: () => void;
}

const FUEL_CARDS: { fuel: FuelType | 'all'; title: string; sub: string; icon: React.ReactNode; grad: string }[] = [
  { fuel: 'petrol', title: 'PETROL', sub: 'Petrol Bikes', icon: <FuelPumpIcon className="h-8 w-8" />, grad: 'from-orange-500 to-amber-600' },
  { fuel: 'electric', title: 'ELECTRIC', sub: 'Electric Bikes', icon: <BoltIcon className="h-8 w-8" />, grad: 'from-emerald-500 to-teal-600' },
  { fuel: 'cng_petrol', title: 'CNG + PETROL', sub: 'CNG + Petrol Bikes', icon: <FlameIcon className="h-8 w-8" />, grad: 'from-sky-500 to-indigo-600' },
];

export default function Home() {
  const { settings, settingsLoaded } = useApp();
  const navigate = useNavigate();
  const { fuel: fuelParam } = useParams<{ fuel?: string }>();
  const brandName = settings['brand_name'] || 'CompareBike';
  const [data, setData] = useState<HomeData | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [brands, pop, rel, mIce, mEv, offers, usedQ, articles, faqs] = await Promise.all([
        getBrands(),
        queryModels({ sort: 'popular', per_page: 8, status: 'live' }),
        queryModels({ sort: 'newest', per_page: 8, status: 'live' }),
        queryModels({ sort: 'mileage', per_page: 4, fuel: 'petrol', status: 'live' }),
        queryModels({ sort: 'newest', per_page: 4, fuel: 'electric', status: 'live' }),
        getFeaturedOffers(6),
        queryUsedBikes({ per_page: 6 }),
        getArticles({ publishedOnly: true }),
        getFaqs(),
      ]);
      const all = [...pop.rows, ...rel.rows];
      const images = await loadModelImages(all);
      // rating overlay for cards
      for (const m of all) {
        try {
          const { avg, count } = await getReviewsForModel(m.id, 1, 1);
          if (avg) {
            m.rating_avg = avg;
            m.review_count = count;
          }
        } catch { /* ratings optional */ }
      }
      setData({ brands, popular: pop.rows, releases: rel.rows, mileageIce: mIce.rows, mileageEv: mEv.rows, offers, used: usedQ.rows, articles, faqs, images, error: null, retry: load });
    } catch (e: any) {
      setData({
        brands: [], popular: [], releases: [], mileageIce: [], mileageEv: [], offers: [], used: [], articles: [], faqs: [],
        images: {}, error: e.message || 'Could not load the homepage.', retry: load,
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSEO({
    title: `${brandName} — Find, Compare & Choose Your Perfect Bike`,
    description: 'Petrol, electric and CNG+petrol bikes in India. Compare specs, mileage, prices, dealer offers and verified used bikes on CompareBike.',
  });

  if (!settingsLoaded) return <LoadingBlock label="Loading the site…" />;
  if (!data) return <LoadingBlock label="Preparing your ride search…" />;
  if (data.error && !data.brands.length && !data.popular.length) return <ErrorBlock message={data.error} onRetry={data.retry} />;

  const featuredUsed: string[] = Array.isArray(settings['featured_used']) ? settings['featured_used'] : [];
  const featuredOffers: string[] = Array.isArray(settings['featured_offers']) ? settings['featured_offers'] : [];
  const homeUsed = featuredUsed.length ? data.used.filter((u) => featuredUsed.includes(u.id)) : data.used;
  const homeOffers = featuredOffers.length ? data.offers.filter((o) => featuredOffers.includes(o.id)) : data.offers;

  const scrollToFinder = (fuel: string) => {
    if (fuel === 'all') {
      document.getElementById('find-your-bike')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate(`/#fuel-${fuel}`);
      setTimeout(() => document.getElementById('find-your-bike')?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  };

  return (
    <div>
      {/* ── HERO: FIND YOUR BIKE ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink-900">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="container-x relative py-12 md:py-16">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-400 ring-1 ring-white/15">
            India's bike marketplace
          </p>
          <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">
            What type of bike are <span className="text-primary-500">you looking for?</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-300 md:text-base">
            Choose your fuel type first — then filter by brand, budget, mileage and more. Real specifications, live dealer offers and verified used bikes.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FUEL_CARDS.map((c) => (
              <button
                key={c.title}
                onClick={() => scrollToFinder(c.fuel)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.grad} p-5 text-left text-white shadow-lift transition hover:-translate-y-1`}
              >
                <div className="absolute -right-4 -top-4 text-white/15 transition group-hover:scale-110">{c.icon}</div>
                <div className="mb-8 text-white/90">{c.icon}</div>
                <p className="text-lg font-black tracking-wide">{c.title}</p>
                <p className="text-sm font-medium text-white/80">{c.sub} →</p>
              </button>
            ))}
            <button
              onClick={() => scrollToFinder('all')}
              className="group rounded-2xl border-2 border-white/25 bg-white/5 p-5 text-left text-white backdrop-blur transition hover:-translate-y-1 hover:border-primary-500"
            >
              <div className="mb-8">
                <svg className="h-8 w-8 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" />
                  <path d="M20 40c0-7 5-12 12-12h8l5-7h7l-6 8c3 2.5 5 6.5 5 11" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="24" cy="42" r="5" />
                  <circle cx="44" cy="42" r="5" />
                </svg>
              </div>
              <p className="text-lg font-black tracking-wide">ALL BIKES</p>
              <p className="text-sm font-medium text-white/70">Browse everything →</p>
            </button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => document.getElementById('help-me-choose')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lift transition hover:bg-primary-500"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.75h4.5M15 3.75V6M9.75 3.75V6m5.25 10.5v-4.5m-5.25 4.5v-4.5m5.25 0h-5.25m5.25 4.5h-5.25m0-9h5.25M8.25 21a8.25 8.25 0 1113.5-6.7" /></svg>
              Help Me Choose My Bike
            </button>
            <Link to="/used-bikes" className="rounded-full border border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              Browse Used Bikes
            </Link>
            <Link to="/compare" className="rounded-full border border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              Compare Bikes
            </Link>
          </div>
        </div>
      </section>

      {/* ── FUEL FLOW: SEARCH + MODEL FILTER ─────────────────────────────── */}
      <FuelFinder initialFuel={fuelParam && ['petrol', 'electric', 'cng_petrol'].includes(fuelParam) ? (fuelParam as FuelType) : undefined} brands={data.brands} />

      {/* ── HELP ME CHOOSE ───────────────────────────────────────────────── */}
      <section id="help-me-choose" className="bg-gradient-to-r from-primary-600 to-orange-500">
        <div className="container-x flex flex-col items-start justify-between gap-4 py-10 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black text-white md:text-3xl">Not sure which bike is right for you?</h2>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              Answer 9 quick questions — budget, fuel, daily distance, priorities — and we'll rank real bikes with a match score and explain why each one fits.
            </p>
          </div>
          <HelpMeChoose />
        </div>
      </section>

      {/* ── POPULAR MODELS ───────────────────────────────────────────────── */}
      <Section
        title="Popular Models"
        subtitle="The most searched and compared bikes on the platform right now."
        action={<Link to="/new-bikes" className="text-sm font-bold text-primary-600 hover:underline">View all new bikes →</Link>}
      >
        {data.popular.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.popular.slice(0, 4).map((m) => (
              <BikeCard key={m.id} model={m} image={data.images[m.id]} />
            ))}
          </div>
        ) : (
          <EmptyState title="No models published yet" desc="Bike models added by the administrator will appear here as soon as they are live." />
        )}
      </Section>

      {/* ── NEW BIKE RELEASES ────────────────────────────────────────────── */}
      <Section
        title="New Bike Releases"
        subtitle="The latest launches, freshest first."
        action={<Link to="/new-bikes?sort=newest" className="text-sm font-bold text-primary-600 hover:underline">All releases →</Link>}
      >
        {data.releases.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.releases.slice(0, 4).map((m) => (
              <BikeCard key={m.id} model={m} image={data.images[m.id]} />
            ))}
          </div>
        ) : (
          <EmptyState title="No releases yet" desc="Newly launched bikes will show up here automatically." />
        )}
      </Section>

      {/* ── TOP MILEAGE ──────────────────────────────────────────────────── */}
      <Section
        title="Top Mileage Bikes"
        subtitle="Go the farthest on every tank and every charge."
        action={<Link to="/top-mileage-bikes" className="text-sm font-bold text-primary-600 hover:underline">Full list →</Link>}
      >
        {data.mileageIce.length || data.mileageEv.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">Petrol — best kmpl</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.mileageIce.slice(0, 2).map((m) => (
                  <BikeCard key={m.id} model={m} image={data.images[m.id]} />
                ))}
              </div>
              {!data.mileageIce.length && <p className="text-sm text-ink-400">No petrol models yet.</p>}
            </div>
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">Electric — best range</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.mileageEv.slice(0, 2).map((m) => (
                  <BikeCard key={m.id} model={m} image={data.images[m.id]} />
                ))}
              </div>
              {!data.mileageEv.length && <p className="text-sm text-ink-400">No electric models yet.</p>}
            </div>
          </div>
        ) : (
          <EmptyState title="Mileage data coming soon" desc="As soon as models with verified mileage or range are published, they'll rank here." />
        )}
      </Section>

      {/* ── BEST BY BUDGET ───────────────────────────────────────────────── */}
      <BudgetSection />

      {/* ── BROWSE BY BRAND ──────────────────────────────────────────────── */}
      <Section title="Browse by Brand" subtitle="Every major Indian and global brand, in one place.">
        {data.brands.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {data.brands.slice(0, 12).map((b) => (
              <Link key={b.id} to={`/brands/${b.slug}`} className="card group flex flex-col items-center justify-center gap-2 p-5 text-center transition hover:shadow-lift">
                {b.logo_path ? (
                  <img src={publicImageUrl('brand-images', b.logo_path) || undefined} alt={b.name} className="h-10 w-auto object-contain" loading="lazy" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-base font-black text-white">{b.name.charAt(0)}</span>
                )}
                <span className="text-sm font-bold text-ink-800 group-hover:text-primary-600">{b.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No brands yet" desc="Brands added in the Admin Panel appear here automatically." />
        )}
      </Section>

      {/* ── DEALER OFFERS ────────────────────────────────────────────────── */}
      <Section
        title="Dealer Offers"
        subtitle="Approved discounts, exchange bonuses and finance deals from verified dealers."
        action={<Link to="/dealer/register" className="text-sm font-bold text-primary-600 hover:underline">Are you a dealer? Register →</Link>}
      >
        {homeOffers.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {homeOffers.map((o) => (
              <article key={o.id} className="card p-4 transition hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{o.brand_name}</p>
                    <p className="font-bold text-ink-900">{o.bike_name}</p>
                  </div>
                  <VerifiedBadge label="Verified Dealer" />
                </div>
                <p className="mt-1 text-xs text-ink-500">{o.dealer_name} · {o.dealer_city}{o.dealer_state ? `, ${o.dealer_state}` : ''}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-ink-900">{inr(o.final_offer_price || o.ex_showroom_price)}</span>
                  {o.discount_amount ? <span className="text-xs font-semibold text-emerald-600">Save {inr(o.discount_amount)}</span> : null}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-ink-600">
                  {o.exchange_bonus ? <li>• Exchange bonus {inr(o.exchange_bonus)}</li> : null}
                  {o.finance_offer ? <li>• {o.finance_offer}</li> : null}
                  {o.insurance_offer ? <li>• {o.insurance_offer}</li> : null}
                  {o.accessories ? <li>• Free accessories: {o.accessories}</li> : null}
                </ul>
                <Link
                  to={o.bike_slug && o.brand_slug ? `/new-bikes/${o.brand_slug}/${o.bike_slug}#offers` : '/new-bikes'}
                  className="mt-3 block rounded-lg bg-ink-900 px-3 py-2 text-center text-sm font-bold text-white hover:bg-ink-700"
                >
                  View offer on bike
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No approved offers yet" desc="Once dealers get verified and their offers approved, live deals appear here." />
        )}
      </Section>

      {/* ── USED BIKES ───────────────────────────────────────────────────── */}
      <Section
        title="Verified Used Bikes"
        subtitle="Admin-approved second-hand bikes from sellers and dealers across India."
        action={
          <div className="flex gap-3">
            <Link to="/post-used-bike" className="text-sm font-bold text-primary-600 hover:underline">Sell yours →</Link>
            <Link to="/used-bikes" className="text-sm font-bold text-primary-600 hover:underline">Browse all →</Link>
          </div>
        }
      >
        {homeUsed.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {homeUsed.map((u) => (
              <article key={u.id} className="card overflow-hidden transition hover:shadow-lift">
                <Link to={`/used-bikes/${u.id}`} className="relative block aspect-[16/10] bg-ink-100">
                  {u.primary_image_url ? (
                    <img src={u.primary_image_url} alt={u.model_name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-ink-300"><svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3.5" /></svg></span>
                  )}
                  {u.is_verified_listing && <span className="absolute left-2 top-2"><VerifiedBadge label="Verified Listing" /></span>}
                  {u.dealer_name ? <span className="absolute right-2 top-2"><VerifiedBadge label="Verified Dealer" /></span> : null}
                </Link>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-ink-900">{u.year ? `${u.year} ` : ''}{u.model_name}</p>
                    <p className="text-lg font-extrabold text-ink-900">{inr(u.price)}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {u.fuel_type ? fuelShort(u.fuel_type) : ''} {u.km_driven != null ? `· ${u.km_driven.toLocaleString('en-IN')} km` : ''} · {u.city || 'India'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link to={`/used-bikes/${u.id}`} className="flex-1 rounded-lg bg-ink-900 px-3 py-2 text-center text-sm font-bold text-white hover:bg-ink-700">View Details</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No approved used bikes yet" desc="Sellers can post listings anytime — approved bikes appear here automatically." action={<Link to="/post-used-bike" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Post the first bike</Link>} />
        )}
      </Section>

      {/* ── COMPARE CTA ──────────────────────────────────────────────────── */}
      <section className="container-x py-10">
        <div className="card flex flex-col items-center justify-between gap-4 bg-ink-900 p-8 text-center md:flex-row md:text-left">
          <div>
            <h2 className="flex items-center justify-center gap-2 text-2xl font-black text-white md:justify-start">
              <ScaleIcon className="h-6 w-6 text-primary-500" /> Compare Bikes side by side
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ink-300">
              Pick 2–4 bikes, see every dynamic specification (missing values shown as N/A) and get the CompareBike Score with category breakdowns.
            </p>
          </div>
          <Link to="/compare" className="shrink-0 rounded-lg bg-primary-600 px-6 py-3 text-sm font-black text-white hover:bg-primary-500">
            Start Comparing →
          </Link>
        </div>
      </section>

      {/* ── BUYING GUIDES ────────────────────────────────────────────────── */}
      <Section title="Bike Buying Guides" subtitle="Practical advice for choosing, buying and owning your bike in India.">
        {data.articles.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.articles.slice(0, 4).map((a) => (
              <Link key={a.id} to={`/guides/${a.slug}`} className="card group overflow-hidden transition hover:shadow-lift">
                <div className="aspect-[16/9] bg-gradient-to-br from-ink-200 to-ink-300">
                  {a.image_path ? (
                    <img src={publicImageUrl('article-images', a.image_path) || undefined} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-ink-400"><svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" /></svg></span>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-600">{a.category === 'guide' ? 'Guide' : a.category}</p>
                  <h3 className="mt-1 font-bold leading-snug text-ink-900 group-hover:text-primary-600">{a.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-500">{a.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Guides coming soon" desc="Editorial guides published by the admin team appear here." />
        )}
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      {data.faqs.length > 0 && (
        <Section title="Frequently Asked Questions" action={<Link to="/faq" className="text-sm font-bold text-primary-600 hover:underline">All FAQs →</Link>}>
          <div className="mx-auto max-w-3xl space-y-2">
            {data.faqs.slice(0, 6).map((f) => (
              <div key={f.id} className="card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)} className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left">
                  <span className="text-sm font-bold text-ink-900">{f.question}</span>
                  <svg className={`h-4 w-4 shrink-0 text-ink-400 transition ${openFaq === f.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {openFaq === f.id && <p className="border-t border-ink-100 px-4 py-3 text-sm leading-relaxed text-ink-600">{f.answer}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Best bikes by budget (tabs under 1L / 1–2L / 2L+) ─────────────────────

const BUDGET_TABS = [
  { id: '1', label: 'Under ₹1 Lakh', min: 0, max: 100000 },
  { id: '2', label: '₹1 – 2 Lakh', min: 100000, max: 200000 },
  { id: '3', label: '₹2 Lakh +', min: 200000, max: 0 },
];

function BudgetSection() {
  const [tab, setTab] = useState('1');
  const [rows, setRows] = useState<BikeModel[]>([]);
  const [images, setImages] = useState<Record<string, { path: string; bucket: string } | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = BUDGET_TABS.find((x) => x.id === tab)!;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q: any = { sort: 'popular', per_page: 4, status: 'live', price_min: t.min || undefined };
      if (t.max) q.price_max = t.max;
      const res = await queryModels(q);
      setRows(res.rows);
      setImages(await loadModelImages(res.rows));
    } catch (e: any) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <Section title="Best Bikes by Budget" subtitle="Curated by popularity within each price band.">
      <div className="mb-5 flex flex-wrap gap-2">
        {BUDGET_TABS.map((bt) => (
          <button
            key={bt.id}
            onClick={() => setTab(bt.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${tab === bt.id ? 'bg-ink-900 text-white' : 'border border-ink-300 bg-white text-ink-700 hover:border-ink-400'}`}
          >
            {bt.label}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : rows.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((m) => (
            <BikeCard key={m.id} model={m} image={images[m.id]} />
          ))}
        </div>
      ) : (
        <EmptyState title={`No bikes in ${t.label}`} desc="Models in this price band will appear here as soon as they're published." />
      )}
    </Section>
  );
}
