import { Suspense } from 'react';
import { ProductListing } from '@/components/ProductListing';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata = buildMetadata({
  title: 'Electric Scooters & Bikes in India — Range, Charging and Running Cost',
  description:
    'Compare electric two-wheelers with manufacturer-claimed range shown separately from our own real-world estimate, plus battery capacity, charging time, warranty and cost per kilometre.',
  path: '/electric',
  keywords: ['electric scooter india', 'ev bike price', 'ev range comparison'],
});

export default function ElectricPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Electric', url: '/electric' }])} />
      <Suspense fallback={<div className="container-xl py-10"><div className="skeleton h-96" /></div>}>
        <ProductListing
          category="electric"
          title="Electric scooters & bikes"
          intro="Manufacturer-claimed range is always shown separately from the Bikepick real-world estimate. Charging time, battery chemistry, warranty and cost per kilometre are recorded for every model."
          searchParams={searchParams}
        />
      </Suspense>
    </>
  );
}
