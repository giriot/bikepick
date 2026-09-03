import { Suspense } from 'react';
import { ProductListing } from '@/components/ProductListing';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata = buildMetadata({
  title: 'New Bikes & Scooters in India — Prices, Specs and Comparison',
  description:
    'Browse petrol motorcycles and scooters with structured specifications, mileage, safety equipment, Bikepick Score and verified dealer offers. Filter by budget, brand, engine capacity and ABS.',
  path: '/bikes',
  keywords: ['new bikes india', 'bike price', 'scooter comparison', 'bike specifications'],
});

export default function BikesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Bikes & Scooters', url: '/bikes' }])} />
      <Suspense fallback={<div className="container-xl py-10"><div className="skeleton h-96" /></div>}>
        <ProductListing
          category="bikes"
          title="New bikes & scooters"
          intro="Petrol motorcycles and scooters with full specification sheets, running-cost estimates and dealer offers. Every figure is stored as a structured field with a recorded source."
          searchParams={searchParams}
        />
      </Suspense>
    </>
  );
}
