import { NextRequest } from 'next/server';
import { db, insert, nowIso, uid } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { usedBikeSchema } from '@/lib/validation';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { rateLimit } from '@/lib/ratelimit';
import { slugify, normalizeKey } from '@/lib/slug';
import { estimateUsedPrice, judgeAskingPrice } from '@/lib/calculators';
import { computeTrust, DEFAULT_TRUST_WEIGHTS, type TrustWeights } from '@/lib/trust';
import { getJsonSetting, getSetting } from '@/lib/settings';
import { audit, track } from '@/lib/audit';
import { notify } from '@/lib/notify';

/**
 * Seller submission. A listing NEVER goes live here — it enters the mandatory
 * workflow at `verification_required` and only a verifier/admin can approve it.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await rateLimit('used_bike_submit', { limit: 5, windowSeconds: 3600, key: user.id });
    if (!limited.ok) return fail('You have submitted several listings recently. Please try again later.', 429);

    const body = usedBikeSchema.parse(await readJson(req));
    const minPhotos = Number((await getSetting('used_bike_min_photos')) || 5);
    if (body.images.length < minPhotos) return fail(`At least ${minPhotos} photos are required`, 422);

    // Match to a catalogue product where possible (helps search and valuation).
    let productId = body.product_id && body.product_id !== 'other' ? body.product_id : null;
    let brandId: string | null = null;
    const brandRow = await db.get<any>('SELECT id FROM brands WHERE LOWER(name) = ?', [body.brand_name.toLowerCase()]);
    brandId = brandRow?.id || null;
    if (!productId) {
      const match = await db.get<any>('SELECT id FROM products WHERE normalized_key = ?', [normalizeKey(body.brand_name, body.model_name)]);
      productId = match?.id || null;
    }

    // Estimate a market range from our own catalogue price.
    let estMin: number | null = null, estMax: number | null = null, verdict: string | null = null;
    const basePriceRow = productId ? await db.get<any>('SELECT price_min FROM products WHERE id = ?', [productId]) : null;
    if (basePriceRow?.price_min) {
      const est = estimateUsedPrice({
        basePrice: basePriceRow.price_min, manufactureYear: body.manufacture_year, kmDriven: body.km_driven,
        owners: body.owners, condition: body.condition_grade, insuranceStatus: body.insurance_status,
        serviceHistory: body.service_history, accidentHistory: body.accident_history, cityTier: 2,
      });
      estMin = est.min; estMax = est.max;
      verdict = judgeAskingPrice(body.asking_price, est).verdict;
    }

    const id = uid('usd');
    const slug = `${slugify(`${body.brand_name}-${body.model_name}-${body.manufacture_year}-${body.city}`)}-${id.slice(-6)}`;

    // Trust score at submission time: no checks completed yet, so it is low by design.
    const weights = await getJsonSetting<TrustWeights>('trust_weights', DEFAULT_TRUST_WEIGHTS);
    const trust = computeTrust(
      {
        checks: [],
        photoAngles: body.images.map((i) => i.angle),
        infoFields: {
          insurance_status: body.insurance_status, rc_available: body.rc_available,
          loan_status: body.loan_status, service_history: body.service_history,
          accident_history: body.accident_history, tyre_condition: body.tyre_condition,
          description: body.description,
        },
      },
      weights,
    );

    await insert('used_bikes', {
      id, seller_id: user.id, seller_type: user.role === 'dealer' ? 'dealer' : 'individual',
      product_id: productId, brand_id: brandId, brand_name: body.brand_name, model_name: body.model_name,
      variant_name: body.variant_name || null, slug,
      manufacture_year: body.manufacture_year, registration_year: body.registration_year || null,
      km_driven: body.km_driven, owners: body.owners, fuel_type: body.fuel_type,
      city: body.city, state: body.state || null, pincode: body.pincode || null,
      asking_price: body.asking_price, estimated_price_min: estMin, estimated_price_max: estMax,
      price_verdict: verdict, condition_grade: body.condition_grade,
      insurance_status: body.insurance_status, insurance_valid_till: body.insurance_valid_till || null,
      rc_available: body.rc_available, loan_status: body.loan_status,
      service_history: body.service_history, accident_history: body.accident_history,
      tyre_condition: body.tyre_condition, battery_condition: body.battery_condition || null,
      abs_equipped: body.abs_equipped ? 1 : 0, description: body.description || null,
      status: 'verification_required',
      trust_score: trust.score, trust_band: trust.band, trust_breakdown: JSON.stringify(trust),
      submitted_at: nowIso(),
    });

    for (let i = 0; i < body.images.length; i++) {
      await insert('used_bike_images', {
        id: uid('uim'), used_bike_id: id, angle: body.images[i].angle,
        image_url: body.images[i].image_url, approved: 0, sort_order: i,
      });
    }

    // Open the required verification checks as "not_checked" — honest by default.
    for (const check of ['seller_identity', 'ownership_declaration', 'rc_verification', 'insurance_verification', 'loan_status', 'service_history']) {
      await insert('verification_records', {
        id: uid('vrf'), entity_type: 'used_bike', entity_id: id, check_type: check, result: 'not_checked',
      });
    }

    await notify({
      userId: user.id, event: 'verification_result',
      title: 'Listing received — verification pending',
      body: 'We will verify your identity and documents before your listing goes public.',
      link: '/account/listings', email: user.email, phone: user.phone,
    });
    await audit(user, 'used_bike.submit', 'used_bike', id);
    await track('used_bike_submitted', { entity_type: 'used_bike', entity_id: id, user_id: user.id });

    return ok({ id, slug, status: 'verification_required' }, 'Listing submitted for verification');
  } catch (e) {
    return handleError(e);
  }
}
