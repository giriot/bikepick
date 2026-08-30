'use client';
import { useState } from 'react';
import Link from 'next/link';
import { inr } from '@/lib/format';
import { ScoreRing } from '@/components/ui';

export interface Candidate {
  id: string; name: string; brand: string; slug: string; brandSlug: string; fuel: string;
  bodyType: string | null; price: number | null; score: number | null; mileage: number | null;
  cc: number | null; range: number | null; abs: string | null; seatHeight: number | null; image: string | null;
}

const QUESTIONS = [
  { key: 'budget', title: 'What can you comfortably spend?', hint: 'Ex-showroom. On-road is typically 10–15% higher.',
    options: [
      { value: '0-90000', label: 'Under ₹90,000', note: 'Entry commuters and scooters' },
      { value: '90000-150000', label: '₹90,000 – ₹1.5 lakh', note: 'The busiest segment in India' },
      { value: '150000-250000', label: '₹1.5 – ₹2.5 lakh', note: 'Sporty 150–250cc and premium EVs' },
      { value: '250000-9999999', label: 'Above ₹2.5 lakh', note: 'Big-capacity and touring machines' },
    ] },
  { key: 'use', title: 'What will you mostly do on it?', hint: 'Pick the one that matches four days out of five.',
    options: [
      { value: 'city', label: 'City commuting', note: 'Traffic, short trips, parking' },
      { value: 'mixed', label: 'City plus weekend rides', note: 'Some highway, some fun' },
      { value: 'highway', label: 'Long highway rides', note: 'Distance and stability matter' },
      { value: 'errands', label: 'Errands and family duty', note: 'Storage, easy handling, pillion comfort' },
    ] },
  { key: 'fuel', title: 'Petrol or electric?', hint: 'Electric saves running cost but needs charging access.',
    options: [
      { value: 'any', label: 'Show me both', note: 'Decide on the numbers' },
      { value: 'petrol', label: 'Petrol', note: 'Refuel anywhere, proven resale' },
      { value: 'electric', label: 'Electric', note: 'Low running cost, home charging' },
    ] },
  { key: 'priority', title: 'What matters most?', hint: 'This adjusts how we weight the shortlist.',
    options: [
      { value: 'running_cost', label: 'Low running cost', note: 'Mileage or cost per km' },
      { value: 'performance', label: 'Performance', note: 'Power and pace' },
      { value: 'safety', label: 'Safety', note: 'ABS and braking' },
      { value: 'value', label: 'Overall value', note: 'Best all-round package for the money' },
    ] },
  { key: 'rider', title: 'How tall are you?', hint: 'Seat height decides whether you can flat-foot at a signal.',
    options: [
      { value: 'short', label: 'Under 5\'5"', note: 'Lower seats are easier' },
      { value: 'average', label: '5\'5" – 5\'10"', note: 'Most bikes will suit you' },
      { value: 'tall', label: 'Above 5\'10"', note: 'Roomier ergonomics help' },
    ] },
];

function scoreCandidate(c: Candidate, a: Record<string, string>) {
  const reasons: string[] = [];
  let fit = 50;

  const [lo, hi] = (a.budget || '0-9999999').split('-').map(Number);
  if (c.price != null) {
    if (c.price >= lo && c.price <= hi) { fit += 22; reasons.push('Sits inside your budget'); }
    else if (c.price < lo) { fit += 8; reasons.push('Cheaper than your budget — leaves money for gear'); }
    else { fit -= 40; }
  }

  if (a.fuel !== 'any') {
    if (c.fuel === a.fuel) { fit += 10; }
    else fit -= 45;
  }

  const body = (c.bodyType || '').toLowerCase();
  if (a.use === 'city' && ['scooter', 'commuter'].includes(body)) { fit += 14; reasons.push('Built for city traffic'); }
  if (a.use === 'errands' && body === 'scooter') { fit += 16; reasons.push('Step-through with under-seat storage'); }
  if (a.use === 'highway' && ['cruiser', 'adventure', 'sport', 'street'].includes(body)) { fit += 14; reasons.push('Stable at highway speeds'); }
  if (a.use === 'mixed' && ['street', 'sport', 'commuter'].includes(body)) { fit += 12; reasons.push('Comfortable in town, capable outside it'); }

  if (a.priority === 'running_cost') {
    if (c.fuel === 'electric') { fit += 12; reasons.push('Very low cost per kilometre'); }
    else if ((c.mileage || 0) >= 55) { fit += 12; reasons.push(`${c.mileage} kmpl claimed mileage`); }
  }
  if (a.priority === 'performance' && (c.cc || 0) >= 150) { fit += 12; reasons.push(`${c.cc}cc engine for real overtaking pace`); }
  if (a.priority === 'safety') {
    if ((c.abs || '').toLowerCase().includes('dual')) { fit += 14; reasons.push('Dual-channel ABS'); }
    else if (c.abs) { fit += 8; reasons.push('ABS fitted'); }
  }
  if (a.priority === 'value' && c.score != null) { fit += (c.score - 60) / 3; reasons.push(`Bikepick Score ${c.score}`); }

  if (c.seatHeight != null) {
    if (a.rider === 'short' && c.seatHeight <= 790) { fit += 10; reasons.push(`Low ${c.seatHeight} mm seat — easy to flat-foot`); }
    if (a.rider === 'short' && c.seatHeight > 810) { fit -= 12; }
    if (a.rider === 'tall' && c.seatHeight >= 795) { fit += 8; reasons.push(`Roomy ${c.seatHeight} mm seat height`); }
  }

  if (c.score != null) fit += (c.score - 60) / 6;
  return { fit: Math.max(0, Math.min(99, Math.round(fit))), reasons: reasons.slice(0, 3) };
}

