import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { getRow, relationOptions } from '@/lib/admin-query';
import { requirePermission } from '@/lib/rbac';
import { relative } from '@/lib/format';
import { AdminHeader, Badge } from '@/components/admin/ui';
import { ResourceForm } from '@/components/admin/ResourceForm';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { resource: string } }): Promise<Metadata> {
  const r = getResource(params.resource);
  return { title: `Edit ${r?.label || 'record'} · Bikepick Admin`, robots: { index: false, follow: false } };
}

export default async function AdminEdit({ params }: { params: { resource: string; id: string } }) {
  const resource = getResource(params.resource);
  if (!resource) notFound();
  await requirePermission(resource.permission === '*' ? '*' : resource.permission);

  const isNew = params.id === 'new';
  if (isNew && !resource.canCreate) notFound();

  const row = isNew ? {} : await getRow(resource, params.id);
  if (!row) notFound();

  // Load option lists for every relation field.
  const relations: Record<string, { id: string; label: string }[]> = {};
  for (const f of resource.fields) {
    if (f.type === 'relation' && f.relation) {
      relations[f.name] = await relationOptions(f.relation.table, f.relation.labelColumn, f.relation.where);
    }
  }

  // Recent audit trail for this record.
  const history = isNew ? [] : await db.all<any>(
    'SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT 8', [params.id],
  );

  const title = isNew ? `New ${resource.label.toLowerCase()}` : String(row[resource.titleColumn] || resource.label);

  return (
    <div>
      <div className="mb-3">
        <Link href={`/admin/${resource.key}`} className="text-[12.5px] font-medium text-ink-mute hover:text-ink">← {resource.plural}</Link>
      </div>

      <AdminHeader
        title={title}
        subtitle={isNew ? resource.description : `ID ${params.id}`}
        action={
          !isNew && resource.publicPath ? (
            <Link href={row.slug ? `${resource.publicPath}/${row.slug}` : resource.publicPath} className="btn-outline btn-sm" target="_blank">
              View on site ↗
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {resource.fields.length === 0 ? (
            <div className="rounded-xl border border-line bg-white p-5">
              <p className="text-[13px] text-ink-mute">This record is read-only by design.</p>
              <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {Object.entries(row).map(([k, v]) => (
                  <div key={k} className="border-b border-line pb-1.5">
                    <dt className="text-[11px] uppercase tracking-wide text-ink-mute">{k.replace(/_/g, ' ')}</dt>
                    <dd className="text-[13px] break-words">{v == null ? '—' : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <ResourceForm resource={resource.key} id={isNew ? undefined : params.id}
              fields={resource.fields} initial={row} relations={relations} canDelete={resource.canDelete} />
          )}
        </div>

        {!isNew && (
          <aside className="space-y-4">
            {(resource.actions || []).length > 0 && (
              <div className="rounded-xl border border-line bg-white p-5">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Workflow</h2>
                <p className="mt-1 text-[12px] leading-5 text-ink-mute">
                  Actions here notify the person affected and are written to the audit log.
                </p>
                <div className="mt-3">
                  <RowActions resource={resource.key} id={params.id} row={row} actions={resource.actions || []} />
                </div>
              </div>
            )}

            <div className="rounded-xl border border-line bg-white p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Record</h2>
              <dl className="mt-2.5 space-y-2 text-[12.5px]">
                {row.status !== undefined && <div className="flex justify-between gap-2"><dt className="text-ink-mute">Status</dt><dd><Badge value={row.status} /></dd></div>}
                {row.created_at && <div className="flex justify-between gap-2"><dt className="text-ink-mute">Created</dt><dd>{relative(row.created_at)}</dd></div>}
                {row.updated_at && <div className="flex justify-between gap-2"><dt className="text-ink-mute">Updated</dt><dd>{relative(row.updated_at)}</dd></div>}
              </dl>
            </div>

            {history.length > 0 && (
              <div className="rounded-xl border border-line bg-white p-5">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Audit trail</h2>
                <ul className="mt-2.5 space-y-2.5">
                  {history.map((h) => (
                    <li key={h.id} className="border-l-2 border-line pl-2.5">
                      <p className="text-[12.5px] font-medium">{h.action}</p>
                      <p className="text-[11.5px] text-ink-mute">{h.actor_email || 'system'} · {relative(h.created_at)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
