import { NextRequest } from 'next/server';
import { db, insert, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { reviewSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';

/** Reviews are always created as `pending` — moderation is mandatory. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await rateLimit('review', { limit: 5, windowSeconds: 3600, key: user.id });
    if (!limited.ok) return fail('You have submitted several reviews recently. Please try again later.', 429);

    const body = reviewSchema.parse(await readJson(req));
    const product = await db.get<any>("SELECT id FROM products WHERE id = ? AND status='published'", [body.product_id]);
    if (!product) return fail('Product not found', 404);

    const duplicate = await db.get<any>(
      "SELECT id FROM reviews WHERE user_id = ? AND product_id = ? AND deleted_at IS NULL AND status <> 'rejected'",
      [user.id, body.product_id],
    );
    if (duplicate) return fail('You have already reviewed this model', 409);

    const id = await insert('reviews', {
      id: uid('rev'), product_id: body.product_id, user_id: user.id,
      variant_name: body.variant_name || null, rating: body.rating, title: body.title || null,
      pros: body.pros || null, cons: body.cons || null, body: body.body,
      ownership_months: body.ownership_months ?? null, km_driven: body.km_driven ?? null,
      status: 'pending',
    });
    return ok({ id, status: 'pending' }, 'Review submitted for moderation');
  } catch (e) {
    return handleError(e);
  }
}
