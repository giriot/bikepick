import { BIKE_SPEC_KEYS, EV_SPEC_KEYS } from './spec-fields';
import { aiComplete } from './oem-ai';

/**
 * AI template generation — the admin enters only the brand + model name and
 * the AI drafts the WHOLE listing template:
 *   - full specification sheet (whitelisted columns only)
 *   - manufacturer extras (max 8)
 *   - all variants with ex-showroom prices + colours
 *   - per-variant comparison values (for the variant table on the model page)
 *   - pros & cons
 *
 * Nothing is saved here — the result goes to the admin for review and is
 * applied through the normal audited flows. Values come from the AI's
 * knowledge (not from a fetched OEM page), which is exactly why the admin
 * must verify before publishing.
 */

export interface AiVariant {
  name: string;
  price: number | null;
  on_road_price: number | null;
  colours: string | null;
  is_new: boolean;
  variant_specs: Record<string, any>;
}

export interface AiTemplateResult {
  provider: string;
  specs: Record<string, any>;
  extras: Record<string, string>;
  variants: AiVariant[];
  pros: string[];
  cons: string[];
  best_for: string[];
  warnings: string[];
}

/** Per-variant fields used by the public variant comparison table. */
const VARIANT_SPEC_KEYS: readonly string[] = [
  'engine_capacity_cc', 'max_power_bhp', 'max_power_rpm', 'max_torque_nm', 'max_torque_rpm',
  'transmission', 'gearbox', 'clutch', 'front_brake', 'rear_brake', 'abs_type', 'cbs',
  'wheel_type', 'seat_type', 'instrument_cluster', 'drl', 'bluetooth', 'navigation',
  'usb_charging', 'keyless_start', 'cruise_control', 'ride_modes', 'fuel_tank_l',
  'kerb_weight_kg', 'mileage_kmpl', 'top_speed_kmph',
  // EV-only (ignored automatically for petrol models)
  'battery_capacity_kwh', 'claimed_range_km', 'real_world_range_km', 'fast_charging',
  'fast_charge_time_min', 'charging_time_hours', 'charging_connector', 'regen_braking', 'peak_power_kw', 'torque_nm',
];

const BOOL_KEYS = new Set([
  'cbs', 'traction_control', 'drl', 'bluetooth', 'navigation', 'usb_charging', 'keyless_start',
  'cruise_control', 'hill_hold', 'reverse_mode', 'fast_charging', 'home_charging', 'portable_charger', 'regen_braking',
]);
const NUM_KEYS = new Set([
  'engine_capacity_cc', 'max_power_bhp', 'max_power_rpm', 'max_torque_nm', 'max_torque_rpm', 'top_speed_kmph',
  'mileage_kmpl', 'fuel_tank_l', 'length_mm', 'width_mm', 'height_mm', 'wheelbase_mm', 'seat_height_mm',
  'ground_clearance_mm', 'kerb_weight_kg', 'service_interval_km', 'est_service_cost',
  'motor_power_kw', 'peak_power_kw', 'torque_nm', 'battery_capacity_kwh', 'claimed_range_km',
  'real_world_range_km', 'charging_time_hours', 'fast_charge_time_min', 'running_cost_per_km', 'est_battery_replacement_cost',
]);
const INT_KEYS = new Set(['max_power_rpm', 'max_torque_rpm', 'fast_charge_time_min', 'service_interval_km']);

// mentionSearch MUST match whether the google_search tool is actually
// attached to the request: telling the model it has a search tool when it
// does not makes it emit a malformed function call and return no text.
const SEARCH_PREAMBLE = (brand: string, model: string) =>
  `You have a Google Search tool. BEFORE answering, search the web for this model's current Indian variants, ex-showroom prices and features (e.g. "${brand} ${model} variants price India", "${brand} ${model} specifications") and base your answer on the search results — do NOT answer from memory alone, especially for older or uncommon models. If the search results disagree, prefer the most recent authoritative source.

Using the search results, `;
const MEMORY_PREAMBLE = `Using your own knowledge of this model (current Indian model year), create a COMPLETE specification sheet — go through every section deliberately: engine & performance, dimensions & weight, brakes, tyres & suspension, features & technology, ownership & cost. Do not stop early or return a partial sheet. `;

