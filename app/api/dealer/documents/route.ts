import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, insert, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  doc_type: z.enum(['gst_certificate', 'trade_licence', 'address_proof', 'pan_card', 'dealership_letter', 'other']),
  file_key: z.string().min(1),
  note: z.string().max(300).optional().or(z.literal('')),
});

/** Records a privately-stored document against the dealer for verification. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const dealer = await db.get<any>('SELECT id FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    if (!dealer) return fail('No dealer profile', 404);

    const b = schema.parse(await readJson(req));
    const id = await insert('dealer_documents', {
      id: uid('doc'), dealer_id: dealer.id, doc_type: b.doc_type,
      storage_key: b.file_key, private: 1, note: b.note || null, status: 'pending',
    });
    await audit(user, 'dealer.upload_document', 'dealer_document', id, { doc_type: b.doc_type });
    return ok({ id }, 'Document uploaded for verification');
  } catch (e) {
    return handleError(e);
  }
}
