import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Free Bike Ownership Tools & Calculators',
  description: 'EV vs petrol running cost, EMI calculator and used-bike price estimator — free tools built on real specs from the Bikepick database.',
  path: '/tools',
});

const TOOLS = [
  { href: '/tools/ev-vs-petrol', title: 'EV vs petrol calculator', body: 'Cost per km, monthly saving and how long the price difference takes to pay back.', tag: 'Most used' },
  { href: '/tools/emi', title: 'EMI calculator', body: 'Monthly instalment, total interest and a month-by-month repayment schedule.', tag: null },
  { href: '/tools/used-bike-price', title: 'Used bike price estimator', body: 'A fair market range for any used two-wheeler based on age, kilometres, owners and paperwork.', tag: null },
  { href: '/find-my-bike', title: 'Find my bike', body: 'Answer five questions about budget and use, get a shortlist scored against your priorities.', tag: 'Guided' },
];

export default function ToolsPage() {
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Tools', url: '/tools' }];
  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Tools & calculators</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          Every calculator runs on the specs in our own database and shows the assumptions behind the answer. Where we do not
          have a figure, we say so instead of guessing.
        </p>
      </header>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="card card-hover group p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[16px] font-semibold group-hover:text-brand-700">{t.title}</h2>
              {t.tag && <span className="badge bg-brand-50 text-brand-700">{t.tag}</span>}
            </div>
            <p className="mt-1.5 text-[13px] leading-6 text-ink-mute">{t.body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700">Open tool →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
