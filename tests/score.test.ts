import { describe, it, expect } from 'vitest';
import { computeScore, DEFAULT_WEIGHTS } from '@/lib/score';

const petrol = {
  price: 150000,
  fuelType: 'petrol',
  bike: {
    engine_capacity_cc: 155, max_power_bhp: 18.4, max_torque_nm: 14.1, mileage_kmpl: 45,
    kerb_weight_kg: 141, seat_height_mm: 810, fuel_tank_l: 10, abs_type: 'dual-channel',
    braking_front: 'disc', braking_rear: 'disc', suspension_front: 'USD forks',
    service_interval_km: 6000, warranty_years: 2,
  },
  segment: { medianPrice: 150000, medianPower: 15 },
} as any;

describe('Bikepick Score', () => {
  it('returns a 0-100 total with pillar breakdown', () => {
    const r = computeScore(petrol);
    expect(r.total).toBeGreaterThan(0);
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.pillars.length).toBeGreaterThan(0);
    expect(r.coverage).toBeGreaterThan(0);
  });

  it('is deterministic — same input, same score', () => {
    expect(computeScore(petrol).total).toBe(computeScore(petrol).total);
  });

  it('rewards a cheaper bike with otherwise identical specs', () => {
    const cheap = computeScore({ ...petrol, price: 100000 });
    const dear = computeScore({ ...petrol, price: 220000 });
    expect(cheap.total).toBeGreaterThan(dear.total);
  });

  it('rewards better safety equipment', () => {
    const noAbs = computeScore({ ...petrol, bike: { ...petrol.bike, abs_type: null, braking_rear: 'drum' } });
    expect(computeScore(petrol).total).toBeGreaterThan(noAbs.total);
  });

  it('drops pillars with no data instead of guessing, and reports lower coverage', () => {
    const sparse = computeScore({ price: 90000, fuelType: 'petrol', bike: { engine_capacity_cc: 110 } } as any);
    expect(sparse.coverage).toBeLessThan(computeScore(petrol).coverage);
    expect(sparse.total).toBeGreaterThanOrEqual(0);
  });

  it('ignores commercial data entirely — the function accepts none', () => {
    const withJunk = computeScore({ ...petrol, featured: 1, sponsored: true, dealer_paid: 999999 } as any);
    expect(withJunk.total).toBe(computeScore(petrol).total);
  });

  it('respects custom admin weights', () => {
    const valueHeavy = computeScore(petrol, { ...DEFAULT_WEIGHTS, value: 80, features: 5, performance: 5, safety: 5, running_cost: 5, comfort: 0, maintenance: 0 });
    expect(valueHeavy.total).not.toBe(computeScore(petrol).total);
  });

  it('scores an electric vehicle without petrol specs', () => {
    const ev = computeScore({
      price: 145000, fuelType: 'electric',
      ev: { battery_capacity_kwh: 3.7, claimed_range_km: 146, real_world_range_km: 105, motor_power_kw: 6.4, top_speed_kmph: 90, charging_time_hours: 5.4, abs_type: 'single-channel', kerb_weight_kg: 108 },
      segment: { medianPrice: 130000 },
    } as any);
    expect(ev.total).toBeGreaterThan(0);
  });
});
