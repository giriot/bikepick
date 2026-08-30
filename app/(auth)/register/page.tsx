import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/AuthForm';
import { buildMetadata } from '@/lib/seo';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Create your account', description: 'Create a free Bikepick.IN account to save comparisons, track prices and sell your bike.', path: '/register', robots: 'noindex,follow' });

const PERKS = [
  'Price-drop alerts on any model, in your city',
  'Save and share comparisons with a permalink',
  'List your used bike free, with verification',
  'Track every enquiry you send from one place',
];

export default async function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const user = await getCurrentUser();
  if (user) redirect(searchParams.next || '/account');
  return (
    <div className="container-xl grid min-h-[70vh] items-center gap-10 py-10 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md lg:mx-0">
        <div className="mb-6">
          <Link href="/" className="inline-flex lg:hidden"><Logo /></Link>
          <h1 className="mt-5 text-[26px] font-bold tracking-[-0.03em] lg:mt-0">Create your account</h1>
          <p className="mt-1 text-[13.5px] text-ink-mute">Free forever. No card, no spam.</p>
        </div>
        <div className="card p-6"><AuthForm mode="register" next={searchParams.next} /></div>
      </div>
      <div className="hidden lg:block">
        <div className="rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-white p-8">
          <Logo />
          <p className="mt-6 text-[20px] font-bold leading-7 tracking-[-0.02em]">Everything you need to pick the right two-wheeler.</p>
          <ul className="mt-5 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex gap-2.5 text-[13.5px] text-ink">
                <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
