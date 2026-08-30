import 'server-only';
import { db, insert, nowIso, uid } from '@/lib/db';
import { getJsonSetting, getSetting } from '@/lib/settings';

/**
 * Affiliate abstraction.
 *
 * No affiliate network API is called and no tracking pixel is embedded. A link is
 * simply the retailer URL the owner pasted, with their own tracking parameter
 * appended from Settings. Clicks are counted in our database, so commissions can
 * be reconciled against the retailer's own dashboard.
 */

export interface AffiliateTagConfig {
  /** e.g. { amazon: { param: 'tag', value: 'bikepick-21' } } */
  [retailer: string]: { param: string; value: string };
}

export async function getTagConfig(): Promise<AffiliateTagConfig> {
  return getJsonSetting<AffiliateTagConfig>('affiliate_tags', {});
}

/** Appends the owner's tracking parameter for that retailer, if one is configured. */
export async function buildAffiliateUrl(retailer: string | null, url: string | null): Promise<string | null> {
  if (!url) return null;
  const config = await getTagConfig();
  const entry = retailer ? config[retailer.toLowerCase()] : undefined;
  if (!entry?.param || !entry?.value) return url;
  try {
    const u = new URL(url);
    u.searchParams.set(entry.param, entry.value);
    return u.toString();
  } catch {
    return url; // malformed URLs are passed through untouched rather than mangled
  }
}

export async function recordClick(link: {
  id: string; product_id: string | null; retailer: string | null;
}, ctx: { userId?: string | null; referrer?: string | null } = {}) {
  await insert('affiliate_clicks', {
    id: uid('clk'),
    affiliate_link_id: link.id,
    product_id: link.product_id || null,
    user_id: ctx.userId || null,
    retailer: link.retailer || null,
    referrer: ctx.referrer?.slice(0, 300) || null,
  });
  await db.run('UPDATE affiliate_links SET click_count = click_count + 1, updated_at = ? WHERE id = ?', [nowIso(), link.id]);
}

export async function getDisclosure(): Promise<string> {
  return (
    (await getSetting('affiliate_disclosure')) ||
    'Some links on this page are affiliate links. If you buy through them we may earn a small commission at no extra cost to you. This never affects Bikepick Scores, rankings or recommendations.'
  );
}

export async function affiliateLinksForProduct(productId: string) {
  const rows = await db.all<any>(
    "SELECT * FROM affiliate_links WHERE product_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY price IS NULL, price ASC",
    [productId],
  );
  return rows;
}
