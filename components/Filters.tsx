'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

export interface FilterConfig {
  brands: { slug: string; name: string; count: number; logo?: string | null }[];
  bodyTypes: string[];
  isEv?: boolean;
  priceMax: number;
}

/** URL-driven filters — every change is a real query against the database. */
export function Filters({ config }: { config: FilterConfig }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const get = (k: string) => params.get(k) || '';
  const selectedBrands = params.getAll('brand');

  const push = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    mutate(p);
    p.delete('page');
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const setParam = (key: string, value: string) =>
    push((p) => { value ? p.set(key, value) : p.delete(key); });

  const toggleBrand = (slug: string) =>
    push((p) => {
      const current = p.getAll('brand');
      p.delete('brand');
      const next = current.includes(slug) ? current.filter((b) => b !== slug) : [...current, slug];
      next.forEach((b) => p.append('brand', b));
    });

  const activeCount = ['minPrice', 'maxPrice', 'minCc', 'maxCc', 'minMileage', 'abs', 'bodyType']
    .filter((k) => get(k)).length + selectedBrands.length;

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-outline btn-sm w-full lg:hidden">
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      <aside className={`${open ? 'block' : 'hidden'} lg:block`} aria-label="Filters">
        <div className="card divide-y divide-line">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-sm font-semibold">Filters</h2>
            {activeCount > 0 && (
              <button type="button" onClick={() => router.push(pathname)} className="text-[13px] font-medium text-brand-600 hover:underline">
                Clear all
              </button>
            )}
          </div>

          <Group title="Budget (ex-showroom)">
            <div className="grid grid-cols-2 gap-2">
              <label className="sr-only" htmlFor="minPrice">Minimum price</label>
              <input id="minPrice" type="number" inputMode="numeric" placeholder="Min ₹" defaultValue={get('minPrice')}
                onBlur={(e) => setParam('minPrice', e.target.value)} className="field !py-2 !text-[13px]" />
              <label className="sr-only" htmlFor="maxPrice">Maximum price</label>
              <input id="maxPrice" type="number" inputMode="numeric" placeholder="Max ₹" defaultValue={get('maxPrice')}
                onBlur={(e) => setParam('maxPrice', e.target.value)} className="field !py-2 !text-[13px]" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[[0, 80000, 'Under ₹80k'], [80000, 120000, '₹80k–1.2L'], [120000, 180000, '₹1.2–1.8L'], [180000, config.priceMax, 'Above ₹1.8L']].map(([lo, hi, label]) => (
                <button key={String(label)} type="button" onClick={() => push((p) => { p.set('minPrice', String(lo)); p.set('maxPrice', String(hi)); })}
                  className={`chip !py-1 !text-xs ${get('minPrice') === String(lo) && get('maxPrice') === String(hi) ? 'chip-active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>
          </Group>

          <Group title="Brand">
            <div className="max-h-56 space-y-1.5 overflow-auto pr-1">
              {config.brands.map((b) => (
                <label key={b.slug} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={selectedBrands.includes(b.slug)} onChange={() => toggleBrand(b.slug)}
                    className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-300" />
                  {b.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo} alt="" className="h-4 w-4 shrink-0 rounded-sm object-contain" />
                  )}
                  <span className="flex-1 text-ink-soft">{b.name}</span>
                  <span className="text-xs text-ink-mute">{b.count}</span>
                </label>
              ))}
            </div>
          </Group>

          {!config.isEv && (
            <>
              <Group title="Engine capacity (cc)">
                <div className="flex flex-wrap gap-1.5">
                  {[[0, 125, 'Up to 125'], [125, 160, '125–160'], [160, 200, '160–200'], [200, 400, '200–400'], [400, 1000, '400+']].map(([lo, hi, label]) => (
                    <button key={String(label)} type="button" onClick={() => push((p) => { p.set('minCc', String(lo)); p.set('maxCc', String(hi)); })}
                      className={`chip !py-1 !text-xs ${get('minCc') === String(lo) && get('maxCc') === String(hi) ? 'chip-active' : ''}`}>{label}</button>
                  ))}
                </div>
              </Group>
              <Group title="Minimum mileage (kmpl)">
                <div className="flex flex-wrap gap-1.5">
                  {[35, 45, 55, 65].map((m) => (
                    <button key={m} type="button" onClick={() => setParam('minMileage', get('minMileage') === String(m) ? '' : String(m))}
                      className={`chip !py-1 !text-xs ${get('minMileage') === String(m) ? 'chip-active' : ''}`}>{m}+ kmpl</button>
                  ))}
                </div>
              </Group>
            </>
          )}

          <Group title="Body type">
            <div className="flex flex-wrap gap-1.5">
              {config.bodyTypes.map((t) => (
                <button key={t} type="button" onClick={() => setParam('bodyType', get('bodyType') === t ? '' : t)}
                  className={`chip !py-1 !text-xs capitalize ${get('bodyType') === t ? 'chip-active' : ''}`}>{t.replace('-', ' ')}</button>
              ))}
            </div>
          </Group>

          <Group title="Safety">
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={get('abs') === '1'} onChange={(e) => setParam('abs', e.target.checked ? '1' : '')}
                className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-300" />
              <span className="text-ink-soft">ABS equipped only</span>
            </label>
          </Group>
        </div>
      </aside>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <h3 className="mb-2.5 text-[13px] font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

export function SortSelect({ options }: { options: [string, string][] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-mute">
      Sort
      <select
        value={params.get('sort') || options[0][0]}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          p.set('sort', e.target.value); p.delete('page');
          router.push(`${pathname}?${p.toString()}`, { scroll: false });
        }}
        className="field !w-auto !py-1.5 !text-[13px]"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
