import Link from 'next/link';
import type { ReactNode } from 'react';

export function Breadcrumbs({ items }: { items: { name: string; url: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-mute">
      {items.map((c, i) => (
        <span key={c.url} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {i === items.length - 1 ? (
            <span className="font-medium text-ink-soft" aria-current="page">{c.name}</span>
          ) : (
            <Link href={c.url} className="hover:text-brand-600">{c.name}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ScoreRing({ score, size = 74 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const colour = pct >= 75 ? '#00B27A' : pct >= 55 ? '#F0620C' : '#F59E0B';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Bikepick Score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E7EBF0" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[17px] font-bold leading-none">{score}</span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-mute">/100</span>
      </div>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card grid place-items-center gap-2 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-surface text-ink-mute" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v13H4zM4 7l2-3h12l2 3M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-ink-mute">{body}</p>
      {action}
    </div>
  );
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'danger' | 'success'; title?: string; children: ReactNode }) {
  const map = {
    info: 'border-brand-200 bg-brand-50 text-brand-800',
    warn: 'border-warn/30 bg-warn-soft text-[#8A5B00]',
    danger: 'border-danger/25 bg-danger-soft text-[#9F1239]',
    success: 'border-accent/30 bg-accent-soft text-accent-dark',
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-3 text-[13px] leading-6 ${map[tone]}`} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

export function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const join = (p: number) => `${base}${base.includes('?') ? '&' : '?'}page=${p}`;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && <Link href={join(page - 1)} className="chip">← Previous</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-mute">…</span>}
          <Link href={join(n)} aria-current={n === page ? 'page' : undefined} className={`chip ${n === page ? 'chip-active' : ''}`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={join(page + 1)} className="chip">Next →</Link>}
    </nav>
  );
}

export function TrustBadge({ band, score }: { band: string; score: number }) {
  const map: Record<string, string> = {
    excellent: 'bg-accent-soft text-accent-dark',
    good: 'bg-brand-50 text-brand-700',
    needs_verification: 'bg-warn-soft text-[#8A5B00]',
  };
  const label = band === 'excellent' ? 'Excellent' : band === 'good' ? 'Good' : 'Needs verification';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[band] || map.needs_verification}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
      Trust {score}/100 · {label}
    </span>
  );
}
