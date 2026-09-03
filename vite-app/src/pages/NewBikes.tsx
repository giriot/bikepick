import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getBrands, queryModels, getReviewsForModel, type ModelSort } from '../lib/api';
import { getScoreWeights, quickScoreFor } from '../lib/scorex';
import type { BikeModel, Brand, ModelStatus } from '../lib/types';
import { inr, fuelShort, FUEL_OPTIONS, BODY_TYPES, titleCase } from '../lib/format';
import { useSEO, breadcrumbJsonLd } from '../lib/seo';
import { EmptyState, ErrorBlock, LoadingBlock, Pagination, Select } from '../components/ui';
import BikeCard, { loadModelImages } from '../components/BikeCard';
import SearchBox from '../components/SearchBox';

/**
 * /new-bikes — full catalogue with every filter required:
 * brand, price from/to, fuel, engine CC, mileage, transmission, body type,
 * status, EV range, charging time + sorts (price, mileage, popularity,
 * newest, Compare Score).
 */
export default function NewBikes({ fixedStatus }: { fixedStatus?: ModelStatus; page?: React.ReactNode }) {
  const [params, setParams] = useSearchParams();
  const { settings } = useApp();
  const brandName = settings['brand_name'] || 'CompareBike';

  const fuel = params.get('fuel') || '';
  const brandSlug = params.get('brand') || '';
  const status = fixedStatus || params.get('status') || '';
  const sort = (params.get('sort') as ModelSort) || 'popular';
  const page = Math.max(1, Number(params.get('page') || 1));

  const [priceMin, setPriceMin] = useState(params.get('pmin') || '');
  const [priceMax, setPriceMax] = useState(params.get('pmax') || '');
  const [ccMin, setCcMin] = useState('');
  const [ccMax, setCcMax] = useState('');
  const [mileageMin, setMileageMin] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [transmission, setTransmission] = useState('');
  const [rangeMin, setRangeMin] = useState('');
  const [chargeMax, setChargeMax] = useState('');
  const [search, setSearch] = useState('');

  const [brands, setBrands] = useState<Brand[]>([]);
  const [pool, setPool] = useState<BikeModel[]>([]);
  const [count, setCount] = useState(0);
  const [images, setImages] = useState<Record<string, { path: string; bucket: string } | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<ReturnType<typeof getScoreWeights> extends Promise<infer T> ? T : never>(null as any);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => null);
    getScoreWeights().then(setWeights).catch(() => null);
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
      const q: Parameters<typeof queryModels>[0] = { page, per_page: 12, sort: sort === 'score' ? 'popular' : sort };
      if (fuel) q.fuel = fuel;
      if (status) q.status = status;
      if (brandSlug) {
        const b = brands.find((x) => x.slug === brandSlug);
        if (b) q.brand_id = b.id;
      }
      if (priceMin) q.price_min = Number(priceMin);
      if (priceMax) q.price_max = Number(priceMax);
      if (ccMin) q.cc_min = Number(ccMin);
      if (ccMax) q.cc_max = Number(ccMax);
      if (mileageMin) q.mileage_min = Number(mileageMin);
      if (bodyType) q.body_type = bodyType;
      if (rangeMin) q.range_min = Number(rangeMin);
      if (search) q.search = search;
      const res = await queryModels(q);
      let rows = res.rows;

      // client-side filters that need spec data
      if (transmission) {
        const wanted = transmission.toLowerCase();
        rows = rows.filter((m) => (m as any).transmission_value?.toLowerCase().includes(wanted));
      }
      if (chargeMax) rows = rows.filter((m) => parseHours(m.charging_time) <= Number(chargeMax));

      // Compare Score sort: compute over the visible pool
      if (sort === 'score' && weights) {
        rows = [...rows].sort((a, b) => quickScoreFor(b, weights) - quickScoreFor(a, weights));
      }

      // ratings overlay (cheap: only this page)
      for (const m of rows.slice(0, 12)) {
        try {
          const { avg, count: c } = await getReviewsForModel(m.id, 1, 1);
          if (avg) {
            m.rating_avg = avg;
            m.review_count = c;
          }
        } catch { /* optional */ }
      }

      setPool(rows);
      setCount(res.count);
      setImages(await loadModelImages(rows));
    } catch (e: any) {
      setError(e.message);
      setPool([]);
    } finally {
      setLoading(false);
    }
  }, [fuel, brandSlug, status, sort, page, priceMin, priceMax, ccMin, ccMax, mileageMin, bodyType, rangeMin, search, brands, weights]);

  useEffect(() => {
    load();
  }, [load]);

  const per = 12;
  const pages = Math.max(1, Math.ceil(count / per));

  useSEO({
    title: `${fixedStatus === 'upcoming' ? 'Upcoming Bikes' : 'New Bikes'} in India — ${brandName}`,
    description: 'Browse new bikes in India by fuel type, brand, price, mileage and more. Compare specs and check live dealer offers.',
    jsonLd: breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: fixedStatus === 'upcoming' ? 'Upcoming Bikes' : 'New Bikes', url: '/new-bikes' }]),
  });

  const clearAll = () => {
    setPriceMin(''); setPriceMax(''); setCcMin(''); setCcMax(''); setMileageMin('');
    setBodyType(''); setTransmission(''); setRangeMin(''); setChargeMax(''); setSearch('');
    const next = new URLSearchParams();
    if (fuel) next.set('fuel', fuel);
    if (status) next.set('status', status);
    setParams(next);
  };

  return (
    <div className="container-x py-8">
      <nav className="mb-3 text-xs text-ink-400">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="font-semibold text-ink-700">{fixedStatus === 'upcoming' ? 'Upcoming Bikes' : 'New Bikes'}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-ink-900">
            {fixedStatus === 'upcoming' ? 'Upcoming Bikes' : 'New Bikes'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {fuel ? `${fuelShort(fuel)} · ` : ''}{brandSlug ? titleCase(brandSlug) + ' · ' : ''}
            {loading ? 'searching…' : `${count} bike${count === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <SearchBox />
        </div>
      </div>

      {/* Filter bar */}
      <div className="card mb-6 grid grid-cols-2 gap-3 p-4 md:grid-cols-4 xl:grid-cols-6">
        <F label="Fuel type">
          <Select value={fuel} onChange={(e) => setParam('fuel', e.target.value)}>
            <option value="">All fuels</option>
            {FUEL_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        </F>
        <F label="Brand">
          <Select value={brandSlug} onChange={(e) => setParam('brand', e.target.value)}>
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.id} value={b.slug}>{b.name}</option>)}
          </Select>
        </F>
        {!fixedStatus && (
          <F label="Status">
            <Select value={status} onChange={(e) => setParam('status', e.target.value)}>
              <option value="">Live + upcoming</option>
              <option value="live">Live</option>
              <option value="upcoming">Upcoming</option>
              <option value="outdated">Outdated</option>
              <option value="discontinued">Discontinued</option>
            </Select>
          </F>
        )}
        <F label="Price (from ₹)">
          <input className="input-base" type="number" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
        </F>
        <F label="Price (to ₹)">
          <input className="input-base" type="number" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
        </F>
        <F label="Sort by">
          <Select value={sort} onChange={(e) => setParam('sort', e.target.value === 'popular' ? '' : e.target.value)}>
            <option value="popular">Popularity</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="mileage">Mileage</option>
            <option value="score">Compare Score</option>
          </Select>
        </F>
        <F label="Engine CC (min)">
          <input className="input-base" type="number" placeholder="e.g. 100" value={ccMin} onChange={(e) => setCcMin(e.target.value)} />
        </F>
        <F label="Engine CC (max)">
          <input className="input-base" type="number" placeholder="e.g. 400" value={ccMax} onChange={(e) => setCcMax(e.target.value)} />
        </F>
        <F label="Mileage (min kmpl)">
          <input className="input-base" type="number" placeholder="e.g. 40" value={mileageMin} onChange={(e) => setMileageMin(e.target.value)} />
        </F>
        <F label="Body type">
          <Select value={bodyType} onChange={(e) => setBodyType(e.target.value)}>
            <option value="">Any</option>
            {BODY_TYPES.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </F>
        <F label="Transmission">
          <Select value={transmission} onChange={(e) => setTransmission(e.target.value)}>
            <option value="">Any</option>
            <option value="manual">Manual</option>
            <option value="CVT">CVT</option>
            <option value="automatic">Automatic / AMT</option>
          </Select>
        </F>
        <F label="EV range (min km)">
          <input className="input-base" type="number" placeholder="e.g. 100" value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} />
        </F>
        <F label="Charging (max hrs)">
          <input className="input-base" type="number" step="0.5" placeholder="e.g. 4" value={chargeMax} onChange={(e) => setChargeMax(e.target.value)} />
        </F>
      </div>

      {loading ? (
        <LoadingBlock label="Loading bikes…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : pool.length ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pool.map((m) => (
              <BikeCard key={m.id} model={m} image={images[m.id]} />
            ))}
          </div>
          <Pagination page={page} pages={pages} onChange={(p) => setParam('page', String(p))} />
        </>
      ) : (
        <EmptyState
          title="No bikes found"
          desc="Nothing matches the current filters. Try clearing a few."
          action={<button onClick={clearAll} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-bold text-white hover:bg-ink-700">Clear all filters</button>}
        />
      )}
    </div>
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

function parseHours(text: string | null): number {
  if (!text) return 0;
  const m = text.match(/([\d.]+)/);
  return m ? Number(m[1]) : 99;
}
