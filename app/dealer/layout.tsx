import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { DealerNav } from '@/components/DealerNav';
import { Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dealer');

  const dealer = await db.get<any>('SELECT * FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);

  // No application yet → send them to the registration form (which is inside this layout).
  if (!dealer) {
    return (
      <div className="container-xl py-6">
        <h1 className="text-2xl font-bold tracking-[-0.03em]">Dealer portal</h1>
        <div className="mt-5">{children}</div>
      </div>
    );
  }

  const banner = {
    pending: { tone: 'warn' as const, title: 'Verification in progress', body: 'Our team is checking your business details. You can complete your profile now; offers unlock once you are verified.' },
    rejected: { tone: 'danger' as const, title: 'Application not approved', body: dealer.rejection_reason || 'Contact support for details.' },
    suspended: { tone: 'danger' as const, title: 'Account suspended', body: dealer.rejection_reason || 'Your dealership is temporarily suspended. Contact support.' },
    verified: null,
  }[dealer.status as string] || null;

  return (
    <div className="container-xl py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-[-0.03em]">{dealer.business_name}</h1>
            {dealer.status === 'verified' && <span className="badge-verified">Verified dealer</span>}
            {dealer.is_demo === 1 && <span className="badge-demo">Demo data</span>}
          </div>
          <p className="text-[13px] text-ink-mute">{dealer.city}, {dealer.state} · {dealer.email}</p>
        </div>
        <Link href="/account" className="btn-outline btn-sm">My account</Link>
      </div>

      {banner && <div className="mt-4"><Notice tone={banner.tone} title={banner.title}>{banner.body}</Notice></div>}

      <div className="mt-5 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside><DealerNav verified={dealer.status === 'verified'} /></aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
