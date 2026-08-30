import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { dateIn } from '@/lib/format';
import { Breadcrumbs } from '@/components/ui';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const ORDER = ['about', 'terms', 'privacy', 'disclaimer', 'editorial-policy', 'affiliate-disclosure', 'used-bike-terms', 'verification-terms', 'cookie-policy', 'refund-policy'];

async function getPage(slug: string) {
  return db.get<any>("SELECT * FROM articles WHERE slug = ? AND category = 'legal' AND published = 1 AND deleted_at IS NULL", [slug]);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPage(params.slug);
  if (!p) return buildMetadata({ title: 'Page not found', description: '', path: `/legal/${params.slug}`, robots: 'noindex,follow' });
  return buildMetadata({ title: p.title, description: p.excerpt, path: `/legal/${p.slug}` });
}

function render(content: string) {
  return content.split(/\n{2,}/).map((block, i) => {
    const t = block.trim();
    if (t.startsWith('## ')) return <h2 key={i} className="mt-8 text-[19px] font-bold tracking-[-0.02em]">{t.slice(3)}</h2>;
    if (t.startsWith('### ')) return <h3 key={i} className="mt-6 text-[16px] font-semibold">{t.slice(4)}</h3>;
    if (/^[-*] /m.test(t)) {
      const items = t.split('\n').filter((l) => /^[-*] /.test(l.trim())).map((l) => l.trim().slice(2));
      return <ul key={i} className="mt-3 space-y-1.5">{items.map((it, j) => (
        <li key={j} className="flex gap-2.5 text-[14px] leading-7 text-ink-soft">
          <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
          <span dangerouslySetInnerHTML={{ __html: bold(it) }} />
        </li>))}</ul>;
    }
    return <p key={i} className="mt-3.5 text-[14px] leading-7 text-ink-soft" dangerouslySetInnerHTML={{ __html: bold(t) }} />;
  });
}

/** Only bold markers are converted; everything else is escaped first. */
function bold(s: string) {
  const escaped = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');
}

export default async function LegalPage({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  const all = await db.all<any>("SELECT title, slug FROM articles WHERE category='legal' AND published=1 AND deleted_at IS NULL");
  const sorted = all.sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug));
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Legal', url: '/legal/terms' }, { name: page.title, url: `/legal/${page.slug}` }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:h-max">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Policies</p>
          <nav className="mt-2 flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
            {sorted.map((p) => (
              <Link key={p.slug} href={`/legal/${p.slug}`} aria-current={p.slug === page.slug ? 'page' : undefined}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-[13px] transition ${
                  p.slug === page.slug ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-soft hover:bg-surface'}`}>
                {p.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <h1 className="text-[28px] font-bold leading-9 tracking-[-0.03em] sm:text-[34px]">{page.title}</h1>
          <p className="mt-2 text-[14px] leading-6 text-ink-mute">{page.excerpt}</p>
          <p className="mt-2 text-[12px] text-ink-mute">Last updated {dateIn(page.updated_at || page.published_at)}</p>
          <div className="mt-2">{render(page.content || '')}</div>
        </article>
      </div>
    </div>
  );
}
