import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { queryModels } from '../lib/api';
import type { BikeModel, FuelType, ScoreWeights } from '../lib/types';
import { DEFAULT_WEIGHTS, calculateScore, inputFromSpecs, quickScore, SCORE_DISCLAIMER, SCORE_CATEGORY_LABELS } from '../lib/score';
import { inr, kmpl, kmRange, fuelShort } from '../lib/format';
import { Button, Field, Input, LoadingBlock, Modal, Select } from './ui';
import { useApp } from '../context/AppContext';

interface Answers {
  budget: string;
  fuel: string;
  dailyKm: string;
  road: string;
  priorities: string[];
  evRange: string;
}

const EMPTY: Answers = { budget: '', fuel: 'petrol', dailyKm: '', road: 'city', priorities: [], evRange: '' };

/**
 * "Help Me Choose" — 9-question wizard that recommends real published bikes.
 * Adjusts the CompareBike Score weights based on the rider's priorities,
 * then explains why each recommendation matches.
 */
export default function HelpMeChoose() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(EMPTY);
  const [results, setResults] = useState<{ model: BikeModel; overall: number; reasons: string[]; cats: { label: string; score: number | null }[] }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addCompare } = useApp();

  const start = () => {
    setA(EMPTY);
    setStep(0);
    setResults(null);
    setError(null);
    setOpen(true);
  };

  const next = () => {
    if (step < 6) setStep(step + 1);
    else runRecommendation();
  };

  const togglePriority = (p: string) => {
    setA((prev) => ({ ...prev, priorities: prev.priorities.includes(p) ? prev.priorities.filter((x) => x !== p) : [...prev.priorities, p] }));
  };

  const runRecommendation = async () => {
    setBusy(true);
    setError(null);
    try {
      const budget = Number(a.budget) || 0;
      const res = await queryModels({
        fuel: a.fuel || undefined,
        status: 'live',
        price_max: budget ? budget * 1.15 : undefined,
        per_page: 40,
        sort: 'popular',
      });
      let pool = res.rows;
      if (a.fuel === 'electric' && a.evRange) {
        const minRange = Number(a.evRange);
        const ranged = pool.filter((m) => (m.range_km ?? 0) >= minRange);
        if (ranged.length) pool = ranged;
      }
      if (a.road === 'highway' && a.fuel !== 'electric') {
        const bigger = pool.filter((m) => (m.engine_cc ?? 0) >= 125 || (m.top_speed_kmph ?? 0) >= 90);
        if (bigger.length) pool = bigger;
      }

      // build weights from priorities
      const w: ScoreWeights = { ...DEFAULT_WEIGHTS };
      if (a.priorities.includes('mileage')) w.mileage = 30;
      if (a.priorities.includes('performance')) w.performance = 30;
      if (a.priorities.includes('comfort')) w.comfort = 25;
      if (a.priorities.includes('family')) {
        w.comfort = Math.max(w.comfort, 20);
        w.safety = Math.max(w.safety, 20);
      }
      if (a.fuel === 'electric' && a.evRange) w.ev_range = 25;

      const scored = pool.map((m) => {
        const s = quickScore(m, w);
        const cats = [
          { label: SCORE_CATEGORY_LABELS.mileage, score: m.fuel_type === 'electric' ? m.range_km ? Math.min(100, (m.range_km / 350) * 100) : null : m.mileage_kmpl ? Math.min(100, (m.mileage_kmpl / 80) * 100) : null },
          { label: SCORE_CATEGORY_LABELS.price, score: m.price_start ? Math.min(100, (1 - m.price_start / 3000000) * 100) : null },
          { label: SCORE_CATEGORY_LABELS.performance, score: m.power_ps ? Math.min(100, (m.power_ps / 250) * 100) : null },
        ];
        const reasons: string[] = [];
        if (budget && m.price_start != null && m.price_start <= budget) reasons.push(`Fits your budget (${inr(m.price_start)} ex-showroom)`);
        else if (m.price_start == null) reasons.push('Price not published yet');
        if (m.fuel_type === a.fuel) reasons.push(`${fuelShort(m.fuel_type)} fuel as requested`);
        if (a.fuel !== 'electric' && m.mileage_kmpl && m.mileage_kmpl >= 50) reasons.push(`Strong mileage of ${kmpl(m.mileage_kmpl)}`);
        if (a.fuel === 'electric' && m.range_km) reasons.push(`Range of ${kmRange(m.range_km)} per charge`);
        if (a.road === 'highway' && (m.engine_cc ?? 0) >= 150) reasons.push(`${m.engine_cc} cc engine handles highways well`);
        if (a.road === 'city' && (m.mileage_kmpl ?? 0) >= 45) reasons.push('Efficient in city traffic');
        if (a.dailyKm && Number(a.dailyKm) > 100 && m.fuel_type !== 'electric') reasons.push('Comfortable for long daily commutes');
        if (a.priorities.includes('family') && m.abs_enabled) reasons.push('ABS fitted — safer for family rides');
        if (!reasons.length) reasons.push('Well-rounded choice in your segment');
        return { model: m, overall: s, reasons, cats };
      });

      scored.sort((x, y) => y.overall - x.overall);
      setResults(scored.slice(0, 4));
    } catch (e: any) {
      setError(e.message || 'Could not generate recommendations.');
    } finally {
      setBusy(false);
    }
  };

  const questions = [
    { label: 'What is your budget?', hint: 'Ex-showroom price you are comfortable with.', control: <Input type="number" value={a.budget} onChange={(e) => setA({ ...a, budget: e.target.value })} placeholder="e.g. 150000" className="max-w-xs" /> },
    {
      label: 'Which fuel type do you want?',
      hint: 'Petrol, electric or CNG+petrol dual fuel.',
      control: (
        <Select value={a.fuel} onChange={(e) => setA({ ...a, fuel: e.target.value })} className="max-w-xs">
          <option value="petrol">Petrol</option>
          <option value="electric">Electric</option>
          <option value="cng_petrol">CNG + Petrol</option>
        </Select>
      ),
    },
    { label: 'How many kilometres do you ride daily?', hint: 'Helps us balance mileage vs performance.', control: <Input type="number" value={a.dailyKm} onChange={(e) => setA({ ...a, dailyKm: e.target.value })} placeholder="e.g. 40" className="max-w-xs" /> },
    {
      label: 'Where will you ride mostly?',
      hint: 'City commutes, highway trips or a mix.',
      control: (
        <Select value={a.road} onChange={(e) => setA({ ...a, road: e.target.value })} className="max-w-xs">
          <option value="city">City</option>
          <option value="highway">Highway</option>
          <option value="mixed">City + Highway (mixed)</option>
        </Select>
      ),
    },
    {
      label: 'What matters most to you?',
      hint: 'Pick up to 3 — we re-weight the CompareBike Score for you.',
      control: (
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'mileage', label: 'Mileage priority' },
            { id: 'performance', label: 'Performance priority' },
            { id: 'comfort', label: 'Comfort priority' },
            { id: 'family', label: 'Family use' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePriority(p.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${a.priorities.includes(p.id) ? 'bg-ink-900 text-white' : 'border border-ink-300 bg-white text-ink-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      label: a.fuel === 'electric' ? 'What minimum range do you need?' : 'Anything else?',
      hint: a.fuel === 'electric' ? 'Real-world range you want per charge.' : 'Skip this — non-electric riders don\u2019t need a range check.',
      control:
        a.fuel === 'electric' ? (
          <Select value={a.evRange} onChange={(e) => setA({ ...a, evRange: e.target.value })} className="max-w-xs">
            <option value="">No specific range</option>
            <option value="80">80+ km</option>
            <option value="120">120+ km</option>
            <option value="150">150+ km</option>
            <option value="200">200+ km</option>
          </Select>
        ) : (
          <p className="text-sm text-ink-500">You can skip this step for petrol / CNG bikes.</p>
        ),
    },
    {
      label: 'Ready?',
      hint: 'We\u2019ll score every published bike in your budget and rank the best matches with reasons.',
      control: <p className="text-sm font-semibold text-emerald-600">Click “Get my recommendations” below. 🔧</p>,
    },
  ];

  const best = results && results.length > 0 ? results[0] : null;

  return (
    <>
      <Button variant="dark" size="lg" onClick={start} className="shrink-0 !bg-white !text-ink-900 hover:!bg-ink-100">
        HELP ME CHOOSE MY BIKE
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Help Me Choose My Bike" wide>
        {!results ? (
          <div>
            {busy ? (
              <LoadingBlock label="Scoring bikes against your answers…" />
            ) : (
              <>
                <div className="mb-4 flex items-center gap-1.5">
                  {questions.map((_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary-600' : 'bg-ink-200'}`} />
                  ))}
                </div>
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-ink-400">Question {step + 1} of {questions.length}</p>
                <h4 className="mb-1 text-lg font-bold text-ink-900">{questions[step].label}</h4>
                <p className="mb-4 text-sm text-ink-500">{questions[step].hint}</p>
                {questions[step].control}
                {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
                <div className="mt-6 flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Back</Button>
                  {step < questions.length - 1 ? (
                    <Button onClick={next} loading={busy}>Next →</Button>
                  ) : (
                    <Button onClick={runRecommendation} loading={busy}>Get my recommendations</Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {results.length === 0 ? (
              <div className="py-6 text-center">
                <h4 className="text-lg font-bold text-ink-900">No perfect matches yet</h4>
                <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
                  No published bikes matched all your answers. Try widening your budget or removing the range requirement.
                </p>
                <Button className="mt-4" variant="outline" onClick={start}>Adjust my answers</Button>
              </div>
            ) : (
              best ? (
              <>
                <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-600/20">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-700">★ Best Match</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-black text-ink-900">
                        {best.model.brand_name} {best.model.name}
                      </p>
                      <p className="text-sm font-bold text-ink-600">{inr(best.model.price_start)} ex-showroom · {fuelShort(best.model.fuel_type)}{best.model.mileage_kmpl ? ` · ${kmpl(best.model.mileage_kmpl)}` : ''}{best.model.range_km ? ` · ${kmRange(best.model.range_km)} range` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-emerald-700">{best.overall.toFixed(1)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">CompareBike Score</p>
                    </div>
                  </div>
                  <ul className="mt-3 grid gap-1 text-sm text-ink-700 sm:grid-cols-2">
                    {best.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {r}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link to={`/new-bikes/${best.model.brand_slug}/${best.model.slug}`} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-bold text-white hover:bg-ink-700">View Details</Link>
                    <Button variant="outline" onClick={() => addCompare(best.model.id)}>+ Add to Compare</Button>
                  </div>
                </div>

                <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Alternative choices</p>
                {results.slice(1).map((r, i) => (
                  <div key={r.model.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold text-ink-900">
                        {i + 2}. {r.model.brand_name} {r.model.name}
                      </p>
                      <p className="text-xs text-ink-500">{inr(r.model.price_start)} · {r.reasons[0]}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-ink-700">{r.overall.toFixed(1)}</span>
                      <Link to={`/new-bikes/${r.model.brand_slug}/${r.model.slug}`} className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50">View</Link>
                      <Button size="sm" variant="outline" onClick={() => addCompare(r.model.id)}>Compare</Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs leading-relaxed text-ink-400">{SCORE_DISCLAIMER} Recommendations are based on published specifications and may not account for regional pricing.</p>
                <div className="flex justify-end">
                  <Button variant="ghost" onClick={start}>Start over</Button>
                </div>
              </>
              ) : null
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
