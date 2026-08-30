import 'server-only';
import { AuthError, getCurrentUser } from './auth';
import type { AppUser, Role } from '@/types';

/**
 * Permission matrix. Server-side only — the UI never decides authorisation,
 * it only hides controls the API would reject anyway.
 */
export const PERMISSIONS = {
  admin: ['*'],
  moderator: [
    'product.read', 'product.write', 'used_bike.review', 'review.moderate',
    'dealer.review', 'offer.review', 'article.write', 'data.review', 'lead.read',
  ],
  verifier: ['used_bike.review', 'dealer.review', 'verification.write', 'document.read'],
  dealer: ['dealer.self', 'offer.self', 'lead.self', 'used_bike.self'],
  user: ['account.self', 'used_bike.self', 'review.write'],
} as const satisfies Record<Role, readonly string[]>;

export function can(user: AppUser | null, permission: string): boolean {
  if (!user) return false;
  const list = PERMISSIONS[user.role] as readonly string[] | undefined;
  if (!list) return false;
  return list.includes('*') || list.includes(permission);
}

export async function requirePermission(permission: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Sign in required', 401);
  if (!can(user, permission)) throw new AuthError('You do not have access to this action', 403);
  return user;
}

export async function requireRole(...roles: Role[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Sign in required', 401);
  if (!roles.includes(user.role)) throw new AuthError('You do not have access to this area', 403);
  return user;
}

export const isStaff = (u: AppUser | null) => !!u && ['admin', 'moderator', 'verifier'].includes(u.role);
