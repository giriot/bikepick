import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { SellWizard } from '@/components/SellWizard';
import { Breadcrumbs, SectionHeader } from '@/components/ui';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = buildMetadata({
  title: 'Sell Your Bike — Free Listing with Verification',
  description:
    'List your used two-wheeler on Bikepick.IN. Get a free market price estimate, upload photos, complete verification and reach buyers across India.',
  path: '/used-bikes/sell',
});

export default async function SellPage() {
  const user = await getCurrentUser();
  const [rows, minPhotos] = await Promise.all([
    db.all<any>(
      `SELECT p.id, p.name, p.price_min, b.name AS brand_name
         FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.status='published' AND p.deleted_at IS NULL ORDER BY b.name, p.name`,
    ),
    getSetting('used_bike_min_photos'),
  ]);

  const brandMap = new Map<string, { id: string; name: string; price: number | null }[]>();
  for (const r of rows) {
    if (!brandMap.has(r.brand_name)) brandMap.set(r.brand_name, []);
    brandMap.get(r.brand_name)!.push({ id: r.id, name: r.name, price: r.price_min });
  }
  const brands = [...brandMap.entries()].map(([name, models]) => ({ name, models }));

  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Used bikes', url: '/used-bikes' }, { name: 'Sell your bike', url: '/used-bikes/sell' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Sell your bike</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          Free to list. We estimate a fair market price from your inputs, verify your identity and paperwork, then
          publish your listing to buyers searching in your city.
        </p>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ['Enter details', 'Vehicle, condition and paperwork — five short steps.'],
          ['Upload photos', 'Seven required angles so buyers can judge condition honestly.'],
          ['Verification', 'We check your identity and documents privately.'],
          ['Go live', 'Approved listings appear publicly and enquiries reach you directly.'],
        ].map(([t, d], i) => (
          <li key={t} className="card p-4">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">{i + 1}</span>
            <p className="mt-2 text-[13.5px] font-semibold">{t}</p>
            <p className="mt-0.5 text-[12px] leading-5 text-ink-mute">{d}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <SellWizard
          signedIn={!!user}
          brands={brands}
          minPhotos={Number(minPhotos || 5)}
          defaults={{ name: user?.full_name || '', phone: user?.phone || '', city: user?.city || '' }}
        />
      </div>
    </div>
  );
}
