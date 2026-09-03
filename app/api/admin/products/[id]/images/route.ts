import { NextRequest } from 'next/server';
import { db, uid, nowIso } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const MAX_IMAGES = 10;
const LIST_SQL =
  'SELECT id, image_url, thumbnail_url, alt_text, license_status, sort_order, approved, is_primary, created_at ' +
  'FROM product_images WHERE product_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, sort_order, created_at';

async function loadProduct(id: string) {
  return db.get<any>('SELECT id, name, fuel_type FROM products WHERE id = ? AND deleted_at IS NULL', [id]);
}

/** Photos for one product — the "basics" of a listing. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resource = getResource('products');
    await requirePermission(resource?.permission || 'product.write');
    const rows = await db.all<any>(LIST_SQL, [params.id]);
    return ok(rows);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resource = getResource('products');
    const user = await requirePermission(resource?.permission || 'product.write');
    const product = await loadProduct(params.id);
    if (!product) return fail('Product not found', 404);

    const existing = await db.all<any>(LIST_SQL, [params.id]);
    if (existing.length >= MAX_IMAGES) return fail(`Maximum ${MAX_IMAGES} photos per model. Remove one first.`, 422);

    const body = await readJson(req);
    const url = String(body.image_url || '').trim();
    const allowed = url.startsWith('/uploads/') || url.startsWith('/media/') || /^https?:\/\/.+\.(jpe?g|png|webp)(\?|$)/i.test(url);
    if (!allowed) return fail('Use a photo uploaded from this panel (or a .jpg/.png/.webp link).', 422);

    const now = nowIso();
    const id = uid('img_');
    await db.run(
      `INSERT INTO product_images (id, product_id, variant_id, image_url, thumbnail_url, source_name, license_status, alt_text, sort_order, approved, is_primary, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id, product.id, url, url,
        body.source_name ? String(body.source_name).slice(0, 120) : 'Admin upload',
        ['owned', 'licensed', 'press_kit', 'placeholder', 'unknown'].includes(String(body.license_status)) ? String(body.license_status) : 'owned',
        body.alt_text ? String(body.alt_text).slice(0, 200) : null,
        existing.length + 1,
        existing.length === 0 ? 1 : 0,
        now, now,
      ],
    );
    await audit(user, 'product.images.add', 'product_images', id, { product: product.name, image: url });
    return ok({ id }, 'Photo added');
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resource = getResource('products');
    const user = await requirePermission(resource?.permission || 'product.write');
    const body = await readJson(req);
    const imageId = String(body.image_id || '');
    if (!imageId) return fail('Missing image_id', 422);

    const row = await db.get<any>(
      'SELECT id, product_id, is_primary FROM product_images WHERE id = ? AND deleted_at IS NULL', [imageId],
    );
    if (!row || row.product_id !== params.id) return fail('Photo not found', 404);

    if (body.primary) {
      await db.run('UPDATE product_images SET is_primary = 0 WHERE product_id = ? AND deleted_at IS NULL', [params.id]);
      await db.run('UPDATE product_images SET is_primary = 1 WHERE id = ?', [imageId]);
      await audit(user, 'product.images.primary', 'product_images', imageId, { product: params.id });
    }
    return ok({ id: imageId }, 'Photo updated');
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resource = getResource('products');
    const user = await requirePermission(resource?.permission || 'product.write');
    const imageId = req.nextUrl.searchParams.get('image_id') || '';
    if (!imageId) return fail('Missing image_id', 422);

    const row = await db.get<any>(
      'SELECT id, product_id FROM product_images WHERE id = ? AND deleted_at IS NULL', [imageId],
    );
    if (!row || row.product_id !== params.id) return fail('Photo not found', 404);

    await db.run('UPDATE product_images SET deleted_at = ?, is_primary = 0 WHERE id = ?', [nowIso(), imageId]);
    // Promote the next photo to primary so the listing never loses its hero image.
    const next = await db.get<any>(
      'SELECT id FROM product_images WHERE product_id = ? AND deleted_at IS NULL ORDER BY sort_order, created_at LIMIT 1', [params.id],
    );
    if (next) await db.run('UPDATE product_images SET is_primary = 1 WHERE id = ?', [next.id]);

    await audit(user, 'product.images.remove', 'product_images', imageId, { product: params.id });
    return ok({ id: imageId }, 'Photo removed');
  } catch (e) {
    return handleError(e);
  }
}
