import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { buildAffiliateUrl, recordClick } from '@/services/affiliate';

/**
 * Records the click, then redirects to the affiliate destination. The affiliate
 * URL is never exposed in page markup and every click is auditable.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const link = await db.get<any>("SELECT * FROM affiliate_links WHERE id = ? AND status='active' AND deleted_at IS NULL", [params.id]);
  if (!link) return NextResponse.redirect(new URL('/', req.url));

  const user = await getCurrentUser();
  await recordClick(link, { userId: user?.id, referrer: req.headers.get('referer') });

  const target = await buildAffiliateUrl(link.retailer, link.affiliate_url || link.normal_url);
  if (!target) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.redirect(target, { status: 302 });
}
