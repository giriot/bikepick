'use client';

import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

/**
 * Optional Supabase browser-client compatibility layer.
 *
 * Bikepick.IN uses its own database/auth layer by default. Some uploaded UI pages
 * may still import `@/lib/supabase/client`; this file keeps those pages compiling
 * on Vercel without forcing Supabase to be configured.
 *
 * If NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set, the
 * returned client is a safe no-op object. It is intentionally typed as `any` so
 * existing pages using `.auth`, `.from()`, `.storage`, etc. continue to typecheck.
 */

type AnyRecord = Record<string, unknown>;

function createNoopQueryBuilder(): any {
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    in: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return builder;
}

function createNoopClient(): any {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Supabase is not configured.' } }),
      signUp: async () => ({ data: null, error: { message: 'Supabase is not configured.' } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    from: (_table: string) => createNoopQueryBuilder(),
    rpc: async (_name: string, _args?: AnyRecord) => ({ data: null, error: null }),
    storage: {
      from: (_bucket: string) => ({
        upload: async () => ({ data: null, error: { message: 'Supabase storage is not configured.' } }),
        download: async () => ({ data: null, error: { message: 'Supabase storage is not configured.' } }),
        remove: async () => ({ data: null, error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
      }),
    },
  };
}

export function createClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Keep the production build working even when Supabase browser auth/storage is
  // not activated. The server-side app still uses DATABASE_URL through lib/db.ts.
  if (!url || !anonKey) return createNoopClient();

  try {
    return createSupabaseJsClient(url, anonKey);
  } catch {
    return createNoopClient();
  }
}
