import { Suspense } from 'react';
import { ProductListing } from '@/components/ProductListing';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata = buildMetadata({
  title: 'Hybrid & CNG Bikes in India — CNG + Petrol Models Compared',
  description:
    'Compare bi-fuel CNG + petrol motorcycles like the Bajaj Freedom 125 — ex-showroom price, CNG mileage in km/kg, combined range, running cost and value.',
  path: '/hybrid',
  keywords: ['cng bike india', 'bajaj freedom 125 cng', 'hybrid bike india', 'bi-fuel motorcycle', 'cng bike mileage'],
});

export default function HybridPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Hybrid', url: '/hybrid' }])} />
      <Suspense fallback={<div className="container-xl py-10"><div className="skeleton h-96" /></div>}>
        <ProductListing
          category="hybrid"
          title="Hybrid (CNG + Petrol) bikes"
          intro="Bi-fuel motorcycles that run primarily on CNG with a small petrol tank as backup — shown with CNG mileage in km/kg, combined range and honest running-cost maths."
          searchParams={searchParams}
        />
      </Suspense>
    </>
  );
}
