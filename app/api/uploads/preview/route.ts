import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isStaff } from '@/lib/rbac';
import { storage, isStagingKey, isOwnStagedKey, contentTypeFromKey } from '@/services/storage';
import { fail, handleError } from '@/lib/api';

export const runtime = 'nodejs';

/**
 * Private preview for staged (pre-approval) photos.
 *
 * Staged objects live in `private-docs` and are not publicly readable. The
 * uploader needs to see their own photo in the sell wizard, and staff need to
 * review it — everyone else gets a 403. The public URL only exists after the
 * listing is approved and the photo is promoted to `public-media`.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('Sign in required', 401);

    const key = req.nextUrl.searchParams.get('key') || '';
    if (!isStagingKey(key)) return fail('Unknown file', 404);
    if (!isOwnStagedKey(key, user.id) && !isStaff(user)) return fail('You do not have access to this file', 403);

    const body = await storage().read('private-docs', key);
    if (!body) return fail('File not found', 404);

    return new Response(new Uint8Array(body), {
      headers: {
        'content-type': contentTypeFromKey(key),
        // Short-lived: the Supabase preview URL itself expires, and ownership
        // can change (sweep / reject), so never cache this aggressively.
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
