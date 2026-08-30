import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, nowIso } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { phoneSchema, emailSchema, pincodeSchema } from '@/lib/validation';

const schema = z.object({
  dealer_name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema,
  whatsapp: phoneSchema.optional().or(z.literal('')),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: pincodeSchema,
  about: z.string().trim().max(1000).optional().or(z.literal('')),
  brands: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const dealer = await db.get<any>('SELECT id FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    if (!dealer) return fail('No dealer profile', 404);

    const b = schema.parse(await readJson(req));
    await db.run(
      `UPDATE dealer_profiles SET dealer_name=?, phone=?, email=?, whatsapp=?, address=?, city=?, state=?, pincode=?, about=?, brands=?, updated_at=?
        WHERE id = ?`,
      [b.dealer_name, b.phone, b.email, b.whatsapp || null, b.address, b.city, b.state, b.pincode,
       b.about || null, JSON.stringify(b.brands || []), nowIso(), dealer.id],
    );
    await audit(user, 'dealer.update_profile', 'dealer_profile', dealer.id);
    return ok({ id: dealer.id }, 'Profile updated');
  } catch (e) {
    return handleError(e);
  }
}
