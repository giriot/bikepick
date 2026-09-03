import { NextRequest } from 'next/server';
import { db, uid, nowIso } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { storage } from '@/services/storage';
import { pullBrandLogo } from '@/lib/oem-logo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

/**
 * Pulls the brand's logo from the official OEM website (or a given URL),
 * converts it to black & white, stores it and sets it as the brand logo.
 * Manual upload (Brand logo box) always overrides this.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resource = getResource('brands');
    const user = await requirePermission(resource?.permission || 'product.write');
    const brand = await db.get<any>('SELECT id, name, official_website FROM brands WHERE id = ? AND deleted_at IS NULL', [params.id]);
    if (!brand) return fail('Brand not found', 404);

    const body = await readJson(req).catch(() => ({}));
    const url = (body.url ? String(body.url).trim() : brand.official_website || '').replace(/^\/\//, 'https://');
    if (!/^https?:\/\//i.test(url)) return fail('No official website URL to pull from — set the brand’s official website first, or paste a URL.', 422);

    const { buffer, sourceUrl } = await pullBrandLogo(url);

    const key = `brand_logo/${brand.id}/${uid()}.png`;
    const put = await storage().put({ bucket: 'public-media', key, body: buffer, contentType: 'image/png' });
    const logoUrl = put.url || `https://fcqznkvftybzjygjfvwa.supabase.co/storage/v1/object/public/public-media/${key}`;

    await db.run(
      'UPDATE brands SET logo_url = ?, logo_source = ?, updated_at = ? WHERE id = ?',
      [logoUrl, 'OEM website (auto-pulled, black & white)', nowIso(), brand.id],
    );

    await audit(user, 'brand.logo.pull', 'brands', brand.id, { brand: brand.name, sourceUrl, logoUrl });
    return ok({ logoUrl, sourceUrl, official: url }, 'Logo pulled from the OEM website and converted to black & white');
  } catch (e: any) {
    if (e?.message && /logo|Logo/.test(e.message)) return fail(e.message, 502);
    return handleError(e);
  }
}
