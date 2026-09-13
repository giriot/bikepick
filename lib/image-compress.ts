/**
 * Automatic image compression for manual uploads.
 *
 * Full HD display: images are kept at up to 1920px wide (looks full HD on
 * any screen) and re-encoded efficiently, which cuts stored file size by a
 * large margin. If compression would make the file BIGGER (already small /
 * already optimized), the original bytes are kept untouched. Content is
 * never altered — only size/format.
 */
export interface CompressResult {
  buffer: Buffer;
  contentType: string;
  originalBytes: number;
  compressedBytes: number;
  changed: boolean;
  /** Final stored dimensions, or null when the file was kept as-is (we did not decode it). */
  width: number | null;
  height: number | null;
}

const MAX_WIDTH = 1920;
const MIN_BYTES_TO_TRY = 100 * 1024; // under 100 KB there is no gain to chase

async function getBuffer(img: any, mime: string, options?: any): Promise<Buffer> {
  const out = img.getBuffer ? img.getBuffer(mime, options) : img.getBufferAsync(mime, options);
  const buf: Buffer = await out;
  return Buffer.from(buf);
}

export async function compressImage(buffer: Buffer, contentType: string): Promise<CompressResult> {
  const result: CompressResult = { buffer, contentType, originalBytes: buffer.length, compressedBytes: buffer.length, changed: false, width: null, height: null };
  if (!/image\/(jpeg|png|webp)/i.test(contentType)) return result;
  if (buffer.length < MIN_BYTES_TO_TRY) return result;

  try {
    const mod: any = await import('jimp');
    const JimpCtor = mod.default?.Jimp || mod.Jimp || mod.default;
    const img = await JimpCtor.fromBuffer(buffer);
    // Dimensions as uploaded — reported whenever we keep the original bytes.
    const srcWidth = img.bitmap.width;
    const srcHeight = img.bitmap.height;
    if (img.width > MAX_WIDTH) img.resize({ w: MAX_WIDTH, limitImage: true });

    let out: Buffer;
    let outMime: string;
    if (contentType === 'image/png') {
      out = await getBuffer(img, 'image/png');
      outMime = 'image/png';
    } else if (contentType === 'image/webp') {
      try {
        out = await getBuffer(img, 'image/webp');
        outMime = 'image/webp';
      } catch {
        return result; // webp encoder unavailable -> keep original
      }
    } else {
      out = await getBuffer(img, 'image/jpeg', { quality: 82 });
      outMime = 'image/jpeg';
    }

    const { width, height } = img.bitmap; // dimensions of the re-encoded bytes
    // Re-encode did not help — keep the original bytes untouched, so the
    // dimensions we report must be the original ones, not the resized ones.
    if (out.length >= buffer.length) return { ...result, width: srcWidth, height: srcHeight };
    return { buffer: out, contentType: outMime, originalBytes: buffer.length, compressedBytes: out.length, changed: true, width, height };
  } catch {
    return result; // decode failure -> keep original, never block the upload
  }
}
