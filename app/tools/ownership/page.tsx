import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { OwnershipCalculator } from '@/components/OwnershipCalculator';
import type { CalcBike } from '@/components/EvCalculator';
import { Breadcrumbs } from '@/components/ui';
import { AdSlot } from '@/components/AdSlot';
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: '5-Year Ownership Cost Calculator — True Cost of a Bike or Scooter',
  description: 'See the true 5-year cost of any bike or scooter: on-road price, petrol, CNG or electricity, insurance, service and resale value. Compare models side by side.',
  path: '/tools/ownership',
  keywords: ['bike ownership cost', '5 year cost of ownership bike india', 'scooter running cost 5 years', 'petrol vs electric 5 year cost', 'cng bike running cost'],
});

const FAQ = [
  { question: 'What does the 5-year total include?', answer: 'On-road price (ex-showroom + ~9% RTO + first-year insurance), energy (petrol, CNG or electricity) for the kilometres you ride, insurance renewals from year two, and scheduled service. It then subtracts an estimated resale value to give the net cost of ownership. You can switch insurance off with the "Include insurance" tick box.' },
  { question: 'How is the on-road price estimated?', answer: 'We take the ex-showroom price in our database and add approximately 9% for road tax (RTO) and about 5% for first-year comprehensive insurance, with sensible minimum and maximum bounds. Actual on-road prices vary by state and insurer — always confirm with a dealer.' },
  { question: 'How is resale value estimated?', answer: 'We apply a standard two-wheeler depreciation curve — roughly 18% in year one, then about 10% a year tapering to 8% and 6%. It is indicative only; real resale depends on condition, kilometres, demand and paperwork.' },
  { question: 'Why is year-one insurance shown as included?', answer: 'First-year insurance is part of the on-road price. From year two, we assume you renew at about 45% of the first-year premium, because the own-damage component reduces as the vehicle ages. Untick "Include insurance" to exclude it from the estimate entirely.' },
  { question: 'What if a model is missing data?', answer: 'We never invent figures. If mileage, battery/range or price is not recorded, that line is shown as missing and the affected totals are excluded — you can still see everything we could calculate.' },
  { question: 'Is there a CNG option?', answer: 'Yes — choose "Custom vehicle" in either picker and set the fuel to CNG. Enter the ex-showroom price and the mileage in km per kg and the calculator treats energy as CNG, priced per kg. When a CNG model is added to the catalogue it will appear in the list automatically.' },
];

export default async function OwnershipPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const settings = await getSettings();
  const rows = await db.all<any>(
    `SELECT p.id, p.name, p.fuel_type, p.body_type, p.price_min, b.name AS brand_name,
            bs.mileage_kmpl, es.claimed_range_km, es.real_world_range_km, es.battery_capacity_kwh
       FROM products p JOIN brands b ON b.id = p.brand_id
       LEFT JOIN bike_specs bs ON bs.product_id = p.id AND bs.variant_id IS NULL
       LEFT JOIN ev_specs es ON es.product_id = p.id AND es.variant_id IS NULL
      WHERE p.status='published' AND p.deleted_at IS NULL
      ORDER BY p.popularity DESC`,
  );
  const bikes: CalcBike[] = rows.map((r: any) => ({
    id: r.id,
    label: `${r.brand_name} ${r.name}`,
    body: r.body_type ?? null,
    fuel: r.fuel_type === 'electric' ? 'electric' : 'petrol',
    mileage: r.mileage_kmpl,
    range: r.real_world_range_km ?? r.claimed_range_km,
    battery: r.battery_capacity_kwh,
    price: r.price_min,
    batteryReplacement: null,
  }));

  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Tools', url: '/tools' }, { name: 'Ownership cost', url: '/tools/ownership' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <Breadcrumbs items={crumbs} />

      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">5-year ownership cost: the real price of a bike</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          Sticker price is only the start. Pick any petrol bike, scooter or electric vehicle — or enter a custom CNG vehicle —
          and see the full 5-year cost: on-road price, energy, insurance, service and resale value, or compare two models side
          by side. Everything runs on the specs in our database, and where a figure is missing we say so instead of guessing.
        </p>
      </header>

      <div className="mt-6">
        <OwnershipCalculator
          bikes={bikes}
          defaults={{
            petrolPrice: Number(settings.petrol_price_default || 104.5),
            electricityPrice: Number(settings.electricity_price_default || 8),
            efficiency: Number(settings.charging_efficiency_default || 85),
          }}
          initialA={searchParams.a}
          initialB={searchParams.b}
        />
      </div>

      <div className="mt-8"><AdSlot slotKey="article_mid" /></div>

      <section className="mt-8 max-w-3xl">
        <h2 className="text-[18px] font-bold tracking-[-0.02em]">Questions people ask</h2>
        <div className="mt-3 space-y-2">
          {FAQ.map((f) => (
            <details key={f.question} className="card p-4">
              <summary className="cursor-pointer text-[13.5px] font-semibold">{f.question}</summary>
              <p className="mt-2 text-[13px] leading-6 text-ink-mute">{f.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
