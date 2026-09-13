import { NextRequest } from 'next/server';
import { getResource } from '@/lib/admin-config';
import { getRow } from '@/lib/admin-query';
import { requirePermission } from '@/lib/rbac';
import { normalisePayload, updateRow, deleteRow } from '@/lib/admin-write';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { promoteUsedBikeImages } from '@/lib/media-staging';
import { getUsedBikeApprovalReadiness } from '@/lib/trust-service';
import { nowIso } from '@/lib/db';

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

    // A verification result must carry the reviewer and timestamp. Keeping
    // this server-side prevents the browser from manufacturing a completed
    // check or changing the actor identity.
    if (resource.key === 'verifications' && 'result' in data) {
      if (data.result && data.result !== 'not_checked') {
        data.performed_by = user.id;
        data.performed_at = data.performed_at || nowIso();
      } else {
        data.performed_by = null;
        data.performed_at = null;
      }
    }

    if (resource.key === 'used-bikes' && data.status === 'approved' && String(existing.status) !== 'approved') {
      data.approved_at = nowIso();
      data.approved_by = user.id;
    }

    if (resource.key === 'used-bikes' && data.status === 'approved' && String(existing.status) !== 'approved') {
      const readiness = await getUsedBikeApprovalReadiness(params.id);
      if (!readiness.ok) return fail(readiness.message || 'Complete verification before publishing', 422);
      const promoted = await promoteUsedBikeImages(params.id);
      if (promoted.missing || promoted.failed) {
        return fail('Some listing photos could not be prepared for publication. Re-upload them and try again.', 422);
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
