import Link from 'next/link';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { relative } from '@/lib/format';
import { sqlDateLiteral } from '@/lib/iso';
import { AdminHeader, AdminCard, AdminStat } from '@/components/admin/ui';
import { BarChart, BreakdownBars } from '@/components/admin/Charts';
import { daily, count } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics · Bikepick Admin', robots: { index: false, follow: false } };

export default async function AnalyticsPage({ searchParams }: { searchParams: { range?: string } }) {
  await requirePermission('*');
  const days = Number(searchParams.range) || 30;
  // Quoted 'YYYY-MM-DD' literal, interpolated below. `date('now', …)` is a SQLite
  // function and throws on Postgres, so the window is computed here instead.
  const since = sqlDateLiteral(days);

  const [leads, listings, signups, reviews] = await Promise.all([
    daily('leads', 'created_at', days, 'deleted_at IS NULL'),
    daily('used_bikes', 'created_at', days, 'deleted_at IS NULL'),
    daily('users', 'created_at', days),
    daily('reviews', 'created_at', days, 'deleted_at IS NULL'),
  ]);

  const [totalLeads, totalUsers, totalListings, totalAlerts] = await Promise.all([
    count(`SELECT COUNT(*) c FROM leads WHERE deleted_at IS NULL AND created_at >= ${since}`),
    count(`SELECT COUNT(*) c FROM users WHERE created_at >= ${since}`),
    count(`SELECT COUNT(*) c FROM used_bikes WHERE deleted_at IS NULL AND created_at >= ${since}`),
    count("SELECT COUNT(*) c FROM price_alerts WHERE status = 'active'"),
  ]);

  const leadTypes = await db.all<any>(
    `SELECT lead_type AS label, COUNT(*) AS value FROM leads
      WHERE deleted_at IS NULL AND created_at >= ${since} GROUP BY lead_type ORDER BY value DESC LIMIT 12`,
  );
  const leadStatus = await db.all<any>(
    `SELECT status AS label, COUNT(*) AS value FROM leads
      WHERE deleted_at IS NULL AND created_at >= ${since} GROUP BY status ORDER BY value DESC`,
  );
  const topProducts = await db.all<any>(
    `SELECT p.name, b.name AS brand, p.slug, b.slug AS brand_slug, p.fuel_type, p.view_count,
            (SELECT COUNT(*) FROM leads l WHERE l.product_id = p.id AND l.deleted_at IS NULL) AS leads
       FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.deleted_at IS NULL AND p.status = 'published'
      ORDER BY p.view_count DESC LIMIT 10`,
  );
  const topSearches = await db.all<any>(
    `SELECT json_extract(meta,'$.q') AS label, COUNT(*) AS value FROM analytics_events
      WHERE event_type = 'search' AND created_at >= ${since} AND json_extract(meta,'$.q') IS NOT NULL
      GROUP BY label ORDER BY value DESC LIMIT 10`,
  );
  const zeroResultSearches = await db.all<any>(
    `SELECT json_extract(meta,'$.q') AS label, COUNT(*) AS value FROM analytics_events
      WHERE event_type = 'search' AND created_at >= ${since} AND json_extract(meta,'$.results') = 0
      GROUP BY label ORDER BY value DESC LIMIT 10`,
  );
  const cities = await db.all<any>(
    `SELECT COALESCE(NULLIF(city,''),'Not given') AS label, COUNT(*) AS value FROM leads
      WHERE deleted_at IS NULL AND created_at >= ${since} GROUP BY label ORDER BY value DESC LIMIT 8`,
  );
  const funnel = await db.all<any>(
    `SELECT status AS label, COUNT(*) AS value FROM used_bikes WHERE deleted_at IS NULL GROUP BY status ORDER BY value DESC`,
  );
  const recentAudit = await db.all<any>(
    'SELECT id, actor_email, actor_role, action, entity_type, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 8',
  );

  const converted = leadStatus.find((s) => s.label === 'converted')?.value ?? 0;
  const conversion = totalLeads > 0 ? Math.round((converted / totalLeads) * 1000) / 10 : 0;

  return (
    <div className="space-y-5">
      <AdminHeader title="Analytics"
        subtitle="Counted from your own database — no third-party tracking script is required for any of this."
        action={
          <div className="flex gap-1.5">
            {[7, 30, 90, 365].map((d) => (
              <Link key={d} href={`/admin/analytics?range=${d}`} className={`chip ${days === d ? 'chip-active' : ''}`}>
                {d === 365 ? '1y' : `${d}d`}
              </Link>
            ))}
          </div>
        } />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat label={`Leads · ${days}d`} value={totalLeads} hint={`${conversion}% marked converted`} />
        <AdminStat label={`New users · ${days}d`} value={totalUsers} />
        <AdminStat label={`Used listings · ${days}d`} value={totalListings} />
        <AdminStat label="Active price alerts" value={totalAlerts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Leads per day"><BarChart data={leads} /></AdminCard>
        <AdminCard title="New user registrations per day"><BarChart data={signups} tone="#00B27A" /></AdminCard>
        <AdminCard title="Used-bike listings per day"><BarChart data={listings} tone="#F59E0B" /></AdminCard>
        <AdminCard title="Reviews submitted per day"><BarChart data={reviews} tone="#9A3412" /></AdminCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Lead types" subtitle="Which intents people act on">
          <BreakdownBars rows={leadTypes} />
        </AdminCard>
        <AdminCard title="Lead status" subtitle="How dealers are handling them">
          <BreakdownBars rows={leadStatus} />
        </AdminCard>
        <AdminCard title="Top lead cities">
          <BreakdownBars rows={cities} />
        </AdminCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Most-viewed models"
          action={<Link href="/admin/products" className="text-[12.5px] font-semibold text-brand-700 hover:underline">Manage</Link>}>
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-mute">
              <tr><th className="px-3 py-2 text-left">Model</th><th className="px-3 py-2 text-right">Views</th><th className="px-3 py-2 text-right">Leads</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {topProducts.map((p) => (
                <tr key={p.slug}>
                  <td className="px-3 py-2">
                    <Link className="font-medium hover:text-brand-700"
                      href={`/${p.fuel_type === 'electric' ? 'electric' : 'bikes'}/${p.brand_slug}/${p.slug}`}>
                      {p.brand} {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.view_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>

        <div className="space-y-4">
          <AdminCard title="Used-bike pipeline" subtitle="Every listing by workflow state">
            <BreakdownBars rows={funnel} />
          </AdminCard>
          {topSearches.length > 0 && (
            <AdminCard title="Top searches" subtitle="What visitors typed into the search box">
              <BreakdownBars rows={topSearches} />
            </AdminCard>
          )}
          {zeroResultSearches.length > 0 && (
            <AdminCard title="Searches with no results" subtitle="Demand you are not covering yet — likely models to add next">
              <BreakdownBars rows={zeroResultSearches} />
            </AdminCard>
          )}
        </div>
      </div>

      <AdminCard title="Latest staff activity"
        action={<Link href="/admin/audit-logs" className="text-[12.5px] font-semibold text-brand-700 hover:underline">Audit log</Link>}>
        <ul className="divide-y divide-line">
          {recentAudit.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
              <span><strong>{a.actor_email || 'System'}</strong> · {a.action} <span className="text-ink-mute">{a.entity_type}</span></span>
              <span className="text-[11.5px] text-ink-mute">{relative(a.created_at)}</span>
            </li>
          ))}
        </ul>
      </AdminCard>
    </div>
  );
}
