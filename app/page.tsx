import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/lib/db';
import { listProducts, listUsedBikes, getStats } from '@/lib/queries';
import { getSettings, isOn } from '@/lib/settings';
import { inr, relative } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { CategoryChooser, ChangeCategoryButton } from '@/components/CategoryChooser';
import { SearchBox } from '@/components/SearchBox';
import { SectionHeader, TrustBadge } from '@/components/ui';
import { AdSlot } from '@/components/AdSlot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function HomePage() {
  const settings = await getSettings();

  const [trending, evs, priceDrops, usedBikes, offers, guides, comparisons, stats] = await Promise.all([
    listProducts({ category: 'bikes', sort: 'popular', perPage: 8 }),
    listProducts({ category: 'electric', sort: 'popular', perPage: 8 }),
    listProducts({ sort: 'price_low', perPage: 4 }),
    listUsedBikes({ sort: 'trust', perPage: 4 }),
    db.all<any>(
      `SELECT o.*, d.business_name, d.city AS dealer_city, p.name AS product_name, p.slug AS product_slug,
              p.fuel_type, b.name AS brand_name, b.slug AS brand_slug
         FROM dealer_offers o
         JOIN dealer_profiles d ON d.id = o.dealer_id
         JOIN products p ON p.id = o.product_id
         JOIN brands b ON b.id = p.brand_id
        WHERE o.status = 'approved' AND o.deleted_at IS NULL AND (o.end_date IS NULL OR o.end_date >= ?)
        ORDER BY o.featured DESC, o.discount DESC LIMIT 4`,
      [new Date().toISOString().slice(0, 10)],
    ),
    db.all<any>('SELECT title, slug, excerpt, category, reading_minutes, published_at FROM articles WHERE published = 1 AND deleted_at IS NULL ORDER BY published_at DESC LIMIT 3'),
    db.all<any>('SELECT id, slug, title, product_ids FROM comparisons ORDER BY featured DESC, view_count DESC LIMIT 6'),
    getStats(),
  ]);

  return (
    <>
      <CategoryChooser enabled={isOn(settings.show_category_chooser)} />

      {/* ------------------------------- HERO ------------------------------ */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-50/70 via-white to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-60"
          style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(31,118,242,.16), transparent 70%)' }}
        />
        <div className="container-xl relative py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[12px] font-medium text-brand-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              {stats.bikes} models · {stats.used} verified used bikes · {stats.dealers} verified dealers
            </span>

            <h1 className="mt-5 text-[34px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[52px]">
              Compare Smart.<br className="sm:hidden" /> <span className="text-brand-600">Buy Better.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-ink-soft">
              Structured specifications, honest running-cost maths and verified listings — for new bikes,
              electric scooters and used two-wheelers across India.
            </p>

            <div className="mx-auto mt-7 max-w-2xl">
              <SearchBox size="lg" placeholder="Search bikes, scooters, EVs and used bikes…" />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                <span className="text-ink-mute">Popular:</span>
                {['MT 15', 'Activa 125', 'Ather 450X', 'Classic 350', 'Pulsar N160'].map((t) => (
                  <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="chip !py-1 !text-xs">{t}</Link>
                ))}
              </div>
            </div>
          </div>

          {/* Two category cards (Used Bikes card removed per user request;
              AI-generated studio photos instead of the old line-art SVGs) */}
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <CategoryCard
              href="/bikes" title="Bikes & Scooters"
              body="Petrol motorcycles and scooters with full specification sheets, pros and cons, and dealer offers."
              cta={`${stats.bikes - stats.evs} models`} art="/media/cat-bikes.jpg" tone="brand" cover
            />
            <CategoryCard
              href="/electric" title="Electric"
              body="EV scooters and motorcycles with claimed range, our own real-world estimate and charging detail."
              cta={`${stats.evs} EVs`} art="/media/cat-electric.jpg" tone="accent" cover
            />
          </div>
        </div>
      </section>

      <div className="container-xl">
        <AdSlot slotKey="home_below_hero" className="mt-8" />
      </div>

      {/* -------------------------- POPULAR COMPARISONS ------------------- */}
      {comparisons.length > 0 && (
        <section className="container-xl py-12">
          <SectionHeader
            title="Popular comparisons"
            subtitle="Side-by-side on price, performance, safety and running cost — with the best value flagged per attribute."
            action={<Link href="/compare" className="btn-outline btn-sm">Build your own</Link>}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comparisons.map((c) => {
              const ids = JSON.parse(c.product_ids) as string[];
              return (
                <Link key={c.id} href={`/compare?ids=${ids.join(',')}`} className="card card-hover flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{ids.length}-way comparison</p>
                    <p className="mt-1 text-sm font-semibold leading-snug">{c.title}</p>
                  </div>
                  <span aria-hidden="true" className="text-ink-mute">→</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------------------- TRENDING BIKES ---------------------- */}
      <section className="container-xl py-6">
        <SectionHeader title="Trending bikes" subtitle="Most viewed petrol motorcycles and scooters this week." action={<Link href="/bikes" className="btn-outline btn-sm">All bikes</Link>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trending.items.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* ------------------------------ POPULAR EVs ------------------------ */}
      <section className="mt-8 border-y border-line bg-surface py-12">
        <div className="container-xl">
          <SectionHeader title="Popular electric" subtitle="Claimed range is shown separately from our own real-world estimate." action={<Link href="/electric" className="btn-outline btn-sm">All EVs</Link>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {evs.items.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
            <div className="flex-1">
              <p className="text-sm font-semibold">Not sure whether electric adds up for you?</p>
              <p className="text-[13px] text-ink-mute">Enter your monthly distance and tariff — we show the break-even point in months, not slogans.</p>
            </div>
            <Link href="/tools/ev-vs-petrol" className="btn-accent btn-sm">Open the calculator</Link>
          </div>
        </div>
      </section>

      {/* --------------------------- DEALER OFFERS ------------------------- */}
      {offers.length > 0 && (
        <section className="container-xl py-12">
          <SectionHeader title="Latest dealer offers" subtitle="Published by verified dealers and reviewed before going live. Confirm final pricing with the dealer." action={<Link href="/dealer-offers" className="btn-outline btn-sm">All offers</Link>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {offers.map((o) => (
              <article key={o.id} className="card card-hover flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="badge bg-accent-soft text-accent-dark">Save {inr(o.discount, { compact: true })}</span>
                  {o.featured === 1 && <span className="badge-sponsored">Featured</span>}
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-snug">
                  <Link href={`/${o.fuel_type === 'electric' ? 'electric' : 'bikes'}/${o.brand_slug}/${o.product_slug}`} className="hover:text-brand-600">
                    {o.brand_name} {o.product_name}
                  </Link>
                </h3>
                <p className="mt-1 text-[13px] text-ink-mute">{o.business_name} · {o.city}</p>
                <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-ink-soft">{o.offer_text}</p>
                <div className="mt-auto pt-3">
                  <Link href={`/dealer-offers?offer=${o.id}`} className="btn-outline btn-sm w-full">View offer</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------- PRICE DROPS ------------------------- */}
      <section className="container-xl pb-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <SectionHeader title="Most affordable right now" subtitle="Lowest recorded ex-showroom price in our database." />
            <ul className="divide-y divide-line">
              {priceDrops.items.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <Image src={p.image_url || '/media/commuter.svg'} alt="" width={64} height={40} className="h-10 w-16 rounded-lg object-contain" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/${p.fuel_type === 'electric' ? 'electric' : 'bikes'}/${p.brand_slug}/${p.slug}`} className="block truncate text-sm font-medium hover:text-brand-600">
                      {p.brand_name} {p.name}
                    </Link>
                    <p className="text-xs text-ink-mute">{p.fuel_type === 'electric' ? 'Electric' : `${Math.round(p.engine_capacity_cc || 0)} cc`}</p>
                  </div>
                  <span className="text-sm font-semibold">{inr(p.price_min)}</span>
                </li>
              ))}
            </ul>
            <Link href="/bikes?sort=price_low" className="btn-ghost btn-sm mt-2">See all →</Link>
          </div>

          <div className="card p-5">
            <SectionHeader title="Verified used bikes" subtitle="Trust score reflects only the checks actually completed." action={<Link href="/used-bikes" className="btn-ghost btn-sm">All →</Link>} />
            <ul className="divide-y divide-line">
              {usedBikes.items.map((u: any) => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <Image src={u.image_url || '/media/used.svg'} alt="" width={64} height={40} className="h-10 w-16 rounded-lg object-contain" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/used-bikes/${u.slug}`} className="block truncate text-sm font-medium hover:text-brand-600">
                      {u.brand_name} {u.model_name} · {u.manufacture_year}
                    </Link>
                    <p className="text-xs text-ink-mute">{u.city} · {Number(u.km_driven).toLocaleString('en-IN')} km · {u.owners} owner</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{inr(u.asking_price)}</p>
                    <TrustBadge band={u.trust_band} score={u.trust_score} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="container-xl">
        <AdSlot slotKey="home_mid" className="mb-8" />
      </div>

      {/* ------------------------------- GUIDES ---------------------------- */}
      <section className="container-xl pb-12">
        <SectionHeader title="Buying guides" subtitle="Practical, India-specific advice written by our editorial team." action={<Link href="/guides" className="btn-outline btn-sm">All guides</Link>} />
        <div className="grid gap-4 md:grid-cols-3">
          {guides.map((a) => (
            <Link key={a.slug} href={`/guides/${a.slug}`} className="card card-hover flex flex-col p-5">
              <span className="badge bg-surface text-ink-mute">{a.category.replace(/_/g, ' ')}</span>
              <h3 className="mt-3 text-[15px] font-semibold leading-snug">{a.title}</h3>
              <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-ink-mute">{a.excerpt}</p>
              <p className="mt-auto pt-4 text-xs text-ink-mute">{a.reading_minutes} min read · {relative(a.published_at)}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------- WHY BIKEPICK ------------------------- */}
      <section className="border-t border-line bg-ink py-14 text-white">
        <div className="container-xl">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Why Bikepick?</h2>
            <p className="mt-3 text-sm leading-7 text-white/70">
              We would rather show you an empty field than a guessed one. Every number on this platform comes from a
              structured database record with a recorded source.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Structured specifications', 'Over 60 fields per model, stored in typed columns — not one blob of text.'],
              ['Verified listings', 'A used bike shows a trust score built only from checks we actually performed and recorded.'],
              ['Dealer offers', 'Only verified dealers can publish, every offer is reviewed, and expired offers disappear automatically.'],
              ['Price tracking', 'Full price history with the source and date of every recorded change, plus alerts when your target is hit.'],
              ['Transparent comparisons', 'Winners are chosen per attribute with the right direction — lower price and lower weight win, not just bigger numbers.'],
              ['Source information', 'Each product page lists where its data came from, when it was extracted, and how confident we are.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
                <h3 className="text-[15px] font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-6 text-white/65">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <p className="flex-1 text-[13px] leading-6 text-white/70">
              <strong className="font-semibold text-white">Demo dataset notice.</strong> This installation is seeded with
              clearly-labelled demo products for testing. Prices are illustrative, not live market prices. Replace them
              with authorised feeds or a CSV import from the admin panel before launch.
            </p>
            <Link href="/admin" className="btn bg-white text-ink hover:bg-white/90 btn-sm">Open admin panel</Link>
          </div>
        </div>
      </section>

      <section className="container-xl py-10">
        <div className="flex flex-wrap items-center justify-center gap-3 text-center">
          <p className="text-sm text-ink-mute">Looking for something else?</p>
          <ChangeCategoryButton />
          <Link href="/find-my-bike" className="chip">Find my bike</Link>
          <Link href="/tools/used-bike-price" className="chip">Value my used bike</Link>
          <Link href="/dealer/register" className="chip">Register as a dealer</Link>
        </div>
      </section>
    </>
  );
}

function CategoryCard({ href, title, body, cta, art, tone, cover }: { href: string; title: string; body: string; cta: string; art: string; tone: 'brand' | 'accent' | 'ink'; cover?: boolean }) {
  const ring = { brand: 'hover:border-brand-300', accent: 'hover:border-accent/40', ink: 'hover:border-ink/25' }[tone];
  const pill = { brand: 'bg-brand-50 text-brand-700', accent: 'bg-accent-soft text-accent-dark', ink: 'bg-surface text-ink-soft' }[tone];
  return (
    <Link href={href} className={`card card-hover group overflow-hidden ${ring}`}>
      <div className="product-stage h-36">
        <Image
          src={art} alt="" width={640} height={400}
          className={`h-full w-full transition-transform duration-300 group-hover:scale-[1.04] ${cover ? 'object-cover' : 'object-contain p-2'}`}
        />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <span className={`badge ${pill}`}>{cta}</span>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-ink-mute">{body}</p>
        <span className="mt-3 inline-block text-[13px] font-semibold text-brand-600 group-hover:underline">Explore →</span>
      </div>
    </Link>
  );
}
