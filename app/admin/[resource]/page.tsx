import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getResource } from '@/lib/admin-config';
import { listResource } from '@/lib/admin-query';
import { requirePermission } from '@/lib/rbac';
import { inr, dateIn } from '@/lib/format';
import { AdminHeader, Badge } from '@/components/admin/ui';
import { RowActions } from '@/components/admin/RowActions';
import { Pagination, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { resource: string } }): Promise<Metadata> {
  const r = getResource(params.resource);
  return { title: `${r?.plural || 'Admin'} · Bikepick Admin`, robots: { index: false, follow: false } };
}

function cell(row: any, col: any) {
  const v = row[col.name];
  if (v == null || v === '') return <span className="text-ink-mute">—</span>;
  switch (col.type) {
    case 'money': return <span className="tabular-nums">{inr(Number(v))}</span>;
    case 'number': return <span className="tabular-nums">{v}</span>;
    case 'bool': return v === 1 || v === true
      ? <span className="badge bg-emerald-50 text-emerald-700">yes</span>
      : <span className="text-ink-mute">no</span>;
    case 'date': return <span className="whitespace-nowrap text-ink-mute">{dateIn(v)}</span>;
    case 'badge': return <Badge value={v} />;
    default: {
      const s = String(v);
      return <span title={s}>{s.length > 52 ? `${s.slice(0, 52)}…` : s}</span>;
    }
  }
}

export default async function AdminList({ params, searchParams }: {
  params: { resource: string };
  searchParams: Record<string, string | undefined>;
}) {
  const resource = getResource(params.resource);
  if (!resource) notFound();
  await requirePermission(resource.permission === '*' ? '*' : resource.permission);

  const filters: Record<string, string> = {};
  for (const f of resource.filters || []) if (searchParams[f.name]) filters[f.name] = searchParams[f.name]!;

  const { rows, total, page, pages } = await listResource(resource, {
    q: searchParams.q, page: Number(searchParams.page) || 1, filters,
  });

  const qs = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (searchParams.q) sp.set('q', searchParams.q);
    for (const [k, v] of Object.entries(filters)) sp.set(k, v);
    for (const [k, v] of Object.entries(extra)) { if (v) sp.set(k, v); else sp.delete(k); }
    const s = sp.toString();
    return `/admin/${resource.key}${s ? `?${s}` : ''}`;
  };

  return (
    <div>
      <AdminHeader
        title={resource.plural}
        subtitle={resource.description}
        action={resource.canCreate ? <Link href={`/admin/${resource.key}/new`} className="btn-primary btn-sm">New {resource.label.toLowerCase()}</Link> : undefined}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form action={`/admin/${resource.key}`} className="flex gap-2">
          {Object.entries(filters).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="q" defaultValue={searchParams.q || ''} placeholder={`Search ${resource.plural.toLowerCase()}…`}
            className="field h-9 w-64 py-1.5" aria-label="Search" />
          <button className="btn-outline btn-sm">Search</button>
        </form>
        {(searchParams.q || Object.keys(filters).length > 0) && (
          <Link href={`/admin/${resource.key}`} className="btn-ghost btn-sm">Clear</Link>
        )}
        <span className="ml-auto text-[12.5px] text-ink-mute">{total} record{total === 1 ? '' : 's'}</span>
      </div>

      {(resource.filters || []).length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(resource.filters || []).map((f) =>
            f.options.map((o) => (
              <Link key={`${f.name}-${o}`} href={qs({ [f.name]: filters[f.name] === o ? undefined : o, page: undefined })}
                className={`chip ${filters[f.name] === o ? 'chip-active' : ''}`}>{o.replace(/_/g, ' ')}</Link>
            )),
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-white">
          <Empty title={`No ${resource.plural.toLowerCase()} found`} body="Adjust the search or filters, or create a new record." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-mute">
              <tr>
                {resource.columns.map((c) => <th key={c.name} className="px-4 py-2.5 text-left font-semibold">{c.label}</th>)}
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-surface/50">
                  {resource.columns.map((c, i) => (
                    <td key={c.name} className="px-4 py-3">
                      {i === 0 ? (
                        <Link href={`/admin/${resource.key}/${row.id}`} className="font-medium text-brand-700 hover:underline">
                          {cell(row, c)}
                        </Link>
                      ) : cell(row, c)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <RowActions resource={resource.key} id={row.id} row={row}
                        actions={resource.actions || []} canDelete={resource.canDelete} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} base={qs({})} />
    </div>
  );
}
