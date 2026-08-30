import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AccountNav } from '@/components/AccountNav';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  return (
    <div className="container-xl py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em]">My account</h1>
          <p className="text-[13px] text-ink-mute">{user.full_name} · {user.email}</p>
        </div>
        {user.role !== 'user' && (
          <a className="btn-outline btn-sm" href={user.role === 'dealer' ? '/dealer' : '/admin'}>
            Go to {user.role === 'dealer' ? 'dealer dashboard' : 'admin panel'}
          </a>
        )}
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside><AccountNav /></aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
