import 'server-only';
import { db, nowIso, uid } from './db';
import { DEFAULT_SETTINGS } from './settings-defaults';

export type { SettingsMap } from './settings-defaults';
export { DEFAULT_SETTINGS } from './settings-defaults';
import type { SettingsMap } from './settings-defaults';

export async function getSettings(): Promise<SettingsMap> {
  const rows = await db.all<any>('SELECT key, value FROM settings');
  const map: SettingsMap = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) map[k] = v.value;
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.get<any>('SELECT value FROM settings WHERE key = ?', [key]);
  if (row) return row.value;
  return DEFAULT_SETTINGS[key]?.value ?? null;
}

export async function getJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSetting(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.get<any>('SELECT id FROM settings WHERE key = ?', [key]);
  if (existing) {
    await db.run('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', [value, nowIso(), key]);
  } else {
    const def = DEFAULT_SETTINGS[key];
    await db.run(
      'INSERT INTO settings (id, key, value, value_type, group_name, label, help_text, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [uid('set'), key, value, def?.type || 'string', def?.group || 'general', def?.label || key, def?.help || null, nowIso(), nowIso()],
    );
  }
}

export const isOn = (v: string | null | undefined) => v === '1' || v === 'true';
