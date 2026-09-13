/**
 * Storage abstraction for images and PRIVATE documents.
 *
 *  - Supabase Storage when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY exist
 *  - Local filesystem fallback (public/uploads) for development
 *
 * Buckets:
 *   public-media   -> product/used-bike photos (publicly readable). Used-bike
 *                     photos only land here once a listing is APPROVED — see
 *                     lib/media-staging.ts for the promote-on-approve flow.
 *   private-docs   -> RC, insurance, KYC, dealer documents (never public;
 *                     served only through an authorised admin route), plus
 *                     `staging/` — pre-approval used-bike photos.
 *
 * Staging: seller photos are written to `private-docs/staging/…` and are only
 * copied into `public-media` when a verifier approves the listing. Objects
 * that are never attached to a live listing are reclaimed by the daily
 * `sweep-staging` cron after the configured TTL (default 24 h).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export type Bucket = 'public-media' | 'private-docs';
export interface PutInput { bucket: Bucket; key: string; body: Buffer; contentType: string }
export interface PutResult { key: string; url: string | null }
export interface StoredObject { key: string; createdAt: string; size: number }

export interface StorageProvider {
  name: string;
  configured(): boolean;
  put(input: PutInput): Promise<PutResult>;
  getSignedUrl(bucket: Bucket, key: string, expiresIn?: number): Promise<string | null>;
  read(bucket: Bucket, key: string): Promise<Buffer | null>;
  /** Delete one object. Returns false when the object did not exist. */
  remove(bucket: Bucket, key: string): Promise<boolean>;
  /** List object keys under a prefix (keys are relative to the bucket root). */
  list(bucket: Bucket, prefix: string): Promise<StoredObject[]>;
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']);
export function assertUploadAllowed(contentType: string, size: number, maxMb = 8) {
  if (!ALLOWED.has(contentType)) throw new Error(`Unsupported file type: ${contentType}`);
  if (size > maxMb * 1024 * 1024) throw new Error(`File larger than ${maxMb}MB`);
}

/* ------------------------------ staging keys ----------------------------- */

/** Prefix inside `private-docs` where pre-approval uploads live. */
export const STAGING_PREFIX = 'staging/';

/** `staging/{purpose}/{userId}/{filename}` — the owner id is embedded so both
 *  the uploader (for previews) and the sweeper can attribute every object. */
export function stagingKey(purpose: string, userId: string, filename: string): string {
  return `${STAGING_PREFIX}${purpose}/${userId}/${filename}`;
}

export function isStagingKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && key.startsWith(STAGING_PREFIX) && !key.includes('..');
}

/** True when the key is a staged object that belongs to `userId`. */
export function isOwnStagedKey(key: string | null | undefined, userId: string): boolean {
  return isStagingKey(key) && key.slice(STAGING_PREFIX.length).split('/')[1] === userId;
}

/** Guess a content type from a stored key's extension (images we accept). */
export function contentTypeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'avif': return 'image/avif';
    case 'pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}

/* ------------------------------ local (dev) ------------------------------ */

function localRoot(bucket: Bucket): string {
  return bucket === 'public-media'
    ? path.join(process.cwd(), 'public', 'uploads')
    : path.join(process.cwd(), 'private-uploads');
}

async function walk(dir: string, out: StoredObject[], base: string): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // directory does not exist (yet)
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out, base);
    } else if (entry.isFile()) {
      const stat = await fs.stat(full);
      out.push({
        key: path.relative(base, full).split(path.sep).join('/'),
        createdAt: new Date(stat.birthtimeMs || stat.mtimeMs).toISOString(),
        size: stat.size,
      });
    }
  }
}

const localProvider: StorageProvider = {
  name: 'local',
  configured: () => true,
  async put({ bucket, key, body }) {
    const root = localRoot(bucket);
    const full = path.join(root, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { key, url: bucket === 'public-media' ? `/uploads/${key}` : null };
  },
  async getSignedUrl(bucket, key) {
    if (bucket === 'public-media') return `/uploads/${key}`;
    // Staged photos are previewed through the owner/staff-only route; other
    // private documents keep the admin document route contract.
    if (key.startsWith(STAGING_PREFIX)) return `/api/uploads/preview?key=${encodeURIComponent(key)}`;
    return `/api/admin/documents/${encodeURIComponent(key)}`;
  },
  async read(bucket, key) {
    try {
      return await fs.readFile(path.join(localRoot(bucket), key));
    } catch {
      return null;
    }
  },
  async remove(bucket, key) {
    try {
      await fs.unlink(path.join(localRoot(bucket), key));
      return true;
    } catch (e: any) {
      if (e?.code === 'ENOENT') return false;
      throw e;
    }
  },
  async list(bucket, prefix) {
    const root = localRoot(bucket);
    const out: StoredObject[] = [];
    await walk(path.join(root, prefix), out, root);
    return out.sort((a, b) => a.key.localeCompare(b.key));
  },
};

/* ------------------------------- supabase -------------------------------- */

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
  async remove(bucket, key) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (res.status === 404 || res.status === 400) return false; // already gone
    return res.ok;
  },
  async list(bucket, prefix) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const out: StoredObject[] = [];
    const PAGE = 1000;
    for (let offset = 0; offset < 20 * PAGE; offset += PAGE) {
      const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
      });
      if (!res.ok) throw new Error(`Storage list failed (${res.status})`);
      const items = (await res.json()) as { name: string; created_at?: number; metadata?: { size?: number } }[];
      for (const item of items) {
        out.push({
          key: item.name,
          createdAt: new Date(item.created_at || 0).toISOString(),
          size: item.metadata?.size ?? 0,
        });
      }
      if (items.length < PAGE) break;
    }
    return out;
  },
};

export function storage(): StorageProvider {
  return supabaseProvider.configured() ? supabaseProvider : localProvider;
}
