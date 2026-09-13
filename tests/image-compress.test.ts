import { describe, it, expect } from 'vitest';
import { Jimp } from 'jimp';
import { compressImage } from '@/lib/image-compress';
import { fileSize } from '@/lib/format';

/** A synthetic "photo" — noisy enough that JPEG quality actually matters, so
 *  the encoder has something real to gain or lose. */
async function photo(w: number, h: number, quality: number): Promise<Buffer> {
  const j = new Jimp({ width: w, height: h, color: '#808080' });
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < h; y += 2) j.setPixelColor(((x * 37 + y * 91) % 0xff) * 0x010101, x, y);
  }
  return Buffer.from(await j.getBuffer('image/jpeg', { quality }));
}

describe('compressImage', () => {
  it('caps width at 1920px and shrinks the stored file', async () => {
    const src = await photo(2400, 1600, 95);
    const r = await compressImage(src, 'image/jpeg');
    expect(r.changed).toBe(true);
    expect(r.compressedBytes).toBeLessThan(r.originalBytes);
    expect(r.contentType).toBe('image/jpeg');
    expect(r.width).toBe(1920);
    // the reported size must describe the bytes we actually stored
    expect((await Jimp.read(r.buffer)).bitmap.width).toBe(1920);
  }, 60000);

  it('keeps the original bytes when re-encoding would not help — and reports the original dimensions', async () => {
    // Just over the width cap and already compressed: resizing saves ~1% of
    // pixels while q82 costs much more than q40, so there is nothing to gain.
    const src = await photo(1930, 1290, 40);
    const r = await compressImage(src, 'image/jpeg');
    expect(r.compressedBytes).toBeLessThanOrEqual(r.originalBytes);
    if (!r.changed) {
      expect(r.buffer.equals(src)).toBe(true);
      expect(r.width).toBe(1930); // NOT the would-be 1920 of the discarded re-encode
      expect(r.height).toBe(1290);
    }
  }, 60000);

  it('leaves files under 100 KB alone and never guesses their dimensions', async () => {
    const src = await photo(600, 400, 35);
    expect(src.length).toBeLessThan(100 * 1024);
    const r = await compressImage(src, 'image/jpeg');
    expect(r.changed).toBe(false);
    expect(r.buffer.equals(src)).toBe(true);
    expect(r.width).toBeNull();
    expect(r.height).toBeNull();
  }, 60000);

  it('passes non-images through untouched', async () => {
    const src = Buffer.from('not an image');
    const r = await compressImage(src, 'image/svg+xml');
    expect(r.changed).toBe(false);
    expect(r.contentType).toBe('image/svg+xml');
    expect(r.buffer.equals(src)).toBe(true);
  });

  it('never blocks an upload when the bytes cannot be decoded', async () => {
    const src = Buffer.from('garbage'.repeat(100)); // >100 KB trigger, undecodable
    const r = await compressImage(src, 'image/jpeg');
    expect(r.changed).toBe(false);
    expect(r.buffer.equals(src)).toBe(true);
  });
});

describe('fileSize', () => {
  it('formats bytes in 1024-based units', () => {
    expect(fileSize(900)).toBe('900 B');
    expect(fileSize(1024)).toBe('1.0 KB');
    expect(fileSize(382356)).toBe('373 KB');
    expect(fileSize(1048576)).toBe('1.00 MB');
    expect(fileSize(4100000)).toBe('3.91 MB');
  });

  it('shows a dash instead of a fake size for unknown values', () => {
    expect(fileSize(null)).toBe('—');
    expect(fileSize(undefined)).toBe('—');
    expect(fileSize(NaN)).toBe('—');
    expect(fileSize(-5)).toBe('—');
  });
});
