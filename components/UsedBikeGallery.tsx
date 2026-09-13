'use client';

import { useState } from 'react';
import Image from 'next/image';

type UsedBikeGalleryImage = {
  id: string;
  angle: string;
  image_url: string;
};

export function UsedBikeGallery({
  images,
  brandName,
  modelName,
  isElectric,
  isDemo,
}: {
  images: UsedBikeGalleryImage[];
  brandName: string;
  modelName: string;
  isElectric: boolean;
  isDemo: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const active = images[activeIndex] || images[0];
  const fallback = `/media/${isElectric ? 'ev-scooter' : 'street'}.svg`;

  function select(index: number) {
    setActiveIndex(index);
    setLightboxIndex(null);
  }

  function step(direction: 1 | -1) {
    if (!images.length) return;
    setLightboxIndex((current) => {
      const from = current ?? activeIndex;
      const next = (from + direction + images.length) % images.length;
      setActiveIndex(next);
      return next;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => active && setLightboxIndex(activeIndex)}
        className="product-stage aspect-[8/5] w-full cursor-zoom-in border border-line"
        aria-label={active ? `Open ${active.angle} image` : 'Bike image'}
      >
        <Image
          key={active?.id || fallback}
          src={active?.image_url || fallback}
          alt={active ? `${brandName} ${modelName} ${active.angle} view` : `${brandName} ${modelName}`}
          width={880}
          height={550}
          priority
          sizes="(max-width: 1024px) 100vw, 620px"
          className="h-full w-full object-contain"
        />
        <span className="absolute left-3 top-3 flex gap-1.5">
          {isElectric && <span className="badge-ev">Electric</span>}
          {isDemo && <span className="badge-demo">Demo listing</span>}
        </span>
        {active && <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">{active.angle} · View all ({images.length})</span>}
      </button>

      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Bike photo thumbnails">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => select(index)}
                aria-label={`Select ${image.angle} image`}
                aria-pressed={index === activeIndex}
                className={`product-stage aspect-[4/3] w-full border-2 ${index === activeIndex ? 'border-brand-500 ring-2 ring-brand-200' : 'border-line hover:border-brand-400'}`}
              >
                <Image src={image.image_url} alt={`${image.angle} thumbnail`} width={160} height={120} loading="lazy" className="h-full w-full object-contain" />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-white/90 px-1 text-[9px] uppercase tracking-wide text-ink-mute">{image.angle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightboxIndex !== null && images[lightboxIndex] && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Big bike image" onClick={() => setLightboxIndex(null)}>
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(event) => event.stopPropagation()}>
            <span className="text-[13px] font-medium">{brandName} {modelName} · image {lightboxIndex + 1} / {images.length}</span>
            <button type="button" onClick={() => setLightboxIndex(null)} className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/20">Close ✕</button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 pb-4" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => step(-1)} aria-label="Previous image" className="absolute left-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/25 sm:left-4">‹</button>
            <Image
              key={images[lightboxIndex].id}
              src={images[lightboxIndex].image_url}
              alt={`${brandName} ${modelName} ${images[lightboxIndex].angle} view`}
              width={1400}
              height={900}
              className="max-h-[76vh] max-w-full rounded-lg object-contain"
            />
            <button type="button" onClick={() => step(1)} aria-label="Next image" className="absolute right-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/25 sm:right-4">›</button>
          </div>
          <div className="pb-3 text-center text-[12px] capitalize text-white/70">{images[lightboxIndex].angle} view</div>
        </div>
      )}
    </div>
  );
}
