import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Hard-deletes every record flagged `is_demo = 1`, plus their dependent rows.
 * Real records carry `is_demo = 0` and are never matched by this query.
 */
export async function DELETE() {
  try {
    const user = await requirePermission('*');
    let removed = 0;

    // Dependents first so foreign keys stay satisfied.
    await db.run('DELETE FROM used_bike_images WHERE used_bike_id IN (SELECT id FROM used_bikes WHERE is_demo = 1)');
    await db.run("DELETE FROM verification_records WHERE entity_type='used_bike' AND entity_id IN (SELECT id FROM used_bikes WHERE is_demo = 1)");
    await db.run('DELETE FROM leads WHERE used_bike_id IN (SELECT id FROM used_bikes WHERE is_demo = 1) OR dealer_id IN (SELECT id FROM dealer_profiles WHERE is_demo = 1)');
    await db.run('DELETE FROM dealer_offers WHERE is_demo = 1 OR dealer_id IN (SELECT id FROM dealer_profiles WHERE is_demo = 1)');
    await db.run('DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM bike_specs WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM ev_specs WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM price_history WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM product_prices WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM product_sources WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM product_versions WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM reviews WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');
    await db.run('DELETE FROM price_alerts WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)');

    for (const table of ['used_bikes', 'dealer_profiles', 'service_centres', 'products']) {
      const before = await db.get<any>(`SELECT COUNT(*) AS c FROM ${table} WHERE is_demo = 1`);
      removed += before?.c ?? 0;
      await db.run(`DELETE FROM ${table} WHERE is_demo = 1`);
    }

    await audit(user, 'settings.purge_demo_data', 'settings', undefined, { removed });
    return ok({ removed }, `Removed ${removed} demo records`);
  } catch (e) {
    return handleError(e);
  }
}
