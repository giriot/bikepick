import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { getRow } from '@/lib/admin-query';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail } from '@/lib/api';
import { audit } from '@/lib/audit';

/**
 * Undo a soft delete. Only works on tables that use soft deletion
 * (they must have a deleted_at column) and only on records that are
 * actually deleted — a live record is left exactly as it is.
 */
export async function POST(_req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  try {
    const resource = getResource(params.resource);
    if (!resource) return fail('Unknown section', 404);
    if (!resource.softDelete) return fail('This section does not use soft delete — nothing to restore', 405);
    const user = await requirePermission(resource.permission);

    const row = await getRow(resource, params.id);
    if (!row) return fail('Record not found', 404);
    if (!row.deleted_at) return fail('This record is not deleted — nothing to restore', 409);

    await db.run(`UPDATE ${resource.table} SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [nowIso(), params.id]);
    await audit(user, `${resource.key}.restore`, resource.table, params.id, { deleted_at: row.deleted_at });
    return ok({ id: params.id }, `${resource.label} restored`);
  } catch (e) {
    return handleError(e);
  }
}
