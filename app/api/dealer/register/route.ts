import { NextRequest } from 'next/server';
import { db, insert, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { dealerRegisterSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

/** Dealer applications always start as `pending` — an admin must verify them. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await rateLimit('dealer_register', { limit: 3, windowSeconds: 3600, key: user.id });
    if (!limited.ok) return fail('Too many applications. Please contact support.', 429);

    const existing = await db.get<any>('SELECT id, status FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    if (existing) return fail(`You already have a dealer application (${existing.status}).`, 409);

    const body = dealerRegisterSchema.parse(await readJson(req));
    const id = await insert('dealer_profiles', {
      id: uid('dlr'), user_id: user.id,
      business_name: body.business_name, dealer_name: body.dealer_name,
      phone: body.phone, email: body.email, whatsapp: body.whatsapp || null,
      gstin: body.gstin || null, address: body.address, city: body.city,
      state: body.state, pincode: body.pincode,
      brands: JSON.stringify(body.brands || []), about: body.about || null,
      status: 'pending',
    });

    await notify({
      userId: user.id, event: 'dealer_verified',
      title: 'Dealer application received',
      body: 'We will verify your business details and documents, usually within two working days.',
      link: '/dealer', email: body.email, phone: body.phone,
    });
    await audit(user, 'dealer.apply', 'dealer_profile', id);
    return ok({ id, status: 'pending' }, 'Application submitted for verification');
  } catch (e) {
    return handleError(e);
  }
}
