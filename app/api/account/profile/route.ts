import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, nowIso } from '@/lib/db';
import { requireUser, hashPassword } from '@/lib/auth';
import { handleError, ok, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { phoneSchema } from '@/lib/validation';

const schema = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: phoneSchema.optional().or(z.literal('')).nullable(),
  city: z.string().trim().max(60).optional().or(z.literal('')).nullable(),
  notify_email: z.boolean().optional(),
  notify_sms: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await readJson(req));
    const params: any[] = [body.full_name, body.phone || null, body.city || null, body.notify_email ? 1 : 0, body.notify_sms ? 1 : 0];
    let sql = 'UPDATE users SET full_name=?, phone=?, city=?, notify_email=?, notify_sms=?';
    if (body.password) { sql += ', password_hash=?'; params.push(hashPassword(body.password)); }
    sql += ', updated_at=? WHERE id=?';
    params.push(nowIso(), user.id);
    await db.run(sql, params);
    await audit(user, 'account.update_profile', 'user', user.id, { password_changed: !!body.password });
    return ok({ id: user.id }, 'Profile updated');
  } catch (e) {
    return handleError(e);
  }
}
