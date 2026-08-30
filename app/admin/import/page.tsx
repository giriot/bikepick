import Link from 'next/link';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { relative } from '@/lib/format';
import { AdminHeader, AdminCard, Badge } from '@/components/admin/ui';
import { ImportWizard } from '@/components/admin/ImportWizard';
import { IMPORT_TYPES } from '@/lib/import-schema';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CSV import · Bikepick Admin', robots: { index: false, follow: false } };

export default async function ImportPage() {
  await requirePermission('data.review');
  const jobs = await db.all<any>('SELECT * FROM data_import_jobs ORDER BY created_at DESC LIMIT 10');

  return (
    <div className="space-y-5">
      <AdminHeader title="CSV import"
        subtitle="Load real data in bulk. Every import is previewed field-by-field before anything is written, and every job is logged." />

      <ImportWizard types={IMPORT_TYPES} />

      <AdminCard title="Recent imports" action={<Link href="/admin/imports" className="text-[12.5px] font-semibold text-brand-700 hover:underline">Full history</Link>}>
        {jobs.length === 0 ? (
          <p className="text-[13px] text-ink-mute">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-[13px] font-medium">{j.filename}</p>
                  <p className="text-[11.5px] text-ink-mute">
                    {j.job_type} · {j.rows_total} rows · {j.rows_imported} imported · {j.rows_invalid} invalid · {relative(j.created_at)}
                  </p>
                </div>
                <Badge value={j.status} />
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
