import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getModelsAdmin } from '../lib/api-admin';
import { ScaleIcon } from './ui';

/**
 * Sticky bottom tray showing bikes the user added to the comparison
 * (max 4). The Compare page itself is excluded.
 */
export default function CompareTray() {
  const { compareIds, removeCompare, clearCompare } = useApp();
  const { pathname } = useLocation();
  const [models, setModels] = useState<{ id: string; name: string; brand_name: string; brand_slug: string; slug: string; image_url: string | null }[]>([]);

  useEffect(() => {
    if (!compareIds.length) {
      setModels([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const rows = await getModelsAdmin({ ids: compareIds });
        if (!alive) return;
        setModels(
          rows.map((m) => ({
            id: m.id,
            name: m.name,
            brand_name: m.brand_name || '',
            brand_slug: m.brand_slug || '',
            slug: m.slug,
            image_url: m.primary_image_url,
          })),
        );
      } catch {
        if (alive) setModels([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [compareIds]);

  if (!compareIds.length || pathname.startsWith('/compare') || pathname.startsWith('/admin')) return null;

  return (
    <div className="fixed inset-x-0 bottom-14 z-40 border-t border-ink-200 bg-white/95 shadow-lift backdrop-blur md:bottom-0">
      <div className="container-x flex items-center gap-3 py-2.5">
        <span className="hidden shrink-0 text-xs font-bold uppercase tracking-wide text-ink-400 sm:block">
          Compare <span className="text-ink-900">{compareIds.length}</span>/4
        </span>
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {models.map((m) => (
            <span key={m.id} className="flex shrink-0 items-center gap-2 rounded-full border border-ink-200 bg-white py-1 pl-1 pr-2 text-xs font-semibold text-ink-700">
              {m.image_url ? (
                <img src={m.image_url} alt="" className="h-7 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-9 items-center justify-center rounded-full bg-ink-100 text-[10px]">{m.brand_name?.slice(0, 1)}</span>
              )}
              {m.brand_name} {m.name}
              <button onClick={() => removeCompare(m.id)} className="rounded-full p-0.5 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${m.name}`}>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
        <button onClick={clearCompare} className="shrink-0 text-xs font-bold text-ink-400 hover:text-red-600">
          Clear
        </button>
        <Link
          to="/compare"
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white transition ${compareIds.length >= 2 ? 'bg-primary-600 hover:bg-primary-700' : 'pointer-events-none bg-ink-300'}`}
        >
          <ScaleIcon className="h-4 w-4" />
          Compare{compareIds.length >= 2 ? ` (${compareIds.length})` : ' (min 2)'}
        </Link>
      </div>
    </div>
  );
}
