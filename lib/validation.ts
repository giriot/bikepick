import { z } from 'zod';

/**
 * Indian mobile number. People type spaces, dashes and +91 — we strip all of
 * that first and store a clean 10-digit number, instead of rejecting the entry.
 */
export const phoneSchema = z
  .string()
  .transform((v) => {
    const digits = String(v).replace(/\D/g, '');
    return digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  })
  .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number');

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email');

export const pincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode');

export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/, 'Enter a valid 15-character GSTIN');

export const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  city: z.string().trim().max(60).optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const leadSchema = z.object({
  lead_type: z.enum([
    'best_price', 'contact_dealer', 'whatsapp', 'call', 'request_offer', 'test_ride',
    'finance', 'insurance', 'service', 'inspection', 'used_bike_enquiry', 'bulk_purchase',
  ]),
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  city: z.string().trim().max(60).optional().or(z.literal('')),
  product_id: z.string().optional().or(z.literal('')),
  variant_id: z.string().optional().or(z.literal('')),
  dealer_id: z.string().optional().or(z.literal('')),
  offer_id: z.string().optional().or(z.literal('')),
  used_bike_id: z.string().optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional().or(z.literal('')),
  source: z.string().trim().max(120).optional().or(z.literal('')),
  campaign: z.string().trim().max(120).optional().or(z.literal('')),
  payload: z.record(z.any()).optional(),
});

export const dealerRegisterSchema = z.object({
  business_name: z.string().trim().min(3).max(120),
  dealer_name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema,
  whatsapp: phoneSchema.optional().or(z.literal('')),
  gstin: gstinSchema.optional().or(z.literal('')),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: pincodeSchema,
  brands: z.array(z.string()).default([]),
  about: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const offerSchema = z.object({
  product_id: z.string().min(1, 'Choose a product'),
  variant_id: z.string().optional().or(z.literal('')),
  city: z.string().trim().min(2),
  ex_showroom: z.coerce.number().nonnegative().optional(),
  on_road: z.coerce.number().nonnegative().optional(),
  insurance: z.coerce.number().nonnegative().optional(),
  registration: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  exchange_bonus: z.coerce.number().nonnegative().optional(),
  finance_offer: z.string().max(300).optional().or(z.literal('')),
  accessories_offer: z.string().max(300).optional().or(z.literal('')),
  offer_text: z.string().trim().min(5).max(500),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
});

export const usedBikeSchema = z.object({
  brand_name: z.string().trim().min(2),
  model_name: z.string().trim().min(1),
  variant_name: z.string().trim().max(80).optional().or(z.literal('')),
  product_id: z.string().optional().or(z.literal('')),
  manufacture_year: z.coerce.number().int().min(1990).max(new Date().getFullYear()),
  registration_year: z.coerce.number().int().min(1990).max(new Date().getFullYear()).optional(),
  km_driven: z.coerce.number().int().min(0).max(500000),
  owners: z.coerce.number().int().min(1).max(10),
  fuel_type: z.enum(['petrol', 'electric']),
  city: z.string().trim().min(2),
  state: z.string().trim().max(60).optional().or(z.literal('')),
  pincode: pincodeSchema.optional().or(z.literal('')),
  asking_price: z.coerce.number().min(1000).max(10000000),
  condition_grade: z.enum(['excellent', 'good', 'fair', 'needs_work']),
  insurance_status: z.enum(['comprehensive', 'third_party', 'expired', 'none']),
  insurance_valid_till: z.string().optional().or(z.literal('')),
  rc_available: z.enum(['original', 'duplicate', 'not_available']),
  loan_status: z.enum(['no_loan', 'loan_closed_noc', 'loan_running']),
  service_history: z.enum(['full_authorised', 'partial', 'local', 'none']),
  accident_history: z.enum(['none', 'minor', 'major']),
  tyre_condition: z.enum(['new', 'good', 'average', 'replace_soon']),
  battery_condition: z.enum(['new', 'good', 'average', 'replace_soon', 'na']).optional(),
  abs_equipped: z.coerce.boolean().optional(),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  images: z
    .array(z.object({ angle: z.string(), image_url: z.string().min(1) }))
    .default([]),
});

export const reviewSchema = z.object({
  product_id: z.string().min(1),
  rating: z.coerce.number().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal('')),
  variant_name: z.string().trim().max(80).optional().or(z.literal('')),
  pros: z.string().trim().max(600).optional().or(z.literal('')),
  cons: z.string().trim().max(600).optional().or(z.literal('')),
  body: z.string().trim().min(20, 'Please write at least 20 characters').max(3000),
  ownership_months: z.coerce.number().int().min(0).max(600).optional(),
  km_driven: z.coerce.number().int().min(0).max(500000).optional(),
});

export const priceAlertSchema = z.object({
  product_id: z.string().min(1),
  variant_id: z.string().optional().or(z.literal('')),
  city: z.string().trim().max(60).optional().or(z.literal('')),
  target_price: z.coerce.number().min(1000),
});

export type FieldErrors = Record<string, string>;

export function zodErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.errors) out[issue.path.join('.') || '_'] = issue.message;
  return out;
}
