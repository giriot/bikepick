'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function UsedFilters({ brands, cities }: { brands: string[]; cities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const get = (k: string) => params.get(k) || '';

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    v ? p.set(k, v) : p.delete(k);
    p.delete('page');
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const active = ['brand', 'city', 'minPrice', 'maxPrice', 'minYear', 'maxKm', 'owners', 'fuel', 'abs', 'condition', 'sellerType', 'verified', 'minTrust'].filter((k) => get(k)).length;

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-outline btn-sm w-full lg:hidden" aria-expanded={open}>
        Filters{active ? ` (${active})` : ''}
      </button>
      <aside className={`${open ? 'block' : 'hidden'} lg:block`} aria-label="Used bike filters">
        <div className="card divide-y divide-line">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-sm font-semibold">Filters</h2>
            {active > 0 && <button type="button" onClick={() => router.push(pathname)} className="text-[13px] font-medium text-brand-600 hover:underline">Clear all</button>}
          </div>

          <Row label="Brand">
            <select value={get('brand')} onChange={(e) => set('brand', e.target.value)} className="field !py-2 !text-[13px]">
              <option value="">Any brand</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Row>

          <Row label="City">
            <select value={get('city')} onChange={(e) => set('city', e.target.value)} className="field !py-2 !text-[13px]">
              <option value="">Any city</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Row>

          <Row label="Budget">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Min ₹" defaultValue={get('minPrice')} onBlur={(e) => set('minPrice', e.target.value)} className="field !py-2 !text-[13px]" aria-label="Minimum price" />
              <input type="number" placeholder="Max ₹" defaultValue={get('maxPrice')} onBlur={(e) => set('maxPrice', e.target.value)} className="field !py-2 !text-[13px]" aria-label="Maximum price" />
            </div>
          </Row>

          <Row label="Year & usage">
            <div className="grid grid-cols-2 gap-2">
              <select value={get('minYear')} onChange={(e) => set('minYear', e.target.value)} className="field !py-2 !text-[13px]" aria-label="Minimum year">
                <option value="">Any year</option>
                {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y} or newer</option>)}
              </select>
              <select value={get('maxKm')} onChange={(e) => set('maxKm', e.target.value)} className="field !py-2 !text-[13px]" aria-label="Maximum kilometres">
                <option value="">Any km</option>
                {[10000, 20000, 30000, 50000, 80000].map((k) => <option key={k} value={k}>Under {k.toLocaleString('en-IN')} km</option>)}
              </select>
            </div>
          </Row>

          <Row label="Owners">
            <div className="flex gap-1.5">
              {[1, 2, 3].map((o) => (
                <button key={o} type="button" onClick={() => set('owners', get('owners') === String(o) ? '' : String(o))} className={`chip !py-1 !text-xs ${get('owners') === String(o) ? 'chip-active' : ''}`}>
                  {o === 3 ? '3+' : `${o} owner${o > 1 ? 's' : ''}`}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Fuel">
            <div className="flex gap-1.5">
              {[['petrol', 'Petrol'], ['electric', 'Electric']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('fuel', get('fuel') === v ? '' : v)} className={`chip !py-1 !text-xs ${get('fuel') === v ? 'chip-active' : ''}`}>{l}</button>
              ))}
            </div>
          </Row>

          <Row label="Condition">
            <div className="flex flex-wrap gap-1.5">
              {[['excellent', 'Excellent'], ['good', 'Good'], ['fair', 'Fair'], ['needs_work', 'Needs work']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('condition', get('condition') === v ? '' : v)} className={`chip !py-1 !text-xs ${get('condition') === v ? 'chip-active' : ''}`}>{l}</button>
              ))}
            </div>
          </Row>

          <Row label="Seller">
            <div className="flex gap-1.5">
              {[['individual', 'Individual'], ['dealer', 'Dealer']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('sellerType', get('sellerType') === v ? '' : v)} className={`chip !py-1 !text-xs ${get('sellerType') === v ? 'chip-active' : ''}`}>{l}</button>
              ))}
            </div>
          </Row>

          <Row label="Trust & safety">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" checked={get('verified') === '1'} onChange={(e) => set('verified', e.target.checked ? '1' : '')} className="h-4 w-4 rounded border-line text-brand-500" />
                <span className="text-ink-soft">Verified listings only</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" checked={get('abs') === '1'} onChange={(e) => set('abs', e.target.checked ? '1' : '')} className="h-4 w-4 rounded border-line text-brand-500" />
                <span className="text-ink-soft">ABS equipped</span>
              </label>
              <div>
                <label htmlFor="minTrust" className="label">Minimum trust score: {get('minTrust') || 0}</label>
                <input id="minTrust" type="range" min={0} max={100} step={5} defaultValue={get('minTrust') || 0} onMouseUp={(e) => set('minTrust', (e.target as HTMLInputElement).value)} onTouchEnd={(e) => set('minTrust', (e.target as HTMLInputElement).value)} className="w-full accent-brand-500" />
              </div>
            </div>
          </Row>
        </div>
      </aside>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <h3 className="mb-2 text-[13px] font-semibold">{label}</h3>
      {children}
    </div>
  );
}
