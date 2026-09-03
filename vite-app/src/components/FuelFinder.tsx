import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Brand, BikeModel, FuelType } from '../lib/types';
import { getBrands, queryModels, getReviewsForModel, type ModelSort } from '../lib/api';
import { inr, fuelShort } from '../lib/format';
import { EmptyState, ErrorBlock, LoadingBlock, Pagination, Section, Select } from './ui';
import BikeCard, { loadModelImages } from './BikeCard';
import SearchBox from './SearchBox';

/**
 * The fuel-first discovery flow:
 *   FUEL → BRAND → FUEL-SPECIFIC FILTERS → RESULTS
 * State lives in the URL (?fuel=&brand=&page=&sort=&...) so views are shareable.
 *
 * Petrol filters:    Engine CC, Price, Mileage, Body Type, Transmission
 * Electric filters:  Price, Range, Battery, Charging Time, Motor Power
 * CNG+Petrol:        Price, Mileage, Engine, Fuel Type
 */
export default function FuelFinder({ initialFuel }: { initialFuel?: FuelType; brands: Brand[] }) {
  const [params, setParams] = useSearchParams();
  const fuel = (params.get('fuel') as FuelType | null) || (initialFuel ?? null);
  const brandSlug = params.get('brand') || '';
  const page = Math.max(1, Number(params.get('page') || 1));
  const sort = (params.get('sort') as ModelSort) || 'popular';
  const search = params.get('q') || '';

  // brand filters
  const [ccMin, setCcMin] = useState('');
  const [ccMax, setCcMax] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [mileageMin, setMileageMin] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [rangeMin, setRangeMin] = useState('');
  const [batteryMin, setBatteryMin] = useState('');
  const [chargeMax, setChargeMax] = useState('');
  const [powerMin, setPowerMin] = useState('');

  const [rows, setRows] = useState<BikeModel[]>([]);
  const [count, setCount] = useState(0);
  const [images, setImages] = useState<Record<string, { path: string; bucket: string } | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandMap, setBrandMap] = useState<Record<string, Brand>>({});
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({});

  // load brand counts (one lightweight query, client-side tally)
  useEffect(() => {
    (async () => {
      try {
        const all = await getBrands();
        const map: Record<string, Brand> = {};
        all.forEach((b) => (map[b.slug] = b));
        setBrandMap(map);
        const sb = (await import('../lib/supabase')).requireSupabase();
        const { data } = await sb.from('bike_models').select('brand_id, brands(slug)').eq('is_published', true);
        const counts: Record<string, number> = {};
        (data || []).forEach((r: any) => {
          const s = r.brands?.slug;
          if (s) counts[s] = (counts[s] || 0) + 1;
        });
        setBrandCounts(counts);
      } catch {
        /* brand chips degrade gracefully */
      }
    })();
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
      const q: Parameters<typeof queryModels>[0] = {
        fuel: fuel || undefined,
        page,
        per_page: 12,
        sort,
        search: search || undefined,
      };
      if (brandSlug) {
        const b = brandMap[brandSlug];
        if (b) q.brand_id = b.id;
      }
      if (fuel === 'petrol') {
        if (ccMin) q.cc_min = Number(ccMin);
        if (ccMax) q.cc_max = Number(ccMax);
        if (mileageMin) q.mileage_min = Number(mileageMin);
        if (bodyType) q.body_type = bodyType;
      }
      if (fuel === 'electric') {
        if (rangeMin) q.range_min = Number(rangeMin);
      }
      if (priceMin) q.price_min = Number(priceMin);
      if (priceMax) q.price_max = Number(priceMax);
      const res = await queryModels(q);
      setRows(res.rows);
      setCount(res.count);
      setImages(await loadModelImages(res.rows));
    } catch (e: any) {
      setError(e.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fuel, brandSlug, page, sort, search, ccMin, ccMax, priceMin, priceMax, mileageMin, bodyType, rangeMin, brandMap]);

  useEffect(() => {
    load();
  }, [load]);

  // post-query filters that can't be pushed to the DB (charging time, battery, power)
  const filtered = useMemo(() => {
    let out = rows;
    if (fuel === 'electric') {
      if (batteryMin) out = out.filter((m) => (m.battery_kwh ?? 0) >= Number(batteryMin));
      if (chargeMax) out = out.filter((m) => parseHours(m.charging_time) <= Number(chargeMax));
      if (powerMin) out = out.filter((m) => (m.power_ps ?? 0) >= Number(powerMin));
    }
    return out;
  }, [rows, fuel, batteryMin, chargeMax, powerMin]);

  const per = 12;
  const pages = Math.max(1, Math.ceil(count / per));

  const activeFilterCount = [ccMin, ccMax, priceMin, priceMax, mileageMin, bodyType, rangeMin, batteryMin, chargeMax, powerMin].filter(Boolean).length;

  return (
    <Section
      id="find-your-bike"
      title={
        fuel ? (
          <span className="flex items-center gap-2">
            {fuelShort(fuel)} Bikes
            <button onClick={() => setParam('fuel', '')} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-bold text-ink-600 hover:bg-ink-200">
              Change fuel ✕
            </button>
          </span>
        ) : (
          'Find Your Bike'
        )
      }
      subtitle={fuel ? 'Pick a brand and fine-tune with the filters below.' : 'Choose a fuel type above, then narrow down by brand and spec.'}
    >
      {/* quick search inside finder */}
      <div className="mb-5 max-w-xl">
        <SearchBox />
      </div>

      {/* Brand chips (dynamic from Supabase) */}
      {Object.keys(brandMap).length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-400">Select Brand</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <Chip active={!brandSlug} onClick={() => setParam('brand', '')}>All Brands</Chip>
            {Object.values(brandMap).map((b) => (
              <Chip key={b.id} active={brandSlug === b.slug} onClick={() => setParam('brand', b.slug)}>
                {b.name}{brandCounts[b.slug] ? ` (${brandCounts[b.slug]})` : ''}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Fuel-specific filters */}
      {fuel && (
        <div className="card mb-6 grid grid-cols-2 gap-3 p-4 md:grid-cols-4 lg:grid-cols-6">
          {fuel === 'petrol' && (
            <>
              <MiniFilter label="Engine CC (min)">
                <input className="input-base" type="number" placeholder="e.g. 110" value={ccMin} onChange={(e) => setCcMin(e.target.value)} />
              </MiniFilter>
              <MiniFilter label="Engine CC (max)">
                <input className="input-base" type="number" placeholder="e.g. 400" value={ccMax} onChange={(e) => setCcMax(e.target.value)} />
              </MiniFilter>
              <MiniFilter label="Mileage (min kmpl)">
                <input className="input-base" type="number" placeholder="e.g. 50" value={mileageMin} onChange={(e) => setMileageMin(e.target.value)} />
              </MiniFilter>
              <MiniFilter label="Body type">
                <select className="input-base" value={bodyType} onChange={(e) => setBodyType(e.target.value)}>
                  <option value="">Any</option>
                  <option>Commuter</option>
                  <option>Standard</option>
                  <option>Sport</option>
                  <option>Cruiser</option>
                  <option>Adventure</option>
                </select>
              </MiniFilter>
            </>
          )}
          {fuel === 'electric' && (
            <>
              <MiniFilter label="Range (min km)">
                <input className="input-base" type="number" placeholder="e.g. 100" value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} />
              </MiniFilter>
              <MiniFilter label="Battery (min kWh)">
                <input className="input-base" type="number" step="0.1" placeholder="e.g. 2.5" value={batteryMin} onChange={(e) => setBatteryMin(e.target.value)} />
              </MiniFilter>
              <MiniFilter label="Charging (max hrs)">
                <input className="input-base" type="number" step="0.5" placeholder="e.g. 4" value={chargeMax} onChange={(e) => setChargeMax(e.target.value)} />
              </MiniFilter>
              <MiniFilter label="Motor power (min PS)">
                <input className="input-base" type="number" placeholder="e.g. 5" value={powerMin} onChange={(e) => setPowerMin(e.target.value)} />
              </MiniFilter>
            </>
          )}
          {fuel === 'cng_petrol' && (
            <>
              <MiniFilter label="Engine CC (min)">
                <input className="input-base" type="number" placeholder="e.g. 100" value={ccMin} onChange={(e) => setCcMin(e.target.value)} />
              </MiniFilter>
              <MiniFilter label="Engine CC (max)">
                <input className="input-base" type="number" placeholder="e.g. 400" value={ccMax} onChange={(e) => setCcMax(e.target.value)} />
              </MiniFilter>
              <MiniFilter label="Mileage (min kmpl)">
                <input className="input-base" type="number" placeholder="e.g. 30" value={mileageMin} onChange={(e) => setMileageMin(e.target.value)} />
              </MiniFilter>
            </>
          )}
          <MiniFilter label="Price (from ₹)">
            <input className="input-base" type="number" placeholder="e.g. 80000" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
          </MiniFilter>
          <MiniFilter label="Price (to ₹)">
            <input className="input-base" type="number" placeholder="e.g. 250000" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
          </MiniFilter>
        </div>
      )}

      {/* Sort + count + clear */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          {loading ? 'Searching…' : `${count} bike${count === 1 ? '' : 's'} found`}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setCcMin(''); setCcMax(''); setPriceMin(''); setPriceMax(''); setMileageMin('');
                setBodyType(''); setRangeMin(''); setBatteryMin(''); setChargeMax(''); setPowerMin('');
              }}
              className="ml-2 text-xs font-bold text-primary-600 hover:underline"
            >
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </button>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Sort</span>
          <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'popular' ? '' : e.target.value)} className="input-base w-auto py-1.5 text-sm">
            <option value="popular">Popularity</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="mileage">Mileage</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <LoadingBlock label="Loading bikes…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : filtered.length ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((m) => (
              <BikeCard key={m.id} model={m} image={images[m.id]} />
            ))}
          </div>
          <Pagination page={page} pages={pages} onChange={(p) => setParam('page', String(p))} />
        </>
      ) : (
        <EmptyState
          title="No bikes match these filters"
          desc="Try widening the price range, removing a filter, or picking a different brand."
          action={
            <button
              onClick={() => {
                setCcMin(''); setCcMax(''); setPriceMin(''); setPriceMax(''); setMileageMin('');
                setBodyType(''); setRangeMin(''); setBatteryMin(''); setChargeMax(''); setPowerMin('');
                setParam('brand', '');
              }}
              className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-bold text-white hover:bg-ink-700"
            >
              Reset all filters
            </button>
          }
        />
      )}
    </Section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${active ? 'bg-ink-900 text-white shadow' : 'border border-ink-300 bg-white text-ink-700 hover:border-ink-500'}`}
    >
      {children}
    </button>
  );
}

function MiniFilter({ label, children }: { label: string; children: React.ReactNode }) {
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
