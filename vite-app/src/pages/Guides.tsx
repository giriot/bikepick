import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getArticles } from '../lib/api';
import type { Article } from '../lib/types';
import { titleCase } from '../lib/format';
import { useSEO } from '../lib/seo';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui';

/**
 * /guides — published guides & articles from the database.
 */
export default function GuidesPage() {
  const [rows, setRows] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState('');

  useSEO({ title: 'Buying Guides & Tips', description: 'Honest, practical guides to choosing bikes in India — petrol vs electric, first bike checklists, used-bike tips.' });

  useEffect(() => {
    (async () => {
      try {
        setRows(await getArticles({ category: cat || undefined }));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [cat]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  const cats = Array.from(new Set(rows.map((r) => r.category).filter(Boolean)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-black text-ink-900">Guides & Help</h1>
      <p className="mb-6 text-sm text-ink-500">Practical, no-hype help for choosing a bike. Written to be useful, not to sell you anything.</p>

      {cats.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => setCat('')} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${!cat ? 'border-primary-600 bg-primary-600 text-white' : 'border-ink-200 bg-white text-ink-600'}`}>All</button>
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${cat === c ? 'border-primary-600 bg-primary-600 text-white' : 'border-ink-200 bg-white text-ink-600'}`}>
              {titleCase(c)}
            </button>
          ))}
        </div>
      )}

      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => (
            <Link key={a.id} to={`/guides/${a.slug}`} className="card group flex flex-col p-5 transition hover:border-primary-300 hover:shadow-card">
              <span className="mb-2 w-fit rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-ink-500">{titleCase(a.category)}</span>
              <h2 className="font-black leading-snug text-ink-900 group-hover:text-primary-600">{a.title}</h2>
              {a.subtitle && <p className="mt-1.5 text-sm text-ink-500">{a.subtitle}</p>}
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-600">{a.body.replace(/[#*>\n]+/g, ' ').slice(0, 160)}…</p>
              <span className="mt-4 text-xs font-black text-primary-600">Read guide →</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Guides are on the way"
          desc="Published guides appear here. Meanwhile, the “Help me choose” wizard on the homepage walks you through picking a bike step by step."
          action={<Link to="/" className="mt-4 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">Try the wizard</Link>}
        />
      )}
    </div>
  );
}
