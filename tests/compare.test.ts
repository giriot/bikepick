import { describe, it, expect } from 'vitest';
import { buildComparison, runningCostPerKm, ATTRIBUTES, type CompareEntity } from '@/lib/compare';

const make = (over: Partial<CompareEntity>): CompareEntity => ({
  id: 'a', name: 'Model', brand: 'Brand', slug: 'model', brandSlug: 'brand', image: null,
  price: 150000, fuelType: 'petrol', score: 70,
  bike: { mileage_kmpl: 45, max_power_bhp: 18, kerb_weight_kg: 140, seat_height_mm: 800, abs_type: 'dual-channel', front_brake: 'disc' },
  ev: null, ...over,
});

const cheap = make({ id: 'cheap', name: 'Cheap', price: 100000, bike: { mileage_kmpl: 60, max_power_bhp: 12, kerb_weight_kg: 120, seat_height_mm: 790, abs_type: 'cbs', front_brake: 'drum' } as any });
const dear = make({ id: 'dear', name: 'Dear', price: 200000, bike: { mileage_kmpl: 35, max_power_bhp: 24, kerb_weight_kg: 160, seat_height_mm: 830, abs_type: 'dual-channel', front_brake: 'disc' } as any });

describe('Comparison engine', () => {
  const { groups, verdict } = buildComparison([cheap, dear]);
  const rows = groups.flatMap((g) => g.rows);
  const row = (k: string) => rows.find((r) => r.key === k)!;

  it('groups attributes and returns rows', () => {
    expect(groups.length).toBeGreaterThan(1);
    expect(rows.length).toBeGreaterThan(5);
  });

  it('marks the LOWER price as best', () => {
    const cells = row('price').cells;
    expect(cells.find((c) => c.entityId === 'cheap')!.isBest).toBe(true);
    expect(cells.find((c) => c.entityId === 'dear')!.isWorst).toBe(true);
  });

  it('marks the HIGHER power as best', () => {
    const cells = row('max_power_bhp').cells;
    expect(cells.find((c) => c.entityId === 'dear')!.isBest).toBe(true);
  });

  it('marks the LOWER kerb weight as best', () => {
    expect(row('kerb_weight_kg').cells.find((c) => c.entityId === 'cheap')!.isBest).toBe(true);
  });

  it('ranks qualitative fields rather than comparing text alphabetically', () => {
    expect(row('abs_type').cells.find((c) => c.entityId === 'dear')!.isBest).toBe(true);
  });

  it('declares no winner when values tie', () => {
    const twins = buildComparison([make({ id: 'x' }), make({ id: 'y' })]);
    expect(twins.groups.flatMap((g) => g.rows).find((r) => r.key === 'price')!.hasWinner).toBe(false);
  });

  it('omits attributes that no product has data for', () => {
    const bare = buildComparison([
      make({ id: 'p', bike: { mileage_kmpl: 50 } as any }),
      make({ id: 'q', bike: { mileage_kmpl: 40 } as any }),
    ]);
    expect(bare.groups.flatMap((g) => g.rows).some((r) => r.key === 'seat_height_mm')).toBe(false);
  });

  it('produces a human verdict', () => {
    expect(verdict.length).toBeGreaterThan(0);
    expect(verdict.join(' ').length).toBeGreaterThan(20);
  });

  it('handles a 4-way comparison', () => {
    const four = buildComparison([cheap, dear, make({ id: 'c' }), make({ id: 'd', price: 130000 })]);
    expect(four.groups.flatMap((g) => g.rows)[0].cells).toHaveLength(4);
  });

  it('compares an EV against a petrol bike without inventing missing specs', () => {
    const ev = make({ id: 'ev', fuelType: 'electric', bike: null, ev: { battery_capacity_kwh: 3, real_world_range_km: 100, motor_power_kw: 6 } as any });
    const mixed = buildComparison([ev, cheap]);
    const mileage = mixed.groups.flatMap((g) => g.rows).find((r) => r.key === 'mileage_kmpl');
    expect(mileage?.cells.find((c) => c.entityId === 'ev')?.raw ?? null).toBeNull();
  });
});

describe('Running cost', () => {
  it('computes petrol cost per km from price and mileage', () => {
    expect(runningCostPerKm(make({}), 100, 8, 0.85)).toBeCloseTo(2.22, 1);
  });

  it('computes EV cost per km from battery and real-world range', () => {
    const ev = make({ fuelType: 'electric', bike: null, ev: { battery_capacity_kwh: 3, real_world_range_km: 100 } as any });
    expect(runningCostPerKm(ev, 104.5, 8, 0.85)).toBeCloseTo(0.28, 1);
  });

  it('returns null rather than a guess when the data is missing', () => {
    expect(runningCostPerKm(make({ bike: {} as any }))).toBeNull();
    expect(runningCostPerKm(make({ fuelType: 'electric', bike: null, ev: {} as any }))).toBeNull();
  });

  it('derates a claimed range when no real-world figure exists', () => {
    const claimed = make({ fuelType: 'electric', bike: null, ev: { battery_capacity_kwh: 3, claimed_range_km: 100 } as any });
    const real = make({ fuelType: 'electric', bike: null, ev: { battery_capacity_kwh: 3, real_world_range_km: 100 } as any });
    expect(runningCostPerKm(claimed)!).toBeGreaterThan(runningCostPerKm(real)!);
  });
});

describe('Attribute definitions', () => {
  it('gives every attribute an explicit better-direction', () => {
    for (const a of ATTRIBUTES) {
      expect(['higher', 'lower', 'band', 'custom', 'none']).toContain(a.direction);
      if (a.direction === 'custom') expect(typeof a.rank).toBe('function');
      if (a.direction === 'band') expect(a.band).toHaveLength(2);
    }
  });

  it('has unique keys', () => {
    expect(new Set(ATTRIBUTES.map((a) => a.key)).size).toBe(ATTRIBUTES.length);
  });
});
