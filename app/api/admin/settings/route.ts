import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

/** Validates by declared type before writing; a bad value never lands in settings. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission('*');
    const body = await readJson<{ values: Record<string, string> }>(req);
    if (!body?.values) return fail('No settings supplied');

    const existing = await db.all<any>('SELECT key, value, value_type FROM settings');
    const byKey = new Map(existing.map((s) => [s.key, s]));
    const changed: Record<string, { from: string; to: string }> = {};
    const errors: Record<string, string> = {};

    for (const [key, raw] of Object.entries(body.values)) {
      const row = byKey.get(key);
      if (!row) continue;
      const value = String(raw ?? '').trim();

      if (row.value_type === 'number' && value !== '' && Number.isNaN(Number(value))) { errors[key] = 'Must be a number'; continue; }
      if (row.value_type === 'json' && value !== '') {
        try { JSON.parse(value); } catch { errors[key] = 'Must be valid JSON'; continue; }
      }
      if (key === 'score_weights') {
        try {
          const w = JSON.parse(value) as Record<string, number>;
          const total = Object.values(w).reduce((a, b) => a + Number(b || 0), 0);
          if (total <= 0) { errors[key] = 'Weights must total more than zero'; continue; }
        } catch { errors[key] = 'Must be valid JSON'; continue; }
      }
      if (value === row.value) continue;
      changed[key] = { from: row.value, to: value };
      await db.run('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', [value, nowIso(), key]);
    }

    if (Object.keys(errors).length) return fail('Some settings were not saved', 422, errors);
    await audit(user, 'settings.update', 'settings', undefined, changed);
    return ok({ changed: Object.keys(changed) }, `${Object.keys(changed).length} setting(s) updated`);
  } catch (e) {
    return handleError(e);
  }
}