const PROMPT = (brand: string, model: string, fuelType: string, keys: readonly string[], vkeys: readonly string[], mentionSearch: boolean) => `You are creating a motorcycle listing template for the Indian market for the website Bikepick.
Model: ${brand} ${model} (${fuelType === 'electric' ? 'electric two-wheeler' : 'petrol motorcycle/scooter'}).

${mentionSearch ? SEARCH_PREAMBLE(brand, model) : MEMORY_PREAMBLE}output STRICT JSON only (no markdown, no comments, no text outside the JSON) with exactly this shape:
{
  "specs": { ... },
  "extras": { ... },
  "variants": [ { "name": "...", "price": <number or null>, "on_road_price": <number or null>, "colours": "comma,separated or null", "is_new": true|false, "variant_specs": { ... } } ],
  "pros": ["...", "..."],
  "cons": ["...", "..."],
  "best_for": ["...", "..."],
  "warnings": ["..."]
}

RULES:
1. "specs" keys may ONLY be: ${keys.join(', ')}. Use "true"/"false" for boolean keys, JSON numbers for number keys, short strings otherwise. FILL EVERY key you can determine for this model — aim for a full sheet, not a partial one. OMIT only what you genuinely cannot determine, and never invent a number; list anything uncertain in "warnings".
2. Indian context: prices in ₹ (Delhi ex-showroom), displacement cc, power bhp, torque Nm, mileage kmpl (IDC if that is what is claimed), dimensions mm, weight kg.
3. "extras": up to 12 important manufacturer spec fields that are NOT in the allowed specs keys, each {"Label": "value"}.
4. "variants": list EVERY trim/variant of this model currently sold in India — one entry per trim (e.g. Drum, Disc, LED, Digital, top-end sport edition). Do NOT skip, merge or "pick the popular" trims: if the model is sold in 2 or 3 variants in India, output exactly 2 or 3 entries. If you are unsure whether a trim exists, include it and flag it in "warnings". "price" = ex-showroom ₹ as a plain number (e.g. 92806). "on_road_price" only if you are confident, else null. "is_new" = true only for trims launched within the last ~12 months.
5. "variant_specs": per-variant values that DIFFER from the base model, using ONLY these keys: ${vkeys.join(', ')}. Include only keys that genuinely differ for that trim (brakes, display, connectivity, seat, battery, range…). Empty object {} is fine when the trim shares everything with the base model.
6. "pros": 4–6 short factual strengths. "cons": 3–5 short factual drawbacks. Both in plain English, no marketing exaggeration. "best_for": 2–4 short phrases (max 6 words each) naming the rider profiles / use cases this model suits best (e.g. "city commuters", "first-time riders", "highway commuters", "delivery riders") — inferred from its price, size, mileage and features.
7. "warnings": 1–3 short notes for anything you are not fully certain about (e.g. "2026 price unconfirmed — verify before publishing"). If everything is solid, use [].
8. Keep every string under 160 characters.`;

function parseJson(text: string): any {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('AI returned no JSON object');
  return JSON.parse(t.slice(start, end + 1));
}

function cleanNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanVariant(v: any, fuelType: string): AiVariant | null {
  if (!v || typeof v.name !== 'string' || !v.name.trim()) return null;
  const allowed = new Set<string>([...VARIANT_SPEC_KEYS]);
  if (fuelType !== 'electric') {
    for (const evOnly of ['battery_capacity_kwh', 'claimed_range_km', 'real_world_range_km', 'fast_charging', 'fast_charge_time_min', 'charging_time_hours', 'charging_connector', 'regen_braking', 'peak_power_kw', 'torque_nm']) allowed.delete(evOnly);
  }
  const vs: Record<string, any> = {};
  const src = v.variant_specs && typeof v.variant_specs === 'object' ? v.variant_specs : {};
  const BLANK = new Set(['false', 'no', 'none', 'n/a', 'na', 'null', 'unknown', '—']);
  for (const [k, val] of Object.entries(src)) {
    if (!allowed.has(k) || val === undefined || val === null || val === '') continue;
    if (typeof val === 'string' && BLANK.has(val.trim().toLowerCase())) continue;
    if (BOOL_KEYS.has(k)) { if (val === true || val === 1 || val === 'true' || val === 'yes') vs[k] = true; }
    else if (INT_KEYS.has(k)) { const n = cleanNumber(val); if (n) vs[k] = Math.round(n); }
    else if (NUM_KEYS.has(k)) { const n = cleanNumber(val); if (n) vs[k] = n; }
    else vs[k] = String(val).slice(0, 120);
  }
  return {
    name: v.name.trim().slice(0, 80),
    price: cleanNumber(v.price),
    on_road_price: cleanNumber(v.on_road_price),
    colours: typeof v.colours === 'string' && v.colours.trim() ? v.colours.trim().slice(0, 200) : null,
    is_new: v.is_new === true,
    variant_specs: vs,
  };
}

