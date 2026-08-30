import 'server-only';
import { db } from './db';
import type { AdminResource } from './admin-config';

export interface ListResult {
  rows: any[];
  total: number;
  page: number;
  pages: number;
}

const PER_PAGE = 25;

function hasColumnCache(): Map<string, Set<string>> {
  const g = globalThis as any;
  if (!g.__bpColumnCache) g.__bpColumnCache = new Map<string, Set<string>>();
  return g.__bpColumnCache;
}

/** Column names of a table, cached per process. Used to build safe SQL. */
export async function tableColumns(table: string): Promise<Set<string>> {
  const cache = hasColumnCache();
  if (cache.has(table)) return cache.get(table)!;
  const safe = table.replace(/[^a-z_]/g, '');
  const rows = db.kind === 'postgres'
    ? await db.all<any>('SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?', [safe])
    : await db.all<any>(`SELECT name FROM pragma_table_info('${safe}')`);
  const set = new Set(rows.map((r) => r.name as string));
  cache.set(table, set);
  return set;
}

export async function listResource(
  resource: AdminResource,
  params: { q?: string; page?: number; sort?: string; filters?: Record<string, string> },
): Promise<ListResult> {
  const cols = await tableColumns(resource.table);
  const where: string[] = [];
  const args: any[] = [];

  if (cols.has('deleted_at')) where.push('t.deleted_at IS NULL');
  if (resource.listWhere) where.push(resource.listWhere);

  if (params.q && resource.searchColumns.length) {
    const like = `%${params.q.toLowerCase()}%`;
    where.push(`(${resource.searchColumns.map((c) => `LOWER(${c}) LIKE ?`).join(' OR ')})`);
    resource.searchColumns.forEach(() => args.push(like));
  }

  for (const f of resource.filters || []) {
    const value = params.filters?.[f.name];
    if (value && f.options.includes(value)) { where.push(`${f.column} = ?`); args.push(value); }
  }

  const extras = [resource.listSelect, ...(resource.columns.filter((c) => c.expr).map((c) => `${c.expr} AS ${c.name}`))]
    .filter(Boolean).join(', ');
  const select = `t.*${extras ? `, ${extras}` : ''}`;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const join = resource.listJoin || '';
  const sort = params.sort || resource.defaultSort || 't.created_at DESC';
  const page = Math.max(1, params.page || 1);

  const [rows, count] = await Promise.all([
    db.all<any>(
      `SELECT ${select} FROM ${resource.table} t ${join} ${whereSql} ORDER BY ${sort} LIMIT ? OFFSET ?`,
      [...args, PER_PAGE, (page - 1) * PER_PAGE],
    ),
    db.get<any>(`SELECT COUNT(*) AS c FROM ${resource.table} t ${join} ${whereSql}`, args),
  ]);

  const total = count?.c ?? 0;
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PER_PAGE)) };
}

export async function getRow(resource: AdminResource, id: string) {
  return db.get<any>(`SELECT * FROM ${resource.table} WHERE id = ?`, [id]);
}

/** Options for a `relation` field. */
export async function relationOptions(table: string, labelColumn: string, where?: string) {
  const cols = await tableColumns(table);
  const conditions = [where, cols.has('deleted_at') ? 'deleted_at IS NULL' : null].filter(Boolean);
  return db.all<any>(
    `SELECT id, ${labelColumn} AS label FROM ${table} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY ${labelColumn} LIMIT 500`,
  );
}
