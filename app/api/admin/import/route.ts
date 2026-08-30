import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { parseCsv } from '@/lib/csv';
import { planImport, applyImport, type ImportPlan } from '@/lib/importer';
import { getImportType } from '@/lib/import-schema';
import { handleError, ok, fail } from '@/lib/api';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Two-phase import.
 *  - mode=preview : parse + diff, write nothing, return a per-row plan.
 *  - mode=apply   : re-plan from the same file and execute it.
 * Re-planning on apply means a stale preview can never write unexpected values.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('data.review');
    const form = await req.formData();
    const file = form.get('file');
    const typeKey = String(form.get('type') || '');
    const mode = String(form.get('mode') || 'preview');

    const type = getImportType(typeKey);
    if (!type) return fail('Choose a valid import type');
    if (!(file instanceof File)) return fail('Attach a CSV file');
    if (file.size > 8 * 1024 * 1024) return fail('File is larger than 8 MB. Split it into smaller files.');

    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (rows.length === 0) return fail('That file has no data rows');
    if (rows.length > 5000) return fail('Maximum 5,000 rows per import. Split the file.');

    const missing = type.columns.filter((c) => c.required && !headers.includes(c.name)).map((c) => c.name);
    if (missing.length) return fail(`Missing required column(s): ${missing.join(', ')}`);

    const plan: ImportPlan = await planImport(typeKey, rows, headers);

    if (mode === 'preview') {
      return ok({ ...plan, filename: file.name, rows: plan.rows.slice(0, 200), truncated: plan.rows.length > 200 });
    }

    const result = await applyImport(typeKey, plan, user, file.name);
    await audit(user, 'import.apply', 'data_import_jobs', result.jobId, {
      type: typeKey, created: result.created, updated: result.updated, skipped: result.skipped,
    });
    return ok(result, `Imported: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  } catch (e) {
    return handleError(e);
  }
}
