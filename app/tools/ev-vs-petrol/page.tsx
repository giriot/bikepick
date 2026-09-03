import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { EvCalculator, type CalcBike } from '@/components/EvCalculator';
import { Breadcrumbs } from '@/components/ui';
import { AdSlot } from '@/components/AdSlot';
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'EV vs Petrol Calculator — Real Running Cost Comparison',
  description: 'Compare the running cost of an electric scooter against a petrol bike using real specs from our database. See cost per km, monthly savings and break-even.',
  path: '/tools/ev-vs-petrol',
  keywords: ['ev vs petrol calculator', 'electric scooter running cost india', 'cost per km electric scooter'],
});

const FAQ = [
  { question: 'How is electric cost per km calculated?', answer: 'We divide the usable battery capacity (kWh) by the claimed range to get kWh per km, multiply by your electricity tariff, then divide by charging efficiency to account for losses at the charger and in the battery.' },
  { question: 'Are claimed range figures realistic?', answer: 'Usually not. Manufacturer range is measured in ideal conditions. Real-world range is often 20-30% lower, which raises the real cost per km. Where we have a verified real-world figure we show it on the model page.' },
  { question: 'Does the 5-year total include battery replacement?', answer: 'Only if you tick the box. When a replacement estimate is recorded for the selected EV it is pre-filled automatically — edit it to your dealer quote if you like. If nothing is recorded, enter the figure yourself. Until the box is ticked, the total excludes battery replacement.' },
  { question: 'How is a hybrid CNG+Petrol vehicle compared?', answer: 'Hybrid fuel mix is personal, so we never invent its cost: you enter your real fuel spend per km (fuel bill ÷ km) and we use that for the running cost. Hybrid models appear in the picker as soon as they are added to our database.' },
];

const fuelKey = (ft: string | null): 'petrol' | 'electric' | 'hybrid' =>
  ft === 'electric' ? 'electric' : (ft === 'hybrid' || ft === 'cng' || ft === 'cng_petrol' ? 'hybrid' : 'petrol');

export default async function EvVsPetrolPage() {
  const settings = await getSettings();
  const rows = await db.all<any>(
    `SELECT p.id, p.name, p.fuel_type, p.body_type, p.price_min, b.name AS brand_name,
            bs.mileage_kmpl, es.claimed_range_km, es.real_world_range_km, es.battery_capacity_kwh,
            es.est_battery_replacement_cost
       FROM products p JOIN brands b ON b.id = p.brand_id
       LEFT JOIN bike_specs bs ON bs.product_id = p.id AND bs.variant_id IS NULL
       LEFT JOIN ev_specs es ON es.product_id = p.id AND es.variant_id IS NULL
      WHERE p.status='published' AND p.deleted_at IS NULL
      ORDER BY p.popularity DESC`,
  );
  const map = (r: any): CalcBike => ({
    id: r.id, label: `${r.brand_name} ${r.name}`, body: r.body_type ?? null, fuel: fuelKey(r.fuel_type),
    mileage: r.mileage_kmpl, range: r.real_world_range_km ?? r.claimed_range_km,
    battery: r.battery_capacity_kwh, price: r.price_min, batteryReplacement: r.est_battery_replacement_cost,
  });
  const groups: Record<'petrol' | 'electric' | 'hybrid', CalcBike[]> = { petrol: [], electric: [], hybrid: [] };
  for (const r of rows) groups[fuelKey(r.fuel_type)].push(map(r));

  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Tools', url: '/tools' }, { name: 'EV vs Petrol', url: '/tools/ev-vs-petrol' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <Breadcrumbs items={crumbs} />

      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Running cost: petrol, electric or hybrid CNG+Petrol</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          Pick any two vehicles — petrol, electric or hybrid CNG+Petrol — and for each choose a bike or a scooter. We use the
          specs already in our database, no invented figures, and show cost per kilometre, monthly saving, a 5-year ownership
          total (with optional battery replacement) and how long a price gap takes to pay back.
        </p>
      </header>

      <div className="mt-6"><EvCalculator groups={groups} defaults={{
        petrolPrice: Number(settings.petrol_price_default || 104.5),
        electricityPrice: Number(settings.electricity_price_default || 8),
        efficiency: Number(settings.charging_efficiency_default || 85),
      }} /></div>

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
