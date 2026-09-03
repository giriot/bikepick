import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { storage, assertUploadAllowed, type Bucket } from '@/services/storage';
import { handleError, ok, fail } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { uid } from '@/lib/db';
import { compressImage } from '@/lib/image-compress';

export const runtime = 'nodejs';

const PURPOSES: Record<string, { bucket: Bucket; maxMb: number }> = {
  used_bike_photo: { bucket: 'public-media', maxMb: 4 },
  product_image: { bucket: 'public-media', maxMb: 4 },
  brand_logo: { bucket: 'public-media', maxMb: 2 },
  showroom_image: { bucket: 'public-media', maxMb: 4 },
  dealer_document: { bucket: 'private-docs', maxMb: 10 },
  used_bike_document: { bucket: 'private-docs', maxMb: 10 },
};

/** Authenticated, validated, size-limited uploads. Documents go to private storage. */
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
    const key = `${purpose}/${user.id}/${uid()}.${ext}`;
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    const originalBytes = buffer.length;

    // Automatic background compression for public photos: full HD display
    // (max 1920px wide) + efficient re-encode to cut storage. Original bytes
    // are kept if compression would not help.
    if (config.bucket === 'public-media' && /image\/(jpeg|png|webp)/i.test(file.type)) {
      const compressed = await compressImage(buffer, file.type);
      buffer = compressed.buffer;
      contentType = compressed.contentType;
    }

    const result = await storage().put({ bucket: config.bucket, key, body: buffer, contentType });

    return ok({
      key: result.key,
      url: result.url,          // null for private documents — by design
      private: config.bucket === 'private-docs',
      compressed: buffer.length < originalBytes,
      original_bytes: originalBytes,
      bytes: buffer.length,
    }, 'Uploaded');
  } catch (e) {
    return handleError(e);
  }
}
