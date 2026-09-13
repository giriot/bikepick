import { NextRequest } from 'next/server';
import { db, insert, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { dealerRegisterSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { emailVerificationConfigured, sendDealerEmailOtp } from '@/lib/email-otp';
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
    if (!emailVerificationConfigured()) {
      return fail('Dealer email verification is not configured yet. Please try again shortly.', 503);
    }
    const otpLimited = await rateLimit('dealer_email_otp', { limit: 3, windowSeconds: 600, key: body.email });
    if (!otpLimited.ok) return fail(`Too many verification emails. Try again in ${otpLimited.retryAfter}s.`, 429);
    const delivery = await sendDealerEmailOtp(body.email);
    if (!delivery.delivered) return fail('Could not send the dealer confirmation email. Please try again shortly.', 503, {
      email: 'Confirmation email could not be sent',
    });

    const id = uid('dlr');
    await db.tx(async () => {
      await insert('dealer_profiles', {
        id, user_id: user.id,
        business_name: body.business_name, dealer_name: body.dealer_name,
        phone: body.phone, email: body.email, whatsapp: body.whatsapp || null,
        gstin: body.gstin || null, address: body.address, city: body.city,
        state: body.state, pincode: body.pincode,
        brands: JSON.stringify(body.brands || []), about: body.about || null,
        status: 'pending', email_verified: 0,
      });
      await insert('dealer_documents', {
        id: uid('doc'), dealer_id: id, doc_type: 'visiting_card',
        storage_key: body.visiting_card_key, private: 1, status: 'pending',
        note: 'Required visiting card submitted with dealership registration',
      });
    });

    await audit(user, 'dealer.apply', 'dealer_profile', id);
    return ok(
      { id, status: 'pending', email: body.email, needs_email_verification: true },
      'Application saved. We sent a verification code to the dealer email.',
    );
  } catch (e) {
    return handleError(e);
  }
}
