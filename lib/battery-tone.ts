/**
 * Battery life rating for display: a small "patch" next to the battery type.
 * Lead-acid = Normal, Li-ion = Good, LiFePO4 (LifePO4) = Best.
 * The note explains which battery is best for long life (shown on hover).
 */
export type BatteryTone = { text: string; cls: string; note: string };

export function batteryTone(val: string): BatteryTone | null {
  const s = val.toLowerCase();
  if (/lifepo|lifeo|lfp|iron phosphate/.test(s)) {
    return {
      text: 'Best',
      cls: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
      note: 'LiFePO4 (LifePO4) has the longest cycle life — typically 2,000–4,000+ cycles — and is the most stable. Best choice for long battery life.',
    };
  }
  if (/lead|acid/.test(s)) {
    return {
      text: 'Normal',
      cls: 'bg-gray-200 text-gray-700 ring-gray-400',
      note: 'Lead-acid batteries are the cheapest to buy but need the most frequent replacement — shorter cycle life than lithium.',
    };
  }
  if (/lithium|li.?ion|nmc|nca/.test(s)) {
    return {
      text: 'Good',
      cls: 'bg-amber-100 text-amber-800 ring-amber-300',
      note: 'Lithium-ion (Li-ion / NMC) packs are lighter and charge faster. Good life, but they degrade a bit sooner than LiFePO4.',
    };
  }
  return null;
}
