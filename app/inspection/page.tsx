import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { Breadcrumbs, Notice } from '@/components/ui';
import { LeadDialog } from '@/components/LeadDialog';
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, JsonLd } from '@/lib/seo';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Used Bike Inspection Service — 40-Point Physical Check',
  description: 'Book an independent physical inspection before you buy a used two-wheeler. Engine, frame, electricals, documents and a written report.',
  path: '/inspection',
});

const CHECKS = [
  { group: 'Engine & transmission', items: ['Cold start behaviour', 'Idle stability and unusual noise', 'Smoke colour under load', 'Clutch engagement and free play', 'Gear shift quality across all gears', 'Oil leaks at head, casing and gasket', 'Chain and sprocket wear'] },
  { group: 'Frame & body', items: ['Chassis number matched to the RC', 'Frame alignment and weld inspection', 'Accident repair and repaint detection', 'Panel gaps and fitment', 'Fork alignment and seal condition', 'Rear suspension travel and leaks'] },
  { group: 'Brakes, tyres & wheels', items: ['Pad and shoe thickness', 'Disc runout and scoring', 'ABS function where fitted', 'Tyre tread depth and manufacture date', 'Sidewall cracks or bulges', 'Wheel truing and bearing play'] },
  { group: 'Electricals & battery', items: ['Battery voltage under load', 'Charging system output', 'All lighting and indicators', 'Instrument cluster and warning lamps', 'Starter motor draw', 'For EVs: state of health, cell balance, charger function'] },
  { group: 'Documents', items: ['RC original and ownership chain', 'Insurance validity and claim history', 'Hypothecation and NOC status', 'Pending challans', 'Service record continuity', 'Odometer tamper indicators'] },
];

const FAQ = [
  { question: 'Who does the inspection?', answer: 'An independent inspector assigned by us — never the seller and never the dealer selling the bike. The report goes to you, not to them.' },
  { question: 'How long does it take?', answer: 'A full inspection takes roughly 60 to 90 minutes at the location where the bike is kept. You receive the written report the same day.' },
  { question: 'What if the bike fails?', answer: 'There is no pass or fail. You get a factual condition report with photos and an estimate of what needs spending. Walking away is often the best outcome of an inspection.' },
  { question: 'Can I cancel?', answer: 'Yes. Cancel at least 24 hours before the slot for a full refund. See the refund policy for detail.' },
];

export default async function InspectionPage() {
  const settings = await getSettings();
  const fee = Number(settings.inspection_fee_default || 0);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Inspection', url: '/inspection' }];
  const total = CHECKS.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[34px]">Get it inspected before you pay</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ink-mute">
            A used bike that looks clean can still be hiding a bent frame, a tampered odometer or an unclosed loan. An
            independent inspection costs a fraction of what those cost to discover afterwards.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[['Independent', 'Our inspector works for you, not the seller.'],
              ['Written report', 'Photos, findings and an estimate of what needs spending.'],
              [`${total} checkpoints`, 'Engine, frame, brakes, electricals and documents.']].map(([t, d]) => (
              <div key={t} className="card p-4">
                <p className="text-[13.5px] font-semibold">{t}</p>
                <p className="mt-1 text-[12.5px] leading-5 text-ink-mute">{d}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-9 text-[20px] font-bold tracking-[-0.02em]">What gets checked</h2>
          <div className="mt-4 space-y-3">
            {CHECKS.map((g) => (
              <details key={g.group} className="card p-5" open={g.group === 'Engine & transmission'}>
                <summary className="cursor-pointer text-[14.5px] font-semibold">{g.group} <span className="font-normal text-ink-mute">({g.items.length})</span></summary>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {g.items.map((i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-6 text-ink-soft">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />{i}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          <div className="mt-7">
            <Notice tone="warn" title="What an inspection cannot tell you">
              No inspection can predict when a component will fail, or find a fault that is not present on the day. It reduces
              risk substantially — it does not eliminate it, and it is not a warranty.
            </Notice>
          </div>

          <h2 className="mt-9 text-[20px] font-bold tracking-[-0.02em]">Questions</h2>
          <div className="mt-3 space-y-2">
            {FAQ.map((f) => (
              <details key={f.question} className="card p-4">
                <summary className="cursor-pointer text-[13.5px] font-semibold">{f.question}</summary>
                <p className="mt-2 text-[13px] leading-6 text-ink-mute">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-max">
          <div className="card p-6">
            <p className="text-[12.5px] font-medium text-brand-700">Book an inspection</p>
            <p className="mt-1 text-[30px] font-bold leading-none tracking-[-0.03em]">
              {fee > 0 ? inr(fee) : 'Request a quote'}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-mute">
              {fee > 0 ? 'Per vehicle, at the location where the bike is kept.' : 'Pricing depends on your city — we will confirm before scheduling.'}
            </p>
            <div className="mt-4">
              <LeadDialog
                leadType="inspection" label="Book an inspection"
                title="Book a used-bike inspection"
                description="Tell us where the bike is and when suits you. We confirm the inspector and the fee before anything is charged."
                source="inspection-page" className="btn-primary w-full"
                extraFields={[
                  { name: 'vehicle', label: 'Which bike (brand and model)', required: true },
                  { name: 'listing_url', label: 'Listing link, if any' },
                  { name: 'preferred_date', label: 'Preferred date', type: 'date', required: true },
                  { name: 'location', label: 'Where is the bike kept', required: true },
                ]}
              />
            </div>
            <p className="mt-3 text-[11.5px] leading-5 text-ink-mute">
              No payment is taken now. Read the <Link href="/legal/refund-policy" className="underline">refund policy</Link>.
            </p>
          </div>

          <div className="card mt-4 p-5">
            <p className="text-[14px] font-semibold">Selling instead?</p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-mute">
              An inspection report attached to your listing raises your trust score and gets you a better price.
            </p>
            <Link href="/used-bikes/sell" className="btn-outline btn-sm mt-3 w-full">List your bike</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
