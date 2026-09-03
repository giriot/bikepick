// "Green dot" feature markers for the Full specifications table.
//
// A spec value gets a green dot when it indicates a class-leading or
// genuinely useful feature (TCS, ABS, LED, alloy wheels, big tank…).
// Hovering (or long-pressing on mobile) the dot shows a tooltip explaining
// the advantage for the rider.
//
// The tooltip text describes what the feature does — general knowledge,
// never a fabricated spec, price or number. Threshold-based rules use
// class context (e.g. "tank ≥ 11 L is a lot in the 150cc class"), not data
// that is invented for the bike.

const num = (s: string) => {
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
};

/** Minutes — handles "4 hrs", "30 min" and bare minute values. */
const toMin = (v: string) => {
  const n = num(v);
  if (isNaN(n)) return NaN;
  if (/hr|hour|\bh\b/i.test(v)) return n * 60;
  return n;
};

type Rule = { test: (label: string, value: string) => boolean; adv: string };

const RULES: Rule[] = [
  {
    test: (l, v) => /\bTCS\b|traction control/i.test(l + ' ' + v),
    adv: 'Traction Control (TCS): if the rear wheel starts spinning, the system trims engine power automatically — safer launches and less slip on wet, loose or uneven roads.',
  },
  {
    test: (l, v) => /\bABS\b|anti-?lock/i.test(l + ' ' + v),
    adv: 'Anti-lock Braking System: prevents the wheel from locking in hard braking, so the bike stays stable and you can still steer while braking — shorter, safer stops.',
  },
  {
    test: (l, v) => /\bCBS\b|combined braking/i.test(l + ' ' + v),
    adv: 'Combined Braking System: balances braking force between front and rear wheels — more stable, shorter stopping distances, especially helpful for new riders.',
  },
  {
    test: (l, v) => /brake|braking/i.test(l) && /disc/i.test(v),
    adv: 'Disc brake: stronger and more consistent stopping than a drum — works well in rain and resists heat fade on long downhill runs.',
  },
  {
    test: (_l, v) => /\bLED\b/i.test(v),
    adv: 'LED lighting: a noticeably brighter beam at night, several times the life of a halogen lamp, and lower battery draw.',
  },
  {
    test: (l, v) => /cluster|instrument|console/i.test(l) && /digital|TCI|colour|color|LCD/i.test(v),
    adv: 'Digital instrument cluster: fuel, odometer, trip, range and service info at a glance — clearer in daylight and in rain than analog dials.',
  },
  {
    test: (_l, v) => /alloy/i.test(v),
    adv: 'Alloy wheels: lighter than spoke wheels — quicker acceleration, sharper looks, and no spoke maintenance.',
  },
  {
    test: (_l, v) => /tubeless/i.test(v),
    adv: 'Tubeless tyres: a puncture loses air slowly instead of suddenly, so you can usually ride gently to the nearest repair shop.',
  },
  {
    test: (_l, v) => /\bUSB\b/i.test(v),
    adv: 'USB charging port: keep your phone charged for navigation and calls while you ride.',
  },
  {
    test: (_l, v) => /ARAI\s?5\.9|ARAI\s?6/i.test(v),
    adv: 'Latest ARAI emission standard: a cleaner-running engine, future-proof for tightening city norms, and better resale value.',
  },
  {
    test: (_l, v) => /regenerat/i.test(v),
    adv: 'Regenerative braking: recovers energy during braking and downshifting and feeds it back to the battery — extra range on every ride.',
  },
  {
    test: (l, v) => /service interval/i.test(l) && num(v) >= 16000,
    adv: 'Long service interval: fewer workshop visits and lower maintenance cost over the life of the bike.',
  },
  {
    test: (l, v) => /under-?seat|trunk|storage/i.test(l + ' ' + v) && /helmet|litre|\bL\b/i.test(v),
    adv: 'Under-seat storage: space for a full-face helmet or daily essentials without a top box.',
  },
  // Context-based "good option" dots — thresholds are class context, not invented data.
  {
    test: (l, v) => /seat height/i.test(l) && num(v) > 0 && num(v) <= 780,
    adv: 'Low seat height: you can plant both feet flat on the ground — more confidence for shorter riders and in stop-and-go traffic.',
  },
  {
    test: (l, v) => /kerb weight/i.test(l) && num(v) > 0 && num(v) <= 110,
    adv: 'Light kerb weight: easy to push, park and flick through traffic — less fatigue in city riding.',
  },
  {
    test: (l, v) => /tank (capacity|size)|fuel tank/i.test(l) && num(v) >= 11,
    adv: 'Large fuel tank: more kilometres per fill — fewer fuel stops on highway runs.',
  },
  {
    test: (l, v) => /top speed/i.test(l) && num(v) >= 100,
    adv: 'High top speed: comfortable overtaking and confidence on open roads without straining the engine.',
  },
  {
    test: (l, v) => /mileage|kmpl|km\/l|efficiency/i.test(l + ' ' + v) && num(v) >= 50,
    adv: 'High fuel efficiency: a lower running cost per kilometre — a big saving over years of daily commuting.',
  },
  {
    test: (l, v) => /range.*(claim|manufacturer)/i.test(l) && /km\b/i.test(v) && num(v) >= 100,
    adv: 'Manufacturer-claimed range (IDC cycle): the best-condition figure — real-world distance is usually a little lower.',
  },
  {
    test: (l, v) => /range.*(estimate|bikpick)/i.test(l) && /km\b/i.test(v) && num(v) >= 100,
    adv: 'Bikepick real-world estimate: the distance a typical city ride will actually get out of this battery.',
  },
  {
    test: (l, v) => /range/i.test(l) && /km\b/i.test(v) && num(v) >= 100,
    adv: 'Certified real-world (IDC) range: the distance the battery is tested to deliver per charge — the figure to compare EVs on.',
  },
  {
    test: (l, v) => /fast charge|0.?80/i.test(l) && toMin(v) <= 60,
    adv: 'Fast charging: a 0–80% top-up in under an hour — back on the road in a coffee break.',
  },
  {
    test: (l, v) => /full charge|standard charge/i.test(l) && toMin(v) <= 300,
    adv: 'Reasonable full-charge time — a top-up at home overnight or a café stop covers most days.',
  },
];

// A spec that is not recorded ("—") or is negative ("No") must never get a
// green dot — the dot means "this bike HAS an advanced/good feature".
const NEGATIVE = /^(—|–|-+|n\/?a|no|none|null|tbd|unknown|not (recorded|available|applicable|fitted|provided))$/i;

/** Returns the advantage text for a spec, or null when the spec is not a "green dot" feature. */
export function featureAdvantage(label: string, value: string): string | null {
  if (NEGATIVE.test(value.trim())) return null;
  for (const r of RULES) {
    if (r.test(label, value)) return r.adv;
  }
  return null;
}
