import { Suspense } from 'react';
import { ProductListing } from '@/components/ProductListing';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata = buildMetadata({
  title: 'Flex-Fuel Bikes in India — E85 & E100 Ethanol Motorcycles',
  description:
    'Motorcycles that run on high-ethanol blends E85 and E100 (flex-fuel), not just E20. A model is listed here only when its flex-fuel capability is recorded — never a plain E20 bike.',
  path: '/ethanol',
  keywords: ['flex fuel bike india', 'e85 bike', 'e100 bike', 'ethanol motorcycle india', 'e85 petrol bike'],
});

export default function EthanolPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Ethanol', url: '/ethanol' }])} />
      <Suspense fallback={<div className="container-xl py-10"><div className="skeleton h-96" /></div>}>
        <ProductListing
          category="ethanol"
          title="Flex-fuel bikes (E85–E100)"
          intro="Flex-fuel motorcycles run on any ethanol blend from E20 up to E85 or E100 (100% ethanol). India's first flex-fuel bikes are only just launching — a model appears here only when its flex-fuel rating is recorded. E20-ready bikes are marked on their own pages instead."
          searchParams={searchParams}
        />
      </Suspense>
    </>
  );
}
