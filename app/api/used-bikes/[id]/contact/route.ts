import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ok, fail, handleError } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { track } from '@/lib/audit';

/** Reveal the registered seller phone only after an explicit public click. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const viewer = await getCurrentUser();
    if (!viewer) return fail('Sign in as a buyer to view seller contact', 401);

    const limited = await rateLimit('used_bike_phone_reveal', { limit: 10, windowSeconds: 600 });
    if (!limited.ok) return fail(`Too many phone-number requests. Try again in ${limited.retryAfter}s.`, 429);

    const seller = await db.get<any>(
      `SELECT b.status, u.id AS seller_id, u.full_name, u.phone
         FROM used_bikes b
         JOIN users u ON u.id = b.seller_id
        WHERE b.id = ? AND b.deleted_at IS NULL AND u.status = 'active'`,
      [params.id],
    );
    if (!seller || seller.status !== 'approved') return fail('Seller contact is unavailable for this listing', 404);
    if (!seller.phone) return fail('The registered seller has not provided a phone number', 404);

    await track('used_bike_phone_revealed', { entity_type: 'used_bike', entity_id: params.id, user_id: viewer.id });
    return ok({ phone: seller.phone, name: seller.full_name || null }, 'Seller contact loaded', {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return handleError(e);
  }
}
