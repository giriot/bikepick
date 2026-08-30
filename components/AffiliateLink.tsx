'use client';

import { inr } from '@/lib/format';

interface Link {
  id: string; title: string; retailer: string; price: number | null;
  accessory_type: string | null; image_url: string | null;
}

/**
 * Affiliate outbound link. The click is recorded server-side through
 * /api/affiliate/[id] which then redirects — so click analytics are real and
 * the affiliate URL is never exposed in the markup.
 */
export function AffiliateLink({ link }: { link: Link }) {
  return (
    <a
      href={`/api/affiliate/${link.id}`}
      rel="nofollow sponsored noopener"
      target="_blank"
      className="card card-hover flex items-center gap-3 p-3"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-ink-mute" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 7h12l-1 13H7L6 7Zm3 0a3 3 0 1 1 6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{link.title}</span>
        <span className="block text-[11.5px] text-ink-mute">{link.retailer} · {link.price ? inr(link.price) : 'price at retailer'}</span>
      </span>
      <span className="badge-sponsored shrink-0">Affiliate</span>
    </a>
  );
}
