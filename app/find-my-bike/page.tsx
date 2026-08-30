import { db } from '@/lib/db';
import { FindMyBike, type Candidate } from '@/components/FindMyBike';
import { Breadcrumbs } from '@/components/ui';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Find My Bike — Get a Shortlist in Five Questions',
  description: 'Answer five questions about budget, riding and priorities. We match them against real specs and show you why each bike made your shortlist.',
  path: '/find-my-bike',
});

export default async function FindMyBikePage() {
  const rows = await db.all<any>(
    `SELECT p.id, p.name, p.slug, p.fuel_type, p.body_type, p.price_min, p.score,
            b.name AS brand_name, b.slug AS brand_slug,
            bs.mileage_kmpl, bs.engine_capacity_cc, bs.abs_type, bs.seat_height_mm,
            es.claimed_range_km,
            (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN bike_specs bs ON bs.product_id = p.id AND bs.variant_id IS NULL
       LEFT JOIN ev_specs es ON es.product_id = p.id AND es.variant_id IS NULL
      WHERE p.status = 'published' AND p.deleted_at IS NULL`,
  );

  const candidates: Candidate[] = rows.map((r) => ({
    id: r.id, name: r.name, brand: r.brand_name, slug: r.slug, brandSlug: r.brand_slug,
    fuel: r.fuel_type, bodyType: r.body_type, price: r.price_min, score: r.score,
    mileage: r.mileage_kmpl, cc: r.engine_capacity_cc, range: r.claimed_range_km,
    abs: r.abs_type, seatHeight: r.seat_height_mm, image: r.image,
  }));

  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Find my bike', url: '/find-my-bike' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Find my bike</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          Five questions, then a shortlist scored against your answers using the specs in our database. We show the reason
          behind every recommendation — and nobody can pay to be included.
        </p>
      </header>
      <div className="mt-8"><FindMyBike candidates={candidates} /></div>
    </div>
  );
}
