import 'server-only';
import { db, insert, nowIso, uid } from './db';
import { slugify } from './slug';
import { tableColumns } from './admin-query';
import { syncProductPricesFromVariants } from './pricing-sync';
import type { AdminResource } from './admin-config';
import type { AppUser } from '@/types';

/** Coerce submitted form values into the shapes the database expects. */
export async function normalisePayload(resource: AdminResource, body: Record<string, any>) {
  const cols = await tableColumns(resource.table);
  const out: Record<string, any> = {};
  const errors: Record<string, string> = {};

  for (const f of resource.fields) {
    if (f.type === 'readonly') continue;
    if (!(f.name in body)) continue;
    if (!cols.has(f.name)) continue;

    let v = body[f.name];
    if (v === '' || v === undefined) v = null;
    else if (typeof v === 'string' && v.trim().toLowerCase() === 'null') v = null;

    if (f.required && (v === null || v === '')) { errors[f.name] = `${f.label} is required`; continue; }

    switch (f.type) {
      case 'number':
      case 'money': {
        if (v !== null) {
          const n = Number(v);
          if (Number.isNaN(n)) { errors[f.name] = 'Enter a number'; continue; }
          v = n;
        }
        break;
      }
      case 'bool':
        v = v === 1 || v === true || v === 'on' || v === '1' ? 1 : 0;
        break;
      case 'json':
        if (v !== null) {
          try { JSON.parse(String(v)); } catch { errors[f.name] = 'Must be valid JSON'; continue; }
        }
        break;
      case 'datetime':
      case 'date':
        if (v !== null) v = String(v);
        break;
      default:
        if (v !== null) v = String(v);
    }
    out[f.name] = v;
  }

  // Auto-slug where the table has one and the user left it blank.
  if (cols.has('slug') && !out.slug && out[resource.titleColumn]) {
    out.slug = slugify(String(out[resource.titleColumn]));
  }
  return { data: out, errors };
}

export async function createRow(resource: AdminResource, data: Record<string, any>, user: AppUser) {
  const cols = await tableColumns(resource.table);
  const record: Record<string, any> = { ...data, id: uid(resource.key.slice(0, 3)) };
  if (cols.has('created_by')) record.created_by = user.id;
  if (cols.has('normalized_key') && data.name) record.normalized_key = slugify(String(data.name));
  const id = await insert(resource.table, record);
  if (resource.key === 'variants') await syncProductPricesFromVariants(id); // prices follow the variants
  return id;
}

export async function updateRow(resource: AdminResource, id: string, data: Record<string, any>) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  await db.run(
    `UPDATE ${resource.table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    [...keys.map((k) => data[k]), nowIso(), id],
  );
  if (resource.key === 'variants') await syncProductPricesFromVariants(id);
}

export async function deleteRow(resource: AdminResource, id: string) {
  if (resource.softDelete) {
    await db.run(`UPDATE ${resource.table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [nowIso(), nowIso(), id]);
  } else {
    await db.run(`DELETE FROM ${resource.table} WHERE id = ?`, [id]);
  }
  if (resource.key === 'variants') await syncProductPricesFromVariants(id);
}
