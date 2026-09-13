import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { DealerRegisterForm } from '@/components/DealerRegisterForm';
import { buildMetadata } from '@/lib/seo';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Register Your Dealership',
  description: 'List your two-wheeler dealership on Bikepick.IN, publish offers and receive verified buyer enquiries.',
  path: '/dealer/register',
});

const BENEFITS = [
  ['Buyer enquiries, not clicks', 'Every lead carries a name, phone and the exact model the buyer asked about.'],
  ['Offers with an expiry', 'Your offers stop showing automatically on their end date, so nobody walks in quoting a dead deal.'],
  ['Verified badge', 'We check your business details once; buyers see the badge everywhere you appear.'],
  ['No ranking manipulation', 'Paid placement is labelled as Sponsored and never changes a bike’s score.'],
];

export default async function DealerRegisterPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dealer/register');

  const existing = await db.get<any>('SELECT id FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
  if (existing) redirect('/dealer');

  const brands = await db.all<any>('SELECT id, name FROM brands WHERE deleted_at IS NULL ORDER BY name');

  return (
    <div className="container-xl grid min-h-[calc(100vh-4rem)] items-start gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto w-full max-w-2xl lg:mx-0">
        <div className="mb-6">
          <Link href="/" className="inline-flex lg:hidden"><Logo /></Link>
          <h1 className="mt-5 text-[26px] font-bold tracking-[-0.03em] lg:mt-0">Register your dealership</h1>
          <p className="mt-1 text-[13.5px] leading-5 text-ink-mute">Free to register. We verify every dealership before it goes live — usually within two working days.</p>
        </div>
        <div className="card p-6">
          <DealerRegisterForm brands={brands} defaults={{ name: user.full_name || '', phone: user.phone || '', email: user.email, city: user.city || '' }} />
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-white p-8">
          <Logo />
          <p className="mt-6 text-[20px] font-bold leading-7 tracking-[-0.02em]">Turn your showroom into trusted online business.</p>
          <ul className="mt-5 space-y-4">
            {BENEFITS.map(([title, body]) => (
              <li key={title} className="flex gap-2.5 text-[13px] leading-5 text-ink">
                <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">✓</span>
                <span><strong className="font-semibold">{title}.</strong> {body}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
