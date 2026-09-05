import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { can, isStaff } from '@/lib/rbac';
import { ADMIN_RESOURCES, ADMIN_GROUPS } from '@/lib/admin-config';
import { AdminNav, type NavGroup } from '@/components/admin/AdminNav';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (!isStaff(user)) redirect('/account');

  // Pending-work counters shown as badges in the sidebar.
  const [usedPending, dealerPending, offerPending, reviewPending, changePending, specPending] = await Promise.all([
    db.get<any>("SELECT COUNT(*) AS c FROM used_bikes WHERE status IN ('submitted','verification_required','under_review') AND deleted_at IS NULL"),
    db.get<any>("SELECT COUNT(*) AS c FROM dealer_profiles WHERE status='pending' AND deleted_at IS NULL"),
    db.get<any>("SELECT COUNT(*) AS c FROM dealer_offers WHERE status='pending' AND deleted_at IS NULL"),
    db.get<any>("SELECT COUNT(*) AS c FROM reviews WHERE status='pending' AND deleted_at IS NULL"),
    db.get<any>("SELECT COUNT(*) AS c FROM data_change_logs WHERE status='pending'"),
    // Newer table — tolerate not-existing yet (fresh deploys before setup).
    db.get<any>("SELECT COUNT(*) AS c FROM spec_suggestions WHERE status='pending'").catch(() => undefined),
  ]);
  const badges: Record<string, number> = {
    'used-bikes': usedPending?.c || 0, dealers: dealerPending?.c || 0,
    offers: offerPending?.c || 0, reviews: reviewPending?.c || 0, changes: changePending?.c || 0,
    'spec-suggestions': specPending?.c || 0,
  };

  const allowed = ADMIN_RESOURCES.filter((r) => r.permission === '*' ? can(user, '*') : can(user, r.permission));

  const groups: NavGroup[] = [
    { group: 'Overview', items: [
      { href: '/admin', label: 'Dashboard' },
      { href: '/admin/revenue', label: 'Revenue' },
      { href: '/admin/analytics', label: 'Analytics' },
      { href: '/admin/ai-spec-queue', label: 'AI spec queue' },
    ] },
    ...ADMIN_GROUPS.map((g) => ({
      group: g,
      items: allowed.filter((r) => r.group === g).map((r) => ({
        href: `/admin/${r.key}`, label: r.plural, badge: badges[r.key] || undefined,
      })),
    })).filter((g) => g.items.length > 0),
  ];

  if (can(user, '*')) {
    groups.push({ group: 'System', items: [
      { href: '/admin/spec-suggestions', label: 'Spec suggestions', badge: badges['spec-suggestions'] || undefined },
      { href: '/admin/import', label: 'CSV import' },
      { href: '/admin/settings', label: 'Settings' },
    ] });
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2"><Logo compact /></Link>
            <span className="hidden rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white sm:inline">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[12.5px] text-ink-mute sm:inline">{user.email} · {user.role}</span>
            <Link href="/" className="btn-outline btn-sm">View site</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[74px] lg:h-[calc(100vh-96px)] lg:overflow-y-auto lg:pr-1">
          <AdminNav groups={groups} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
