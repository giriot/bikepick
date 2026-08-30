/**
 * Storage abstraction for images and PRIVATE documents.
 *
 *  - Supabase Storage when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY exist
 *  - Local filesystem fallback (public/uploads) for development
 *
 * Buckets:
 *   public-media   -> product/used-bike photos (publicly readable)
 *   private-docs   -> RC, insurance, KYC, dealer documents (never public;
 *                     served only through an authorised admin route)
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export type Bucket = 'public-media' | 'private-docs';
export interface PutInput { bucket: Bucket; key: string; body: Buffer; contentType: string }
export interface PutResult { key: string; url: string | null }

export interface StorageProvider {
  name: string;
  configured(): boolean;
  put(input: PutInput): Promise<PutResult>;
  getSignedUrl(bucket: Bucket, key: string, expiresIn?: number): Promise<string | null>;
  read(bucket: Bucket, key: string): Promise<Buffer | null>;
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']);
export function assertUploadAllowed(contentType: string, size: number, maxMb = 8) {
  if (!ALLOWED.has(contentType)) throw new Error(`Unsupported file type: ${contentType}`);
  if (size > maxMb * 1024 * 1024) throw new Error(`File larger than ${maxMb}MB`);
}

const localProvider: StorageProvider = {
  name: 'local',
  configured: () => true,
  async put({ bucket, key, body }) {
    const root = bucket === 'public-media'
      ? path.join(process.cwd(), 'public', 'uploads')
      : path.join(process.cwd(), 'private-uploads');
    const full = path.join(root, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { key, url: bucket === 'public-media' ? `/uploads/${key}` : null };
  },
  async getSignedUrl(bucket, key) {
    return bucket === 'public-media' ? `/uploads/${key}` : `/api/admin/documents/${encodeURIComponent(key)}`;
  },
  async read(bucket, key) {
    const root = bucket === 'public-media'
      ? path.join(process.cwd(), 'public', 'uploads')
      : path.join(process.cwd(), 'private-uploads');
    try {
      return await fs.readFile(path.join(root, key));
    } catch {
      return null;
    }
  },
};

const supabaseProvider: StorageProvider = {
  name: 'supabase',
  configured: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  async put({ bucket, key, body, contentType }) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': contentType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(body),
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    return { key, url: bucket === 'public-media' ? `${base}/storage/v1/object/public/${bucket}/${key}` : null };
  },
  async getSignedUrl(bucket, key, expiresIn = 300) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (bucket === 'public-media') return `${base}/storage/v1/object/public/${bucket}/${key}`;
    const res = await fetch(`${base}/storage/v1/object/sign/${bucket}/${key}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expiresIn }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { signedURL?: string };
    return json.signedURL ? `${base}/storage/v1${json.signedURL}` : null;
  },
  async read(bucket, key) {
    const url = await this.getSignedUrl(bucket, key, 60);
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  },
};

export function storage(): StorageProvider {
  return supabaseProvider.configured() ? supabaseProvider : localProvider;
}
