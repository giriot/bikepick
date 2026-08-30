import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, insert, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ok, fail, handleError, readJson } from '@/lib/api';

const schema = z.object({
  product_id: z.string().min(1).optional(),
  used_bike_id: z.string().min(1).optional(),
  note: z.string().max(300).optional(),
}).refine((v) => !!(v.product_id || v.used_bike_id), { message: 'Nothing to save' });

/** Saves or un-saves a model / used listing for the signed-in user. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await readJson(req));

    const existing = await db.get<any>(
      'SELECT id FROM saved_products WHERE user_id = ? AND COALESCE(product_id, \'\') = ? AND COALESCE(used_bike_id, \'\') = ?',
      [user.id, body.product_id || '', body.used_bike_id || ''],
    );
    if (existing) {
      await db.run('DELETE FROM saved_products WHERE id = ?', [existing.id]);
      return ok({ saved: false }, 'Removed from your saved list');
    }

    if (body.product_id) {
      const p = await db.get<any>('SELECT id FROM products WHERE id = ? AND deleted_at IS NULL', [body.product_id]);
      if (!p) return fail('That model no longer exists', 404);
    }
    if (body.used_bike_id) {
      const u = await db.get<any>('SELECT id FROM used_bikes WHERE id = ? AND deleted_at IS NULL', [body.used_bike_id]);
      if (!u) return fail('That listing no longer exists', 404);
    }

    await insert('saved_products', {
      id: uid('sav'), user_id: user.id,
      product_id: body.product_id || null, used_bike_id: body.used_bike_id || null,
      note: body.note || null,
    });
    return ok({ saved: true }, 'Saved');
  } catch (e) {
    return handleError(e);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.all<any>(
      `SELECT s.id, s.note, s.created_at,
              p.name AS product_name, p.slug AS product_slug, p.fuel_type, b.slug AS brand_slug, b.name AS brand,
              u.brand_name, u.model_name, u.slug AS used_slug, u.asking_price
         FROM saved_products s
         LEFT JOIN products p ON p.id = s.product_id
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN used_bikes u ON u.id = s.used_bike_id
        WHERE s.user_id = ? ORDER BY s.created_at DESC`,
      [user.id],
    );
    return ok(rows);
  } catch (e) {
    return handleError(e);
  }
}
