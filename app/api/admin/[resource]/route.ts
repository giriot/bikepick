import { NextRequest } from 'next/server';
import { getResource } from '@/lib/admin-config';
import { requirePermission } from '@/lib/rbac';
import { normalisePayload, createRow } from '@/lib/admin-write';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  try {
    const resource = getResource(params.resource);
    if (!resource) return fail('Unknown section', 404);
    if (!resource.canCreate) return fail('This section does not allow creating records', 405);
    const user = await requirePermission(resource.permission);

    const body = await readJson(req);
    const { data, errors } = await normalisePayload(resource, body);
    if (Object.keys(errors).length) return fail('Please correct the highlighted fields', 422, errors);

    const id = await createRow(resource, data, user);
    await audit(user, `${resource.key}.create`, resource.table, id, data);
    return ok({ id }, `${resource.label} created`);
  } catch (e) {
    return handleError(e);
  }
}
