import { NextRequest } from 'next/server';
import { suggest } from '@/lib/search';
import { handleError, ok } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit('search_suggest', { limit: 120, windowSeconds: 60 });
    if (!limited.ok) return ok([], 'rate limited');
    const q = req.nextUrl.searchParams.get('q') || '';
    return ok(await suggest(q));
  } catch (e) {
    return handleError(e);
  }
}
