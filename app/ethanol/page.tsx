import { Suspense } from 'react';
import { ProductListing } from '@/components/ProductListing';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata = buildMetadata({
  title: 'Ethanol-Ready & Flex-Fuel Bikes in India — E20, E85, E100',
  description:
    'Which Indian bikes run on ethanol-blended petrol? Every new petrol bike is E20-ready by the BS6 Phase 2 mandate; flex-fuel E85/E100 models are just arriving. Compare them here.',
  path: '/ethanol',
  keywords: ['e20 bike india', 'ethanol bike', 'flex fuel bike india', 'e85 bike', 'e100 bike', 'ethanol petrol bike'],
});

export default function EthanolPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Ethanol', url: '/ethanol' }])} />
      <Suspense fallback={<div className="container-xl py-10"><div className="skeleton h-96" /></div>}>
        <ProductListing
          category="ethanol"
          title="Ethanol-ready bikes"
          intro="Every new petrol two-wheeler sold in India since April 2023 is E20-ready by the BS6 Phase 2 mandate — E20 (20% ethanol) is now the standard fuel. Flex-fuel models that run E85/E100 are shown first."
          searchParams={searchParams}
        />
      </Suspense>
    </>
  );
}
