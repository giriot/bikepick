import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.all<any>(
      "SELECT * FROM notifications WHERE user_id = ? AND channel='in_app' ORDER BY created_at DESC LIMIT 50",
      [user.id],
    );
    return ok(rows);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const { id } = await req.json();
    if (id) await db.run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?', [nowIso(), id, user.id]);
    else await db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [nowIso(), user.id]);
    return ok({ done: true });
  } catch (e) {
    return handleError(e);
  }
}
