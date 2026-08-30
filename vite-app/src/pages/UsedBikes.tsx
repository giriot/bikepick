import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getBrands, queryUsedBikes, type UsedSort } from '../lib/api';
import type { Brand, UsedBike } from '../lib/types';
import { inr, fuelShort, CONDITION_GRADES, FUEL_OPTIONS, titleCase } from '../lib/format';
import { useSEO, breadcrumbJsonLd } from '../lib/seo';
import { Button, EmptyState, ErrorBlock, LoadingBlock, Pagination, Select, VerifiedBadge } from '../components/ui';
import SearchBox from '../components/SearchBox';

const STATES = ['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','Uttarakhand','West Bengal','Other'];

export default function UsedBikes() {
  const [params, setParams] = useSearchParams();
  const { settings, isAuthed } = useApp();
  const brandName = settings['brand_name'] || 'CompareBike';

  const page = Math.max(1, Number(params.get('page') || 1));
  const sort = (params.get('sort') as UsedSort) || 'newest';
  const state = params.get('state') || '';
  const sellerType = params.get('seller') || '';

  const [brandSlug, setBrandSlug] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [kmMax, setKmMax] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [city, setCity] = useState('');
  const [fuel, setFuel] = useState('');
  const [condition, setCondition] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [search, setSearch] = useState('');

  const [brands, setBrands] = useState<Brand[]>([]);
  const [rows, setRows] = useState<UsedBike[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => null);
  }, []);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q: Parameters<typeof queryUsedBikes>[0] = { page, per_page: 12, sort };
      if (brandSlug) {
        const b = brands.find((x) => x.slug === brandSlug);
        if (b) q.brand_id = b.id;
      }
      if (priceMin) q.price_min = Number(priceMin);
      if (priceMax) q.price_max = Number(priceMax);
      if (kmMax) q.km_max = Number(kmMax);
      if (yearMin) q.year_min = Number(yearMin);
      if (yearMax) q.year_max = Number(yearMax);
      if (city) q.city = city;
      if (state) q.state = state;
      if (fuel) q.fuel = fuel;
      if (condition) q.condition = condition;
      if (verifiedOnly) q.verified = true;
      if (sellerType) q.seller_type = sellerType as 'dealer' | 'user';
      if (search) q.search = search;
      const res = await queryUsedBikes(q);
      setRows(res.rows);
      setCount(res.count);
    } catch (e: any) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, sort, state, sellerType, brandSlug, priceMin, priceMax, kmMax, yearMin, yearMax, city, fuel, condition, verifiedOnly, search, brands]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(count / 12));

  useSEO({
    title: `Used Bikes in India — Verified Second-Hand Motorcycles | ${brandName}`,
    description: 'Browse admin-verified used bikes from sellers and dealers across India. Filter by price, km driven, year, city and more.',
    jsonLd: breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Used Bikes', url: '/used-bikes' }]),
  });

  return (
    <div className="container-x py-8">
      <nav className="mb-3 text-xs text-ink-400">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="font-semibold text-ink-700">Used Bikes</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-ink-900">Used Bikes</h1>
          <p className="mt-1 text-sm text-ink-500">
            {loading ? 'searching…' : `${count} verified listing${count === 1 ? '' : 's'}`} — every listing is checked by our admin team before it goes live.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="w-56"><SearchBox /></div>
          <Link to="/post-used-bike" className="shrink-0 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700">
            + Sell a Bike
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6 grid grid-cols-2 gap-3 p-4 md:grid-cols-4 xl:grid-cols-6">
        <F label="Brand">
          <Select value={brandSlug} onChange={(e) => setBrandSlug(e.target.value)}>
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.slug}>{b.name}</option>)}
          </Select>
        </F>
        <F label="Price (from ₹)">
          <input className="input-base" type="number" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
        </F>
        <F label="Price (to ₹)">
          <input className="input-base" type="number" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
        </F>
        <F label="KM driven (max)">
          <input className="input-base" type="number" placeholder="e.g. 40000" value={kmMax} onChange={(e) => setKmMax(e.target.value)} />
        </F>
        <F label="Year (from)">
          <input className="input-base" type="number" placeholder="e.g. 2018" value={yearMin} onChange={(e) => setYearMin(e.target.value)} />
        </F>
        <F label="Year (to)">
          <input className="input-base" type="number" placeholder="e.g. 2025" value={yearMax} onChange={(e) => setYearMax(e.target.value)} />
        </F>
        <F label="City / area">
          <input className="input-base" placeholder="e.g. Coimbatore" value={city} onChange={(e) => setCity(e.target.value)} />
        </F>
        <F label="State">
          <Select value={state} onChange={(e) => setParam('state', e.target.value)}>
            <option value="">All states</option>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </F>
        <F label="Fuel">
          <Select value={fuel} onChange={(e) => setFuel(e.target.value)}>
            <option value="">Any fuel</option>
            {FUEL_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        </F>
        <F label="Condition">
          <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="">Any condition</option>
            {CONDITION_GRADES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </F>
        <F label="Seller">
          <Select value={sellerType} onChange={(e) => setParam('seller', e.target.value)}>
            <option value="">Any seller</option>
            <option value="dealer">Dealer</option>
            <option value="user">Individual</option>
          </Select>
        </F>
        <F label="Sort">
          <Select value={sort} onChange={(e) => setParam('sort', e.target.value === 'newest' ? '' : e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="km_asc">KM driven: Low → High</option>
          </Select>
        </F>
      </div>

      <label className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
        <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="h-4 w-4 accent-primary-600" />
        Verified documents only
      </label>

      {loading ? (
        <LoadingBlock label="Loading used bikes…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : rows.length ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((u) => (
              <UsedCard key={u.id} u={u} />
            ))}
          </div>
          <Pagination page={page} pages={pages} onChange={(p) => setParam('page', String(p))} />
        </>
      ) : (
        <EmptyState
          title="No used bikes match these filters"
          desc="Try widening the price range or clearing filters. New verified listings arrive daily."
          action={<Link to="/post-used-bike" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Post a used bike</Link>}
        />
      )}
    </div>
  );
}

