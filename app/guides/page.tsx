import Link from 'next/link';
import { db } from '@/lib/db';
import { dateIn } from '@/lib/format';
import { Breadcrumbs, Empty } from '@/components/ui';
import { AdSlot } from '@/components/AdSlot';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Buying Guides & Ownership Advice',
  description: 'Practical, jargon-free guides on choosing, buying, financing and maintaining two-wheelers in India — written by the Bikepick editorial team.',
  path: '/guides',
});

export default async function GuidesPage({ searchParams }: { searchParams: { category?: string } }) {
  const category = searchParams.category;
  const rows = await db.all<any>(
    `SELECT id, title, slug, excerpt, category, cover_image, reading_minutes, published_at, author_name
       FROM articles WHERE published = 1 AND deleted_at IS NULL ${category ? 'AND category = ?' : ''}
      ORDER BY published_at DESC`,
    category ? [category] : [],
  );
  const cats = await db.all<any>('SELECT DISTINCT category FROM articles WHERE published = 1 AND deleted_at IS NULL AND category IS NOT NULL ORDER BY category');
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Guides', url: '/guides' }];
  const [lead, ...rest] = rows;

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Guides & advice</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          No sponsored verdicts, no affiliate-driven recommendations. Just what we would tell a friend before they spend a lakh.
        </p>
      </header>

      <nav className="mt-5 flex flex-wrap gap-2">
        <Link href="/guides" className={`chip ${!category ? 'chip-active' : ''}`}>All guides</Link>
        {cats.map((c) => (
          <Link key={c.category} href={`/guides?category=${encodeURIComponent(c.category)}`}
            className={`chip ${category === c.category ? 'chip-active' : ''}`}>{c.category.replace(/_/g, ' ')}</Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="mt-6"><Empty title="No guides here yet" body="Try another category, or browse all guides." /></div>
      ) : (
        <>
          <Link href={`/guides/${lead.slug}`} className="card card-hover mt-6 grid gap-0 overflow-hidden md:grid-cols-[1.1fr_1fr]">
            <div className="aspect-[16/10] bg-surface md:aspect-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lead.cover_image || '/media/placeholder-article.svg'} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col justify-center p-6">
              <span className="badge w-max bg-brand-50 text-brand-700">{(lead.category || 'guide').replace(/_/g, ' ')}</span>
              <h2 className="mt-2.5 text-[22px] font-bold leading-7 tracking-[-0.02em]">{lead.title}</h2>
              <p className="mt-2 text-[13.5px] leading-6 text-ink-mute">{lead.excerpt}</p>
              <p className="mt-3 text-[12px] text-ink-mute">{lead.author_name} · {dateIn(lead.published_at)} · {lead.reading_minutes} min read</p>
            </div>
          </Link>

          <div className="mt-4"><AdSlot slotKey="article_mid" /></div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <Link key={a.id} href={`/guides/${a.slug}`} className="card card-hover overflow-hidden">
                <div className="aspect-[16/9] bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.cover_image || '/media/placeholder-article.svg'} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <span className="badge bg-surface text-ink-mute">{(a.category || 'guide').replace(/_/g, ' ')}</span>
                  <h3 className="mt-2 text-[15px] font-semibold leading-6">{a.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-ink-mute">{a.excerpt}</p>
                  <p className="mt-2.5 text-[11.5px] text-ink-mute">{dateIn(a.published_at)} · {a.reading_minutes} min read</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
