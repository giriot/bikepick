import { NextRequest } from 'next/server';
import { getCurrentUser, AuthError } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { storage, contentTypeFromKey } from '@/services/storage';
import { fail, handleError } from '@/lib/api';

export const runtime = 'nodejs';

/** Streams a private seller/dealer document to authorised staff only. */
export async function GET(_req: NextRequest, { params }: { params: { key: string[] } }) {
  try {
    const user = await getCurrentUser();
    if (!user || (!can(user, 'document.read') && !can(user, 'used_bike.review') && !can(user, 'dealer.review'))) {
      throw new AuthError('You do not have access to this document', 403);
    }

    const raw = Array.isArray(params.key) ? params.key.join('/') : String(params.key || '');
    let key = raw;
    try { key = decodeURIComponent(raw); } catch { /* keep the already-decoded path */ }
    if (!key || key.includes('..') || key.startsWith('/')) return fail('Unknown document', 404);

    const [usedBikeDocument, dealerDocument] = await Promise.all([
      db.get<any>('SELECT id FROM used_bike_documents WHERE storage_key = ?', [key]),
      db.get<any>('SELECT id FROM dealer_documents WHERE storage_key = ?', [key]),
    ]);
    if (!usedBikeDocument && !dealerDocument) return fail('Document not found', 404);

    const body = await storage().read('private-docs', key);
    if (!body) return fail('Document file not found', 404);

    return new Response(new Uint8Array(body), {
      headers: {
        'content-type': contentTypeFromKey(key),
        'content-disposition': 'inline',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
