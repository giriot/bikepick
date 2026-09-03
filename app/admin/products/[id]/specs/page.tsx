import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { requirePermission } from '@/lib/rbac';
import { SpecSheetPage } from '@/components/admin/SpecSheetPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Spec Sheet · Bikepick Admin', robots: { index: false, follow: false } };

export default async function ProductSpecsPage({ params }: { params: { id: string } }) {
  const resource = getResource('products');
  await requirePermission(resource?.permission || 'product.update');

  const product = await db.get<any>(
    `SELECT p.*, b.name AS brand_name, b.official_website FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.id = ? AND p.deleted_at IS NULL`,
    [params.id],
  );
  if (!product) notFound();

  const isEv = product.fuel_type === 'electric';
  const table = isEv ? 'ev_specs' : 'bike_specs';
  const spec = (await db.get<any>(`SELECT * FROM ${table} WHERE product_id = ? AND variant_id IS NULL`, [product.id])) || {};

  const variantRows = await db.all<any>(
    'SELECT id, name, is_new, price, on_road_price FROM product_variants WHERE product_id = ? AND deleted_at IS NULL ORDER BY sort_order, price, created_at',
    [product.id],
  );
  const variantSpecRows = await db.all<any>(`SELECT * FROM ${table} WHERE product_id = ? AND variant_id IS NOT NULL`, [product.id]);
  const variantSpecs: Record<string, Record<string, any>> = {};
  for (const r of variantSpecRows) variantSpecs[r.variant_id] = r;
  const variants = variantRows.map((v) => ({ id: v.id, name: v.name, is_new: v.is_new, price: v.price, on_road_price: v.on_road_price }));

  return (
    <div className="container-xl py-6">
      <Link href={`/admin/products/${product.id}`} className="text-[12.5px] font-medium text-ink-mute hover:text-ink">
        ← {product.brand_name} {product.name}
      </Link>
      <h1 className="mt-2 text-[22px] font-bold tracking-[-0.025em]">Spec sheet — {product.brand_name} {product.name}</h1>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-ink-mute">
        Fill this from the <b>AI template</b> (top orange box — needs only the brand &amp; model name; drafts the full spec,
        variants, comparison and pros &amp; cons) or the dropdown form below. You review and save every value — nothing is
        published automatically. Blank fields are stored as &ldquo;not recorded&rdquo; and shown as <b>N/A</b> on the site.
      </p>
      <div className="mt-5">
        <SpecSheetPage
          productId={product.id}
          fuelType={product.fuel_type}
          brandName={product.brand_name}
          productName={product.name}
          initial={spec}
          variants={variants}
          variantSpecs={variantSpecs}
        />
      </div>
    </div>
  );
}
