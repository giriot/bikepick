import 'server-only';
import { db, nowIso } from './db';

/**
 * Keeps a product's price range in lock-step with its active variants.
 * The admin form no longer has manual price fields — variant prices are the
 * single source of truth (ex-showroom). Products without variants keep
 * whatever price was set (e.g. by the seed).
 */
export async function syncProductPricesFromVariants(variantId: string): Promise<void> {
  const v = await db.get<any>('SELECT product_id FROM product_variants WHERE id = ?', [variantId]);
  if (!v?.product_id) return;
  const rows = await db.all<any>(
    'SELECT price FROM product_variants WHERE product_id = ? AND deleted_at IS NULL AND price IS NOT NULL AND price > 0',
    [v.product_id],
  );
  if (!rows.length) return; // no priced variants — leave the existing range untouched
  const prices = rows.map((r) => Number(r.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  await db.run('UPDATE products SET price_min = ?, price_max = ?, updated_at = ? WHERE id = ?', [min, max, nowIso(), v.product_id]);
}
