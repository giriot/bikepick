import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, insert, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isOwnPrivateUploadKey } from '@/services/storage';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  doc_type: z.enum(['identity', 'rc', 'insurance', 'loan_noc', 'service_history', 'other']),
  file_key: z.string().min(1),
  note: z.string().max(300).optional().or(z.literal('')),
});

/**
 * Attach a privately uploaded document to a seller's own used-bike listing.
 * The file is uploaded first through /api/uploads and is never made public.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const listing = await db.get<any>(
      'SELECT id, seller_id, status FROM used_bikes WHERE id = ? AND deleted_at IS NULL',
      [params.id],
    );
    if (!listing) return fail('Listing not found', 404);
    if (listing.seller_id !== user.id) return fail('You can only upload documents for your own listing', 403);
    if (['sold', 'expired'].includes(String(listing.status))) return fail('This listing is no longer accepting documents', 409);

    const body = schema.parse(await readJson(req));
    if (!isOwnPrivateUploadKey(body.file_key, 'used_bike_document', user.id)) {
      return fail('Please upload the document through this form before attaching it', 422);
    }

    const id = await insert('used_bike_documents', {
      id: uid('udoc'),
      used_bike_id: listing.id,
      doc_type: body.doc_type,
      storage_key: body.file_key,
      private: 1,
      status: 'pending',
      note: body.note || null,
    });

    await audit(user, 'used_bike.upload_document', 'used_bike_document', id, {
      used_bike_id: listing.id,
      doc_type: body.doc_type,
    });
    return ok({ id }, 'Document uploaded for verification');
  } catch (e) {
    return handleError(e);
  }
}
