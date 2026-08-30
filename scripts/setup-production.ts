/**
 * One-time-safe production database setup for Vercel.
 *
 * Vercel builds dynamic pages successfully even when the database is empty, but
 * runtime pages such as / and /bikes need the schema + owner/demo seed data.
 * This script runs migrations on every deploy and seeds only when the database
 * is empty, so repeated redeploys do not duplicate rows.
 */
import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';
import { db } from '../lib/db';

config({ path: '.env.local' });
config({ path: '.env' });

function run(script: string) {
  execFileSync('npm', ['run', script], { stdio: 'inherit' });
}

async function tableCount(table: string): Promise<number> {
  try {
    const row = await db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`);
    return Number(row?.c ?? 0);
  } catch {
    return 0;
  }
}

async function main() {
  console.log('\nBikepick.IN production setup');
  console.log('Database:', process.env.DATABASE_URL ? 'Postgres/Supabase' : 'Runtime SQLite fallback');

  run('db:migrate');

  const users = await tableCount('users');
  const products = await tableCount('products');
  if (users === 0 && products === 0) {
    console.log('\nEmpty database detected. Seeding initial Bikepick data...');
    run('db:seed');
  } else {
    console.log(`\nSeed skipped. Existing database has ${users} user(s) and ${products} product(s).`);
  }

  run('seed:legal');
  run('sync:settings');

  console.log('\nProduction database setup complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
