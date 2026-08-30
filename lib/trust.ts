/**
 * Used-bike Trust Score.
 *
 * RULE: points are awarded only for checks that were ACTUALLY performed and
 * recorded in verification_records. Nothing is assumed, nothing is implied.
 * A listing with no completed checks scores 0 and is labelled
 * "Needs verification" — never "verified".
 */
export type CheckType =
  | 'seller_identity' | 'ownership_declaration' | 'rc_verification' | 'insurance_verification'
  | 'puc_verification' | 'loan_status' | 'service_history' | 'physical_inspection';

export type CheckResult = 'not_checked' | 'passed' | 'failed' | 'unavailable';

export interface TrustWeights {
  seller_verified: number; rc_checked: number; insurance_checked: number;
  service_history: number; inspection: number; photos_complete: number; info_complete: number;
}

export const DEFAULT_TRUST_WEIGHTS: TrustWeights = {
  seller_verified: 20, rc_checked: 20, insurance_checked: 12,
  service_history: 12, inspection: 20, photos_complete: 8, info_complete: 8,
};

export interface TrustInput {
  checks: { check_type: string; result: string }[];
  photoAngles: string[];
  requiredAngles?: string[];
  infoFields: Record<string, unknown>;
}

export interface TrustFactor { key: string; label: string; earned: number; possible: number; state: 'done' | 'partial' | 'missing'; note: string }
export interface TrustResult { score: number; band: 'excellent' | 'good' | 'needs_verification'; label: string; factors: TrustFactor[] }

export const REQUIRED_ANGLES = ['front', 'rear', 'left', 'right', 'odometer', 'engine', 'tyres'];

export function computeTrust(input: TrustInput, weights: TrustWeights = DEFAULT_TRUST_WEIGHTS): TrustResult {
  const passed = (t: CheckType) => input.checks.some((c) => c.check_type === t && c.result === 'passed');
  const factors: TrustFactor[] = [];

  const add = (key: keyof TrustWeights, label: string, done: boolean, doneNote: string, missNote: string) =>
    factors.push({
      key, label, possible: weights[key], earned: done ? weights[key] : 0,
      state: done ? 'done' : 'missing', note: done ? doneNote : missNote,
    });

  add('seller_verified', 'Seller identity verified', passed('seller_identity'),
    'Seller identity confirmed by our team.', 'Seller identity not yet confirmed.');
  add('rc_checked', 'RC verified', passed('rc_verification'),
    'Registration certificate checked against the listing.', 'RC not checked.');
  add('insurance_checked', 'Insurance verified', passed('insurance_verification'),
    'Insurance document checked.', 'Insurance not checked.');
  add('service_history', 'Service history reviewed', passed('service_history'),
    'Service records reviewed.', 'Service records not reviewed.');
  add('inspection', 'Physical inspection completed', passed('physical_inspection'),
    'A physical inspection was completed and reported.', 'No physical inspection has been performed.');

  const required = input.requiredAngles || REQUIRED_ANGLES;
  const have = required.filter((a) => input.photoAngles.includes(a));
  const photoRatio = have.length / required.length;
  factors.push({
    key: 'photos_complete', label: 'Photo set complete',
    possible: weights.photos_complete, earned: Math.round(weights.photos_complete * photoRatio),
    state: photoRatio === 1 ? 'done' : photoRatio > 0 ? 'partial' : 'missing',
    note: `${have.length} of ${required.length} required angles uploaded${photoRatio < 1 ? ` (missing: ${required.filter((a) => !have.includes(a)).join(', ')})` : ''}.`,
  });

  const infoKeys = Object.keys(input.infoFields);
  const filled = infoKeys.filter((k) => {
    const v = input.infoFields[k];
    return v !== null && v !== undefined && v !== '';
  });
  const infoRatio = infoKeys.length ? filled.length / infoKeys.length : 0;
  factors.push({
    key: 'info_complete', label: 'Vehicle information complete',
    possible: weights.info_complete, earned: Math.round(weights.info_complete * infoRatio),
    state: infoRatio >= 0.99 ? 'done' : infoRatio > 0 ? 'partial' : 'missing',
    note: `${filled.length} of ${infoKeys.length} declared details provided.`,
  });

  const score = Math.min(100, factors.reduce((a, f) => a + f.earned, 0));
  const band = score >= 75 ? 'excellent' : score >= 45 ? 'good' : 'needs_verification';
  const label = band === 'excellent' ? 'Excellent' : band === 'good' ? 'Good' : 'Needs verification';
  return { score, band, label, factors };
}
