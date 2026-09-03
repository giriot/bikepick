import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// ─── Spinner / loading ──────────────────────────────────────────────────────

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-500">
      <Spinner className="h-7 w-7 text-primary-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card mx-auto my-8 max-w-md p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.2 16a2 2 0 001.73 3z" />
        </svg>
      </div>
      <h3 className="font-semibold text-ink-900">Something went wrong</h3>
      <p className="mt-1 text-sm text-ink-500">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.5 9a7.5 7.5 0 0113.2-3M18.5 15a7.5 7.5 0 01-13.2 3" />
          </svg>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon?: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 text-ink-400">{icon || <BikeIcon className="h-12 w-12" />}</div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {desc && <p className="mt-1 max-w-sm text-sm text-ink-500">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'success';

const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500/40 shadow-sm',
  dark: 'bg-ink-900 text-white hover:bg-ink-700 focus-visible:ring-ink-500/40',
  outline: 'border border-ink-300 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${btnStyles[variant]} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

// ─── Form fields ────────────────────────────────────────────────────────────

export function Field({ label, error, hint, required, children }: { label?: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label className="label-base">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

export function Input({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`input-base ${className}`} />;
}

export function Textarea({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`input-base min-h-[90px] ${className}`} />;
}

export function Select({ className = '', children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`input-base cursor-pointer ${className}`}>
      {children}
    </select>
  );
}

// ─── Badges & status ────────────────────────────────────────────────────────

export function Badge({ tone = 'gray', children, className = '' }: { tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'orange' | 'violet'; children: React.ReactNode; className?: string }) {
  const tones: Record<string, string> = {
    gray: 'bg-ink-100 text-ink-700',
    green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
    red: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
    blue: 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20',
    orange: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20',
    violet: 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

const statusMap: Record<string, { tone: 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'orange' | 'violet'; label: string }> = {
  live: { tone: 'green', label: 'Live' },
  upcoming: { tone: 'blue', label: 'Upcoming' },
  outdated: { tone: 'amber', label: 'Outdated' },
  discontinued: { tone: 'red', label: 'Discontinued' },
  waiting: { tone: 'amber', label: 'Waiting for approval' },
  approved: { tone: 'green', label: 'Approved' },
  rejected: { tone: 'red', label: 'Rejected' },
  suspended: { tone: 'violet', label: 'Suspended' },
  draft: { tone: 'gray', label: 'Draft' },
  submitted: { tone: 'blue', label: 'Submitted' },
  waiting_approval: { tone: 'amber', label: 'Waiting for approval' },
  changes_required: { tone: 'orange', label: 'Changes required' },
  sold: { tone: 'gray', label: 'Sold' },
  open: { tone: 'red', label: 'Open' },
  reviewed: { tone: 'blue', label: 'Reviewed' },
  resolved: { tone: 'green', label: 'Resolved' },
  dismissed: { tone: 'gray', label: 'Dismissed' },
  new: { tone: 'blue', label: 'New' },
  contacted: { tone: 'green', label: 'Contacted' },
  closed: { tone: 'gray', label: 'Closed' },
  pending: { tone: 'amber', label: 'Pending' },
  available: { tone: 'green', label: 'Available' },
  on_order: { tone: 'blue', label: 'On order' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] || { tone: 'gray' as const, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function VerifiedBadge({ label = 'Verified', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/25 ${className}`}>
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      {label}
    </span>
  );
}

// ─── Rating stars ───────────────────────────────────────────────────────────

export function RatingStars({ value, size = 'h-4 w-4', onChange, showValue = false }: { value: number; size?: string; onChange?: (v: number) => void; showValue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(i)}
            className={`${onChange ? 'cursor-pointer transition hover:scale-110' : 'cursor-default'} ${i <= Math.round(value) ? 'text-amber-400' : 'text-ink-300'}`}
            aria-label={`${i} star`}
          >
            <svg className={size} viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.958a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.286 3.958c.3.922-.755 1.688-1.539 1.118l-3.367-2.446a1 1 0 00-1.175 0l-3.367 2.446c-.783.57-1.838-.196-1.538-1.118l1.285-3.958a1 1 0 00-.362-1.118L2.063 9.385c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.958z" />
            </svg>
          </button>
        ))}
      </span>
      {showValue && <span className="text-xs font-medium text-ink-500">{value ? value.toFixed(1) : 'N/A'}</span>}
    </span>
  );
}

// ─── Card / Section ─────────────────────────────────────────────────────────

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Section({ id, title, subtitle, action, children, className = '' }: { id?: string; title: React.ReactNode; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`container-x py-10 md:py-14 ${className}`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Modal / Drawer ─────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lift sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-ink-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange, className = '' }: { tabs: { id: string; label: React.ReactNode; badge?: number }[]; active: string; onChange: (id: string) => void; className?: string }) {
  return (
    <div className={`no-scrollbar -mx-1 flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${active === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className="rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums: number[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) nums.push(i);
  }
  const items: (number | 'gap')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) items.push('gap');
    items.push(n);
  });
  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 disabled:opacity-40 hover:bg-ink-50"
      >
        ← Prev
      </button>
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`g${i}`} className="px-1 text-ink-400">…</span>
        ) : (
          <button
            key={it}
            onClick={() => onChange(it)}
            className={`min-w-[38px] rounded-lg px-3 py-2 text-sm font-semibold ${it === page ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'}`}
          >
            {it}
          </button>
        ),
      )}
      <button
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 disabled:opacity-40 hover:bg-ink-50"
      >
        Next →
      </button>
    </nav>
  );
}

