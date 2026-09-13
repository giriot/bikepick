import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, nowIso } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  note: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission('used_bike.review');
    const document = await db.get<any>('SELECT id, used_bike_id, status FROM used_bike_documents WHERE id = ?', [params.id]);
    if (!document) return fail('Document not found', 404);

    const body = schema.parse(await readJson(req));
    const reviewed = body.status === 'pending' ? { reviewedBy: null, reviewedAt: null } : { reviewedBy: user.id, reviewedAt: nowIso() };
    await db.run(
      'UPDATE used_bike_documents SET status = ?, note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?',
      [body.status, body.note || null, reviewed.reviewedBy, reviewed.reviewedAt, nowIso(), params.id],
    );
    await audit(user, 'used_bike.document_review', 'used_bike_document', params.id, {
      used_bike_id: document.used_bike_id,
      from: document.status,
      to: body.status,
    });
    return ok({ id: params.id, status: body.status }, 'Document status updated');
  } catch (e) {
    return handleError(e);
  }
}
