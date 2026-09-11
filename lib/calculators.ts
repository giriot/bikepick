/**
 * Ownership calculators. Every output is an ESTIMATE derived from the inputs
 * shown to the user — nothing here is a quotation or a guarantee.
 */

export interface EvVsPetrolInput {
  monthlyKm: number;
  petrolPrice: number;
  electricityPrice: number;
  mileageKmpl: number;
  evRangeKm: number;
  batteryKwh: number;
  chargingEfficiencyPercent: number;
  petrolPrice_vehicle?: number;
  evPrice?: number;
  petrolServiceCostPerYear?: number;
  evServiceCostPerYear?: number;
}

export interface EvVsPetrolResult {
  petrol: { perKm: number; monthly: number; annual: number; fiveYearEnergy: number; fiveYearMaintenance: number; fiveYearTotal: number };
  ev: { perKm: number; monthly: number; annual: number; fiveYearEnergy: number; fiveYearMaintenance: number; fiveYearTotal: number };
  monthlySaving: number;
  annualSaving: number;
  fiveYearSaving: number;
  priceDifference: number;
  breakEvenMonths: number | null;
  breakEvenKm: number | null;
  assumptions: string[];
}

export function evVsPetrol(i: EvVsPetrolInput): EvVsPetrolResult {
  const eff = Math.max(0.4, Math.min(1, i.chargingEfficiencyPercent / 100));
  const petrolPerKm = i.mileageKmpl > 0 ? i.petrolPrice / i.mileageKmpl : 0;
  const kwhPerKm = i.evRangeKm > 0 ? i.batteryKwh / i.evRangeKm : 0;
  const evPerKm = (kwhPerKm * i.electricityPrice) / eff;

  const pService = i.petrolServiceCostPerYear ?? 3500;
  const eService = i.evServiceCostPerYear ?? 1500;

  const mk = (perKm: number, servicePerYear: number) => {
    const monthly = perKm * i.monthlyKm;
    const annual = monthly * 12;
    return {
      perKm: round2(perKm),
      monthly: Math.round(monthly),
      annual: Math.round(annual),
      fiveYearEnergy: Math.round(annual * 5),
      fiveYearMaintenance: Math.round(servicePerYear * 5),
      fiveYearTotal: Math.round(annual * 5 + servicePerYear * 5),
    };
  };

  const petrol = mk(petrolPerKm, pService);
  const ev = mk(evPerKm, eService);

  const monthlySaving = petrol.monthly + pService / 12 - (ev.monthly + eService / 12);
  const priceDifference = (i.evPrice || 0) - (i.petrolPrice_vehicle || 0);
  const breakEvenMonths = priceDifference > 0 && monthlySaving > 0 ? Math.ceil(priceDifference / monthlySaving) : null;

  return {
    petrol, ev,
    monthlySaving: Math.round(monthlySaving),
    annualSaving: Math.round(monthlySaving * 12),
    fiveYearSaving: petrol.fiveYearTotal - ev.fiveYearTotal,
    priceDifference: Math.round(priceDifference),
    breakEvenMonths,
    breakEvenKm: breakEvenMonths ? Math.round(breakEvenMonths * i.monthlyKm) : null,
    assumptions: [
      `Petrol at ₹${i.petrolPrice}/litre and ${i.mileageKmpl} kmpl.`,
      `Electricity at ₹${i.electricityPrice}/unit with ${Math.round(eff * 100)}% charging efficiency.`,
      `EV consumption derived from ${i.batteryKwh} kWh battery over ${i.evRangeKm} km usable range.`,
      `Maintenance assumed at ₹${pService}/year (petrol) and ₹${eService}/year (EV); battery replacement is not included.`,
      'All figures are estimates. Real costs vary with riding style, load, terrain, tariffs and service pricing.',
    ],
  };
}

export interface EmiInput { principal: number; annualRatePercent: number; months: number; downPayment?: number }
export interface EmiResult { emi: number; principal: number; totalInterest: number; totalPayable: number; schedulePreview: { month: number; principal: number; interest: number; balance: number }[] }

