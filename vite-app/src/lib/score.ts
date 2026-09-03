import type { BikeFeature, BikeSpec, BikeModel, ScoreWeights } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CompareBike Score
//
// A transparent, editable 0–100 comparison score calculated by this site.
// Weights are stored in site_settings ("score_weights") and can be adjusted
// by the admin; they must sum to 100.
//
// Categories: performance, mileage, safety, features, comfort, value, price,
// ev_range (EV only). Categories without data are excluded and remaining
// weights are renormalised, so partial data never hides a bike.
//
// "CompareBike Score is our site's calculated comparison score and is not an
// official rating."
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: ScoreWeights = {
  performance: 20,
  mileage: 20,
  safety: 15,
  features: 15,
  comfort: 10,
  value: 10,
  price: 10,
  ev_range: 0,
};

export const SCORE_CATEGORY_LABELS: Record<keyof ScoreWeights, string> = {
  performance: 'Performance',
  mileage: 'Mileage / Range',
  safety: 'Safety',
  features: 'Features',
  comfort: 'Comfort',
  value: 'Value',
  price: 'Price',
  ev_range: 'EV Range',
};

export const SCORE_DISCLAIMER =
  'CompareBike Score is our site’s calculated comparison score and is not an official rating.';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export interface ScoreInput {
  ev: boolean;
  power_ps?: number | null;
  torque_nm?: number | null;
  top_speed_kmph?: number | null;
  mileage_kmpl?: number | null;
  range_km?: number | null;
  price?: number | null;
  kerb_weight_kg?: number | null;
  seat_height_mm?: number | null;
  ground_clearance_mm?: number | null;
  safety_flags: boolean[]; // true for each available safety spec (ABS, traction control…)
  has_any_safety: boolean;
  feature_flags: boolean[]; // included features
  spec_count: number; // number of specs defined (value-for-money signal)
}

/**
 * Build the score input from full specification data.
 * Spec names are matched case-insensitively; the score never invents values —
 * anything missing is simply excluded from that category.
 */
export function inputFromSpecs(model: BikeModel, specs: BikeSpec[], features: BikeFeature[]): ScoreInput {
  const ev = model.fuel_type === 'electric';
  const find = (terms: string[], numeric = false) => {
    const hit = specs.find((s) => {
      const name = (s.spec_name || '').toLowerCase();
      if (!terms.some((t) => name.includes(t))) return false;
      if (numeric) return s.value_numeric != null;
      return s.value_text != null || s.value_boolean != null;
    });
    return hit;
  };
  const power = model.power_ps ?? find(['power'], true)?.value_numeric ?? null;
  const torque = model.torque_nm ?? find(['torque'], true)?.value_numeric ?? null;
  const speed = model.top_speed_kmph ?? find(['top speed', 'top speed'], true)?.value_numeric ?? null;
  const mileage = model.mileage_kmpl ?? (ev ? null : find(['mileage'], true)?.value_numeric ?? null);
  const range = ev ? model.range_km ?? find(['range'], true)?.value_numeric ?? null : null;
  const price = model.price_start;
  const weight = find(['kerb weight', 'weight'], true)?.value_numeric ?? null;
  const seat = find(['seat height'], true)?.value_numeric ?? null;
  const clearance = find(['ground clearance'], true)?.value_numeric ?? null;
  const bool = (terms: string[]) => find(terms)?.value_boolean ?? false;
  const safetyFlags = [
    bool(['abs']),
    bool(['traction control']),
    bool(['speed limiter', 'cruise control']),
    bool(['dual channel abs']),
  ];
  const featureFlags = features
    .filter((f) => f.included)
    .map(() => true);
  return {
    ev,
    power_ps: power,
    torque_nm: torque,
    top_speed_kmph: speed,
    mileage_kmpl: ev ? null : mileage,
    range_km: ev ? range : null,
    price,
    kerb_weight_kg: weight,
    seat_height_mm: seat,
    ground_clearance_mm: clearance,
    safety_flags: safetyFlags,
    has_any_safety: safetyFlags.some(Boolean) || model.abs_enabled == null ? safetyFlags.some(Boolean) : Boolean(model.abs_enabled),
    feature_flags: featureFlags,
    spec_count: specs.length + features.length,
  };
}

export interface CategoryScore {
  key: keyof ScoreWeights;
  label: string;
  score: number | null; // null = no data
  weight: number;
}

export interface ScoreResult {
  overall: number; // 0-100, 1 decimal
  categories: CategoryScore[];
  dataCoverage: number; // % of weighted categories that had data
}

