import Link from 'next/link';
import type { ReactNode } from 'react';

export function AdminHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.025em]">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-ink-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function AdminCard({ title, subtitle, children, action }: { title?: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white">
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-[14px] font-semibold">{title}</h2>}
            {subtitle && <p className="text-[12px] text-ink-mute">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700', verified: 'bg-emerald-50 text-emerald-700',
  published: 'bg-emerald-50 text-emerald-700', active: 'bg-emerald-50 text-emerald-700', paid: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-800', submitted: 'bg-amber-50 text-amber-800',
  verification_required: 'bg-amber-50 text-amber-800', under_review: 'bg-amber-50 text-amber-800',
  needs_more_info: 'bg-amber-50 text-amber-800', created: 'bg-amber-50 text-amber-800',
  rejected: 'bg-rose-50 text-rose-700', suspended: 'bg-rose-50 text-rose-700', failed: 'bg-rose-50 text-rose-700', failing: 'bg-rose-50 text-rose-700',
  draft: 'bg-slate-100 text-slate-600', expired: 'bg-slate-100 text-slate-600', withdrawn: 'bg-slate-100 text-slate-600',
  sold: 'bg-slate-100 text-slate-600', electric: 'bg-accent-soft text-accent-dark',
};

export function Badge({ value }: { value: any }) {
  if (value == null || value === '') return <span className="text-ink-mute">—</span>;
  const key = String(value);
  return <span className={`badge ${TONES[key] || 'bg-surface text-ink-soft'}`}>{key.replace(/_/g, ' ')}</span>;
}

export function AdminStat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const inner = (
    <div className="rounded-xl border border-line bg-white p-4 transition hover:border-brand-300">
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-1 text-[26px] font-bold leading-none tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-1 text-[11.5px] text-ink-mute">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
