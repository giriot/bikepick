import { db } from '@/lib/db';
import { EmiCalculator } from '@/components/EmiCalculator';
import { Breadcrumbs } from '@/components/ui';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Bike EMI Calculator — Monthly Instalment & Total Interest',
  description: 'Work out the monthly EMI, total interest and repayment schedule for any two-wheeler loan. Pick a model from our database or enter your own price.',
  path: '/tools/emi',
  keywords: ['bike emi calculator', 'two wheeler loan emi', 'scooter emi calculator india'],
});

export default async function EmiPage() {
  const rows = await db.all<any>(
    `SELECT p.id, p.name, p.price_min, b.name AS brand_name FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.status='published' AND p.deleted_at IS NULL ORDER BY p.popularity DESC`,
  );
  const products = rows.map((r) => ({ id: r.id, label: `${r.brand_name} ${r.name}`, price: r.price_min }));
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Tools', url: '/tools' }, { name: 'EMI calculator', url: '/tools/emi' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Bike EMI calculator</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          A reducing-balance calculation — the same method banks and NBFCs use. Change the down payment, rate and tenure to
          see what you actually pay over the life of the loan.
        </p>
      </header>
      <div className="mt-6"><EmiCalculator products={products} initialPrice={products[0]?.price || 150000} /></div>
      <p className="mt-6 max-w-3xl text-[12px] leading-5 text-ink-mute">
        This is an estimate. Lenders add processing fees, documentation charges and insurance financing, and your actual
        rate depends on your credit profile. Always ask for the annual percentage rate and the full repayment schedule in writing.
      </p>
    </div>
  );
}
