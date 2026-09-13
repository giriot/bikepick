import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  STAGING_PREFIX, stagingKey, isStagingKey, isOwnStagedKey, contentTypeFromKey, storage,
} from '@/services/storage';
import { selectSweepCandidates, promotedKey, STAGING_KEEP_STATUSES } from '@/lib/media-staging';

describe('staging keys', () => {
  const key = stagingKey('used_bike_photo', 'usr_123', 'abc.jpg');

  it('embeds purpose, owner and filename under the staging prefix', () => {
    expect(key).toBe('staging/used_bike_photo/usr_123/abc.jpg');
    expect(key.startsWith(STAGING_PREFIX)).toBe(true);
  });

  it('recognises staging keys and rejects everything else', () => {
    expect(isStagingKey(key)).toBe(true);
    expect(isStagingKey('used_bike_photo/usr_123/abc.jpg')).toBe(false); // missing prefix
    expect(isStagingKey('https://cdn.example.com/staging/x.jpg')).toBe(false);
    expect(isStagingKey('staging/../private-docs/secret.pdf')).toBe(false); // traversal
    expect(isStagingKey('')).toBe(false);
    expect(isStagingKey(null)).toBe(false);
    expect(isStagingKey(undefined)).toBe(false);
  });

  it('attributes ownership by the embedded user id', () => {
    expect(isOwnStagedKey(key, 'usr_123')).toBe(true);
    expect(isOwnStagedKey(key, 'usr_999')).toBe(false);
    expect(isOwnStagedKey('not-staged.jpg', 'usr_123')).toBe(false);
  });

  it('maps extensions to content types', () => {
    expect(contentTypeFromKey('staging/x/a.jpeg')).toBe('image/jpeg');
    expect(contentTypeFromKey('staging/x/a.jpg')).toBe('image/jpeg');
    expect(contentTypeFromKey('staging/x/a.png')).toBe('image/png');
    expect(contentTypeFromKey('staging/x/a.webp')).toBe('image/webp');
    expect(contentTypeFromKey('staging/x/a.pdf')).toBe('application/pdf');
    expect(contentTypeFromKey('staging/x/a.bin')).toBe('application/octet-stream');
  });

  it('promotes into a stable per-listing public path', () => {
    expect(promotedKey('usd_1', key)).toBe('used_bike_photo/usd_1/abc.jpg');
    expect(promotedKey('usd_1', 'staging/used_bike_photo/usr_1/noext')).toBe('used_bike_photo/usd_1/noext');
  });
});

describe('sweep candidate selection', () => {
  const cutoff = '2026-09-12T12:00:00.000Z';
  const objects = [
    { key: 'staging/used_bike_photo/u1/old-orphan.jpg', createdAt: '2026-09-10T09:00:00.000Z', size: 100 },
    { key: 'staging/used_bike_photo/u1/fresh-orphan.jpg', createdAt: '2026-09-13T09:00:00.000Z', size: 100 },
    { key: 'staging/used_bike_photo/u2/referenced.jpg', createdAt: '2026-09-01T09:00:00.000Z', size: 100 },
    { key: 'staging/used_bike_photo/u2/exactly-at-cutoff.jpg', createdAt: cutoff, size: 100 },
  ];
  const protectedKeys = new Set(['staging/used_bike_photo/u2/referenced.jpg']);

  it('removes only objects that are both old and unreferenced', () => {
    const due = selectSweepCandidates(objects, protectedKeys, cutoff);
    expect(due.map((o) => o.key)).toEqual(['staging/used_bike_photo/u1/old-orphan.jpg']);
  });

  it('keeps fresh objects and anything at/after the cutoff', () => {
    const due = selectSweepCandidates(objects, new Set(), cutoff);
    expect(due.map((o) => o.key)).toEqual([
      'staging/used_bike_photo/u1/old-orphan.jpg',
      'staging/used_bike_photo/u2/referenced.jpg',
    ]);
  });

  it('keeps photos of in-flight listings regardless of age', () => {
    const due = selectSweepCandidates(
      objects,
      new Set([
        'staging/used_bike_photo/u1/old-orphan.jpg',
        'staging/used_bike_photo/u2/referenced.jpg',
      ]),
      cutoff,
    );
    expect(due).toHaveLength(0);
  });

  it('defines the in-flight statuses that protect staged photos', () => {
    // Terminal statuses (rejected / expired / sold) must NOT protect, so their
    // staged photos become reclaimable; every review-in-progress status must.
    expect(STAGING_KEEP_STATUSES).toContain('verification_required');
    expect(STAGING_KEEP_STATUSES).toContain('under_review');
    expect(STAGING_KEEP_STATUSES).toContain('needs_more_info');
    expect(STAGING_KEEP_STATUSES).not.toContain('rejected');
    expect(STAGING_KEEP_STATUSES).not.toContain('expired');
    expect(STAGING_KEEP_STATUSES).not.toContain('sold');
  });
});

describe('local provider staged round-trip (dev fallback)', () => {
  const originalCwd = process.cwd();
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-staging-'));
    process.chdir(tmp); // local provider roots are relative to cwd
  });
  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('puts, lists, reads and removes a staged object without exposing it publicly', async () => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return; // supabase mode
    const store = storage();
    const key = stagingKey('used_bike_photo', 'usr_1', 'roundtrip.jpg');

    const put = await store.put({ bucket: 'private-docs', key, body: Buffer.from('photo-bytes'), contentType: 'image/jpeg' });
    expect(put.url).toBeNull(); // staged objects never get a public URL

    const listed = await store.list('private-docs', STAGING_PREFIX);
    expect(listed.map((o) => o.key)).toContain(key);
    expect(listed.find((o) => o.key === key)!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const body = await store.read('private-docs', key);
    expect(body?.toString()).toBe('photo-bytes');

    expect(await store.remove('private-docs', key)).toBe(true);
    expect(await store.remove('private-docs', key)).toBe(false); // idempotent
    expect(await store.list('private-docs', STAGING_PREFIX)).toHaveLength(0);

    // Preview URLs point at the authorised route, never at /uploads.
    const preview = await store.getSignedUrl('private-docs', key);
    expect(preview).toContain('/api/uploads/preview?key=');
  });
});
