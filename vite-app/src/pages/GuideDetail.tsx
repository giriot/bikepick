import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getArticleBySlug } from '../lib/api';
import type { Article } from '../lib/types';
import { titleCase, formatDate } from '../lib/format';
import { useSEO } from '../lib/seo';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/ui';

/**
 * /guides/:slug — article view. Body is plain text with simple line breaks,
 * headings (#) and lists (-) rendered conservatively (no dangerouslySetInnerHTML).
 */
export default function GuideDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const a = await getArticleBySlug(slug || '');
        if (active) setArticle(a);
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
    title: article ? `${article.title} | Guide` : undefined,
    description: article?.seo_description || article?.subtitle || undefined,
    canonical: article ? `${window.location.origin}/guides/${article.slug}` : undefined,
  });

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;
  if (!article)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-ink-900">Guide not found</h1>
        <Link to="/guides" className="mt-5 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-black text-white hover:bg-primary-700">All guides</Link>
      </div>
    );

  const lines = (article.body || '').split('\n');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-5 text-xs text-ink-400">
        <Link to="/" className="hover:text-primary-600">Home</Link> <span className="mx-1">/</span>
        <Link to="/guides" className="hover:text-primary-600">Guides</Link> <span className="mx-1">/</span>
        <span className="text-ink-600">{article.title}</span>
      </nav>

      <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-ink-500">{titleCase(article.category)}</span>
      <h1 className="mt-3 text-3xl font-black leading-tight text-ink-900">{article.title}</h1>
      {article.subtitle && <p className="mt-2 text-lg text-ink-500">{article.subtitle}</p>}
      {article.published_at && <p className="mt-2 text-xs text-ink-400">Published {formatDate(article.published_at)}</p>}

      <div className="prose-bike mt-7">
        {lines.map((ln, i) => {
          const t = ln.trim();
          if (!t) return <div key={i} className="h-3" />;
          if (t.startsWith('## ')) return <h2 key={i} className="mb-2 mt-7 text-xl font-black text-ink-900">{t.slice(3)}</h2>;
          if (t.startsWith('# ')) return <h2 key={i} className="mb-2 mt-7 text-2xl font-black text-ink-900">{t.slice(2)}</h2>;
          if (t.startsWith('- ') || t.startsWith('* ')) return <p key={i} className="my-1 flex gap-2 pl-1 text-[15px] leading-relaxed text-ink-700"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />{t.slice(2)}</p>;
          return <p key={i} className="my-3 text-[15px] leading-relaxed text-ink-700">{t}</p>;
        })}
      </div>

      <div className="mt-10 rounded-xl bg-ink-50 p-5 text-sm text-ink-600">
        <p className="font-black text-ink-900">Still choosing?</p>
        <p className="mt-1">Use the <Link to="/" className="font-bold text-primary-600 hover:underline">Help me choose</Link> wizard to get a shortlist with scores, or <Link to="/new-bikes" className="font-bold text-primary-600 hover:underline">browse all bikes</Link>.</p>
      </div>
    </div>
  );
}