export function FindMyBike({ candidates }: { candidates: Candidate[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const done = step >= QUESTIONS.length;

  if (!done) {
    const q = QUESTIONS[step];
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
          </div>
          <span className="text-[12px] font-medium text-ink-mute">{step + 1} of {QUESTIONS.length}</span>
        </div>

        <h2 className="mt-6 text-[24px] font-bold leading-8 tracking-[-0.02em]">{q.title}</h2>
        <p className="mt-1 text-[13.5px] text-ink-mute">{q.hint}</p>

        <div className="mt-5 grid gap-2.5">
          {q.options.map((o) => (
            <button key={o.value} type="button"
              onClick={() => { setAnswers({ ...answers, [q.key]: o.value }); setStep(step + 1); }}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/50">
              <span>
                <span className="block text-[14.5px] font-semibold">{o.label}</span>
                <span className="mt-0.5 block text-[12.5px] text-ink-mute">{o.note}</span>
              </span>
              <span className="text-ink-mute transition group-hover:translate-x-0.5 group-hover:text-brand-600">→</span>
            </button>
          ))}
        </div>

        {step > 0 && <button onClick={() => setStep(step - 1)} className="btn-ghost btn-sm mt-4">← Back</button>}
      </div>
    );
  }

  const ranked = candidates
    .map((c) => ({ ...c, ...scoreCandidate(c, answers) }))
    .filter((c) => c.fit > 35)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 6);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Your shortlist</h2>
          <p className="mt-1 text-[13.5px] text-ink-mute">
            Ranked by how well each model matches your answers — not by who pays us. {ranked.length} of {candidates.length} models fit.
          </p>
        </div>
        <button className="btn-outline btn-sm" onClick={() => { setStep(0); setAnswers({}); }}>Start again</button>
      </div>

      {ranked.length === 0 ? (
        <div className="card mt-5 p-6">
          <p className="text-[14px] font-semibold">Nothing in our database matches all of that</p>
          <p className="mt-1 text-[13px] text-ink-mute">Try widening your budget or allowing both fuel types.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {ranked.map((c, i) => (
            <article key={c.id} className="card card-hover overflow-hidden">
              <div className="flex gap-4 p-4">
                <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image || '/media/placeholder.svg'} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {i === 0 && <span className="badge bg-brand-600 text-white">Best match</span>}
                      <h3 className="mt-1 text-[15px] font-semibold leading-5">
                        <Link href={`/${c.fuel === 'electric' ? 'electric' : 'bikes'}/${c.brandSlug}/${c.slug}`} className="hover:text-brand-700">
                          {c.brand} {c.name}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-[13px] font-semibold">{inr(c.price)}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-[20px] font-bold leading-none text-brand-700">{c.fit}%</div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-mute">match</div>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {c.reasons.map((r) => (
                      <li key={r} className="flex gap-1.5 text-[12px] leading-4 text-ink-mute">
                        <span className="text-brand-600">✓</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                <span className="text-[12px] text-ink-mute">
                  {c.score != null ? `Bikepick Score ${c.score}` : 'Score pending'}
                </span>
                <Link href={`/compare?ids=${ranked.slice(0, 3).map((x) => x.id).join(',')}`} className="text-[12.5px] font-semibold text-brand-700 hover:underline">
                  Compare top 3
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
