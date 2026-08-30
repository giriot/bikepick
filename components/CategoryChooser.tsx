'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'bikepick.category';

const CHOICES = [
  {
    key: 'bikes',
    href: '/bikes',
    title: 'Bikes & Scooters',
    lines: ['New bikes', 'Specifications', 'Comparison', 'Dealer offers'],
    accent: 'from-brand-500 to-brand-700',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6" cy="16.5" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="16.5" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6 16.5 10.5 9h5l2.5 7.5M9.5 9h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'electric',
    href: '/electric',
    title: 'Electric',
    lines: ['EV scooters', 'EV motorcycles', 'Range & charging', 'Running cost'],
    accent: 'from-accent to-accent-dark',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'used',
    href: '/used-bikes',
    title: 'Used Bikes',
    lines: ['Verified listings', 'Trust score', 'Price estimator', 'Sell your bike'],
    accent: 'from-ink to-ink-soft',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 12.5 12 4l8.5 8.5M6 11v8h12v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 19v-4h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

/**
 * First-visit category chooser. The preference is stored in localStorage, so a
 * returning visitor never sees it again until they use "Change category".
 */
export function CategoryChooser({ enabled }: { enabled: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch { /* storage blocked — never block the page */ }
  }, [enabled]);

  useEffect(() => {
    const onReset = () => setShow(true);
    window.addEventListener('bikepick:choose-category', onReset);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('bikepick:choose-category', onReset);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const choose = (key: string) => {
    try { window.localStorage.setItem(KEY, key); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="chooser-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="animate-fade-up w-full max-w-3xl rounded-t-3xl border border-line bg-white p-6 shadow-pop sm:rounded-3xl sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Welcome to Bikepick.IN</p>
            <h1 id="chooser-title" className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">What are you looking for?</h1>
            <p className="mt-2 text-sm text-ink-mute">Pick a starting point. You can change it any time from the footer of the homepage.</p>
          </div>
          <button type="button" onClick={() => setShow(false)} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-ink-mute hover:bg-surface">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {CHOICES.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              onClick={() => choose(c.key)}
              className="card card-hover group flex flex-col gap-3 p-5 text-left focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${c.accent} text-white`}>{c.icon}</span>
              <span className="text-[17px] font-semibold">{c.title}</span>
              <ul className="space-y-1">
                {c.lines.map((l) => (
                  <li key={l} className="flex items-center gap-1.5 text-[13px] text-ink-mute">
                    <span className="h-1 w-1 rounded-full bg-brand-400" aria-hidden="true" />{l}
                  </li>
                ))}
              </ul>
              <span className="mt-1 text-[13px] font-semibold text-brand-600 group-hover:underline">Continue →</span>
            </Link>
          ))}
        </div>

        <button type="button" onClick={() => choose('all')} className="mt-5 text-sm font-medium text-ink-mute underline underline-offset-4 hover:text-ink">
          Just browsing — show me everything
        </button>
      </div>
    </div>
  );
}

export function ChangeCategoryButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('bikepick:choose-category'))}
      className="chip"
    >
      Change category
    </button>
  );
}
