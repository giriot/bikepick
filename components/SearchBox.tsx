'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Suggestion { label: string; url: string; kind: string }

export function SearchBox({
  placeholder = 'Search bikes, scooters, EVs, used bikes…',
  size = 'md',
  autoFocus = false,
}: { placeholder?: string; size?: 'md' | 'lg'; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.ok) { setItems(json.data); setOpen(true); setActive(-1); }
      } finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const submit = (value?: string) => {
    const term = value ?? q;
    if (!term.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); router.push(items[active].url); setOpen(false); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={box} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className={`flex items-center gap-2 rounded-2xl border border-line bg-white ${size === 'lg' ? 'px-4 py-3 shadow-card' : 'px-3 py-2'} focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-ink-mute">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => items.length && setOpen(true)}
          placeholder={placeholder}
          aria-label="Search Bikepick"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-suggestions"
          aria-activedescendant={open && active >= 0 ? `search-suggestion-${active}` : undefined}
          aria-autocomplete="list"
          className={`w-full bg-transparent outline-none ${size === 'lg' ? 'text-[15px]' : 'text-sm'} placeholder:text-ink-mute`}
        />
        {loading && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand-500" aria-hidden="true" />}
        <button type="submit" className={`btn-primary shrink-0 ${size === 'lg' ? '' : 'btn-sm'}`}>Search</button>
      </form>

      {open && (
        q.trim().length < 2 ? (
          <div className="absolute z-50 mt-2 w-full rounded-2xl border border-line bg-white p-3 shadow-pop">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Search by specification</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ['E20 ready', '/ethanol'],
                ['E85 / E100 flex', '/ethanol'],
                ['Hybrid CNG', '/hybrid'],
                ['Electric', '/electric'],
                ['ABS', '/search?q=abs'],
                ['Disc brake', '/search?q=disc'],
                ['LED lights', '/search?q=led'],
                ['100–125 cc', '/bikes?minCc=100&maxCc=125'],
                ['150–200 cc', '/bikes?minCc=150&maxCc=200'],
                ['Under ₹80k', '/bikes?maxPrice=80000'],
              ].map(([label, url]) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => { setOpen(false); router.push(url); }}
                  className="chip !py-1 !text-xs"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2.5 px-1 text-[11px] leading-4 text-ink-mute">
              Or type a spec — try <button type="button" onClick={() => setQ('abs')} className="font-semibold text-brand-600 hover:underline">abs</button>,{' '}
              <button type="button" onClick={() => setQ('disc')} className="font-semibold text-brand-600 hover:underline">disc</button>,{' '}
              <button type="button" onClick={() => setQ('led')} className="font-semibold text-brand-600 hover:underline">led</button>,{' '}
              <button type="button" onClick={() => setQ('160cc')} className="font-semibold text-brand-600 hover:underline">160cc</button> or{' '}
              <button type="button" onClick={() => setQ('e100')} className="font-semibold text-brand-600 hover:underline">e100</button>.
            </p>
          </div>
        ) : items.length > 0 ? (
          <ul id="search-suggestions" role="listbox" aria-label="Search suggestions" className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-pop">
            {items.map((s, i) => (
              <li key={s.url + i}>
                <button
                  type="button"
                  id={`search-suggestion-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => { router.push(s.url); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ${i === active ? 'bg-brand-50 text-brand-700' : 'hover:bg-surface'}`}
                >
                  <span className="truncate font-medium">{s.label}</span>
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-mute ring-1 ring-line">{s.kind}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => submit()} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-brand-600 hover:bg-brand-50">
                See all results for “{q}”
              </button>
            </li>
          </ul>
        ) : (
          <div className="absolute z-50 mt-2 w-full rounded-2xl border border-line bg-white p-3 text-[13px] text-ink-mute shadow-pop">
            No suggestions — press <span className="font-semibold text-ink">Search</span> to see all matches.
          </div>
        )
      )}
    </div>
  );
}
