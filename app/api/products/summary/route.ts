import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Compact product info for the compare tray. */
export async function GET(req: NextRequest) {
  try {
    const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
    if (!ids.length) return ok([]);
    const rows = await db.all<any>(
      `SELECT p.id, p.name, b.name AS brand_name,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.approved = 1 ORDER BY pi.is_primary DESC LIMIT 1) AS image
         FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE p.id IN (${ids.map(() => '?').join(',')}) AND p.status = 'published' AND p.deleted_at IS NULL`,
      ids,
    );
    return ok(rows.map((r) => ({ id: r.id, label: `${r.brand_name} ${r.name}`, image: r.image })));
  } catch (e) {
    return handleError(e);
  }
}
