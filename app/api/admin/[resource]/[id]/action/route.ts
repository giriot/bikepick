import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { getRow, tableColumns } from '@/lib/admin-query';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { notify, type NotificationEvent } from '@/lib/notify';
import { recomputeTrust } from '@/lib/trust-service';

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
    if (action.reasonColumn && (!body.reason || body.reason.trim().length < 5)) {
      return fail('Please give a reason of at least 5 characters — the person affected sees it', 422);
    }

    const cols = await tableColumns(resource.table);
    const set: Record<string, any> = {};
    for (const [k, v] of Object.entries(action.set)) {
      if (!cols.has(k)) continue;
      set[k] = v === '$now' ? nowIso() : v === '$user' ? user.id : v;
    }
    if (action.reasonColumn && cols.has(action.reasonColumn)) set[action.reasonColumn] = body.reason!.trim();

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
        body: body.reason?.trim() || action.notify.body,
        email: owner?.email, phone: owner?.phone,
      });
    }

    await audit(user, `${resource.key}.${action.key}`, resource.table, params.id, { reason: body.reason || null });
    return ok({ id: params.id, action: action.key }, `${action.label} done`);
  } catch (e) {
    return handleError(e);
  }
}
