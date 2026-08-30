import { describe, it, expect } from 'vitest';
import { computeTrust, REQUIRED_ANGLES } from '@/lib/trust';

const full = {
  checks: [
    { check_type: 'seller_identity', result: 'passed' },
    { check_type: 'rc_verification', result: 'passed' },
    { check_type: 'insurance_verification', result: 'passed' },
    { check_type: 'service_history', result: 'passed' },
    { check_type: 'physical_inspection', result: 'passed' },
  ],
  photoAngles: REQUIRED_ANGLES,
  infoFields: { km_driven: 20000, owners: 1, manufacture_year: 2022, city: 'Coimbatore', asking_price: 90000, description: 'Well kept' },
};

describe('Used-bike trust score', () => {
  it('scores zero and refuses the word "verified" when nothing was checked', () => {
    const r = computeTrust({ checks: [], photoAngles: [], infoFields: {} });
    expect(r.score).toBe(0);
    expect(r.band).toBe('needs_verification');
    expect(r.label.toLowerCase()).not.toContain('verified bike');
  });

  it('awards points only for checks recorded as passed', () => {
    const pending = computeTrust({ ...full, checks: full.checks.map((c) => ({ ...c, result: 'not_checked' })) });
    expect(pending.score).toBeLessThan(computeTrust(full).score);
  });

  it('ignores failed checks rather than crediting them', () => {
    const failed = computeTrust({ ...full, checks: full.checks.map((c) => ({ ...c, result: 'failed' })) });
    const passed = computeTrust(full);
    expect(failed.score).toBeLessThan(passed.score);
  });

  it('reaches a high band with a complete, inspected listing', () => {
    const r = computeTrust(full);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(['excellent', 'good']).toContain(r.band);
  });

  it('rewards a complete photo set', () => {
    const few = computeTrust({ ...full, photoAngles: ['front'] });
    expect(few.score).toBeLessThan(computeTrust(full).score);
  });

  it('never exceeds 100 and explains every factor', () => {
    const r = computeTrust(full);
    expect(r.score).toBeLessThanOrEqual(100);
    for (const f of r.factors) {
      expect(f.note.length).toBeGreaterThan(0);
      expect(f.earned).toBeLessThanOrEqual(f.possible);
    }
  });
});
