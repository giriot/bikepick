import Image from 'next/image';
import Link from 'next/link';
import { globalSearch } from '@/lib/search';
import { SearchBox } from '@/components/SearchBox';
import { track } from '@/lib/audit';
import { Breadcrumbs, Empty } from '@/components/ui';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export function generateMetadata({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  return buildMetadata({
    title: q ? `Search results for “${q}”` : 'Search Bikepick.IN',
    description: 'Search bikes, electric scooters, used listings, dealers and buying guides across Bikepick.IN.',
    path: '/search',
    robots: 'noindex,follow',
  });
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q || '').trim();
  const groups = q ? await globalSearch(q, 8) : [];
  const total = groups.reduce((a, g) => a + g.hits.length, 0);

  // Recording what people search for (and what returned nothing) is how the owner
  // learns which models to add next. It is stored locally — no external tracker.
  if (q) await track('search', { path: '/search', meta: { q: q.toLowerCase().slice(0, 80), results: total } });

  return (
    <div className="container-xl py-6">
      <Breadcrumbs items={[{ name: 'Home', url: '/' }, { name: 'Search', url: '/search' }]} />
      <h1 className="mt-4 text-2xl font-bold tracking-[-0.03em]">
        {q ? <>Results for “{q}”</> : 'Search'}
      </h1>
      <div className="mt-4 max-w-2xl"><SearchBox size="lg" autoFocus={!q} /></div>

      {q && total === 0 && (
        <div className="mt-8">
          <Empty
            title={`Nothing matched “${q}”`}
            body="Try a shorter query, or a different spelling — our search already handles variations like MT15, MT 15 and MT-15. If a model is genuinely missing, an administrator can add it from the admin panel."
            action={<Link href="/bikes" className="btn-primary btn-sm mt-2">Browse all bikes</Link>}
          />
        </div>
      )}

      <div className="mt-8 space-y-9">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-mute">{g.label} ({g.hits.length})</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.hits.map((h) => (
                <li key={h.id}>
                  <Link href={h.url} className="card card-hover flex items-center gap-3 p-3">
                    {h.image ? (
                      <Image src={h.image} alt="" width={64} height={40} className="h-10 w-16 shrink-0 object-contain" />
                    ) : (
                      <span className="grid h-10 w-16 shrink-0 place-items-center rounded-lg bg-surface text-ink-mute" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 5h14v14H5z" stroke="currentColor" strokeWidth="1.8" /></svg>
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{h.title}</span>
                      {h.subtitle && <span className="block truncate text-[11.5px] text-ink-mute">{h.subtitle}</span>}
                    </span>
                    {h.meta && <span className="shrink-0 text-[13px] font-semibold">{h.meta}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
