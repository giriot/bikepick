/**
 * Database abstraction for Bikepick.IN
 * ------------------------------------
 * One portable SQL surface with two interchangeable drivers:
 *
 *   - "postgres"  -> production / Supabase (DATABASE_URL=postgres://...)
 *   - "sqlite"    -> zero-config local development & CI (data/bikepick.db)
 *
 * All application code uses `db.all/get/run/tx` with `?` placeholders.
 * The Postgres driver rewrites `?` to `$n`. Migrations are written in the
 * portable subset used by both engines (TEXT ids, TEXT ISO timestamps,
 * INTEGER booleans) so a local database and Supabase stay identical.
 */
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { RUNTIME_MIGRATIONS } from './runtime-migrations';

export type Row = Record<string, any>;
export type Param = string | number | null | boolean;

export interface Driver {
  kind: 'sqlite' | 'postgres';
  all<T = Row>(sql: string, params?: Param[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: Param[]): Promise<T | undefined>;
  run(sql: string, params?: Param[]): Promise<void>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: () => Promise<T>): Promise<T>;
}

function normalizeParams(params: Param[] = []): Param[] {
  return params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p === undefined ? null : p));
}

/* ------------------------------- sqlite -------------------------------- */

/* ------------------------- local dev runtime seed ------------------------ */
// LOCAL DEVELOPMENT ONLY (sqlite driver).
//
// Policy (per project spec): NO fabricated data and NO hardcoded credentials.
// We seed only the role list and a few default settings on a fresh local
// database. No users and no products are created here — create your first
// account via the /register page, then promote it in a local shell:
//
//   sqlite3 data/bikepick.db "UPDATE users SET role='admin' WHERE email='you@example.com';"
//
// (In production the postgres driver is used; this function never runs.)

function initializeSqliteRuntime(raw: any) {
  raw.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)`);
  const appliedRows = raw.prepare('SELECT name FROM schema_migrations').all() as { name: string }[];
  const applied = new Set(appliedRows.map((r) => r.name));
  for (const migration of RUNTIME_MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    raw.exec(migration.sql);
    raw.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?,?,?)').run(uid('mig'), migration.name, new Date().toISOString());
  }

  const roleCount = Number(raw.prepare('SELECT COUNT(*) AS c FROM roles').get().c || 0);
  if (roleCount > 0) return;

  const now = new Date().toISOString();
  const insertIgnore = (table: string, data: Row) => {
    const keys = Object.keys(data);
    raw.prepare(`INSERT OR IGNORE INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => data[k]));
  };

  const roles: [string, string, string][] = [
    ['role_admin', 'admin', 'Administrator'],
    ['role_moderator', 'moderator', 'Moderator'],
    ['role_verifier', 'verifier', 'Verifier'],
    ['role_dealer', 'dealer', 'Dealer'],
    ['role_user', 'user', 'Buyer/user'],
  ];
  for (const [id, name, description] of roles) {
    insertIgnore('roles', { id, name, description, created_at: now, updated_at: now });
  }

  insertIgnore('settings', { id: 'set_brand_color', key: 'brand_color', value: '#F0620C', value_type: 'string', group_name: 'brand', label: 'Brand colour', help_text: null, created_at: now, updated_at: now });
  insertIgnore('settings', { id: 'set_score_weights', key: 'score_weights', value: '{"price":20,"performance":20,"efficiency":20,"safety":15,"features":10,"comfort":10,"ownership":5}', value_type: 'json', group_name: 'score', label: 'Score weights', help_text: null, created_at: now, updated_at: now });
  insertIgnore('settings', { id: 'set_category_chooser', key: 'show_category_chooser', value: '0', value_type: 'boolean', group_name: 'ui', label: 'Show category chooser', help_text: null, created_at: now, updated_at: now });
}

