import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { DealerRegisterForm } from '@/components/DealerRegisterForm';
import { buildMetadata } from '@/lib/seo';

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
  ['No ranking manipulation', 'Paid placement is labelled as Sponsored and never changes a bike\u2019s score. Buyers trust that — which is why they contact you.'],
];

export default async function DealerRegisterPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dealer/register');

  const existing = await db.get<any>('SELECT id FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
  if (existing) redirect('/dealer');

  const brands = await db.all<any>('SELECT id, name FROM brands WHERE deleted_at IS NULL ORDER BY name');

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="card p-6">
        <h2 className="text-[18px] font-bold tracking-[-0.02em]">Register your dealership</h2>
        <p className="mt-1 text-[13px] leading-6 text-ink-mute">
          Free to register. We verify every dealership before it goes live — it takes about two working days.
        </p>
        <div className="mt-5">
          <DealerRegisterForm brands={brands} defaults={{ name: user.full_name || '', phone: user.phone || '', email: user.email, city: user.city || '' }} />
        </div>
      </div>
      <aside className="space-y-3">
        {BENEFITS.map(([t, d]) => (
          <div key={t} className="card p-4">
            <p className="text-[13.5px] font-semibold">{t}</p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-mute">{d}</p>
          </div>
        ))}
      </aside>
    </div>
  );
}
