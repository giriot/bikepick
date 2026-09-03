'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

type GalleryImage = {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  license_status: string | null;
  source_name: string | null;
};

// The visible caption never shows "AI illustration" wording — only the model + colour.
function displayAlt(alt: string | null): string {
  return (alt || '')
    .replace(/\(AI illustration\)/gi, '')
    .replace(/·\s*AI illustration/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+$/, '')
    .trim();
}

/**
 * Product photo gallery: hero + up to 10 thumbnails, all clickable.
 * Clicking any image opens a full-screen popup with a big view and
 * prev/next navigation through every image.
 */
export function ProductGallery({
  images, isEv, isDemo, brandName, productName,
}: {
  images: GalleryImage[];
  isEv: boolean;
  isDemo: boolean;
  brandName: string;
  productName: string;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const shown = images.slice(0, 10);

  const step = useCallback(
    (dir: 1 | -1) => {
      setLightbox((i) => (i === null ? i : (i + dir + shown.length) % shown.length));
    },
    [shown.length],
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox, step]);

  const active = lightbox !== null ? shown[lightbox] : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setLightbox(0)}
        className="product-stage aspect-[8/5] w-full cursor-zoom-in border border-line"
        aria-label="Open big image view"
      >
        <Image
          src={images[0]?.image_url || `/media/${isEv ? 'ev-scooter' : 'street'}.svg`}
          alt={images[0]?.alt_text || `${brandName} ${productName}`}
          width={880} height={550} priority
          sizes="(max-width: 1024px) 100vw, 620px"
          className="h-full w-full object-contain"
        />
        <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {isEv && <span className="badge-ev">Electric</span>}
          {isDemo && <span className="badge-demo">Demo data</span>}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
          View all ({shown.length})
        </span>
      </button>

      {shown.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {shown.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setLightbox(i)}
                className="product-stage aspect-[4/3] w-full cursor-zoom-in border border-line hover:border-brand-400"
                aria-label={`Open image ${i + 1}: ${img.alt_text || ''}`}
              >
                <Image
                  src={img.thumbnail_url || img.image_url}
                  alt={img.alt_text || ''}
                  width={160} height={120} loading="lazy"
                  className="h-full w-full object-contain"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Big image view"
          onClick={() => setLightbox(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-[13px] font-medium">
              {brandName} {productName} · image {(lightbox ?? 0) + 1} / {shown.length}
            </span>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/20"
            >
              Close ✕
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 pb-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous image"
              className="absolute left-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/25 sm:left-4"
            >
              ‹
            </button>
            <Image
              src={active.image_url}
              alt={active.alt_text || `${brandName} ${productName}`}
              width={1400} height={800}
              className="max-h-[76vh] max-w-full rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next image"
              className="absolute right-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/25 sm:right-4"
            >
              ›
            </button>
          </div>

          <div className="px-4 pb-2 text-center text-[12px] text-white/70" onClick={(e) => e.stopPropagation()}>
            {displayAlt(active.alt_text) || `${brandName} ${productName}`}
            {!/AI illustration/i.test(active.alt_text || '') && active.source_name ? (
              <span className="ml-2 text-white/40">· {active.source_name}</span>
            ) : null}
          </div>

          {/* filmstrip: every image is selectable */}
          <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            {shown.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightbox(i)}
                aria-label={`Image ${i + 1}`}
                className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 ${i === lightbox ? 'border-brand-500' : 'border-white/20 opacity-60 hover:opacity-100'}`}
              >
                <Image src={img.thumbnail_url || img.image_url} alt="" width={64} height={48} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
