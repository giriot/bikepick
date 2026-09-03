import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { globalSearch, queryModels } from '../lib/api';
import type { BikeModel } from '../lib/types';
import { inr } from '../lib/format';
import BikeCard from '../components/BikeCard';
import { EmptyState, ErrorBlock, LoadingBlock, RatingStars } from '../components/ui';

/**
 * /search?q=… — live search results with quick-filters.
 * Combines the suggestion API (for the dropdown feel) with a full result grid.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const fuel = params.get('fuel') || '';
  const budget = params.get('budget') || '';
  const [results, setResults] = useState<BikeModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [popular, setPopular] = useState<BikeModel[]>([]);
  const timer = useRef<any>(null);

  useEffect(() => {
    queryModels({ per_page: 12, sort: 'popular' }).then((r) => setPopular(r.rows)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setError(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const s = await globalSearch(q, 24);
        let rows: BikeModel[] = s.models;
        if (fuel) rows = rows.filter((r) => r.fuel_type === fuel);
        if (budget) {
          const [lo, hi] = budget.split('-').map(Number);
          rows = rows.filter((r) => r.price_start != null && (hi ? r.price_start <= hi : true) && (lo ? r.price_start >= lo : true));
        }
        setResults(rows);
      } catch (e: any) {
        setError(e.message);
      }
    }, 200);
    return () => clearTimeout(timer.current);
  }, [q, fuel, budget]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-black text-ink-900">
        {q.trim() ? <>Search results for “{q.trim()}”</> : 'Search bikes'}
      </h1>
      <p className="mb-6 text-sm text-ink-500">
        {q.trim()
          ? results != null
            ? `${results.length} match${results.length === 1 ? '' : 'es'}`
            : 'Search by brand, model or keyword — e.g. “pulse”, “cb350”, “electric under 1.5 lakh”.'
          : 'Type in the search bar above, or use the shortcuts below.'}
      </p>

      {/* quick filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {['petrol', 'electric', 'cng_petrol'].map((f) => (
          <button
            key={f}
            onClick={() => setParam('fuel', fuel === f ? '' : f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${fuel === f ? 'border-primary-600 bg-primary-600 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-primary-400'}`}
          >
            {f === 'cng_petrol' ? 'CNG + Petrol' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-ink-200" />
        {[
          { id: '0-50000', label: 'Under ₹50k' },
          { id: '50000-100000', label: '₹50k–1L' },
          { id: '100000-200000', label: '₹1L–2L' },
          { id: '200000-500000', label: '₹2L–5L' },
          { id: '500000-0', label: '₹5L+' },
        ].map((b) => (
          <button
            key={b.id}
            onClick={() => setParam('budget', budget === b.id ? '' : b.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${budget === b.id ? 'border-primary-600 bg-primary-600 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-primary-400'}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {error && <ErrorBlock message={error} />}

      {!q.trim() && popular.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-ink-400">Popular searches start here</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.slice(0, 8).map((m) => (
              <BikeCard key={m.id} model={m} />
            ))}
          </div>
        </>
      )}

      {q.trim() && results == null && <LoadingBlock />}
      {q.trim() && results != null && results.length === 0 && (
        <EmptyState
          title={`Nothing found for “${q.trim()}”`}
          desc="Check the spelling, try the brand name only, or browse by fuel type."
          action={<a href="/new-bikes" className="mt-4 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">Browse all bikes</a>}
        />
      )}
      {results != null && results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((m) => (
            <BikeCard key={m.id} model={m} />
          ))}
        </div>
      )}
    </div>
  );
}
