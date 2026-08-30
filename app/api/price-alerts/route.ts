import { NextRequest } from 'next/server';
import { db, insert, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { priceAlertSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = priceAlertSchema.parse(await readJson(req));

    const product = await db.get<any>("SELECT id FROM products WHERE id = ? AND status='published'", [body.product_id]);
    if (!product) return fail('Product not found', 404);

    const existing = await db.get<any>(
      "SELECT id FROM price_alerts WHERE user_id = ? AND product_id = ? AND status='active'",
      [user.id, body.product_id],
    );
    if (existing) {
      await db.run('UPDATE price_alerts SET target_price = ?, city = ? WHERE id = ?', [body.target_price, body.city || null, existing.id]);
      return ok({ id: existing.id }, 'Price alert updated');
    }

    const id = await insert('price_alerts', {
      id: uid('alr'), user_id: user.id, product_id: body.product_id,
      variant_id: body.variant_id || null, city: body.city || null,
      target_price: body.target_price, status: 'active',
    });
    return ok({ id }, 'Price alert created');
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return fail('Missing alert id');
    await db.run("UPDATE price_alerts SET status='cancelled' WHERE id = ? AND user_id = ?", [id, user.id]);
    return ok({ id }, 'Alert cancelled');
  } catch (e) {
    return handleError(e);
  }
}
