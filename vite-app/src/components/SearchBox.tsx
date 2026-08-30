import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearch } from '../lib/api';
import type { SearchResult } from '../lib/types';
import { inr } from '../lib/format';
import { SearchIcon, Spinner } from './ui';

/**
 * Live global search across brands, models, variants, used bikes and dealers.
 * Debounced 250ms; results come straight from Supabase (indexed ILIKE queries).
 */
export default function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const search = (term: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!term.trim() || term.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await globalSearch(term.trim(), 5);
        setResults(r);
        setOpen(true);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const go = (path: string) => {
    setOpen(false);
    setQ('');
    setResults(null);
    navigate(path);
    onNavigate?.();
  };

  const goFull = () => {
    if (!q.trim()) return;
    go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const r = results;
  const hasAny = r && (r.brands.length || r.models.length || r.variants.length || r.used.length || r.dealers.length);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
          <SearchIcon className="h-4.5 w-4.5 h-5 w-5" />
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => r && setOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && goFull()}
          placeholder="Search bike, brand or model…"
          className="input-base rounded-full pl-10 pr-24 text-sm"
          aria-label="Search bikes, brands, models"
        />
        {loading && <span className="absolute right-10 top-1/2 -translate-y-1/2 text-primary-600"><Spinner className="h-4 w-4" /></span>}
        {q.trim().length >= 2 && (
          <button onClick={goFull} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-700">
            Search
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-ink-200 bg-white shadow-lift">
          {!hasAny && !loading && (
            <p className="px-4 py-6 text-center text-sm text-ink-500">
              No matches for “{q}”. Try a brand like <button className="font-semibold text-primary-600" onClick={() => { setQ('Hero'); search('Hero'); }}>Hero</button> or a model.
            </p>
          )}
          {r && r.models.length > 0 && (
            <Group title="Models">
              {r.models.map((m) => (
                <button key={m.id} onClick={() => go(`/new-bikes/${m.brand_slug}/${m.slug}`)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-ink-50">
                  <span>
                    <span className="block text-sm font-semibold text-ink-900">{m.brand_name} {m.name}</span>
                    <span className="text-xs capitalize text-ink-400">{m.fuel_type === 'cng_petrol' ? 'CNG + Petrol' : m.fuel_type}</span>
                  </span>
                  <span className="text-sm font-bold text-ink-700">{inr(m.price_start)}</span>
                </button>
              ))}
            </Group>
          )}
          {r && r.variants.length > 0 && (
            <Group title="Variants">
              {r.variants.map((v) => (
                <button key={v.id} onClick={() => go(`/new-bikes/${v.brand_slug}/${v.model_slug}`)} className="block w-full px-4 py-2.5 text-left text-sm text-ink-800 hover:bg-ink-50">
                  {v.brand_name} {v.model_name} <span className="text-ink-400">· {v.name}</span>
                </button>
              ))}
            </Group>
          )}
          {r && r.brands.length > 0 && (
            <Group title="Brands">
              {r.brands.map((b) => (
                <button key={b.id} onClick={() => go(`/brands/${b.slug}`)} className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-ink-800 hover:bg-ink-50">
                  {b.name}
                </button>
              ))}
            </Group>
          )}
          {r && r.used.length > 0 && (
            <Group title="Used Bikes">
              {r.used.map((u) => (
                <button key={u.id} onClick={() => go(`/used-bikes/${u.id}`)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-ink-50">
                  <span className="text-sm text-ink-800">{u.year ? `${u.year} ` : ''}{u.model_name}{u.city ? ` · ${u.city}` : ''}</span>
                  <span className="text-sm font-bold text-ink-700">{inr(u.price)}</span>
                </button>
              ))}
            </Group>
          )}
          {r && r.dealers.length > 0 && (
            <Group title="Dealers">
              {r.dealers.map((d) => (
                <div key={d.id} className="block w-full px-4 py-2.5 text-sm text-ink-800">
                  {d.dealer_name} <span className="text-ink-400">· {d.city}{d.state ? `, ${d.state}` : ''}</span>
                </div>
              ))}
            </Group>
          )}
          <div className="border-t border-ink-100 p-2">
            <button onClick={goFull} className="w-full rounded-lg py-2 text-center text-sm font-bold text-primary-600 hover:bg-primary-50">
              See all results for “{q}” →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-ink-100 first:border-t-0">
      <p className="px-4 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">{title}</p>
      {children}
    </div>
  );
}