// ─── Stat card (admin dashboards) ───────────────────────────────────────────

export function StatCard({ label, value, to, tone = 'default' }: { label: string; value: number | string; to?: string; tone?: 'default' | 'warn' | 'good' }) {
  const inner = (
    <div
      className={`card flex flex-col gap-1 p-4 transition ${to ? 'cursor-pointer hover:shadow-lift' : ''} ${tone === 'warn' ? 'ring-1 ring-amber-400/60' : ''} ${tone === 'good' ? 'ring-1 ring-emerald-400/60' : ''}`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</span>
      <span className={`text-2xl font-bold ${tone === 'warn' ? 'text-amber-600' : tone === 'good' ? 'text-emerald-600' : 'text-ink-900'}`}>{value}</span>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

// ─── Icons (inline, no external deps) ───────────────────────────────────────

export function BikeIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 44c0-7 5-12 12-12h10l6-9h9l-6 9.5c3.5 2.5 5.5 6.5 5.5 10.5" />
      <circle cx="14" cy="46" r="7" />
      <circle cx="46" cy="46" r="7" />
      <path d="M21 46h19" />
      <path d="M38 23l4-8h6" />
    </svg>
  );
}

export function FuelPumpIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16M2 21h14M6 8h8" />
      <path d="M14 10h2a2 2 0 012 2v5a1.5 1.5 0 003 0v-8l-3-3" />
    </svg>
  );
}

export function BoltIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" />
    </svg>
  );
}

export function FlameIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c4.4 0 8-3.6 8-8 0-3.5-2.5-6.3-4.5-8.5C14 3.8 13 2 13 2s-.5 3-2.5 5C8 9.5 4 11 4 14.5 4 18.6 7.6 22 12 22z" />
      <path d="M12 22c2 0 3.5-1.5 3.5-3.5 0-2-1.5-3-2.5-4.5-1 1.5-2.5 2.5-2.5 4.5 0 2 1.5 3.5 1.5 3.5z" />
    </svg>
  );
}

export function SearchIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  );
}

export function HeartIcon({ filled = false, className = 'h-5 w-5' }: { filled?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

export function ScaleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M5 7l7-4 7 4M3 13l2-6 2 6a2.5 2.5 0 01-4 0zM17 13l2-6 2 6a2.5 2.5 0 01-4 0zM8 21h8" />
    </svg>
  );
}
