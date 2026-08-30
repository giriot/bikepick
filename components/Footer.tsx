import Link from 'next/link';
import { LogoFull } from './Logo';

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      ['New bikes', '/bikes'], ['Electric scooters & bikes', '/electric'],
      ['Compare', '/compare'], ['Used bikes', '/used-bikes'],
      ['Dealer offers', '/dealer-offers'], ['Reviews', '/reviews'], ['Buying guides', '/guides'],
    ],
  },
  {
    title: 'Tools',
    links: [
      ['Find my bike', '/find-my-bike'], ['EV vs petrol calculator', '/tools/ev-vs-petrol'],
      ['EMI calculator', '/tools/emi'], ['Used bike price estimator', '/tools/valuation'],
      ['Find a service centre', '/service-centres'], ['Book an inspection', '/inspection'],
    ],
  },
  {
    title: 'Sell & partner',
    links: [
      ['Sell your bike', '/used-bikes/sell'], ['Dealer registration', '/dealer/register'],
      ['Dealer plans', '/dealer/plans'], ['Bulk / fleet enquiry', '/business/bulk-enquiry'],
      ['Advertise with us', '/contact'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['Privacy policy', '/legal/privacy'], ['Terms of use', '/legal/terms'],
      ['Cookie policy', '/legal/cookies'], ['Disclaimer', '/legal/disclaimer'],
      ['Affiliate disclosure', '/legal/affiliate-disclosure'], ['Dealer terms', '/legal/dealer-terms'],
      ['Used bike terms', '/legal/used-bike-terms'], ['Verification terms', '/legal/verification-terms'],
      ['Contact & grievance', '/contact'],
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="container-xl py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" aria-label="Bikepick.IN — home" className="inline-block">
              <LogoFull width={240} className="h-auto w-[240px]" />
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-ink-mute">
              India&apos;s structured comparison and buying platform for two-wheelers — specifications you can trust,
              verified used listings and transparent dealer offers.
            </p>
            <p className="mt-4 rounded-xl border border-line bg-white p-3 text-xs leading-5 text-ink-mute">
              <strong className="font-semibold text-ink-soft">Data notice:</strong> prices and specifications change
              frequently and can vary by variant, city and model year. Always confirm final pricing and equipment with
              the dealer before purchase.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink">{col.title}</h2>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-ink-mute transition-colors hover:text-brand-600">{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Bikepick.IN — Compare Smart. Buy Better.</p>
          <p>
            Sponsored, Featured and Affiliate placements are always labelled. Comparison scores are never influenced by payment.
          </p>
        </div>
      </div>
    </footer>
  );
}
