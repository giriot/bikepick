import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/ratelimit';
import { handleError, ok, fail } from '@/lib/api';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const limited = await rateLimit('used_bike_delete', { limit: 10, windowSeconds: 3600, key: user.id });
    if (!limited.ok) return fail('Too many delete requests. Please try again later.', 429);

    const listing = await db.get<any>(
      'SELECT id, seller_id, status FROM used_bikes WHERE id = ? AND deleted_at IS NULL',
      [params.id],
    );
    if (!listing) return fail('Listing not found', 404);
    if (listing.seller_id !== user.id) return fail('You can only delete your own listing', 403);

    const deletedAt = nowIso();
    await db.run('UPDATE used_bikes SET deleted_at = ?, updated_at = ? WHERE id = ?', [deletedAt, deletedAt, listing.id]);
    await audit(user, 'used_bike.delete', 'used_bike', listing.id, { previous_status: listing.status });
    return ok({ id: listing.id }, 'Listing deleted');
  } catch (e) {
    return handleError(e);
  }
}
