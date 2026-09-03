import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const statics = [
    '', '/bikes', '/electric', '/used-bikes', '/used-bikes/sell', '/compare', '/dealer-offers',
    '/guides', '/reviews', '/find-my-bike', '/tools/ev-vs-petrol', '/tools/emi', '/tools/used-bike-price',
    '/service-centres', '/inspection', '/dealer/register', '/dealer/subscription', '/business/bulk-enquiry',
    '/legal/privacy', '/legal/terms', '/legal/cookies', '/legal/disclaimer', '/legal/affiliate-disclosure',
    '/legal/dealer-terms', '/legal/used-bike-terms', '/legal/verification-terms', '/contact',
  ].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: (p === '' ? 'daily' : 'weekly') as 'daily' | 'weekly',
    priority: p === '' ? 1 : 0.7,
  }));

  const [products, used, articles, comparisons] = await Promise.all([
    db.all<any>(`SELECT p.slug, p.updated_at, p.fuel_type, b.slug AS brand_slug FROM products p JOIN brands b ON b.id = p.brand_id WHERE p.status='published' AND p.deleted_at IS NULL`),
    db.all<any>(`SELECT slug, updated_at FROM used_bikes WHERE status='approved' AND deleted_at IS NULL`),
    db.all<any>(`SELECT slug, updated_at FROM articles WHERE published=1 AND deleted_at IS NULL`),
    db.all<any>(`SELECT slug, updated_at FROM comparisons WHERE slug IS NOT NULL`),
  ]);

  return [
    ...statics,
    ...products.map((p) => ({
      url: `${base}/${p.fuel_type === 'electric' ? 'electric' : 'bikes'}/${encodeURIComponent(p.brand_slug)}/${encodeURIComponent(p.slug)}`,
      lastModified: new Date(p.updated_at), changeFrequency: 'weekly' as const, priority: 0.9,
    })),
    ...used.map((u) => ({ url: `${base}/used-bikes/${u.slug}`, lastModified: new Date(u.updated_at), changeFrequency: 'daily' as const, priority: 0.6 })),
    ...articles.map((a) => ({ url: `${base}/guides/${a.slug}`, lastModified: new Date(a.updated_at), changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...comparisons.map((c) => ({ url: `${base}/compare/${c.slug}`, lastModified: new Date(c.updated_at), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
