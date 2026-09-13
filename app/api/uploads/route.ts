import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { storage, assertUploadAllowed, stagingKey, type Bucket } from '@/services/storage';
import { handleError, ok, fail } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { uid } from '@/lib/db';
import { compressImage } from '@/lib/image-compress';

export const runtime = 'nodejs';

interface PurposeConfig { bucket: Bucket; maxMb: number; staged?: boolean }

/**
 * Upload purposes. `staged` purposes are written to `private-docs/staging/…`
 * and only become public when the related record is approved (see
 * lib/media-staging.ts). Nothing staged is ever publicly readable.
 */
const PURPOSES: Record<string, PurposeConfig> = {
  used_bike_photo: { bucket: 'private-docs', maxMb: 4, staged: true },
  product_image: { bucket: 'public-media', maxMb: 4 },
  brand_logo: { bucket: 'public-media', maxMb: 2 },
  showroom_image: { bucket: 'public-media', maxMb: 4 },
  dealer_document: { bucket: 'private-docs', maxMb: 10 },
  used_bike_document: { bucket: 'private-docs', maxMb: 10 },
};

/** Authenticated, validated, size-limited uploads. Documents and pre-approval
 *  photos go to private storage; photos are promoted on listing approval. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await rateLimit('upload', { limit: 40, windowSeconds: 600, key: user.id });
    if (!limited.ok) return fail('Too many uploads. Please wait a moment.', 429);

    const form = await req.formData();
    const file = form.get('file');
    const purpose = String(form.get('purpose') || '');
    const config = PURPOSES[purpose];
    if (!config) return fail('Unknown upload purpose');
    if (!(file instanceof File)) return fail('No file received');

    assertUploadAllowed(file.type, file.size, config.maxMb);

    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const filename = `${uid()}.${ext}`;
    const key = config.staged ? stagingKey(purpose, user.id, filename) : `${purpose}/${user.id}/${filename}`;
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    const originalBytes = buffer.length;

    // What the seller's preview caption needs: the real stored size, whether we
    // re-encoded it, and its true dimensions (null when stored as uploaded).
    let compressed = false;
    let width: number | null = null;
    let height: number | null = null;
    // Automatic background compression for photos (public now, or staged for
    // publication on approval): full HD display (max 1920px wide) + efficient
    // re-encode to cut storage. Original bytes are kept if compression would
    // not help.
    if ((config.bucket === 'public-media' || config.staged) && /image\/(jpeg|png|webp)/i.test(file.type)) {
      const comp = await compressImage(buffer, file.type);
      buffer = comp.buffer;
      contentType = comp.contentType;
      compressed = comp.changed;
      width = comp.width;
      height = comp.height;
    }

    const result = await storage().put({ bucket: config.bucket, key, body: buffer, contentType });

    // Staged photos return a short-lived preview URL (signed URL on Supabase,
    // owner/staff-only route locally) instead of a public one — the object is
    // not publicly readable until the listing is approved.
    const url = config.staged ? await storage().getSignedUrl('private-docs', key, 3600) : result.url;

    return ok({
      key: result.key,
      url,                    // preview URL for staged uploads; null for private documents
      private: config.bucket === 'private-docs' && !config.staged,
      staged: Boolean(config.staged),
      compressed,
      original_bytes: originalBytes,
      bytes: buffer.length,
      // Null when the file was stored as-is (tiny / unsupported format), so the
      // UI never shows a dimension it does not actually know.
      width,
      height,
    }, 'Uploaded');
  } catch (e) {
    return handleError(e);
  }
}
