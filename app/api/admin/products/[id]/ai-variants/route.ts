import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { generateVariantSweep } from '@/lib/ai-template';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin-only: variant auto-detect. Follows the main AI template with a
 * focused pass that lists EVERY other variant of the model sold in India
 * (price, colours, is_new + per-variant comparison values). Variants that
 * already exist in the DB or were just listed by the template are skipped.
 *
 * Nothing is saved — the panel merges the result into its review list and
 * the admin adds each variant through the normal "Add variant + comparison"
 * flow, exactly like the main template's variants.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resource = getResource('products');
    const user = await requirePermission(resource?.permission || 'product.write');

    const product = await db.get<any>(
      `SELECT p.id, p.name, p.fuel_type, b.name AS brand_name FROM products p
         LEFT JOIN brands b ON b.id = p.brand_id
        WHERE p.id = ? AND p.deleted_at IS NULL`,
      [params.id],
    );
    if (!product) return fail('Product not found', 404);
    if (!product.name?.trim()) return fail('Give the model a name first — the AI needs the brand + model name.', 422);

    // Same brand/model split as the ai-generate route ("Honda Shine100" → brand "Honda", model "Shine100").
    const rawName = product.name.trim();
    const modelName =
      product.brand_name && rawName.toLowerCase().startsWith(product.brand_name.toLowerCase().trim())
        ? rawName.slice(product.brand_name.trim().length).replace(/^[\s-]+/, '').trim()
        : rawName;
    const brandName = product.brand_name || '';

    const existing = await db.all<any>(
      `SELECT name FROM product_variants WHERE product_id = ? AND deleted_at IS NULL`,
      [params.id],
    );
    const existingNames = (existing || []).map((r: any) => String(r.name || '')).filter(Boolean);

    const result = await generateVariantSweep(brandName, modelName, product.fuel_type || 'petrol', existingNames);
    await audit(user, 'product.ai.variant_sweep', 'products', product.id, {
      provider: result.provider,
      model: `${brandName} ${modelName}`,
      found: result.variants.length,
    });
    return ok(result, 'Auto-detect complete — verify every variant before adding.');
  } catch (e: any) {
    if (e?.code === 'no_key') return fail(e.message, 503);
    return handleError(e);
  }
}
