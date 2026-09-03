import { NextRequest } from 'next/server';
import { db, uid, nowIso } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { storage } from '@/services/storage';
import { generateBikeImage, OemImageQuotaError } from '@/lib/oem-images';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const MAX_IMAGES = 10;
const PER_CALL = 1; // one generation per request so we stay under the serverless time limit

/**
 * Generates ONE original AI illustration of the model in the next variant
 * colour (model name printed on the image) and stores it in product_images.
 * The admin panel chains calls until the 10-image cap is reached.
 * Images are ORIGINAL illustrations — never OEM photos, always labelled.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resource = getResource('products');
    const user = await requirePermission(resource?.permission || 'product.write');
    const product = await db.get<any>('SELECT id, name FROM products WHERE id = ? AND deleted_at IS NULL', [params.id]);
    if (!product) return fail('Product not found', 404);
    const brand = await db.get<any>('SELECT b.name FROM products p JOIN brands b ON b.id = p.brand_id WHERE p.id = ?', [params.id]);
    const brandName = brand?.name || '';

    const existing = await db.all<any>(
      'SELECT id, sort_order FROM product_images WHERE product_id = ? AND deleted_at IS NULL',
      [params.id],
    );
    if (existing.length >= MAX_IMAGES) return fail(`This model already has ${MAX_IMAGES} images (the maximum). Remove one first.`, 422);

    const body = await readJson(req).catch(() => ({}));
    const color: string | null = body.color
      ? String(body.color).slice(0, 60)
      : await nextColor(params.id, existing.length);
    if (!color) return fail('No colours found for this model yet — add colours to the variants/spec sheet first, or pass "color" in the request.', 422);

    const { buffer, mime } = await generateBikeImage({ model: product.name, brand: brandName, color });

    const key = `generated/${params.id}/${uid()}.png`;
    const put = await storage().put({ bucket: 'public-media', key, body: buffer, contentType: mime });
    const url = put.url || `https://fcqznkvftybzjygjfvwa.supabase.co/storage/v1/object/public/public-media/${key}`;

    const now = nowIso();
    const id = 'img__' + uid();
    const maxSort = existing.reduce((m: number, r: any) => Math.max(m, r.sort_order || 0), 0);
    await db.run(
      `INSERT INTO product_images (id, product_id, image_url, thumbnail_url, source_name, license_status, alt_text, sort_order, approved, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id, params.id, url, url,
        'AI generated — Bikepick',
        'owned',
        `${brandName} ${product.name} — ${color} (AI illustration)`,
        maxSort + 1,
        existing.length === 0 ? 1 : 0,
        now, now,
      ],
    );

    await audit(user, 'product.images.generate', 'product_images', params.id, { model: product.name, color, url });
    return ok({ id, url, color, total: existing.length + 1, max: MAX_IMAGES }, `Generated “${color}” (image ${existing.length + 1} of ${MAX_IMAGES})`);
  } catch (e) {
    if (e instanceof OemImageQuotaError) return fail(e.message, 429);
    return handleError(e);
  }
}

async function nextColor(productId: string, have: number): Promise<string | null> {
  // colours from variants first (they map to real trims), then the model spec sheet
  const vColors: string[] = [];
  const variants = await db.all<any>(
    'SELECT colours FROM product_variants WHERE product_id = ? AND deleted_at IS NULL AND colours IS NOT NULL ORDER BY sort_order, created_at',
    [productId],
  );
  for (const v of variants) {
    for (const c of String(v.colours).split(/[,/|]/)) {
      const c2 = c.trim();
      if (c2 && !vColors.includes(c2)) vColors.push(c2);
    }
  }
  const spec = await db.get<any>('SELECT colours FROM bike_specs WHERE product_id = ? AND variant_id IS NULL', [productId]);
  if (spec?.colours) {
    for (const c of String(spec.colours).split(/[,/|]/)) {
      const c2 = c.trim();
      if (c2 && !vColors.includes(c2)) vColors.push(c2);
    }
  }
  if (!vColors.length) {
    const ev = await db.get<any>('SELECT colours FROM ev_specs WHERE product_id = ? AND variant_id IS NULL', [productId]);
    if (ev?.colours) for (const c of String(ev.colours).split(/[,/|]/)) {
      const c2 = c.trim();
      if (c2 && !vColors.includes(c2)) vColors.push(c2);
    }
  }
  return vColors[have % vColors.length] || null;
}
