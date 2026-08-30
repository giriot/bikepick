import { cookies } from 'next/headers';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

/**
 * Optional Supabase server-client compatibility layer.
 *
 * The main Bikepick.IN application uses `lib/db.ts` with DATABASE_URL. This file
 * exists only so pages copied from a Supabase template can import
 * `@/lib/supabase/server` without breaking Vercel builds.
 */

function createNoopQueryBuilder(): any {
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
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
      signOut: async () => ({ error: null }),
    },
    from: (_table: string) => createNoopQueryBuilder(),
    rpc: async () => ({ data: null, error: null }),
  };
}

export function createClient(): any {
  // Touch cookies so this module is treated as request-aware when imported from
  // server components, matching common Supabase template behaviour.
  cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return createNoopClient();

  try {
    return createSupabaseJsClient(url, anonKey);
  } catch {
    return createNoopClient();
  }
}
