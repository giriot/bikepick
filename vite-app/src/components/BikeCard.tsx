import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BikeModel } from '../lib/types';
import { inrRange, kmpl, kmRange, fuelShort, cc } from '../lib/format';
import { useApp } from '../context/AppContext';
import { publicImageUrl } from '../lib/api';
import { getImages } from '../lib/api';
import { HeartIcon, ScaleIcon, RatingStars } from './ui';

/**
 * Bike card used across listings. Image falls back gracefully:
 * processed → original → neutral placeholder. Never blocks rendering.
 */
export default function BikeCard({ model, offersCount, image }: { model: BikeModel; offersCount?: number; image?: { path: string; bucket: string } | null }) {
  const { hasFav, toggleFav, hasCompare, addCompare, removeCompare } = useApp();
  const navigate = useNavigate();
  const to = `/new-bikes/${model.brand_slug}/${model.slug}`;
  const saved = hasFav('bike', model.id);
  const comparing = hasCompare(model.id);
  const img = image
    ? publicImageUrl(image.bucket || 'bike-images', image.path)
    : null;

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:shadow-lift">
      <Link to={to} className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-ink-100 to-ink-200">
        {img ? (
          <img src={img} alt={`${model.brand_name} ${model.name}`} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-ink-300">
            <svg className="h-16 w-16" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 40c0-8 6-14 14-14h10l6-8h8l-7 10c4 3 6 8 6 12" />
              <circle cx="18" cy="44" r="7" />
              <circle cx="46" cy="44" r="7" />
              <path d="M25 44h14" />
            </svg>
          </span>
        )}
        <span className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-ink-900/85 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">{fuelShort(model.fuel_type)}</span>
          {model.status === 'upcoming' && <span className="rounded-full bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-white">Upcoming</span>}
          {model.status === 'outdated' && <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">Outdated</span>}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleFav('bike', model.id);
          }}
          aria-label={saved ? 'Remove from saved' : 'Save bike'}
          className={`absolute right-3 top-3 rounded-full p-2 shadow transition ${saved ? 'bg-red-500 text-white' : 'bg-white/90 text-ink-500 hover:text-red-500'}`}
        >
          <HeartIcon filled={saved} className="h-4 w-4" />
        </button>
        {offersCount !== undefined && offersCount > 0 && (
          <span className="absolute bottom-3 left-3 rounded-full bg-primary-600 px-2.5 py-1 text-[11px] font-bold text-white">
            {offersCount} dealer offer{offersCount > 1 ? 's' : ''}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{model.brand_name}</p>
            <Link to={to} className="text-base font-bold text-ink-900 hover:text-primary-600">
              {model.name}
            </Link>
          </div>
          {model.rating_avg != null && model.review_count ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-ink-700">
              <RatingStars value={model.rating_avg} size="h-3.5 w-3.5" /> {model.rating_avg.toFixed(1)}
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-lg font-extrabold text-ink-900">{inrRange(model.price_start, model.price_end)}</p>

        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-ink-600">
          {model.fuel_type === 'electric' ? (
            <Chip label={`Range ${kmRange(model.range_km)}`} />
          ) : (
            <Chip label={kmpl(model.mileage_kmpl)} />
          )}
          {model.engine_cc ? <Chip label={cc(model.engine_cc)} /> : null}
          {model.body_type ? <Chip label={model.body_type} /> : null}
          {model.abs_enabled ? <Chip label="ABS" /> : null}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-ink-100 pt-3">
          <Link to={to} className="flex-1 rounded-lg bg-ink-900 px-3 py-2 text-center text-sm font-bold text-white hover:bg-ink-700">
            View Details
          </Link>
          <button
            onClick={() => (comparing ? removeCompare(model.id) : addCompare(model.id))}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-bold transition ${comparing ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-ink-300 text-ink-700 hover:border-ink-400'}`}
            aria-label={comparing ? 'Remove from compare' : 'Add to compare'}
          >
            <ScaleIcon className="h-4 w-4" />
            {comparing ? 'Added' : 'Compare'}
          </button>
        </div>
        {offersCount !== undefined && offersCount > 0 && (
          <button onClick={() => navigate(`${to}#offers`)} className="mt-2 text-left text-xs font-bold text-primary-600 hover:underline">
            See {offersCount} dealer offer{offersCount > 1 ? 's' : ''} →
          </button>
        )}
      </div>
    </article>
  );
}

export function Chip({ label }: { label: string }) {
  return <span className="rounded-md bg-ink-100 px-2 py-1">{label}</span>;
}

/** Fetch the primary image (or first) for a set of models, keyed by id. */
export async function loadModelImages(models: BikeModel[]): Promise<Record<string, { path: string; bucket: string } | null>> {
  const out: Record<string, { path: string; bucket: string } | null> = {};
  if (!models.length) return out;
  try {
    const sb = (await import('../lib/supabase')).requireSupabase();
    const { data } = await sb
      .from('bike_images')
      .select('bike_model_id, storage_path, original_path, processed_path, bucket, is_primary, sort_order, processing_status')
      .in('bike_model_id', models.map((m) => m.id))
      .order('is_primary', { ascending: false })
      .order('sort_order');
    for (const row of data || []) {
      const bid = row.bike_model_id as string;
      if (out[bid]) continue;
      const path = (row.processing_status !== 'failed' && row.processed_path) || row.original_path || row.storage_path;
      out[bid] = { path: path as string, bucket: (row.bucket as string) || 'bike-images' };
    }
  } catch {
    /* images are optional */
  }
  for (const m of models) if (!(m.id in out)) out[m.id] = null;
  return out;
}
