import 'server-only';
import { headers } from 'next/headers';
import { insert, uid } from './db';
import type { AppUser } from '@/types';

export async function audit(
  actor: AppUser | null,
  action: string,
  entityType?: string,
  entityId?: string,
  detail?: unknown,
): Promise<void> {
  let ip: string | null = null;
  try {
    ip = headers().get('x-forwarded-for')?.split(',')[0] || null;
  } catch {
    ip = null;
  }
  await insert('audit_logs', {
    id: uid('aud'),
    actor_id: actor?.id || null,
    actor_email: actor?.email || null,
    actor_role: actor?.role || null,
    action,
    entity_type: entityType || null,
    entity_id: entityId || null,
    detail: detail ? JSON.stringify(detail).slice(0, 4000) : null,
    ip,
  });
}

export async function track(
  eventType: string,
  data: { entity_type?: string; entity_id?: string; user_id?: string; path?: string; meta?: unknown } = {},
): Promise<void> {
  await insert('analytics_events', {
    id: uid('ev'),
    event_type: eventType,
    entity_type: data.entity_type || null,
    entity_id: data.entity_id || null,
    user_id: data.user_id || null,
    path: data.path || null,
    meta: data.meta ? JSON.stringify(data.meta).slice(0, 2000) : null,
  });
}
