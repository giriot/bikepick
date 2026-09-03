import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSeoPages } from '../lib/api';
import type { SeoPage } from '../lib/types';
import { useSEO } from '../lib/seo';
import { ErrorBlock, LoadingBlock } from '../components/ui';
import { formatDate } from '../lib/format';

/**
 * /legal/:slug — legal & policy pages, editable from the admin panel.
 * Routes: privacy-policy, terms-of-service, cookie-policy, disclaimer,
 *         affiliate-disclosure, refund-policy, shipping-policy, ip-policy
 */
const TITLES: Record<string, string> = {
  'privacy-policy': 'Privacy Policy',
  'terms-of-service': 'Terms of Service',
  'cookie-policy': 'Cookie Policy',
  disclaimer: 'Disclaimer',
  'affiliate-disclosure': 'Affiliate Disclosure',
  'refund-policy': 'Refund Policy',
  'shipping-policy': 'Shipping Policy',
  'ip-policy': 'Intellectual Property Policy',
};

export default function LegalPage() {
  const { slug } = useParams();
  const [page, setPage] = useState<SeoPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = await getSeoPages();
        const found = all.find((p) => p.slug === slug) || null;
        if (active) setPage(found);
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const title = page?.title || TITLES[slug || ''] || 'Policy';
  useSEO({ title: `${title} | CompareBike`, description: page?.meta_description || undefined, canonical: slug ? `${window.location.origin}/legal/${slug}` : undefined });

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  const paragraphs = (page?.body || '').split(/\n\s*\n/);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black text-ink-900">{title}</h1>
      {page && <p className="mt-1 text-xs text-ink-400">Last updated: {formatDate(page.updated_at)}</p>}
      <div className="mt-6">
        {page ? (
          paragraphs.map((p, i) => (
            <p key={i} className="my-4 whitespace-pre-line text-[15px] leading-relaxed text-ink-700">
              {p}
            </p>
          ))
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <p className="font-bold">This page is being prepared.</p>
            <p className="mt-1">
              The full {title.toLowerCase()} will be published here once the site owner completes it from the admin panel. In the meantime, contact us via{' '}
              <a href="/contact" className="font-bold underline">/contact</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
