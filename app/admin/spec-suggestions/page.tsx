import Link from 'next/link';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { relative } from '@/lib/format';
import { AdminHeader, AdminCard, Badge } from '@/components/admin/ui';
import { SpecSuggestionActions } from '@/components/admin/SpecSuggestionActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Spec suggestions · Bikepick Admin', robots: { index: false, follow: false } };

export default async function SpecSuggestionsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requirePermission('product.write');

  const status = searchParams.status || '';
  const base =
    `SELECT s.id, s.product_id, s.message, s.email, s.status, s.note, s.created_at, s.reviewed_at,
            p.name AS product_name, b.name AS brand_name, b.slug AS brand_slug, p.slug AS product_slug
     FROM spec_suggestions s
     JOIN products p ON p.id = s.product_id
     JOIN brands b ON b.id = p.brand_id`;
  const rows = status
    ? await db.all<any>(base + ` WHERE s.status = ? ORDER BY s.created_at DESC LIMIT 200`, [status])
    : await db.all<any>(base + ` ORDER BY (s.status = 'pending') DESC, s.created_at DESC LIMIT 200`);

  const counts = await db.all<any>(
    "SELECT status, COUNT(*) AS c FROM spec_suggestions GROUP BY status",
  );
  const countOf: Record<string, number> = { pending: 0, applied: 0, dismissed: 0 };
  for (const c of counts) countOf[c.status] = c.c;

  const tabs: [string, string][] = [
    ['', `All (${countOf.pending + countOf.applied + countOf.dismissed})`],
    ['pending', `Pending (${countOf.pending})`],
    ['applied', `Applied (${countOf.applied})`],
    ['dismissed', `Dismissed (${countOf.dismissed})`],
  ];

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Spec suggestions"
        subtitle="Visitors report missing or wrong specifications from the product pages. Verify each one against official sources, update the spec sheet if correct, then mark it applied."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={key ? `/admin/spec-suggestions?status=${key}` : '/admin/spec-suggestions'}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
              status === key ? 'bg-ink text-white' : 'border border-line bg-white text-ink-soft hover:border-ink-mute'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <AdminCard title={rows.length ? `${rows.length} suggestions` : 'No suggestions yet'}>
        {rows.length === 0 ? (
          <p className="text-[13px] text-ink-mute">
            When visitors use the &ldquo;Is a specification missing or wrong?&rdquo; box on a product page, their
            suggestion appears here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                      <Link
                        href={`/${r.brand_slug}/${r.product_slug}`}
                        target="_blank"
                        className="text-brand-700 hover:underline"
                      >
                        {r.brand_name} {r.product_name}
                      </Link>
                      <Badge value={r.status} />
                      <span className="text-[11px] font-normal text-ink-mute">{relative(r.created_at)}</span>
                    </p>
                    <p className="mt-1.5 rounded-xl bg-surface px-3.5 py-2.5 text-[13px] leading-6">&ldquo;{r.message}&rdquo;</p>
                    <p className="mt-1 text-[11.5px] text-ink-mute">
                      {r.email ? <>Reporter: {r.email}</> : 'No email given'}
                      {r.reviewed_at && <> · reviewed {relative(r.reviewed_at)}</>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <SpecSuggestionActions id={r.id} status={r.status} />
                    <Link
                      href={`/admin/products/${r.product_id}/specs`}
                      className="text-[11.5px] font-semibold text-brand-700 hover:underline"
                    >
                      Open spec sheet →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