function createSqlite(): Driver {
  let Database: any;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.error('[db] better-sqlite3 failed to load (and DATABASE_URL is unset):', e);
    throw new Error(
      'Database is not configured: set DATABASE_URL (Supabase Postgres connection string) in the environment. See README "Production deployment".',
    );
  }
  const file = process.env.SQLITE_PATH || (process.env.VERCEL ? '/tmp/bikepick.db' : path.join(process.cwd(), 'data', 'bikepick.db'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new Database(file);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  initializeSqliteRuntime(raw);

  return {
    kind: 'sqlite',
    async all<T>(sql: string, params: Param[] = []) {
      return raw.prepare(sql).all(...normalizeParams(params)) as T[];
    },
    async get<T>(sql: string, params: Param[] = []) {
      return raw.prepare(sql).get(...normalizeParams(params)) as T | undefined;
    },
    async run(sql: string, params: Param[] = []) {
      raw.prepare(sql).run(...normalizeParams(params));
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
    async tx<T>(fn: () => Promise<T>) {
      raw.exec('BEGIN');
      try {
        const out = await fn();
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

/* ------------------------------ postgres ------------------------------- */

function toPg(sql: string): string {
  let i = 0;
  let out = '';
  let inStr = false;
  for (const ch of sql) {
    if (ch === "'") inStr = !inStr;
    out += ch === '?' && !inStr ? `$${++i}` : ch;
  }
  return out;
}

// Transient connection errors (cold-start TLS to the pooler, pooler idle
// timeout killing a stale connection, brief DNS blips). Safe to retry once.
const TRANSIENT_PG =
  /ECONNRESET|ETIMEDOUT|EAI_AGAIN|EPIPE|timeout expired|Connection terminated|server closed the connection unexpectedly|connection was closed|terminating connection|no more connections|SSL connection has been closed|ConnectionRefused/i;

function createPostgres(url: string): Driver {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PGPOOL_MAX || 8),
    ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 15000,
  });
  let txClient: any = null;

  const q = async (sql: string, params: Param[] = []) => {
    const pgSql = toPg(sql);
    const paramsNorm = normalizeParams(params);
    let attempt = 0;
    for (;;) {
      try {
        const runner = txClient || pool;
        return await runner.query(pgSql, paramsNorm);
      } catch (e) {
        // Never retry mid-transaction (state may be dirty).
        if (txClient) throw e;
        attempt++;
        if (attempt >= 2 || !TRANSIENT_PG.test(String((e as any)?.message || e))) throw e;
        await new Promise((r) => setTimeout(r, 150 * attempt));
      }
    }
  };

  return {
    kind: 'postgres',
    async all<T>(sql: string, params: Param[] = []) {
      return (await q(sql, params)).rows as T[];
    },
    async get<T>(sql: string, params: Param[] = []) {
      return (await q(sql, params)).rows[0] as T | undefined;
    },
    async run(sql: string, params: Param[] = []) {
      await q(sql, params);
    },
    async exec(sql: string) {
      const runner = txClient || pool;
      await runner.query(sql);
    },
    async tx<T>(fn: () => Promise<T>) {
      const client = await pool.connect();
      txClient = client;
      try {
        await client.query('BEGIN');
        const out = await fn();
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        txClient = null;
        client.release();
      }
    },
  };
}

/* ------------------------------ singleton ------------------------------ */

declare global {
  // eslint-disable-next-line no-var
  var __bikepick_db: Driver | undefined;
}

export function getDb(): Driver {
  if (!global.__bikepick_db) {
    const url = process.env.DATABASE_URL?.trim();
    if (url && /^postgres(ql)?:\/\//.test(url)) {
      console.log('[db] using postgres driver (DATABASE_URL set)');
      global.__bikepick_db = createPostgres(url);
    } else {
      console.warn('[db] DATABASE_URL is NOT set — falling back to local SQLite. On Vercel this storage is ephemeral; set DATABASE_URL to your Supabase Postgres connection string.');
      global.__bikepick_db = createSqlite();
    }
  }
  return global.__bikepick_db;
}

export const db = {
  get kind() {
    return getDb().kind;
  },
  all: <T = Row>(sql: string, params?: Param[]) => getDb().all<T>(sql, params),
  get: <T = Row>(sql: string, params?: Param[]) => getDb().get<T>(sql, params),
  run: (sql: string, params?: Param[]) => getDb().run(sql, params),
  exec: (sql: string) => getDb().exec(sql),
  tx: <T>(fn: () => Promise<T>) => getDb().tx<T>(fn),
};

/* ------------------------------- helpers ------------------------------- */

export function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefix = ''): string {
  const s = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  return prefix ? `${prefix}_${s}` : s;
}

/** Build a parameterised INSERT. */
export async function insert(table: string, data: Row): Promise<string> {
  const record = { ...data };
  if (!record.id) record.id = uid();
  if ('created_at' in record === false) record.created_at = nowIso();
  if ('updated_at' in record === false) record.updated_at = nowIso();
  const keys = Object.keys(record).filter((k) => record[k] !== undefined);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
  await db.run(sql, keys.map((k) => record[k]));
  return record.id as string;
}

/** Build a parameterised UPDATE by id. */
export async function update(table: string, id: string, data: Row): Promise<void> {
  const record: Row = { ...data, updated_at: nowIso() };
  delete record.id;
  const keys = Object.keys(record).filter((k) => record[k] !== undefined);
  if (!keys.length) return;
  await db.run(
    `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    [...keys.map((k) => record[k]), id],
  );
}

/** Soft delete where the table supports it. */
export async function softDelete(table: string, id: string): Promise<void> {
  await db.run(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
    nowIso(),
    nowIso(),
    id,
  ]);
}

export function bool(v: any): boolean {
  return v === 1 || v === true || v === '1' || v === 'true';
}
