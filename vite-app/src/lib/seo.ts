import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  jsonLd?: object | object[];
  noIndex?: boolean;
}

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(jsonLd: object | object[] | undefined, id: string) {
  document.head.querySelectorAll(`script[data-jsonld="${id}"]`).forEach((n) => n.remove());
  if (!jsonLd) return;
  const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  items.forEach((obj) => {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.dataset.jsonld = id;
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  });
}

/**
 * Lightweight SEO head manager: title, meta description, canonical,
 * OpenGraph tags, robots noindex, and Schema.org JSON-LD.
 */
export function useSEO(props: SEOProps = {}) {
  const { title, description, canonical, image, jsonLd, noIndex } = props;
  useEffect(() => {
    if (title) document.title = title;
    setMeta('name', 'description', description || null);
    setMeta('property', 'og:title', title || null);
    setMeta('property', 'og:description', description || null);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', image || null);
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : null);
    setLink('canonical', canonical || null);
    setJsonLd(jsonLd, 'page');
  }, [title, description, canonical, image, JSON.stringify(jsonLd), noIndex]);
}

export function bikeJsonLd(m: {
  name: string;
  brand: string;
  price: number | null;
  image?: string | null;
  mileage?: number | null;
  range?: number | null;
  engine?: number | null;
  description?: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${m.brand} ${m.name}`,
    image: m.image || undefined,
    description: m.description || undefined,
    brand: { '@type': 'Brand', name: m.brand },
    ...(m.price
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: m.price,
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
    ...(m.mileage ? { additionalProperty: { '@type': 'PropertyValue', name: 'Mileage', value: `${m.mileage} kmpl` } } : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