export function UsedCard({ u }: { u: UsedBike }) {
  const { hasFav, toggleFav } = useApp();
  const saved = hasFav('used_bike', u.id);
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:shadow-lift">
      <Link to={`/used-bikes/${u.id}`} className="relative block aspect-[16/10] overflow-hidden bg-ink-100">
        {u.primary_image_url ? (
          <img src={u.primary_image_url} alt={`${u.year || ''} ${u.model_name}`} className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <span className="flex h-full items-center justify-center text-ink-300">
            <svg className="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3.5" /></svg>
          </span>
        )}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {u.is_verified_listing && <VerifiedBadge label="Verified Listing" />}
          {u.dealer_name ? <VerifiedBadge label="Verified Dealer" /> : null}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleFav('used_bike', u.id);
          }}
          aria-label={saved ? 'Remove from saved' : 'Save listing'}
          className={`absolute right-2 top-2 rounded-full p-2 shadow ${saved ? 'bg-red-500 text-white' : 'bg-white/90 text-ink-500 hover:text-red-500'}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold leading-snug text-ink-900">
              {u.year ? `${u.year} ` : ''}{u.brand_name ? `${u.brand_name} ` : ''}{u.model_name}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {u.fuel_type ? fuelShort(u.fuel_type) : ''}
              {u.km_driven != null ? ` · ${u.km_driven.toLocaleString('en-IN')} km` : ''}
              {u.city ? ` · ${u.city}` : ''}
            </p>
          </div>
          <p className="text-lg font-extrabold text-ink-900">{inr(u.price)}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-ink-600">
          {u.condition_grade ? <span className="rounded-md bg-ink-100 px-2 py-1">{titleCase(u.condition_grade)}</span> : null}
          {u.owner_count ? <span className="rounded-md bg-ink-100 px-2 py-1">{u.owner_count} owner{u.owner_count > 1 ? 's' : ''}</span> : null}
          {u.has_insurance ? <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">Insured</span> : null}
        </div>
        <div className="mt-auto flex gap-2 pt-4">
          <Link to={`/used-bikes/${u.id}`} className="flex-1 rounded-lg bg-ink-900 px-3 py-2 text-center text-sm font-bold text-white hover:bg-ink-700">
            View Details
          </Link>
          <Link to={`/used-bikes/${u.id}#contact`} className="rounded-lg border border-ink-300 px-3 py-2 text-sm font-bold text-ink-700 hover:border-ink-500">
            Contact
          </Link>
        </div>
      </div>
    </article>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</span>
      {children}
    </label>
  );
}
