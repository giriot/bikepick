import Link from 'next/link';
import { db } from '@/lib/db';
import { Breadcrumbs, Notice } from '@/components/ui';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'About the demo data on this site',
  description: 'Which records on Bikepick.IN are demonstration data, how they are labelled, and how the site owner removes them.',
  path: '/about-demo-data',
  robots: 'noindex,follow',
});

export default async function DemoDataPage() {
  const counts = await Promise.all([
    db.get<any>('SELECT COUNT(*) AS c FROM products WHERE is_demo = 1 AND deleted_at IS NULL'),
    db.get<any>('SELECT COUNT(*) AS c FROM dealer_profiles WHERE is_demo = 1 AND deleted_at IS NULL'),
    db.get<any>('SELECT COUNT(*) AS c FROM dealer_offers WHERE is_demo = 1 AND deleted_at IS NULL'),
    db.get<any>('SELECT COUNT(*) AS c FROM used_bikes WHERE is_demo = 1 AND deleted_at IS NULL'),
  ]);
  const [products, dealers, offers, used] = counts.map((c) => c?.c ?? 0);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Demo data', url: '/about-demo-data' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 max-w-3xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">About the demo data</h1>
        <p className="mt-2 text-[15px] leading-7 text-ink-mute">
          This installation ships with a small set of demonstration records so every feature can be seen working before the
          owner loads real data. We would rather label them loudly than let you mistake them for verified information.
        </p>

        <div className="mt-6"><Notice tone="warn" title="How to spot demo records">
          Every demonstration record carries an orange <span className="badge-demo">Demo data</span> badge wherever it appears —
          listing cards, product pages, dealer offers and used listings.
        </Notice></div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Products', products], ['Dealers', dealers], ['Dealer offers', offers], ['Used listings', used]].map(([l, v]) => (
            <div key={l as string} className="card p-4">
              <p className="text-[24px] font-bold tracking-[-0.02em]">{v as number}</p>
              <p className="text-[12px] text-ink-mute">demo {String(l).toLowerCase()}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-9 text-[19px] font-bold tracking-[-0.02em]">What is real and what is not</h2>
        <ul className="mt-3 space-y-2">
          {[
            ['The software is real.', 'Search, scoring, comparison, the approval workflows, leads, notifications and the admin panel all run against a real database.'],
            ['Specifications are illustrative.', 'Demo specs are plausible but must not be quoted. Real specifications are loaded by the owner through CSV import or manual entry, each with a recorded source.'],
            ['Prices are not live.', 'There is no live price feed. Prices come from admin entry or an approved data source, and every change is versioned.'],
            ['Demo dealers are not real businesses.', 'Enquiries to them are stored and visible in the dashboard, but no real dealership receives them.'],
          ].map(([t, d]) => (
            <li key={t} className="card p-4">
              <p className="text-[13.5px] font-semibold">{t}</p>
              <p className="mt-1 text-[13px] leading-6 text-ink-mute">{d}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-9 text-[19px] font-bold tracking-[-0.02em]">Removing it</h2>
        <p className="mt-2 text-[14px] leading-7 text-ink-soft">
          The site owner can clear every demonstration record in one action from{' '}
          <strong>Admin → Settings → Demo data</strong>. Nothing else is affected: real products, real dealers and real
          listings are matched on a separate flag and are never touched by the purge.
        </p>

        <h2 className="mt-9 text-[19px] font-bold tracking-[-0.02em]">Demo sign-in accounts</h2>
        <p className="mt-2 text-[14px] leading-7 text-ink-soft">
          The seed script creates one account per role so each dashboard can be reviewed. Their credentials are printed by
          the seed script and documented in the project README — they are not published on this page, and the owner should
          change or delete them before going live.
        </p>
        <Link href="/" className="btn-outline btn-sm mt-6">Back to home</Link>
      </div>
    </div>
  );
}
