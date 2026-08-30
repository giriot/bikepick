import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/AuthForm';
import { buildMetadata } from '@/lib/seo';
import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({ title: 'Sign in', description: 'Sign in to Bikepick.IN to save comparisons, set price alerts and manage your listings.', path: '/login', robots: 'noindex,follow' });

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const user = await getCurrentUser();
  if (user) redirect(searchParams.next || '/account');
  return (
    <div className="container-xl grid min-h-[70vh] place-items-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex"><Logo /></Link>
          <h1 className="mt-5 text-[26px] font-bold tracking-[-0.03em]">Welcome back</h1>
          <p className="mt-1 text-[13.5px] text-ink-mute">Sign in to manage alerts, listings and saved comparisons.</p>
        </div>
        <div className="card p-6">
          <AuthForm mode="login" next={searchParams.next} />
        </div>
        <p className="mt-4 text-center text-[11.5px] leading-5 text-ink-mute">
          Demo accounts are listed on the <Link href="/about-demo-data" className="underline">demo data page</Link>. By signing in you accept our{' '}
          <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
