import { NextRequest } from 'next/server';
import { db, insert, nowIso, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { dealerRegisterSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { isOwnPrivateUploadKey } from '@/services/storage';

/** Dealer applications always start as `pending` — an admin must verify them. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await rateLimit('dealer_register', { limit: 3, windowSeconds: 3600, key: user.id });
    if (!limited.ok) return fail('Too many applications. Please contact support.', 429);

    const existing = await db.get<any>('SELECT id, status FROM dealer_profiles WHERE user_id = ? AND deleted_at IS NULL', [user.id]);
    if (existing) return fail(`You already have a dealer application (${existing.status}).`, 409);

    const body = dealerRegisterSchema.parse(await readJson(req));
    if (!isOwnPrivateUploadKey(body.visiting_card_key, 'dealer_document', user.id)) {
      return fail('Please upload the visiting card through this form before submitting.', 422, {
        visiting_card_key: 'Upload a valid visiting card for dealership confirmation',
      });
    }
    const emailProof = await db.get<any>(
      "SELECT id FROM verification_records WHERE entity_type = 'dealer_registration_email' AND entity_id = ? AND check_type = 'business_email' AND result = 'passed' AND evidence_note = ? ORDER BY created_at DESC LIMIT 1",
      [user.id, body.email],
    );
    if (!emailProof) {
      return fail('Verify the dealer email with the OTP before submitting the application.', 422, {
        email: 'Verify this email address first',
      });
    }

    const id = uid('dlr');
    await db.tx(async () => {
      await insert('dealer_profiles', {
        id, user_id: user.id,
        business_name: body.business_name, dealer_name: body.dealer_name,
        phone: body.phone, email: body.email, whatsapp: body.whatsapp || null,
        gstin: body.gstin || null, address: body.address, city: body.city,
        state: body.state, pincode: body.pincode,
        brands: JSON.stringify(body.brands || []), about: body.about || null,
        status: 'pending', email_verified: 1,
      });
      await insert('dealer_documents', {
        id: uid('doc'), dealer_id: id, doc_type: 'visiting_card',
        storage_key: body.visiting_card_key, private: 1, status: 'pending',
        note: 'Required visiting card submitted with dealership registration',
      });
    });

    await db.run('UPDATE verification_records SET result = \'consumed\', updated_at = ? WHERE id = ?', [nowIso(), emailProof.id]);
    await db.run("UPDATE otp_codes SET consumed = 1, updated_at = ? WHERE destination = ? AND purpose = 'dealer_register_email' AND consumed = 2", [nowIso(), body.email]);
    await audit(user, 'dealer.apply', 'dealer_profile', id);
    return ok({ id, status: 'pending', email: body.email, email_verified: true }, 'Application submitted for verification');
  } catch (e) {
    return handleError(e);
  }
}
