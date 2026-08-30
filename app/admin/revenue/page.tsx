import Link from 'next/link';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { inr, relative } from '@/lib/format';
import { AdminHeader, AdminCard, AdminStat, Badge } from '@/components/admin/ui';
import { BarChart, BreakdownBars } from '@/components/admin/Charts';
import { sumDaily } from '@/lib/analytics';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revenue · Bikepick Admin', robots: { index: false, follow: false } };

const STREAM_LABELS: Record<string, string> = {
  subscription: 'Dealer subscriptions',
  featured_listing: 'Featured listings',
  inspection: 'Paid inspections',
  lead: 'Lead sales',
  affiliate: 'Affiliate commission',
  ads: 'Advertising',
};

export default async function RevenuePage({ searchParams }: { searchParams: { range?: string } }) {
  await requirePermission('*');
  const days = Number(searchParams.range) || 30;

  const totals = await db.get<any>(
    `SELECT COALESCE(SUM(amount),0) AS all_time,
            COALESCE(SUM(CASE WHEN occurred_at >= date('now','-${days} days') THEN amount END),0) AS period,
            COALESCE(SUM(CASE WHEN occurred_at >= date('now','start of month') THEN amount END),0) AS month
       FROM revenue_events`,
  );

  const byStream = await db.all<any>(
    `SELECT stream, COALESCE(SUM(amount),0) AS total, COUNT(*) AS n
       FROM revenue_events WHERE occurred_at >= date('now','-${days} days')
      GROUP BY stream ORDER BY total DESC`,
  );

  const series = await sumDaily('revenue_events', 'occurred_at', 'amount', days);

  const pending = await db.get<any>(
    "SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS amt FROM payments WHERE status = 'pending'",
  );
  const recent = await db.all<any>(
    `SELECT r.*, d.business_name FROM revenue_events r
       LEFT JOIN dealer_profiles d ON d.id = r.dealer_id
      ORDER BY r.occurred_at DESC LIMIT 15`,
  );
  const activeSubs = await db.get<any>(
    "SELECT COUNT(*) AS c FROM subscriptions WHERE status = 'active' AND (ends_at IS NULL OR ends_at >= date('now'))",
  );
  const leadValue = await db.get<any>(
    `SELECT COUNT(*) AS c, COALESCE(SUM(value_estimate),0) AS v FROM leads
      WHERE deleted_at IS NULL AND created_at >= date('now','-${days} days')`,
  );
  const leadPrice = Number((await getSetting('lead_price_default')) ?? 49);
  const gateway = process.env.RAZORPAY_KEY_ID ? 'Razorpay connected' : 'No gateway keys configured';

  return (
    <div className="space-y-5">
      <AdminHeader title="Revenue"
        subtitle="Money actually recorded by the platform. Nothing here is projected or estimated."
        action={
          <div className="flex gap-1.5">
            {[7, 30, 90, 365].map((d) => (
              <Link key={d} href={`/admin/revenue?range=${d}`}
                className={`chip ${days === d ? 'chip-active' : ''}`}>{d === 365 ? '1y' : `${d}d`}</Link>
            ))}
          </div>
        } />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat label={`Last ${days} days`} value={inr(totals.period)} />
        <AdminStat label="This month" value={inr(totals.month)} />
        <AdminStat label="All time" value={inr(totals.all_time)} />
        <AdminStat label="Awaiting payment" value={inr(pending.amt)} hint={`${pending.c} pending payment(s)`} />
      </div>

      <AdminCard title={`Daily revenue · last ${days} days`}>
        <BarChart data={series} format={(n) => inr(n, { compact: true })} />
      </AdminCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="By stream" subtitle={`Recorded in the last ${days} days`}>
          <BreakdownBars
            rows={byStream.map((s) => ({ label: STREAM_LABELS[s.stream] || s.stream, value: Number(s.total) }))}
            format={(n) => inr(n)} />
        </AdminCard>

        <AdminCard title="Revenue readiness" subtitle="What is switched on right now">
          <ul className="space-y-2.5 text-[13px]">
            <li className="flex items-center justify-between gap-3">
              <span>Payment gateway</span><Badge value={process.env.RAZORPAY_KEY_ID ? 'connected' : 'manual'} />
            </li>
            <li className="flex items-center justify-between gap-3"><span>Active dealer subscriptions</span><strong>{activeSubs.c}</strong></li>
            <li className="flex items-center justify-between gap-3"><span>Leads captured ({days}d)</span><strong>{leadValue.c}</strong></li>
            <li className="flex items-center justify-between gap-3"><span>Lead price setting</span><strong>{inr(leadPrice)}</strong></li>
            <li className="flex items-center justify-between gap-3">
              <span>Potential lead billing ({days}d)</span><strong>{inr(leadValue.c * leadPrice)}</strong>
            </li>
          </ul>
          <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[12px] leading-5 text-ink-mute">
            {gateway}. Without gateway keys the platform still records orders — mark a payment as paid in{' '}
            <Link href="/admin/payments" className="font-medium text-brand-700 hover:underline">Payments</Link> after you receive
            money by UPI or bank transfer, and the subscription or listing activates the same way.
            Potential lead billing is a calculation from your own settings, not earned revenue.
          </p>
        </AdminCard>
      </div>

      <AdminCard title="Recent revenue events"
        action={<Link href="/admin/payments" className="text-[12.5px] font-semibold text-brand-700 hover:underline">All payments</Link>}>
        {recent.length === 0 ? (
          <p className="text-[13px] text-ink-mute">
            No revenue recorded yet. Events appear here automatically when a payment is verified or you confirm one manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-mute">
                <tr>
                  <th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">Stream</th>
                  <th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-ink-mute">{relative(r.occurred_at)}</td>
                    <td className="px-3 py-2">{STREAM_LABELS[r.stream] || r.stream}</td>
                    <td className="px-3 py-2 text-ink-mute">{r.business_name || r.note || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
