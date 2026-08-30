import Link from 'next/link';
import { db } from '@/lib/db';
import { Breadcrumbs, Empty, Notice } from '@/components/ui';
import { LeadDialog } from '@/components/LeadDialog';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Two-Wheeler Service Centres in India',
  description: 'Find authorised and verified two-wheeler service centres by city and brand, and book a service callback.',
  path: '/service-centres',
});

export default async function ServiceCentresPage({ searchParams }: { searchParams: { city?: string; brand?: string; q?: string } }) {
  const conditions = ["sc.status = 'active'", 'sc.deleted_at IS NULL'];
  const args: any[] = [];
  if (searchParams.city) { conditions.push('LOWER(sc.city) = LOWER(?)'); args.push(searchParams.city); }
  if (searchParams.brand) { conditions.push('b.slug = ?'); args.push(searchParams.brand); }
  if (searchParams.q) { conditions.push('(LOWER(sc.name) LIKE ? OR LOWER(sc.address) LIKE ?)'); args.push(`%${searchParams.q.toLowerCase()}%`, `%${searchParams.q.toLowerCase()}%`); }

  const [centres, cities, brands] = await Promise.all([
    db.all<any>(
      `SELECT sc.*, b.name AS brand_name FROM service_centres sc LEFT JOIN brands b ON b.id = sc.brand_id
        WHERE ${conditions.join(' AND ')} ORDER BY sc.featured DESC, sc.verified DESC, sc.name LIMIT 120`,
      args,
    ),
    db.all<any>("SELECT DISTINCT city FROM service_centres WHERE status='active' AND deleted_at IS NULL ORDER BY city"),
    db.all<any>("SELECT DISTINCT b.name, b.slug FROM service_centres sc JOIN brands b ON b.id=sc.brand_id WHERE sc.status='active' AND sc.deleted_at IS NULL ORDER BY b.name"),
  ]);

  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Service centres', url: '/service-centres' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Service centres</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          Authorised and independent workshops added by our team or by verified dealers. We only list what we can confirm —
          this directory grows as centres are verified, so it is deliberately incomplete rather than padded out.
        </p>
      </header>

      <form className="mt-5 flex flex-wrap gap-2" action="/service-centres">
        <input name="q" defaultValue={searchParams.q || ''} placeholder="Search by name or area" className="field max-w-xs" aria-label="Search service centres" />
        <select name="city" defaultValue={searchParams.city || ''} className="field max-w-[180px]" aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
        </select>
        <select name="brand" defaultValue={searchParams.brand || ''} className="field max-w-[180px]" aria-label="Brand">
          <option value="">All brands</option>
          {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
        <button className="btn-primary btn-sm">Search</button>
        {(searchParams.q || searchParams.city || searchParams.brand) && <Link href="/service-centres" className="btn-ghost btn-sm">Clear</Link>}
      </form>

      {centres.length === 0 ? (
        <div className="mt-6">
          <Empty title="No service centres match" body="Try a different city or clear the filters. If you run a workshop, ask us to list it." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {centres.map((c) => (
            <article key={c.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[14.5px] font-semibold leading-5">{c.name}</h2>
                {c.verified ? <span className="badge-verified">Verified</span> : null}
              </div>
              {c.brand_name && <p className="mt-1 text-[12px] text-ink-mute">Authorised: {c.brand_name}</p>}
              <p className="mt-2 text-[12.5px] leading-5 text-ink-soft">{c.address}</p>
              <p className="mt-1 text-[12.5px] text-ink-mute">{c.city}{c.state ? `, ${c.state}` : ''} {c.pincode || ''}</p>
              {c.services && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {String(c.services).split(',').slice(0, 4).map((s: string) => (
                    <span key={s} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-mute">{s.trim()}</span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                {c.phone && <a href={`tel:${c.phone}`} className="btn-outline btn-sm flex-1">Call</a>}
                <LeadDialog
                  leadType="service" label="Book service" title={`Book a service at ${c.name}`}
                  description="Tell us what the bike needs and when suits you. The centre calls you back to confirm."
                  city={c.city} source="service-centres" className="btn-primary btn-sm flex-1"
                  extraFields={[
                    { name: 'vehicle', label: 'Bike / scooter model', required: true },
                    { name: 'service_type', label: 'What is needed', type: 'select', options: ['Periodic service', 'Repair', 'Accident damage', 'Tyres', 'Battery', 'Other'] },
                    { name: 'preferred_date', label: 'Preferred date', type: 'date' },
                  ]}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Notice tone="warn" title="Before you hand over the keys">
          Ask for an estimate in writing, insist that old parts are returned, and check that the job card lists the exact
          work approved. Authorised centres cost more but keep your warranty intact.
        </Notice>
      </div>
    </div>
  );
}
