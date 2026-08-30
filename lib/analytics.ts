import 'server-only';
import { db } from './db';

export interface SeriesPoint { label: string; value: number }

/** Buckets a table's rows by day for the last N days, filling empty days with zero. */
export async function daily(table: string, dateColumn: string, days: number, where = '1=1', params: any[] = []): Promise<SeriesPoint[]> {
  const rows = await db.all<any>(
    `SELECT substr(${dateColumn}, 1, 10) AS d, COUNT(*) AS c
       FROM ${table}
      WHERE ${where} AND ${dateColumn} >= date('now', ?)
      GROUP BY d ORDER BY d`,
    [...params, `-${days} days`],
  );
  const map = new Map(rows.map((r) => [r.d, Number(r.c)]));
  const out: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push({ label: d, value: map.get(d) ?? 0 });
  }
  return out;
}

export async function sumDaily(table: string, dateColumn: string, valueColumn: string, days: number, where = '1=1'): Promise<SeriesPoint[]> {
  const rows = await db.all<any>(
    `SELECT substr(${dateColumn}, 1, 10) AS d, SUM(${valueColumn}) AS v
       FROM ${table} WHERE ${where} AND ${dateColumn} >= date('now', ?)
      GROUP BY d ORDER BY d`,
    [`-${days} days`],
  );
  const map = new Map(rows.map((r) => [r.d, Number(r.v || 0)]));
  const out: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push({ label: d, value: map.get(d) ?? 0 });
  }
  return out;
}

export async function count(sql: string, params: any[] = []): Promise<number> {
  const r = await db.get<any>(sql, params);
  return Number(r?.c ?? 0);
}
