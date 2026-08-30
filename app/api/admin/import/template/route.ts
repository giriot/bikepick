import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { getImportType } from '@/lib/import-schema';
import { toCsv } from '@/lib/csv';
import { fail, handleError } from '@/lib/api';

/** Downloads a header-only CSV template with one example row. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission('data.review');
    const type = getImportType(req.nextUrl.searchParams.get('type') || '');
    if (!type) return fail('Unknown import type', 404);

    const example: Record<string, string> = {};
    for (const c of type.columns) {
      example[c.name] = c.type === 'enum' ? (c.options?.[0] ?? '') : c.type === 'number' ? '' : '';
    }
    const csv = toCsv([example], type.columns.map((c) => c.name));

    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="bikepick-${type.key}-template.csv"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
