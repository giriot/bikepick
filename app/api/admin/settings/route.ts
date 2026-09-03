import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { setSetting, DEFAULT_SETTINGS } from '@/lib/settings';
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
    const defaults = DEFAULT_SETTINGS as Record<string, { value: string; type: string }>;
    const changed: Record<string, { from: string; to: string }> = {};
    const errors: Record<string, string> = {};

    for (const [key, raw] of Object.entries(body.values)) {
      const row = byKey.get(key);
      const def = defaults[key];
      if (!row && !def) continue; // unknown key — never write garbage into settings
      const value = String(raw ?? '').trim();
      const type = row?.value_type || def?.type || 'string';

      if (type === 'number' && value !== '' && Number.isNaN(Number(value))) { errors[key] = 'Must be a number'; continue; }
      if (type === 'json' && value !== '') {
        try { JSON.parse(value); } catch { errors[key] = 'Must be valid JSON'; continue; }
      }
      if (key === 'score_weights') {
        try {
          const w = JSON.parse(value) as Record<string, number>;
          const total = Object.values(w).reduce((a, b) => a + Number(b || 0), 0);
          if (total <= 0) { errors[key] = 'Weights must total more than zero'; continue; }
        } catch { errors[key] = 'Must be valid JSON'; continue; }
      }
      const current = row?.value ?? def?.value ?? '';
      if (value === current) continue;
      changed[key] = { from: current, to: value };
      await setSetting(key, value); // upsert — creates the row if the key predates it in this DB
    }

    if (Object.keys(errors).length) return fail('Some settings were not saved', 422, errors);
    await audit(user, 'settings.update', 'settings', undefined, changed);
    return ok({ changed: Object.keys(changed) }, `${Object.keys(changed).length} setting(s) updated`);
  } catch (e) {
    return handleError(e);
  }
}
