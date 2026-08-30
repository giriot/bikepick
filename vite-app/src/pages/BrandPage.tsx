import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBrands, queryModels, publicImageUrl } from '../lib/api';
import type { BikeModel, Brand } from '../lib/types';
import { LoadingBlock, ErrorBlock } from '../components/ui';
import BikeCard from '../components/BikeCard';
import { useSEO } from '../lib/seo';

/**
 * /brands/:slug — brand profile page (description, logo, all its bikes).
 */
export default function BrandPage() {
  const { slug } = useParams();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [models, setModels] = useState<BikeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = await getBrands();
        const b = all.find((x) => x.slug === slug) || null;
        if (!active) return;
        if (!b) {
          setLoading(false);
          return;
        }
        setBrand(b);
        const res = await queryModels({ brand_id: b.id, per_page: 100 });
        if (active) setModels(res.rows);
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

  useSEO({
    title: brand ? `${brand.name} Bikes — Prices, Models & Comparison | ${brand.name}` : undefined,
    description: brand?.description || (brand ? `Compare ${brand.name} bikes: full specs, prices, mileage and dealer offers.` : undefined),
    canonical: brand ? `${window.location.origin}/brands/${slug}` : undefined,
  });

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (!brand)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-ink-900">Brand not found</h1>
        <p className="mt-2 text-sm text-ink-500">This brand doesn't exist (yet). Browse all brands instead.</p>
        <Link to="/brands" className="mt-5 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">All brands</Link>
      </div>
    );

  const logoUrl = brand.logo_path ? publicImageUrl('brand-images', brand.logo_path) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-4 text-xs text-ink-400">
        <Link to="/" className="hover:text-primary-600">Home</Link> <span className="mx-1">/</span>
        <Link to="/brands" className="hover:text-primary-600">Brands</Link> <span className="mx-1">/</span>
        <span className="text-ink-600">{brand.name}</span>
      </nav>

      <div className="mb-8 flex flex-wrap items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt={brand.name} className="h-16 w-24 rounded-xl bg-ink-50 object-contain p-2" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-900 text-3xl font-black text-white">{brand.name.charAt(0)}</span>
        )}
        <div>
          <h1 className="text-3xl font-black text-ink-900">{brand.name}</h1>
          <p className="text-sm text-ink-500">{brand.tagline || `${models.length} bike{models.length === 1 ? '' : 's'} in the CompareBike catalogue`}</p>
        </div>
      </div>

      {brand.description && (
        <p className="mb-8 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-600">{brand.description}</p>
      )}

      {models.length ? (
        <>
          <h2 className="mb-4 text-lg font-black text-ink-900">{brand.name} bikes</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {models.map((m) => (
              <BikeCard key={m.id} model={m} />
            ))}
          </div>
        </>
      ) : (
        <div className="card p-10 text-center">
          <p className="font-black text-ink-900">No {brand.name} bikes in the catalogue yet</p>
          <p className="mt-1 text-sm text-ink-500">Models are added in the admin panel. Browse other brands meanwhile.</p>
          <Link to="/brands" className="mt-4 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">All brands</Link>
        </div>
      )}
    </div>
  );
}
