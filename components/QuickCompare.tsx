'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { inr } from '@/lib/format';

export type CompareOpt = { id: string; label: string; price: number | null };

/**
 * "Quick compare" picker: 2-4 dropdowns + a Compare now button.
 * Works for users who prefer picking models from a list instead of
 * toggling cards on the catalogue pages.
 */
export function QuickCompare({ products }: { products: CompareOpt[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(['', '', '', '']);

  function setSlot(i: number, v: string) {
    const next = [...sel];
    // a model can only appear in one slot
    for (let j = 0; j < next.length; j++) if (next[j] === v && j !== i) next[j] = '';
    next[i] = v;
    setSel(next);
  }

  function go() {
    const ids = sel.filter(Boolean);
    if (ids.length < 2) return;
    router.push(`/compare?ids=${ids.join(',')}`);
  }

  const available = (slot: number) =>
    products.filter((p) => !sel.some((x, j) => x && x === p.id && j !== slot));

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[13.5px] font-semibold">Quick compare</p>
      <p className="mt-0.5 text-[12px] text-ink-mute">Pick 2 to 4 models and press “Compare now”.</p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {sel.map((v, i) => (
          <label key={i} className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
              Model {i + 1}{i < 2 ? ' *' : ''}
            </span>
            <select
              className="w-full rounded-lg border border-[#c3cad4] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand-600"
              value={v}
              onChange={(e) => setSlot(i, e.target.value)}
            >
              <option value="">{i < 2 ? '— Select a model —' : '— Optional —'}</option>
              {available(i).map((p) => (
                <option key={p.id} value={p.id}>{p.label}{p.price ? ` · ${inr(p.price)}` : ''}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-3.5 flex items-center gap-3">
        <button
          type="button"
          onClick={go}
          disabled={sel.filter(Boolean).length < 2}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Compare now
        </button>
        <span className="text-[12px] text-ink-mute">
          {sel.filter(Boolean).length}/2–4 models selected
        </span>
      </div>
    </div>
  );
}
