'use client';

import { useState } from 'react';
import { featureAdvantage } from '@/lib/spec-dots';

export type SpecRowValue = string | number | null | { text: string; badge?: string; cls?: string; note?: string };
export type SpecGroup = { title: string; rows: [string, SpecRowValue][] };

const GRID = 'grid grid-cols-2 min-[900px]:grid-cols-[1.1fr_1.6fr_1.1fr_1.6fr_1.1fr_1.6fr]';

function Cell({ label, value, valueCol }: { label: string; value: SpecRowValue; valueCol: number }) {
  const rich = value && typeof value === 'object' ? (value as { text: string; badge?: string; cls?: string; note?: string }) : null;
  const text = rich ? rich.text : (value as any);
  const adv = featureAdvantage(label, typeof text === 'string' ? text : String(text ?? ''));
  return (
    <>
      <div className="border-b border-line px-4 py-1.5 text-[12.5px] text-ink-mute">{label}</div>
      <div className="border-b border-r border-line px-4 py-1.5 text-[12.5px] font-medium">
        {rich ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {rich.text}
            {rich.badge && (
              <span title={rich.note} className={`cursor-help rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ring-1 ${rich.cls || 'bg-surface text-ink-mute ring-line'}`}>
                {rich.badge}
              </span>
            )}
          </span>
        ) : text === 'Yes'
          ? <span className="font-semibold text-emerald-600">Yes</span>
          : text === 'No'
            ? <span className="font-semibold text-rose-600">No</span>
            : (text || '—')}
        {adv && (
          <span title={adv} className="group/dot relative ml-1.5 inline-flex h-4 w-4 cursor-help items-center justify-center align-middle">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            <span className={`pointer-events-none absolute bottom-full z-30 mb-2 hidden w-60 rounded-lg bg-ink px-3 py-2 text-left text-[11.5px] font-normal leading-4 text-white shadow-pop group-hover/dot:block ${valueCol === 6 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
              {adv}
            </span>
          </span>
        )}
      </div>
    </>
  );
}

/** Collapsible full-specification sheet. Headings are always visible; a tap
 *  expands/collapses the group. The first group is open on first paint. */
export function SpecsAccordion({ groups }: { groups: SpecGroup[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const [all, setAll] = useState(false);

  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });

  const expandAll = () => { setAll(true); setOpen(new Set(groups.map((_, i) => i))); };
  const collapseAll = () => { setAll(false); setOpen(new Set()); };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] text-ink-mute">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
          </span>
          Green dot = a class-leading or genuinely useful feature — hover (or long-press) the dot for its advantage.
        </div>
        <button type="button" onClick={all ? collapseAll : expandAll} className="text-[12px] font-semibold text-brand-600 hover:underline">
          {all ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="card overflow-hidden">
        {groups.map((g, i) => {
          const isOpen = open.has(i);
          return (
            <div key={g.title} className={i > 0 ? 'border-t border-line' : ''}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 bg-surface px-4 py-2.5 text-left"
              >
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">{g.title}</span>
                <span className="text-[14px] font-bold text-brand-600 transition-transform" aria-hidden="true" style={{ transform: isOpen ? 'rotate(45deg)' : 'none' }}>
                  +
                </span>
              </button>
              {isOpen && (
                <div className={GRID}>
                  {g.rows.map(([label, value], ri) => {
                    const col = (ri % 3) * 2 + 1;
                    const valueCol = col + 1;
                    return <Cell key={`${label}-${ri}`} label={label} value={value} valueCol={valueCol} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
