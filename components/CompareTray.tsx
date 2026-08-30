'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCompare } from '@/hooks/useCompare';

interface Item { id: string; label: string; image: string | null }

/** Floating tray showing the current comparison selection on every page. */
export function CompareTray() {
  const { ids, remove, clear } = useCompare();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!ids.length) { setItems([]); return; }
    let cancelled = false;
    fetch(`/api/products/summary?ids=${ids.join(',')}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.ok) setItems(j.data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [ids]);

  if (!ids.length) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 shadow-pop backdrop-blur">
      <div className="container-xl flex flex-wrap items-center gap-3 py-3">
        <span className="text-[13px] font-semibold text-ink">Compare ({ids.length}/4)</span>
        <ul className="flex flex-1 flex-wrap items-center gap-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-3 pr-1.5 text-[13px]">
              <span className="max-w-[160px] truncate">{it.label}</span>
              <button type="button" onClick={() => remove(it.id)} aria-label={`Remove ${it.label}`} className="grid h-5 w-5 place-items-center rounded-full bg-surface text-ink-mute hover:bg-danger-soft hover:text-danger">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={clear} className="btn-ghost btn-sm">Clear</button>
        <Link href={`/compare?ids=${ids.join(',')}`} className={`btn-primary btn-sm ${ids.length < 2 ? 'pointer-events-none opacity-50' : ''}`}>
          Compare now
        </Link>
      </div>
    </div>
  );
}
