import { NextRequest } from 'next/server';
import { getResource } from '@/lib/admin-config';
import { getRow } from '@/lib/admin-query';
import { requirePermission } from '@/lib/rbac';
import { normalisePayload, updateRow, deleteRow } from '@/lib/admin-write';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

export async function PATCH(req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  try {
    const resource = getResource(params.resource);
    if (!resource) return fail('Unknown section', 404);
    const user = await requirePermission(resource.permission);

    const existing = await getRow(resource, params.id);
    if (!existing) return fail('Record not found', 404);

    const body = await readJson(req);
    const { data, errors } = await normalisePayload(resource, body);
    if (Object.keys(errors).length) return fail('Please correct the highlighted fields', 422, errors);

    // pros/cons/best_for are intentionally NOT part of the product form (the
    // boxes were removed from the UI), but the AI template panel saves them —
    // accept them explicitly here so that save is real, not a silent no-op.
    if (resource.key === 'products') {
      for (const k of ['pros', 'cons', 'best_for']) {
        if (k in body) data[k] = body[k] === null || body[k] === '' ? null : String(body[k]);
      }
    }

    // Record only what actually changed, for a meaningful audit trail.
    const changed: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (String(existing[k] ?? '') !== String(v ?? '')) changed[k] = { from: existing[k] ?? null, to: v };
    }

    await updateRow(resource, params.id, data);
    await audit(user, `${resource.key}.update`, resource.table, params.id, changed);
    return ok({ id: params.id, changed: Object.keys(changed) }, 'Saved');
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  try {
    const resource = getResource(params.resource);
    if (!resource) return fail('Unknown section', 404);
    if (!resource.canDelete) return fail('This section does not allow deleting records', 405);
    const user = await requirePermission(resource.permission);

    const existing = await getRow(resource, params.id);
    if (!existing) return fail('Record not found', 404);

    await deleteRow(resource, params.id);
    await audit(user, `${resource.key}.delete`, resource.table, params.id, { soft: !!resource.softDelete });
    return ok({ id: params.id }, `${resource.label} deleted`);
  } catch (e) {
    return handleError(e);
  }
}
