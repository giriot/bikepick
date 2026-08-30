import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db, nowIso } from '@/lib/db';
import { dateIn } from '@/lib/format';
import { Breadcrumbs } from '@/components/ui';
import { AdSlot } from '@/components/AdSlot';
import { buildMetadata, breadcrumbJsonLd, articleJsonLd, JsonLd, absolute } from '@/lib/seo';

export const dynamic = 'force-dynamic';

async function getArticle(slug: string) {
  return db.get<any>('SELECT * FROM articles WHERE slug = ? AND published = 1 AND deleted_at IS NULL', [slug]);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = await getArticle(params.slug);
  if (!a) return buildMetadata({ title: 'Guide not found', description: 'This guide is not available.', path: `/guides/${params.slug}`, robots: 'noindex,follow' });
  return buildMetadata({ title: a.title, description: a.excerpt, path: `/guides/${a.slug}`, image: a.cover_image, type: 'article' });
}

/** Renders the stored Markdown-ish content without a third-party parser. */
function renderBody(content: string) {
  const blocks = content.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const t = block.trim();
    if (t.startsWith('### ')) return <h3 key={i} className="mt-7 text-[17px] font-semibold tracking-[-0.01em]">{t.slice(4)}</h3>;
    if (t.startsWith('## ')) return <h2 key={i} className="mt-9 text-[21px] font-bold tracking-[-0.02em]">{t.slice(3)}</h2>;
    if (t.startsWith('> ')) return <blockquote key={i} className="mt-5 border-l-3 border-brand-400 bg-brand-50/60 px-4 py-3 text-[14px] italic leading-7 text-ink-soft">{t.slice(2)}</blockquote>;
    if (/^[-*] /m.test(t)) {
      const items = t.split('\n').filter((l) => /^[-*] /.test(l.trim())).map((l) => l.trim().slice(2));
      return <ul key={i} className="mt-4 space-y-2">{items.map((it, j) => (
        <li key={j} className="flex gap-2.5 text-[14.5px] leading-7 text-ink-soft">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />{it}
        </li>))}</ul>;
    }
    if (/^\d+\. /m.test(t)) {
      const items = t.split('\n').filter((l) => /^\d+\. /.test(l.trim())).map((l) => l.trim().replace(/^\d+\.\s*/, ''));
      return <ol key={i} className="mt-4 space-y-2">{items.map((it, j) => (
        <li key={j} className="flex gap-2.5 text-[14.5px] leading-7 text-ink-soft">
          <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{j + 1}</span>{it}
        </li>))}</ol>;
    }
    return <p key={i} className="mt-4 text-[14.5px] leading-7 text-ink-soft">{t}</p>;
  });
}

export default async function GuidePage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) notFound();

  await db.run('UPDATE articles SET view_count = view_count + 1, updated_at = ? WHERE id = ?', [nowIso(), article.id]);
  const related = await db.all<any>(
    'SELECT title, slug, excerpt FROM articles WHERE published = 1 AND deleted_at IS NULL AND id <> ? ORDER BY (category = ?) DESC, published_at DESC LIMIT 3',
    [article.id, article.category],
  );

  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Guides', url: '/guides' }, { name: article.title, url: `/guides/${article.slug}` }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={articleJsonLd({
        title: article.title, description: article.excerpt, url: absolute(`/guides/${article.slug}`),
        published: article.published_at, modified: article.updated_at, author: article.author_name || 'Bikepick Editorial',
        image: article.cover_image,
      })} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          <span className="badge bg-brand-50 text-brand-700">{(article.category || 'guide').replace(/_/g, ' ')}</span>
          <h1 className="mt-3 text-[28px] font-bold leading-9 tracking-[-0.03em] sm:text-[36px] sm:leading-[44px]">{article.title}</h1>
          <p className="mt-3 text-[15px] leading-7 text-ink-mute">{article.excerpt}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-line py-3 text-[12.5px] text-ink-mute">
            <span className="font-medium text-ink">{article.author_name || 'Bikepick Editorial'}</span>
            <span>·</span><span>{dateIn(article.published_at)}</span>
            <span>·</span><span>{article.reading_minutes} min read</span>
          </div>

          {article.cover_image && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.cover_image} alt="" className="w-full" />
            </div>
          )}

          <div className="mt-2">{renderBody(article.content || '')}</div>

          <div className="mt-8"><AdSlot slotKey="article_mid" /></div>

          <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
            <p className="text-[13px] leading-6 text-ink-mute">
              <strong className="text-ink">Editorial policy.</strong> Bikepick guides are written independently. Dealers and
              advertisers cannot pay to appear in, or be removed from, our editorial content, and paid placements never affect
              the Bikepick Score. Read our <Link href="/legal/editorial-policy" className="underline">editorial policy</Link>.
            </p>
          </div>
        </article>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-[14px] font-semibold">Keep reading</h2>
            <ul className="mt-3 space-y-3.5">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/guides/${r.slug}`} className="text-[13.5px] font-medium leading-5 hover:text-brand-700">{r.title}</Link>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-ink-mute">{r.excerpt}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="card bg-gradient-to-br from-brand-50 to-white p-5">
            <p className="text-[14px] font-semibold">Not sure which bike?</p>
            <p className="mt-1 text-[12.5px] leading-5 text-ink-mute">Answer five questions and we will shortlist models that fit your budget and riding.</p>
            <Link href="/find-my-bike" className="btn-primary btn-sm mt-3 w-full">Find my bike</Link>
          </div>
          <AdSlot slotKey="product_sidebar" />
        </aside>
      </div>
    </div>
  );
}
