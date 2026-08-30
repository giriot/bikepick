import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { Breadcrumbs } from '@/components/ui';
import { ContactForm } from '@/components/ContactForm';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Contact Bikepick.IN',
  description: 'Report a data error, ask about dealer registration, or reach the Bikepick team.',
  path: '/contact',
});

export default async function ContactPage() {
  const settings = await getSettings();
  const email = settings.contact_email || 'support@bikepick.in';
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Contact', url: '/contact' }];

  const routes = [
    { title: 'A price or spec is wrong', body: 'Tell us the model and what is incorrect. Corrections are usually live within a working day.', action: null },
    { title: 'I want to list my dealership', body: 'Registration is free. You will need your GSTIN and address proof for verification.', action: { href: '/dealer/register', label: 'Register as a dealer' } },
    { title: 'My used-bike listing is stuck', body: 'Check the status note on your listing first — it usually says exactly what is missing.', action: { href: '/account/listings', label: 'Open my listings' } },
    { title: 'Data partnership or press', body: 'Use the form and pick “Partnership” so it reaches the right person.', action: null },
  ];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Contact us</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          A real person reads every message. We aim to reply within two working days — data corrections are usually faster.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card p-6"><ContactForm /></div>
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[14px] font-semibold">Quickest route</h2>
            <ul className="mt-3 space-y-3.5">
              {routes.map((r) => (
                <li key={r.title}>
                  <p className="text-[13.5px] font-medium">{r.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-5 text-ink-mute">{r.body}</p>
                  {r.action && <Link href={r.action.href} className="mt-1 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline">{r.action.label} →</Link>}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="text-[14px] font-semibold">Email</h2>
            <a href={`mailto:${email}`} className="mt-1 block text-[13.5px] text-brand-700 hover:underline">{email}</a>
            <p className="mt-3 text-[12px] leading-5 text-ink-mute">
              We do not sell vehicles and we never ask for payment towards a bike. Treat any such request as fraud.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