export function calculateScore(input: ScoreInput, weights: ScoreWeights): ScoreResult {
  const cats: Record<string, number | null> = {};

  // Performance — power / torque / top speed, normalised against class ceiling
  {
    const parts: number[] = [];
    if (input.power_ps) parts.push(clamp01(input.power_ps / 250));
    if (input.torque_nm) parts.push(clamp01(input.torque_nm / 250));
    if (input.top_speed_kmph) parts.push(clamp01(input.top_speed_kmph / 200));
    cats.performance = parts.length ? (parts.reduce((a, b) => a + b, 0) / parts.length) * 100 : null;
  }
  // Mileage / EV range
  {
    if (input.ev) {
      cats.mileage = input.range_km ? clamp01(input.range_km / 350) * 100 : null;
    } else {
      cats.mileage = input.mileage_kmpl ? clamp01(input.mileage_kmpl / 80) * 100 : null;
    }
  }
  // Safety
  {
    if (input.has_any_safety) {
      const flags = input.safety_flags.filter(Boolean).length;
      cats.safety = Math.min(100, 45 + flags * 15);
    } else {
      cats.safety = null;
    }
  }
  // Features
  {
    cats.features = input.feature_flags.length
      ? clamp01(input.feature_flags.length / 12) * 100
      : input.spec_count >= 8
        ? 40
        : null;
  }
  // Comfort
  {
    const parts: number[] = [];
    if (input.seat_height_mm) parts.push(input.seat_height_mm >= 740 && input.seat_height_mm <= 830 ? 0.75 : 0.55);
    if (input.ground_clearance_mm) parts.push(clamp01((input.ground_clearance_mm - 130) / 60));
    if (input.kerb_weight_kg) parts.push(clamp01(1 - (input.kerb_weight_kg - 100) / 220));
    cats.comfort = parts.length ? (parts.reduce((a, b) => a + b, 0) / parts.length) * 100 : null;
  }
  // Value — how much equipment per rupee
  {
    if (input.price && input.spec_count) {
      const perLakh = input.spec_count / (input.price / 100000);
      cats.value = clamp01(perLakh / 30) * 100;
    } else {
      cats.value = null;
    }
  }
  // Price — affordability (lower is better)
  {
    if (input.price) {
      cats.price = clamp01(1 - input.price / 3000000) * 100;
    } else {
      cats.price = null;
    }
  }
  // EV range (separate category when weighted)
  {
    if (input.ev) cats.ev_range = input.range_km ? clamp01(input.range_km / 350) * 100 : null;
    else cats.ev_range = null;
  }

  const keys = Object.keys(DEFAULT_WEIGHTS) as (keyof ScoreWeights)[];
  const categories: CategoryScore[] = keys
    .filter((k) => weights[k] > 0)
    .map((k) => ({ key: k, label: SCORE_CATEGORY_LABELS[k], score: cats[k], weight: weights[k] }));

  const scored = categories.filter((c) => c.score != null);
  const totalW = scored.reduce((a, c) => a + c.weight, 0);
  const overall =
    totalW === 0 ? 0 : Math.round((scored.reduce((a, c) => a + (c.score as number) * c.weight, 0) / totalW) * 10) / 10;
  const fullW = categories.reduce((a, c) => a + c.weight, 0);
  const dataCoverage = fullW === 0 ? 0 : Math.round((totalW / fullW) * 100);

  return { overall, categories, dataCoverage };
}

/** Fast score used for list-page sorting (top-level model fields only). */
export function quickScore(model: BikeModel, weights: ScoreWeights): number {
  const input: ScoreInput = {
    ev: model.fuel_type === 'electric',
    power_ps: model.power_ps,
    torque_nm: model.torque_nm,
    top_speed_kmph: model.top_speed_kmph,
    mileage_kmpl: model.fuel_type === 'electric' ? null : model.mileage_kmpl,
    range_km: model.fuel_type === 'electric' ? model.range_km : null,
    price: model.price_start,
    safety_flags: [Boolean(model.abs_enabled)],
    has_any_safety: Boolean(model.abs_enabled),
    feature_flags: [],
    spec_count: 0,
  };
  return calculateScore(input, weights).overall;
}

export function rankWithMedals(scored: { id: string; overall: number }[]): Map<string, number> {
  const sorted = [...scored].sort((a, b) => b.overall - a.overall);
  const map = new Map<string, number>();
  sorted.forEach((s, i) => map.set(s.id, i + 1));
  return map;
}