export function calculateEmi({ principal, annualRatePercent, months, downPayment = 0 }: EmiInput): EmiResult {
  const p = Math.max(0, principal - downPayment);
  const r = annualRatePercent / 12 / 100;
  const emi = r === 0 ? p / months : (p * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  let balance = p;
  const schedulePreview: EmiResult['schedulePreview'] = [];
  for (let m = 1; m <= Math.min(months, 6); m++) {
    const interest = balance * r;
    const principalPart = emi - interest;
    balance -= principalPart;
    schedulePreview.push({ month: m, principal: Math.round(principalPart), interest: Math.round(interest), balance: Math.round(Math.max(balance, 0)) });
  }
  return {
    emi: Math.round(emi),
    principal: Math.round(p),
    totalInterest: Math.round(emi * months - p),
    totalPayable: Math.round(emi * months),
    schedulePreview,
  };
}

/**
 * Used-bike price estimator — depreciation model with condition, usage and
 * paperwork adjustments. Clearly an estimate, never a valuation certificate.
 */
export interface ValuationInput {
  basePrice: number;
  manufactureYear: number;
  kmDriven: number;
  owners: number;
  condition: 'excellent' | 'good' | 'fair' | 'needs_work';
  insuranceStatus?: 'comprehensive' | 'third_party' | 'expired' | 'none';
  serviceHistory?: 'full_authorised' | 'partial' | 'local' | 'none';
  accidentHistory?: 'none' | 'minor' | 'major';
  cityTier?: 1 | 2 | 3;
}

export interface ValuationResult {
  fair: number; min: number; max: number;
  factors: { label: string; effect: number; note: string }[];
  disclaimer: string;
}

export function estimateUsedPrice(i: ValuationInput): ValuationResult {
  const age = Math.max(0, new Date().getFullYear() - i.manufactureYear);
  const factors: ValuationResult['factors'] = [];

  // Depreciation curve: steep in year 1, then tapering.
  let retention = 1;
  for (let y = 1; y <= age; y++) retention *= y === 1 ? 0.82 : y <= 3 ? 0.9 : y <= 6 ? 0.92 : 0.94;
  factors.push({ label: `Age (${age} year${age === 1 ? '' : 's'})`, effect: retention - 1, note: 'Standard two-wheeler depreciation curve.' });

  const expectedKm = Math.max(age, 1) * 8000;
  const kmDelta = (expectedKm - i.kmDriven) / Math.max(expectedKm, 1);
  const kmAdj = Math.max(-0.18, Math.min(0.08, kmDelta * 0.18));
  factors.push({ label: `Usage (${i.kmDriven.toLocaleString('en-IN')} km)`, effect: kmAdj, note: `Segment expectation is about ${expectedKm.toLocaleString('en-IN')} km for this age.` });

  const ownerAdj = i.owners <= 1 ? 0.03 : i.owners === 2 ? -0.05 : -0.1;
  factors.push({ label: `${i.owners} owner${i.owners > 1 ? 's' : ''}`, effect: ownerAdj, note: 'First-owner bikes command a premium.' });

  const condMap = { excellent: 0.08, good: 0, fair: -0.08, needs_work: -0.18 } as const;
  factors.push({ label: `Condition: ${i.condition.replace('_', ' ')}`, effect: condMap[i.condition], note: 'Seller-declared condition grade.' });

  if (i.serviceHistory) {
    const sh = { full_authorised: 0.05, partial: 0.01, local: -0.02, none: -0.05 } as const;
    factors.push({ label: 'Service history', effect: sh[i.serviceHistory], note: 'Documented authorised service adds resale value.' });
  }
  if (i.insuranceStatus) {
    const ins = { comprehensive: 0.02, third_party: 0, expired: -0.02, none: -0.03 } as const;
    factors.push({ label: 'Insurance', effect: ins[i.insuranceStatus], note: 'Valid comprehensive cover transfers value to the buyer.' });
  }
  if (i.accidentHistory) {
    const acc = { none: 0, minor: -0.05, major: -0.15 } as const;
    factors.push({ label: 'Accident history', effect: acc[i.accidentHistory], note: 'Declared by the seller; not independently confirmed unless inspected.' });
  }
  if (i.cityTier) {
    const tier = { 1: 0.02, 2: 0, 3: -0.03 } as const;
    factors.push({ label: `City tier ${i.cityTier}`, effect: tier[i.cityTier], note: 'Demand varies by market.' });
  }

  const multiplier = factors.reduce((acc, f) => acc + f.effect, 1);
  const fair = Math.max(3000, Math.round((i.basePrice * multiplier) / 500) * 500);
  return {
    fair,
    min: Math.round((fair * 0.92) / 500) * 500,
    max: Math.round((fair * 1.08) / 500) * 500,
    factors,
    disclaimer: 'Estimated market value only. Actual selling price may differ.',
  };
}

export type PriceVerdict = 'good_deal' | 'fair_price' | 'high_price';
export function judgeAskingPrice(asking: number, v: ValuationResult): { verdict: PriceVerdict; label: string; note: string } {
  if (asking <= v.min) return { verdict: 'good_deal', label: 'Good deal', note: `Asking price is below our estimated range of ${v.min.toLocaleString('en-IN')}–${v.max.toLocaleString('en-IN')}.` };
  if (asking <= v.max) return { verdict: 'fair_price', label: 'Fair price', note: 'Asking price sits inside our estimated market range.' };
  return { verdict: 'high_price', label: 'Above estimate', note: `Asking price is above our estimated range of ${v.min.toLocaleString('en-IN')}–${v.max.toLocaleString('en-IN')}.` };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

/** One point on the depreciation curve. */
export interface ResalePoint { year: number; value: number; retainedPct: number }

/**
 * Standard two-wheeler depreciation curve: ~18% in year one, then ~10% a year
 * tapering to ~8% and ~6%. Value is rounded to the nearest ₹500. Indicative only —
 * real resale depends on condition, kilometres, demand and paperwork.
 */
export function projectResale(price: number, years = 5): ResalePoint[] {
  const pts: ResalePoint[] = [];
  let retention = 1;
  for (let y = 1; y <= years; y++) {
    retention *= y === 1 ? 0.82 : y <= 3 ? 0.9 : y <= 6 ? 0.92 : 0.94;
    pts.push({ year: y, value: Math.round((price * retention) / 500) * 500, retainedPct: Math.round(retention * 100) });
  }
  return pts;
}

/**
 * 5-year ownership cost (total cost of ownership) for one vehicle.
 * Combines purchase (on-road), energy, insurance renewals, service and a
 * depreciation-based resale estimate. Every figure is an ESTIMATE derived
 * from the inputs and clearly-labelled assumptions — missing data is reported,
 * never invented.
 */
export interface OwnershipInput {
  price: number | null;                 // ex-showroom price (₹)
  fuel: 'petrol' | 'electric';
  mileageKmpl?: number | null;          // petrol only
  batteryKwh?: number | null;           // electric only
  rangeKm?: number | null;              // electric only
  years?: number;                       // ownership period, default 5
  kmPerYear?: number;                   // default 10,000
  petrolPrice?: number;                 // ₹/litre
  electricityPrice?: number;            // ₹/unit (kWh)
  chargingEfficiencyPercent?: number;   // default 85
}

export interface OwnershipYear {
  year: number;
  energy: number;
  insurance: number;
  service: number;
  runningTotal: number;     // energy+insurance+service for this year
  cumulative: number;       // purchase + running up to and including this year
}

export interface OwnershipResult {
  onRoadPrice: number | null;           // ex-showroom + RTO + first-year insurance
  energyPerKm: number | null;           // ₹/km energy only
  energyPerYear: number;
  insuranceRenewal: number;             // per year after year 1
  servicePerYear: number;
  years: OwnershipYear[];
  totalEnergy: number;
  totalInsurance: number;
  totalService: number;
  totalCost: number;                    // purchase + running over the period
  costPerKm: number | null;             // totalCost / total km
  costPerMonth: number;                 // totalCost / (years*12)
  resaleValue: number | null;           // estimated resale at end of period
  netCost: number | null;               // totalCost - resaleValue
  missing: string[];                    // what data is missing (never invented)
  assumptions: string[];
}

const RTO_RATE = 0.09;        // typical two-wheeler road tax ≈ 9% of ex-showroom (varies by state)
const INSURANCE_RATE = 0.05;  // first-year comprehensive ≈ 5% of ex-showroom
const INSURANCE_MIN = 2500;
const INSURANCE_MAX = 18000;
const RENEWAL_RATE = 0.45;    // renewal (own-damage depreciates) ≈ 45% of first-year premium
const RENEWAL_MIN = 1800;
const PETROL_SERVICE = 3500;  // ₹/year, typical scheduled service average
const EV_SERVICE = 1500;      // ₹/year, EVs need less scheduled maintenance

export function ownershipCost(i: OwnershipInput): OwnershipResult {
  const years = Math.max(1, Math.min(8, Math.round(i.years ?? 5)));
  const kmPerYear = Math.max(500, i.kmPerYear ?? 10000);
  const petrolPrice = i.petrolPrice ?? 104.5;
  const electricityPrice = i.electricityPrice ?? 8;
  const eff = Math.max(0.4, Math.min(1, (i.chargingEfficiencyPercent ?? 85) / 100));

  const missing: string[] = [];
  let energyPerKm: number | null = null;

  if (i.fuel === 'petrol') {
    if (!i.mileageKmpl) missing.push('recorded mileage (kmpl) — fuel cost cannot be calculated');
    else energyPerKm = petrolPrice / i.mileageKmpl;
  } else {
    if (!i.batteryKwh || !i.rangeKm) missing.push('battery capacity and range — electricity cost cannot be calculated');
    else energyPerKm = ((i.batteryKwh / i.rangeKm) * electricityPrice) / eff;
  }

  const energyPerYear = energyPerKm ? Math.round(energyPerKm * kmPerYear) : 0;

  let onRoadPrice: number | null = null;
  if (i.price != null && i.price > 0) {
    const insurance = Math.max(INSURANCE_MIN, Math.min(INSURANCE_MAX, i.price * INSURANCE_RATE));
    onRoadPrice = Math.round(i.price + i.price * RTO_RATE + insurance);
  } else {
    missing.push('ex-showroom price — purchase cost cannot be calculated');
  }

  const insuranceFirstYear = i.price != null && i.price > 0
    ? Math.max(INSURANCE_MIN, Math.min(INSURANCE_MAX, i.price * INSURANCE_RATE))
    : 0;
  const insuranceRenewal = Math.max(RENEWAL_MIN, Math.round(insuranceFirstYear * RENEWAL_RATE));
  const servicePerYear = i.fuel === 'electric' ? EV_SERVICE : PETROL_SERVICE;

  const yrs: OwnershipYear[] = [];
  let cumulative = onRoadPrice ?? 0;
  for (let y = 1; y <= years; y++) {
    const insurance = y === 1 ? 0 : insuranceRenewal; // year 1 premium is inside the on-road price
    const runningTotal = energyPerYear + insurance + servicePerYear;
    cumulative += runningTotal;
    yrs.push({ year: y, energy: energyPerYear, insurance, service: servicePerYear, runningTotal, cumulative });
  }

  const totalEnergy = energyPerYear * years;
  const totalInsurance = insuranceRenewal * (years - 1);
  const totalService = servicePerYear * years;
  const totalCost = (onRoadPrice ?? 0) + totalEnergy + totalInsurance + totalService;

  // Resale: same depreciation curve as the used-price estimator.
  let resaleValue: number | null = null;
  if (i.price != null && i.price > 0) {
    const curve = projectResale(i.price, years);
    resaleValue = curve[curve.length - 1].value;
  }

  const totalKm = kmPerYear * years;
  const assumptions: string[] = [
    `On-road price = ex-showroom + ~${Math.round(RTO_RATE * 100)}% RTO + first-year insurance (~${Math.round(INSURANCE_RATE * 100)}% of ex-showroom).`,
    `Insurance renewals assumed at ~${Math.round(RENEWAL_RATE * 100)}% of the first-year premium (own-damage cover reduces over time).`,
    `Scheduled service assumed at ₹${servicePerYear.toLocaleString('en-IN')}/year${i.fuel === 'electric' ? ' (EVs need less maintenance)' : ''}.`,
    `Depreciation uses a standard two-wheeler curve; resale value is indicative only.`,
    'All figures are estimates — real costs vary with state taxes, insurer, riding style and service pricing.',
  ];
  if (i.fuel === 'petrol') assumptions.unshift(`Fuel at ₹${petrolPrice}/litre with the recorded ${i.mileageKmpl ?? '—'} kmpl.`);
  else assumptions.unshift(`Electricity at ₹${electricityPrice}/unit with ${Math.round(eff * 100)}% charging efficiency over ${i.rangeKm ?? '—'} km range.`);

  return {
    onRoadPrice,
    energyPerKm: energyPerKm == null ? null : round2(energyPerKm),
    energyPerYear,
    insuranceRenewal,
    servicePerYear,
    years: yrs,
    totalEnergy,
    totalInsurance,
    totalService,
    totalCost,
    costPerKm: totalKm > 0 ? round2(totalCost / totalKm) : null,
    costPerMonth: Math.round(totalCost / (years * 12)),
    resaleValue,
    netCost: resaleValue != null ? totalCost - resaleValue : null,
    missing,
    assumptions,
  };
}
