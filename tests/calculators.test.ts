import { describe, it, expect } from 'vitest';
import { evVsPetrol, calculateEmi, estimateUsedPrice, judgeAskingPrice } from '@/lib/calculators';

describe('EV vs petrol calculator', () => {
  const base = {
    monthlyKm: 1000, petrolPrice: 104.5, electricityPrice: 8, mileageKmpl: 45,
    evRangeKm: 100, batteryKwh: 3, chargingEfficiencyPercent: 85,
  };

  it('finds electricity cheaper per km at Indian tariffs', () => {
    const r = evVsPetrol(base);
    expect(r.ev.perKm).toBeLessThan(r.petrol.perKm);
    expect(r.monthlySaving).toBeGreaterThan(0);
  });

  it('computes a break-even when the EV costs more upfront', () => {
    const r = evVsPetrol({ ...base, petrolPrice_vehicle: 90000, evPrice: 150000 });
    expect(r.priceDifference).toBe(60000);
    expect(r.breakEvenMonths).not.toBeNull();
    expect(r.breakEvenMonths!).toBeGreaterThan(0);
  });

  it('reports no break-even when the EV is cheaper to buy as well', () => {
    const r = evVsPetrol({ ...base, petrolPrice_vehicle: 150000, evPrice: 90000 });
    expect(r.priceDifference).toBeLessThanOrEqual(0);
  });

  it('never divides by zero on missing mileage', () => {
    const r = evVsPetrol({ ...base, mileageKmpl: 0, evRangeKm: 0 });
    expect(Number.isFinite(r.petrol.perKm)).toBe(true);
    expect(Number.isFinite(r.ev.perKm)).toBe(true);
  });

  it('always states its assumptions', () => {
    expect(evVsPetrol(base).assumptions.length).toBeGreaterThan(0);
  });
});

describe('EMI calculator', () => {
  it('matches the standard amortisation formula', () => {
    const r = calculateEmi({ principal: 100000, annualRatePercent: 12, months: 12 });
    expect(Math.round(r.emi)).toBe(8885);
  });

  it('handles a zero interest rate without NaN', () => {
    const r = calculateEmi({ principal: 120000, annualRatePercent: 0, months: 12 });
    expect(Math.round(r.emi)).toBe(10000);
    expect(Math.round(r.totalInterest)).toBe(0);
  });

  it('subtracts the down payment from the financed amount', () => {
    const full = calculateEmi({ principal: 100000, annualRatePercent: 10, months: 24 });
    const part = calculateEmi({ principal: 100000, annualRatePercent: 10, months: 24, downPayment: 20000 });
    expect(part.emi).toBeLessThan(full.emi);
  });
});

describe('Used-bike valuation', () => {
  const base = {
    basePrice: 100000, manufactureYear: new Date().getFullYear() - 3, kmDriven: 24000,
    owners: 1, condition: 'good' as const,
  };

  it('depreciates with age', () => {
    const newer = estimateUsedPrice({ ...base, manufactureYear: new Date().getFullYear() - 1 });
    const older = estimateUsedPrice({ ...base, manufactureYear: new Date().getFullYear() - 6 });
    expect(newer.fair).toBeGreaterThan(older.fair);
  });

  it('penalises high mileage and extra owners', () => {
    expect(estimateUsedPrice({ ...base, kmDriven: 80000 }).fair).toBeLessThan(estimateUsedPrice(base).fair);
    expect(estimateUsedPrice({ ...base, owners: 4 }).fair).toBeLessThan(estimateUsedPrice(base).fair);
  });

  it('rewards paperwork and condition', () => {
    const good = estimateUsedPrice({ ...base, condition: 'excellent', serviceHistory: 'full_authorised', insuranceStatus: 'comprehensive', accidentHistory: 'none' });
    const bad = estimateUsedPrice({ ...base, condition: 'needs_work', serviceHistory: 'none', insuranceStatus: 'none', accidentHistory: 'major' });
    expect(good.fair).toBeGreaterThan(bad.fair);
  });

  it('returns a range around the fair value and always discloses it is an estimate', () => {
    const r = estimateUsedPrice(base);
    expect(r.min).toBeLessThan(r.fair);
    expect(r.max).toBeGreaterThan(r.fair);
    expect(r.disclaimer.toLowerCase()).toContain('estimat');
  });

  it('never returns a negative price', () => {
    const r = estimateUsedPrice({ ...base, manufactureYear: 1995, kmDriven: 400000, owners: 9, condition: 'needs_work' });
    expect(r.fair).toBeGreaterThanOrEqual(0);
    expect(r.min).toBeGreaterThanOrEqual(0);
  });

  it('judges an asking price against the estimate', () => {
    const v = estimateUsedPrice(base);
    expect(judgeAskingPrice(v.min * 0.7, v).verdict).toBeTruthy();
    expect(judgeAskingPrice(v.max * 1.5, v).verdict).toBeTruthy();
    expect(judgeAskingPrice(v.fair, v).label.length).toBeGreaterThan(0);
  });
});
