import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { estimateUsedPrice, judgeAskingPrice } from '@/lib/calculators';
import { normalizeKey } from '@/lib/slug';
import { handleError, ok, readJson } from '@/lib/api';

const schema = z.object({
  product_id: z.string().optional(),
  brand_name: z.string().min(1),
  model_name: z.string().min(1),
  manufacture_year: z.coerce.number().int(),
  km_driven: z.coerce.number().int(),
  owners: z.coerce.number().int().min(1),
  condition: z.enum(['excellent', 'good', 'fair', 'needs_work']),
  insurance_status: z.enum(['comprehensive', 'third_party', 'expired', 'none']).optional(),
  service_history: z.enum(['full_authorised', 'partial', 'local', 'none']).optional(),
  accident_history: z.enum(['none', 'minor', 'major']).optional(),
  city: z.string().optional(),
  asking_price: z.coerce.number().optional(),
});

const TIER1 = ['mumbai', 'delhi', 'bengaluru', 'bangalore', 'chennai', 'hyderabad', 'kolkata', 'pune', 'ahmedabad'];
const TIER2 = ['coimbatore', 'kochi', 'jaipur', 'lucknow', 'indore', 'nagpur', 'madurai', 'surat', 'bhopal', 'visakhapatnam'];

/**
 * Used-bike price estimator. The base price is looked up from our own product
 * database — if we have no reference price we say so rather than inventing one.
 */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await readJson(req));

    let base: number | null = null;
    if (body.product_id && body.product_id !== 'other') {
      const p = await db.get<any>('SELECT price_min FROM products WHERE id = ?', [body.product_id]);
      base = p?.price_min ?? null;
    }
    if (!base) {
      const p = await db.get<any>('SELECT price_min FROM products WHERE normalized_key = ?', [normalizeKey(body.brand_name, body.model_name)]);
      base = p?.price_min ?? null;
    }
    if (!base) {
      return ok({
        available: false,
        message: 'We do not have a reference new price for this model, so we cannot estimate a market range. Enter your own asking price — we will not guess one for you.',
      });
    }

    const city = (body.city || '').toLowerCase();
    const cityTier: 1 | 2 | 3 = TIER1.includes(city) ? 1 : TIER2.includes(city) ? 2 : 3;

    const result = estimateUsedPrice({
      basePrice: base,
      manufactureYear: body.manufacture_year,
      kmDriven: body.km_driven,
      owners: body.owners,
      condition: body.condition,
      insuranceStatus: body.insurance_status,
      serviceHistory: body.service_history,
      accidentHistory: body.accident_history,
      cityTier,
    });

    return ok({
      available: true,
      ...result,
      basePrice: base,
      verdict: body.asking_price ? judgeAskingPrice(body.asking_price, result) : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
