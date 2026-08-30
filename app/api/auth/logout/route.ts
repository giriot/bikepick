import { destroySession, getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { handleError, ok } from '@/lib/api';

export async function POST() {
  try {
    const user = await getCurrentUser();
    await audit(user, 'auth.logout', 'user', user?.id);
    await destroySession();
    return ok({ redirect: '/' }, 'Signed out');
  } catch (e) {
    return handleError(e);
  }
}
