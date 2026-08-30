import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBrands, queryModels } from '../lib/api';
import type { BikeModel, Brand } from '../lib/types';
import { publicImageUrl } from '../lib/api';
import { titleCase } from '../lib/format';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui';

/**
 * /brands — every brand, loaded live from the database (nothing hard-coded).
 */
export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<BikeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [b, m] = await Promise.all([getBrands(), queryModels({ per_page: 200 })]);
        setBrands(b);
        setModels(m.rows);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-black text-ink-900">Bike Brands in India</h1>
      <p className="mb-8 text-sm text-ink-500">
        {brands.length ? `All ${brands.length} brands — click one to see its live and upcoming bikes.` : 'Brands appear here as soon as they are added in the admin panel.'}
      </p>
      {brands.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => {
            const count = models.filter((m) => m.brand_id === b.id && m.is_published && m.status !== 'discontinued').length;
            return (
              <Link
                key={b.id}
                to={`/brands/${b.slug}`}
                className="card group flex items-center gap-4 p-4 transition hover:border-primary-300 hover:shadow-card"
              >
                {b.logo_path && publicImageUrl('brand-images', b.logo_path) ? (
                  <img src={publicImageUrl('brand-images', b.logo_path) || undefined} alt={b.name} className="h-12 w-16 rounded-lg bg-ink-50 object-contain p-1" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-lg font-black text-white">{b.name.charAt(0)}</span>
                )}
                <div>
                  <p className="font-black text-ink-900 group-hover:text-primary-600">{b.name}</p>
                  <p className="text-xs text-ink-400">{b.tagline || titleCase(b.name)} · {count} {count === 1 ? 'bike' : 'bikes'} live</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No brands yet" desc="The catalogue is being loaded in by the admin. Check back soon." />
      )}
    </div>
  );
}
