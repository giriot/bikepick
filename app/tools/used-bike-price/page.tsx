import { db } from '@/lib/db';
import { UsedPriceTool } from '@/components/UsedPriceTool';
import { Breadcrumbs } from '@/components/ui';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Used Bike Price Estimator — What Is Your Two-Wheeler Worth?',
  description: 'Get a fair market price range for any used bike or scooter in India based on age, kilometres, owners, condition and paperwork.',
  path: '/tools/used-bike-price',
  keywords: ['used bike price calculator', 'second hand bike valuation india', 'resale value two wheeler'],
});

export default async function UsedPricePage() {
  const rows = await db.all<any>(
    `SELECT p.id, p.name, p.price_min, b.name AS brand_name FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.status='published' AND p.deleted_at IS NULL ORDER BY b.name, p.name`,
  );
  const map = new Map<string, { id: string; name: string; price: number | null }[]>();
  for (const r of rows) {
    if (!map.has(r.brand_name)) map.set(r.brand_name, []);
    map.get(r.brand_name)!.push({ id: r.id, name: r.name, price: r.price_min });
  }
  const brands = [...map.entries()].map(([name, models]) => ({ name, models }));
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Tools', url: '/tools' }, { name: 'Used bike price', url: '/tools/used-bike-price' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Used bike price estimator</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          Buying or selling, start from a number you can defend. We apply a standard depreciation curve to the model&apos;s new
          price, then adjust for kilometres, owners, condition and paperwork — and show you every adjustment.
        </p>
      </header>
      <div className="mt-6"><UsedPriceTool brands={brands} /></div>
    </div>
  );
}
