import { NextRequest } from 'next/server';
import { db, uid, nowIso } from '@/lib/db';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/**
 * Public endpoint: a visitor reports a missing or wrong specification.
 * Nothing is published from this — entries land in the admin review queue.
 * Anonymous allowed (no login required), rate limited per IP.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit('spec_suggest', { limit: 5, windowSeconds: 3600 });
    if (!limited.ok) return fail('Too many suggestions from your connection. Please try again in an hour.', 429);

    const body = await readJson(req);
    const productId = String(body.product_id || '').trim();
    const message = String(body.message || '').trim();
    const email = body.email ? String(body.email).trim() : '';

    if (!productId) return fail('Missing product', 422);
    if (message.length < 5) return fail('Please describe the missing or wrong specification (at least 5 characters).', 422);
    if (message.length > 300) return fail('Please keep it under 300 characters.', 422);
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120)) {
      return fail('Please enter a valid email address or leave it blank.', 422);
    }

    const product = await db.get<any>(
      'SELECT id, name, slug FROM products WHERE id = ? AND status = \'published\' AND deleted_at IS NULL',
      [productId],
    );
    if (!product) return fail('Product not found', 404);

    const id = uid('sug_');
    const now = nowIso();
    await db.run(
      'INSERT INTO spec_suggestions (id, product_id, message, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, \'pending\', ?, ?)',
      [id, product.id, message, email || null, now, now],
    );

    return ok({ id }, 'Thank you — our team will verify this and update the page if correct. Only verified values are published.');
  } catch (e) {
    return handleError(e);
  }
}
