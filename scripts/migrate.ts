/**
 * Migration runner. Applies every .sql file in database/migrations in order,
 * tracked in the schema_migrations table. Works on Postgres/Supabase and on
 * the local file database.
 *
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --fresh drop the local dev database first
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { db, nowIso, uid } from '../lib/db';

config({ path: '.env.local' });
config({ path: '.env' });

async function main() {
  const fresh = process.argv.includes('--fresh');
  if (fresh && !process.env.DATABASE_URL) {
    const file = path.join(process.cwd(), 'data', 'bikepick.db');
    for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.unlinkSync(f);
    console.log('· dropped local development database');
  }

  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)`);

  const dir = path.join(process.cwd(), 'database', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set((await db.all<any>('SELECT name FROM schema_migrations')).map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) { console.log(`· ${file} (already applied)`); continue; }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const statements = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(/;\s*$/m)
      .map((s) =>
        s
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter(Boolean);
    for (const st of statements) await db.exec(st);
    await db.run('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?,?,?)', [uid('mig'), file, nowIso()]);
    console.log(`✓ ${file} (${statements.length} statements)`);
  }
  console.log(`\nDatabase ready (${db.kind}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
