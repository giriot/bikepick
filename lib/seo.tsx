import type { Metadata } from 'next';

export const SITE_NAME = 'Bikepick.IN';
export const SITE_TAGLINE = 'Compare Smart. Buy Better.';

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://bikepick.in').replace(/\/$/, '');
}

export function absolute(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

interface SeoInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
  robots?: string;
  keywords?: string[];
}

/** Canonical-first metadata builder used by every important page. */
export function buildMetadata({ title, description, path, image, type = 'website', robots, keywords }: SeoInput): Metadata {
  const url = absolute(path);
  const og = image ? (image.startsWith('http') ? image : absolute(image)) : absolute('/og-default.png');
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: robots || 'index,follow',
    openGraph: {
      title, description, url, siteName: SITE_NAME, type,
      locale: 'en_IN',
      images: [{ url: og, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [og] },
  };
}

export interface Crumb { name: string; url: string }

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name, item: absolute(c.url),
    })),
  };
}

/**
 * Product structured data. Ratings are emitted ONLY when real approved reviews
 * exist — never fabricated to win a rich result.
 */
export function productJsonLd(input: {
  name: string; description: string; brand: string; image?: string | null; url: string;
  price?: number | null; offerCount?: number; reviewCount?: number; ratingValue?: number | null;
  isDemo?: boolean;
}) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    brand: { '@type': 'Brand', name: input.brand },
    url: absolute(input.url),
  };
  if (input.image) data.image = [input.image.startsWith('http') ? input.image : absolute(input.image)];
  // Only publish price offers for verified, non-demo pricing.
  if (input.price && !input.isDemo) {
    data.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.round(input.price),
      offerCount: input.offerCount || 1,
      availability: 'https://schema.org/InStock',
    };
  }
  if (input.reviewCount && input.reviewCount > 0 && input.ratingValue) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(input.ratingValue.toFixed(1)),
      reviewCount: input.reviewCount,
      bestRating: 5, worstRating: 1,
    };
  }
  return data;
}

export function articleJsonLd(input: { title: string; description: string; url: string; published: string; modified: string; author: string; image?: string | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    mainEntityOfPage: absolute(input.url),
    datePublished: input.published,
    dateModified: input.modified,
    author: { '@type': 'Organization', name: input.author },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl() },
    ...(input.image ? { image: [absolute(input.image)] } : {}),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question', name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteUrl(),
    slogan: SITE_TAGLINE,
    description: 'Indian two-wheeler comparison, verified used-bike marketplace and dealer offer platform.',
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
