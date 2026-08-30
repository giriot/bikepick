import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'comparebike_backend_config';

export interface BackendConfig {
  url: string;
  anonKey: string;
}

/**
 * Reads manually saved backend config (first-run setup screen).
 * Env vars always take precedence. The anon/publishable key is safe to
 * store client-side — security is enforced by Supabase RLS, not secrecy.
 */
export function getStoredConfig(): BackendConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (cfg && typeof cfg.url === 'string' && typeof cfg.anonKey === 'string') return cfg;
    return null;
  } catch {
    return null;
  }
}

export function saveStoredConfig(cfg: BackendConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearStoredConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? undefined;
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? undefined;
const stored = getStoredConfig();

const SUPABASE_URL = envUrl || stored?.url || '';
const SUPABASE_ANON_KEY = envKey || stored?.anonKey || '';

/**
 * True when the app is connected to a Supabase project.
 * When false, the app renders the first-run Setup Guide instead of
 * the website — no fake data is ever shown.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export class BackendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendError';
  }
}

/** Every data call goes through here so unconfigured state is handled in one place. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new BackendError('Supabase is not configured. Complete the setup steps first.');
  }
  return supabase;
}

/** Extract a friendly message from a supabase-js error. */
export function errMsg(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!e) return fallback;
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'object') {
    const anyE = e as { message?: string; error_description?: string; error?: string };
    return anyE.message || anyE.error_description || anyE.error || fallback;
  }
  return fallback;
}
