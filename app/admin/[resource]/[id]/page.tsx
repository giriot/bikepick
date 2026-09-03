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
import { ProductImagesPanel } from '@/components/admin/ProductImagesPanel';
import { BrandLogoPanel } from '@/components/admin/BrandLogoPanel';

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

  // Photos for this model (products only) — rendered inline below the form.
  const productImages = !isNew && resource.key === 'products'
    ? await db.all<any>(
        'SELECT id, image_url, thumbnail_url, alt_text, license_status, sort_order, approved, is_primary, created_at ' +
        'FROM product_images WHERE product_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, sort_order, created_at',
        [params.id],
      )
    : [];

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
          {resource.key === 'brands' && !isNew && (
            <BrandLogoPanel
              brandId={params.id}
              initial={{
                logo_url: (row.logo_url as string | null) || null,
                logo_source: (row.logo_source as string | null) || null,
                logo_license: (row.logo_license as string | null) || null,
              }}
            />
          )}
          {resource.key === 'products' && !isNew && (
            <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-[13.5px] font-semibold text-brand-800">Basics for a complete model page</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <a href="#photos" className="flex items-center gap-3 rounded-lg border border-brand-200 bg-white p-3 hover:border-brand-400">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700">1</span>
                  <span>
                    <span className="block text-[13px] font-semibold">Photos — add up to 5</span>
                    <span className="block text-[11.5px] leading-4 text-ink-mute">Right below this form: click “+ Add photo”.</span>
                  </span>
                </a>
                <Link href={`/admin/products/${params.id}/specs`} className="flex items-center gap-3 rounded-lg border border-brand-200 bg-white p-3 hover:border-brand-400">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700">2</span>
                  <span>
                    <span className="block text-[13px] font-semibold">Specification sheet (dropdowns)</span>
                    <span className="block text-[11.5px] leading-4 text-ink-mute">Engine, brakes, dimensions, features, colours, warranty →</span>
                  </span>
                </Link>
              </div>
            </div>
          )}
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

          {resource.key === 'products' && !isNew && (
            <div className="mt-5">
              <ProductImagesPanel productId={params.id} initial={productImages} />
            </div>
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
                  <RowActions resource={resource.key} id={params.id} row={row} actions={resource.actions || []} canDelete={resource.canDelete} />
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
