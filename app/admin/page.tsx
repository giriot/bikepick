import Link from 'next/link';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/auth';
import { inr, relative } from '@/lib/format';
import { AdminHeader, AdminStat, AdminCard, Badge } from '@/components/admin/ui';
import { payments } from '@/services/payments';
import { emailService } from '@/services/email';
import { smsService } from '@/services/sms';
import { getSettings, isOn } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard · Bikepick Admin', robots: { index: false, follow: false } };

const n = (r: any) => Number(r?.c ?? 0);

export default async function AdminDashboard() {
  await requirePermission('lead.read');
  const user = await getCurrentUser();
  const settings = await getSettings();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  let statsFailed = false;
  const zero: any = { c: 0 };
  let products: any = zero, published: any = zero, usedPending: any = zero, dealerPending: any = zero,
    offerPending: any = zero, reviewPending: any = zero, changePending: any = zero,
    leads30: any = zero, users30: any = zero, revenue30: any = zero, demoCount: any = zero;
  let recentAudit: any[] = [], recentLeads: any[] = [], sourceIssues: any[] = [];
  try {
    [
      products, published, usedPending, dealerPending, offerPending, reviewPending, changePending,
      leads30, users30, revenue30, demoCount, recentAudit, recentLeads, sourceIssues,
    ] = await Promise.all([
      db.get<any>('SELECT COUNT(*) AS c FROM products WHERE deleted_at IS NULL'),
      db.get<any>("SELECT COUNT(*) AS c FROM products WHERE status='published' AND deleted_at IS NULL"),
      db.get<any>("SELECT COUNT(*) AS c FROM used_bikes WHERE status IN ('submitted','verification_required','under_review') AND deleted_at IS NULL"),
      db.get<any>("SELECT COUNT(*) AS c FROM dealer_profiles WHERE status='pending' AND deleted_at IS NULL"),
      db.get<any>("SELECT COUNT(*) AS c FROM dealer_offers WHERE status='pending' AND deleted_at IS NULL"),
      db.get<any>("SELECT COUNT(*) AS c FROM reviews WHERE status='pending' AND deleted_at IS NULL"),
      db.get<any>("SELECT COUNT(*) AS c FROM data_change_logs WHERE status='pending'"),
      db.get<any>('SELECT COUNT(*) AS c FROM leads WHERE created_at >= ?', [since]),
      db.get<any>('SELECT COUNT(*) AS c FROM users WHERE created_at >= ?', [since]),
      db.get<any>('SELECT COALESCE(SUM(amount),0) AS c FROM revenue_events WHERE occurred_at >= ?', [since]),
      db.get<any>('SELECT COUNT(*) AS c FROM products WHERE is_demo = 1 AND deleted_at IS NULL'),
      db.all<any>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 8'),
      db.all<any>('SELECT l.*, p.name AS product_name FROM leads l LEFT JOIN products p ON p.id = l.product_id ORDER BY l.created_at DESC LIMIT 6'),
      db.all<any>("SELECT * FROM data_sources WHERE status='failing' OR error_count > 0 ORDER BY error_count DESC LIMIT 5"),
    ]);
  } catch (e) {
    // A slow/cold database must never blank the whole admin panel: degrade
    // to zeroed counters with an explanation instead of an error screen.
    statsFailed = true;
    console.error('[admin/dashboard] stats query failed — rendering degraded dashboard:', e);
  }

  const queue = [
    { label: 'Used listings awaiting review', count: n(usedPending), href: '/admin/used-bikes' },
    { label: 'Dealer applications', count: n(dealerPending), href: '/admin/dealers' },
    { label: 'Offers awaiting approval', count: n(offerPending), href: '/admin/offers' },
    { label: 'Reviews to moderate', count: n(reviewPending), href: '/admin/reviews' },
    { label: 'Data changes to approve', count: n(changePending), href: '/admin/changes' },
  ];
  const totalQueue = queue.reduce((a, b) => a + b.count, 0);

  const services = [
    { name: 'Payments', ok: payments.configured(), note: payments.configured() ? `${payments.providerName} connected` : 'No gateway keys — purchases stay pending until you confirm them' },
    { name: 'Email', ok: emailService.configured() && isOn(settings.notifications_email_enabled), note: emailService.configured() ? (isOn(settings.notifications_email_enabled) ? 'Sending' : 'Provider ready, switched off in Settings') : 'No provider configured — notifications stay in-app' },
    { name: 'SMS / WhatsApp', ok: smsService.configured() && isOn(settings.notifications_sms_enabled), note: smsService.configured() ? (isOn(settings.notifications_sms_enabled) ? 'Sending' : 'Provider ready, switched off in Settings') : 'No provider configured' },
    { name: 'Advertising', ok: isOn(settings.ads_enabled) && !!settings.adsense_client_id, note: isOn(settings.ads_enabled) ? (settings.adsense_client_id ? 'AdSense live' : 'Enabled but no client ID set') : 'Ad slots disabled' },
  ];

  return (
    <div className="space-y-5">
      <AdminHeader title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'there'}`}
        subtitle="Everything that needs a decision today, plus how the platform is performing." />

      {statsFailed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13.5px] font-semibold text-amber-900">Live statistics are temporarily unavailable</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-amber-900/80">
            The dashboard itself is working — only the live counters could not be loaded (this can happen for a few
            seconds while the database connection is warming up). Press <b>F5</b> once or twice and they will be back.
            Everything below that does not need live counters (links, settings, approvals) works normally.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStat label="Needs your attention" value={String(totalQueue)} hint={totalQueue ? 'Items waiting in a queue' : 'All queues clear'} />
        <AdminStat label="Leads (30 days)" value={String(n(leads30))} href="/admin/leads" />
        <AdminStat label="Revenue (30 days)" value={inr(Number(revenue30?.c || 0))} href="/admin/revenue" />
        <AdminStat label="Published models" value={`${n(published)}/${n(products)}`} href="/admin/products" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminCard title="Approval queues" subtitle="Nothing reaches the public site without passing through here.">
          <ul className="space-y-1">
            {queue.map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="flex items-center justify-between rounded-lg px-2.5 py-2 transition hover:bg-surface">
                  <span className="text-[13.5px]">{q.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${q.count ? 'bg-warn-soft text-[#8A5B00]' : 'bg-surface text-ink-mute'}`}>{q.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Service status" subtitle="Nothing here is faked — a service that is not configured simply does not send.">
          <ul className="space-y-2.5">
            {services.map((s) => (
              <li key={s.name} className="flex items-start gap-2.5">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <div>
                  <p className="text-[13px] font-medium">{s.name}</p>
                  <p className="text-[12px] leading-4 text-ink-mute">{s.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      {n(demoCount) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13.5px] font-semibold text-amber-900">This installation still contains demo data</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-amber-900/80">
            {n(demoCount)} demo products are labelled publicly with a “Demo data” badge. Remove them from Settings once your
            real catalogue is loaded.
          </p>
          <Link href="/admin/settings#demo" className="btn-outline btn-sm mt-2.5">Manage demo data</Link>
        </div>
      )}

      {sourceIssues.length > 0 && (
        <AdminCard title="Data sources needing attention" subtitle="A failing source never deletes existing data — the last good values stay in place.">
          <ul className="divide-y divide-line">
            {sourceIssues.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <Link href={`/admin/data-sources/${s.id}`} className="text-[13px] font-medium hover:text-brand-700">{s.name}</Link>
                  <p className="text-[11.5px] text-ink-mute">{s.last_error || 'No error message recorded'}</p>
                </div>
                <span className="text-[12px] text-rose-700">{s.error_count} errors</span>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminCard title="Latest leads" action={<Link href="/admin/leads" className="text-[12.5px] font-semibold text-brand-700 hover:underline">All leads</Link>}>
          {recentLeads.length === 0 ? <p className="text-[13px] text-ink-mute">No leads yet.</p> : (
            <ul className="divide-y divide-line">
              {recentLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-[13px] font-medium">{l.name} · {l.phone}</p>
                    <p className="text-[11.5px] text-ink-mute">{l.lead_type.replace(/_/g, ' ')}{l.product_name ? ` · ${l.product_name}` : ''} · {relative(l.created_at)}</p>
                  </div>
                  <Badge value={l.status} />
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Recent staff activity" action={<Link href="/admin/audit-logs" className="text-[12.5px] font-semibold text-brand-700 hover:underline">Audit log</Link>}>
          {recentAudit.length === 0 ? <p className="text-[13px] text-ink-mute">Nothing recorded yet.</p> : (
            <ul className="divide-y divide-line">
              {recentAudit.map((a) => (
                <li key={a.id} className="py-2">
                  <p className="text-[13px] font-medium">{a.action}</p>
                  <p className="text-[11.5px] text-ink-mute">{a.actor_email || 'system'} · {relative(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <AdminCard title="New sign-ups (30 days)">
        <p className="text-[26px] font-bold tracking-[-0.03em]">{n(users30)}</p>
        <p className="text-[12.5px] text-ink-mute">Buyers, sellers and dealers who created an account in the last 30 days.</p>
      </AdminCard>
    </div>
  );
}
