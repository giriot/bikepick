/**
 * Inserts any DEFAULT_SETTINGS key that is missing from the database.
 * Existing values are never overwritten, so it is safe to run after every deploy.
 */
import 'dotenv/config';
import { db, insert, uid } from '../lib/db';
import { DEFAULT_SETTINGS } from '../lib/settings-defaults';

async function main() {
  const existing = new Set((await db.all<any>('SELECT key FROM settings')).map((r) => r.key));
  let added = 0;
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing.has(key)) continue;
    await insert('settings', {
      id: uid('set'), key, value: def.value, value_type: def.type,
      group_name: def.group, label: def.label, help_text: def.help ?? null,
    });
    added++;
    console.log(`+ ${key}`);
  }
  console.log(added === 0 ? 'All settings already present.' : `${added} setting(s) added.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