export async function generateBikeTemplate(brand: string, model: string, fuelType: string): Promise<AiTemplateResult> {
  const isEv = fuelType === 'electric';
  const keys = (isEv ? EV_SPEC_KEYS : BIKE_SPEC_KEYS) as readonly string[];
  const vkeys = VARIANT_SPEC_KEYS;

  // 16k output budget: thinking tokens count against it on generation-3
  // models, and the template JSON (specs + variants + pros/cons) is large.
  // The prompt adapts: it only mentions the search tool when the call
  // actually carries the tool (callGemini degrades when search is down).
  const { provider, text } = await aiComplete((o) => PROMPT(brand, model, fuelType, keys, vkeys, o.search), 16384, true);
  let raw: any;
  try {
    raw = parseJson(text);
  } catch (e: any) {
    throw new Error(`AI response was not valid JSON (${e?.message || 'parse error'}). Try again.`);
  }

  // specs — whitelist only
  const specs: Record<string, any> = {};
  const srcSpecs = raw.specs && typeof raw.specs === 'object' ? raw.specs : {};
  const BLANK = new Set(['false', 'no', 'none', 'n/a', 'na', 'null', 'unknown', '—']);
  for (const [k, val] of Object.entries(srcSpecs)) {
    if (!keys.includes(k as any) || val === undefined || val === null || val === '') continue;
    if (typeof val === 'string' && BLANK.has(val.trim().toLowerCase())) continue; // "false" is not a value
    if (BOOL_KEYS.has(k)) { if (val === true || val === 1 || val === 'true' || val === 'yes') specs[k] = true; }
    else if (INT_KEYS.has(k)) { const n = cleanNumber(val); if (n) specs[k] = Math.round(n); }
    else if (NUM_KEYS.has(k)) { const n = cleanNumber(val); if (n) specs[k] = n; }
    else specs[k] = String(val).slice(0, 300);
  }

  // extras — max 8. Normalised to flat {Label: value} — the model sometimes returns
  // an array of objects or object values, which used to render as "[object Object]".
  const extras: Record<string, string> = {};
  const blankVals = new Set(['false', 'no', 'none', 'n/a', 'na', 'null', 'unknown', '—']);
  let n = 0;
  const takeExtra = (label: any, value: any) => {
    if (n >= 12) return;
    const k = String(label ?? '').trim();
    const v = (value && typeof value === 'object'
      ? String((value as any).value ?? (value as any).val ?? (value as any).text ?? '').trim()
      : String(value ?? '').trim());
    if (!k || !v || v === '[object Object]' || blankVals.has(v.toLowerCase())) return;
    extras[k.slice(0, 60)] = v.slice(0, 200);
    n++;
  };
  const srcExtras = raw.extras;
  if (Array.isArray(srcExtras)) {
    for (const item of srcExtras) {
      if (item && typeof item === 'object') {
        takeExtra(item.label ?? item.name ?? item.key ?? item.field ?? item.title ?? item.spec, item.value ?? item.val ?? item.text ?? item.answer ?? item.data);
      }
      // bare strings in the array have no label — unusable, skip
    }
  } else if (srcExtras && typeof srcExtras === 'object') {
    for (const [k, v] of Object.entries(srcExtras)) {
      if (v && typeof v === 'object') {
        takeExtra((v as any).label ?? (v as any).name ?? k, (v as any).value ?? (v as any).val ?? (v as any).text);
      } else {
        takeExtra(k, v);
      }
    }
  }

  // variants — max 12
  const variants: AiVariant[] = [];
  if (Array.isArray(raw.variants)) {
    for (const v of raw.variants.slice(0, 12)) {
      const cv = cleanVariant(v, fuelType);
      if (cv) variants.push(cv);
    }
  }

  const pros = Array.isArray(raw.pros) ? raw.pros.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 6).map((x: string) => x.slice(0, 160)) : [];
  const cons = Array.isArray(raw.cons) ? raw.cons.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 5).map((x: string) => x.slice(0, 160)) : [];
  const best_for = Array.isArray(raw.best_for) ? raw.best_for.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4).map((x: string) => x.slice(0, 80)) : [];
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 3).map((x: string) => x.slice(0, 160)) : [];

  return { provider, specs, extras, variants, pros, cons, best_for, warnings };
}

