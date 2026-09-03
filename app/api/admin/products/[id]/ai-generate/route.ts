import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail } from '@/lib/api';
import { audit } from '@/lib/audit';
import { generateBikeTemplate } from '@/lib/ai-template';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin-only: generate the full listing template (spec sheet + extras +
 * variants with per-variant comparison values + pros & cons) from the
 * brand and model name using the AI chain (Gemini → OpenAI → Hugging Face).
 *
 * Values come from the AI's knowledge — nothing is saved here. The admin
 * reviews the result in the spec sheet page and applies it through the
 * normal audited flows.
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

    // Some records include the brand in the model name ("Honda Activa 125") — don't double it.
    const rawName = product.name.trim();
    const modelName =
      product.brand_name && rawName.toLowerCase().startsWith(product.brand_name.toLowerCase().trim())
        ? rawName.slice(product.brand_name.trim().length).replace(/^[\s-]+/, '').trim()
        : rawName;
    const brandName = product.brand_name || '';

    const result = await generateBikeTemplate(brandName, modelName, product.fuel_type || 'petrol');
    await audit(user, 'product.ai.generate', 'products', product.id, {
      provider: result.provider,
      model: `${brandName} ${modelName}`,
      specs: Object.keys(result.specs).length,
      variants: result.variants.length,
      pros: result.pros.length,
      cons: result.cons.length,
    });
    return ok(result, 'AI template ready — review every value before applying.');
  } catch (e: any) {
    if (e?.code === 'no_key') return fail(e.message, 503);
    return handleError(e);
  }
}
