import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { getRow, tableColumns } from '@/lib/admin-query';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { notify, type NotificationEvent } from '@/lib/notify';
import { getUsedBikeApprovalReadiness, recomputeTrust } from '@/lib/trust-service';
import { promoteUsedBikeImages } from '@/lib/media-staging';

/**
 * Executes a declared workflow transition: writes the status columns, stores the
 * reason where one is required, notifies the affected user, and audits it.
 */
export async function POST(req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  try {
    const resource = getResource(params.resource);
    if (!resource) return fail('Unknown section', 404);

    const body = await readJson<{ action: string; reason?: string }>(req);
    const action = (resource.actions || []).find((a) => a.key === body.action);
    if (!action) return fail('Unknown action', 400);

    const user = await requirePermission(action.permission || resource.permission);

    const row = await getRow(resource, params.id);
    if (!row) return fail('Record not found', 404);
    if (action.when && !action.when.in.includes(String(row[action.when.column]))) {
      return fail(`This action is not available while the record is "${row[action.when.column]}"`, 409);
    }
    if ((action.reasonColumn || action.requiresReason) && (!body.reason || body.reason.trim().length < 5)) {
      return fail(
        action.requiresReason
          ? 'Please give an override reason of at least 5 characters — it will be stored in the audit log'
          : 'Please give a reason of at least 5 characters — the person affected sees it',
        422,
      );
    }

    const cols = await tableColumns(resource.table);
    const set: Record<string, any> = {};
    for (const [k, v] of Object.entries(action.set)) {
      if (!cols.has(k)) continue;
      set[k] = v === '$now' ? nowIso() : v === '$user' ? user.id : v;
    }
    if (action.reasonColumn && cols.has(action.reasonColumn)) set[action.reasonColumn] = body.reason!.trim();

    const isDocumentOverride = resource.key === 'used-bikes' && action.key === 'approve_without_documents';
    if (isDocumentOverride && user.role !== 'admin') return fail('Only an administrator can publish without documents', 403);

    // A listing is not publishable merely because a reviewer clicked a button.
    // Check the private documents and verification records first, then promote
    // the staged photos. Failed promotion leaves the listing unpublished.
    let approvalReadiness: Awaited<ReturnType<typeof getUsedBikeApprovalReadiness>> | null = null;
    if (resource.key === 'used-bikes' && set.status === 'approved') {
      approvalReadiness = await getUsedBikeApprovalReadiness(params.id, {
        allowMissingDocuments: isDocumentOverride,
      });
      if (isDocumentOverride && approvalReadiness.missingDocuments.length === 0) {
        return fail('All required documents are already approved; use the normal Approve & publish action', 409);
      }
      if (!approvalReadiness.ok) return fail(approvalReadiness.message || 'Complete verification before publishing', 422);
      const promoted = await promoteUsedBikeImages(params.id);
      if (promoted.missing || promoted.failed) {
        return fail('Some listing photos could not be prepared for publication. Re-upload them and try again.', 422);
      }
    }

    const keys = Object.keys(set);
    if (keys.length) {
      await db.run(
        `UPDATE ${resource.table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
        [...keys.map((k) => set[k]), nowIso(), params.id],
      );
    }

    // Approving a used listing recomputes its trust score from the current checks.
    if (resource.key === 'used-bikes') await recomputeTrust(params.id);

    if (action.notify && resource.ownerColumn && row[resource.ownerColumn]) {
      const owner = await db.get<any>('SELECT email, phone FROM users WHERE id = ?', [row[resource.ownerColumn]]);
      await notify({
        userId: row[resource.ownerColumn],
        event: action.notify.event as NotificationEvent,
        title: action.notify.title,
        body: action.notifyReason === false ? action.notify.body : body.reason?.trim() || action.notify.body,
        link: resource.key === 'used-bikes'
          ? (set.status === 'approved' ? `/used-bikes/${row.slug}` : '/account/listings')
          : undefined,
        email: owner?.email, phone: owner?.phone,
      });
    }

    await audit(user, `${resource.key}.${action.key}`, resource.table, params.id, {
      reason: body.reason || null,
      ...(isDocumentOverride ? {
        document_override: true,
        missing_documents: approvalReadiness?.missingDocuments || [],
      } : {}),
    });
    return ok({ id: params.id, action: action.key }, `${action.label} done`);
  } catch (e) {
    return handleError(e);
  }
}