/**
 * Variant auto-detect pass. The main template can come back with fewer
 * variants than the model actually has in India (e.g. only "Standard").
 * This focused follow-up asks the AI to list EVERY other trim with its
 * details + comparison values, so the panel can merge them into the same
 * "Add variant + comparison" review flow.
 */

export interface AiVariantSweepResult {
  provider: string;
  variants: AiVariant[];
  warnings: string[];
}

const SWEEP_PROMPT = (brand: string, model: string, fuelType: string, vkeys: readonly string[], existing: string[], mentionSearch: boolean) => `You are completing the variant list for a ${fuelType === 'electric' ? 'electric two-wheeler' : 'motorcycle/scooter'} listing for the Indian market on Bikepick.
Model: ${brand} ${model}.
Variants already listed: ${existing.length ? existing.join('; ') : '(none)'}.

${mentionSearch
  ? `You have a Google Search tool. BEFORE answering, search the web for this model's complete Indian variant list and prices (e.g. "${brand} ${model} variants price India") and base your answer on the search results — do NOT answer from memory alone.`
  : `Use your own knowledge of this model's Indian variant list and prices.`}

TASK: list EVERY other variant/trim of this model currently sold in India that is NOT in the already-listed set. Never repeat an already-listed variant. If no other variant exists, return an empty list.

Output STRICT JSON only (no markdown, no text outside the JSON):
{ "variants": [ { "name": "...", "price": <ex-showroom ₹ number or null>, "on_road_price": <number or null>, "colours": "comma,separated or null", "is_new": true|false, "variant_specs": { ... } } ], "warnings": ["..."] }

RULES:
1. "price" = Delhi ex-showroom ₹ as a plain number (e.g. 92806). "on_road_price" only if you are confident, else null. "is_new" = true only for trims launched within the last ~12 months.
2. "variant_specs": per-variant values that DIFFER from the base or already-listed variants, using ONLY these keys: ${vkeys.join(', ')}. Include only keys that genuinely differ for that trim (drum vs disc brake, LED vs halogen, display type, ABS, seat, battery, range…). Empty {} when unsure.
3. If you are unsure whether a variant exists, still include it and flag it in "warnings".
4. Keep every string under 160 characters.`;

export async function generateVariantSweep(brand: string, model: string, fuelType: string, existingNames: string[]): Promise<AiVariantSweepResult> {
  const vkeys = VARIANT_SPEC_KEYS;
  const { provider, text } = await aiComplete((o) => SWEEP_PROMPT(brand, model, fuelType, vkeys, existingNames, o.search), 8192, true);
  let raw: any;
  try {
    raw = parseJson(text);
  } catch (e: any) {
    throw new Error(`AI response was not valid JSON (${e?.message || 'parse error'}). Try again.`);
  }
  const variants: AiVariant[] = [];
  const have = new Set(existingNames.map((n) => n.toLowerCase().trim()));
  if (Array.isArray(raw.variants)) {
    for (const v of raw.variants.slice(0, 12)) {
      const cv = cleanVariant(v, fuelType);
      if (!cv) continue;
      if (have.has(cv.name.toLowerCase())) continue;
      have.add(cv.name.toLowerCase());
      variants.push(cv);
    }
  }
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 3).map((x: string) => x.slice(0, 160)) : [];
  return { provider, variants, warnings };
}
