import { requireSupabase } from './supabase';

// ─── Client-side image optimization + Supabase Storage upload ───────────────
//
// Pipeline for every upload:
//   1. validate (type, size)
//   2. resize to a sensible max dimension (original is preserved separately —
//      we upload the original bytes first, then the optimized variant)
//   3. compress to WebP (JPEG fallback)
//   4. generate a thumbnail for list cards
//   5. upload to Supabase Storage (bucket chosen by the caller)
//
// The original upload is ALWAYS kept. Server-side background cleanup /
// background-removal is attempted via the `image-process` Edge Function for
// admin bike images; if it fails, the original is used and the listing is
// never blocked.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per file
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadedFile {
  path: string;
  url: string;
  thumbPath?: string;
  thumbUrl?: string;
  width: number;
  height: number;
  size: number;
  mime: string;
}

export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Only JPG, PNG or WebP images are allowed.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Image must be under 10 MB.';
  if (file.size < 1024) return 'Image looks too small/corrupt.';
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image file.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image compression failed.'))),
      mime,
      quality,
    );
  });
}

function drawScaled(img: HTMLImageElement, maxDim: number): { canvas: HTMLCanvasElement; w: number; h: number } {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, w, h };
}

export async function optimizeImage(file: File, maxDim = 1600, quality = 0.85): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  const img = await loadImage(file);
  const { canvas, w, h } = drawScaled(img, maxDim);
  const webp = await canvasToBlob(canvas, 'image/webp', quality).catch(() => null);
  if (webp) return { blob: webp, width: w, height: h, mime: 'image/webp' };
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
  return { blob: jpeg, width: w, height: h, mime: 'image/jpeg' };
}

export async function makeThumbnail(file: File, maxDim = 480): Promise<{ blob: Blob; mime: string } | null> {
  try {
    const img = await loadImage(file);
    const { canvas } = drawScaled(img, maxDim);
    const webp = await canvasToBlob(canvas, 'image/webp', 0.8).catch(() => null);
    if (webp) return { blob: webp, mime: 'image/webp' };
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.8);
    return { blob: jpeg, mime: 'image/jpeg' };
  } catch {
    return null;
  }
}

export async function uploadBytes(
  bucket: string,
  path: string,
  blob: Blob,
  opts: { original?: File } = {},
): Promise<UploadedFile> {
  const sb = requireSupabase();
  const { error } = await sb.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || 'image/webp',
    upsert: false,
  });
  if (error) throw new Error(error.message || 'Upload failed.');
  const { data } = sb.storage.from(bucket).getPublicUrl(path);

  let width = 0;
  let height = 0;
  try {
    const img = await loadImage(opts.original || new File([blob], 'upload.webp', { type: blob.type || 'image/webp' }));
    width = img.naturalWidth;
    height = img.naturalHeight;
  } catch {
    /* dimensions are optional */
  }

  let thumbPath: string | undefined;
  let thumbUrl: string | undefined;
  if (opts.original) {
    const thumb = await makeThumbnail(opts.original, 480);
    if (thumb) {
      const ext = thumb.mime === 'image/webp' ? 'webp' : 'jpg';
      thumbPath = path.replace(/\.[a-z0-9]+$/i, '') + `-thumb.${ext}`;
      const { error: te } = await sb.storage.from(bucket).upload(thumbPath, thumb.blob, {
        contentType: thumb.mime,
        upsert: false,
      });
      if (!te) thumbUrl = sb.storage.from(bucket).getPublicUrl(thumbPath).data.publicUrl;
    }
  }

  return {
    path,
    url: data.publicUrl,
    thumbPath,
    thumbUrl,
    width,
    height,
    size: blob.size,
    mime: blob.type || 'image/webp',
  };
}

export function fileExt(file: File, mime = file.type): string {
  const m = mime.split('/')[1] || 'jpg';
  return m === 'jpeg' ? 'jpg' : m === 'png' ? 'png' : m === 'webp' ? 'webp' : 'jpg';
}

/** Unique storage path under a prefix: prefix/2026-08/abc123.ext */
export function storagePath(prefix: string, ext: string): string {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix.replace(/\/+$/, '')}/${ym}/${rand}.${ext}`;
}
