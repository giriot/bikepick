import { NextRequest, NextResponse } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { handleError } from '@/lib/api';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const row = await db.get<any>('SELECT id, seller_id FROM used_bikes WHERE id = ?', [params.id]);
    const staff = ['admin', 'moderator'].includes(user.role);
    if (!row || (row.seller_id !== user.id && !staff)) {
      return NextResponse.redirect(new URL('/account/listings', req.url), { status: 303 });
    }
    await db.run("UPDATE used_bikes SET status='sold', sold_at=?, updated_at=? WHERE id = ?", [nowIso(), nowIso(), params.id]);
    await audit(user, 'used_bike.mark_sold', 'used_bike', params.id);
    return NextResponse.redirect(new URL('/account/listings', req.url), { status: 303 });
  } catch (e) {
    return handleError(e);
  }
}
