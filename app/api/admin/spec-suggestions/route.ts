import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const LIST_SQL =
  `SELECT s.id, s.product_id, s.message, s.email, s.status, s.note, s.created_at, s.reviewed_at,
          p.name AS product_name, b.name AS brand_name, b.slug AS brand_slug, p.slug AS product_slug
   FROM spec_suggestions s
   JOIN products p ON p.id = s.product_id
   JOIN brands b ON b.id = p.brand_id
   ORDER BY (s.status = 'pending') DESC, s.created_at DESC
   LIMIT 200`;

const ROWS_SQL =
  `SELECT s.id, s.product_id, s.message, s.email, s.status, s.note, s.created_at, s.reviewed_at,
          p.name AS product_name, b.name AS brand_name, b.slug AS brand_slug, p.slug AS product_slug
   FROM spec_suggestions s
   JOIN products p ON p.id = s.product_id
   JOIN brands b ON b.id = p.brand_id`;

export async function GET(req: NextRequest) {
  try {
    await requirePermission('product.write');
    const status = req.nextUrl.searchParams.get('status') || '';
    const rows = status
      ? await db.all<any>(ROWS_SQL + ` WHERE s.status = ? ORDER BY s.created_at DESC LIMIT 200`, [status])
      : await db.all<any>(LIST_SQL);
    return ok(rows);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission('product.write');
    const body = await readJson(req);
    const id = String(body.id || '');
    const status = String(body.status || '');
    if (!id) return fail('Missing id', 422);
    if (!['pending', 'applied', 'dismissed'].includes(status)) return fail('Invalid status', 422);

    const row = await db.get<any>('SELECT id, product_id, status FROM spec_suggestions WHERE id = ?', [id]);
    if (!row) return fail('Suggestion not found', 404);

    await db.run(
      'UPDATE spec_suggestions SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
      [status, user.id, nowIso(), id],
    );
    await audit(user, `spec_suggestion.${status}`, 'spec_suggestions', id, {});
    return ok({ id }, `Suggestion marked ${status}`);
  } catch (e) {
    return handleError(e);
  }
}
