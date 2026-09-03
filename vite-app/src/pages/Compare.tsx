import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getModelById, getSpecsForModel, getFeatures, getScoreWeights, publicImageUrl } from '../lib/api';
import type { BikeFeature, BikeModel, BikeSpec, ScoreWeights } from '../lib/types';
import { inr, fuelShort, kmpl, kmRange, cc, titleCase } from '../lib/format';
import { calculateScore, inputFromSpecs, SCORE_DISCLAIMER, SCORE_CATEGORY_LABELS } from '../lib/score';
import { useSEO, breadcrumbJsonLd } from '../lib/seo';
import { Button, Card, EmptyState, LoadingBlock, Modal, Select, Spinner } from '../components/ui';

interface BikeBundle {
  model: BikeModel;
  specs: BikeSpec[];
  features: BikeFeature[];
  imageUrl: string | null;
  score: number;
  categories: { key: string; label: string; score: number | null; weight: number }[];
  coverage: number;
}

/**
 * /compare — side-by-side comparison for 2–4 bikes.
 * Dynamic engine: the union of ALL specification names used by the selected
 * bikes is shown (grouped). Missing values are displayed as N/A, never hidden.
 * Ranks bikes by the admin-configurable CompareBike Score.
 */
export default function Compare() {
  const { compareIds, addCompare, removeCompare, clearCompare, isAuthed, toast } = useApp();
  const [bikes, setBikes] = useState<BikeBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<ScoreWeights | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useSEO({
    title: 'Compare Bikes Side by Side | CompareBike',
    description: 'Compare up to 4 bikes by price, engine, mileage, safety, features and more — with the transparent CompareBike Score.',
    jsonLd: breadcrumbJsonLd([{ name: 'Home', url: '/' }, { name: 'Compare', url: '/compare' }]),
  });

  useEffect(() => {
    getScoreWeights().then(setWeights).catch(() => setWeights(null));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!compareIds.length || !weights) {
        setBikes([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const bundles = await Promise.all(
          compareIds.map(async (id): Promise<BikeBundle | null> => {
            const model = await getModelById(id);
            if (!model) return null;
            const [specs, features] = await Promise.all([getSpecsForModel(id), getFeatures(id)]);
            const sb = (await import('../lib/supabase')).requireSupabase();
            const { data: imgs } = await sb
              .from('bike_images')
              .select('storage_path, original_path, processed_path, bucket, is_primary, sort_order, processing_status')
              .eq('bike_model_id', id)
              .order('is_primary', { ascending: false })
              .order('sort_order');
            const p = (imgs || [])[0];
            const path = p ? (p.processing_status !== 'failed' ? p.processed_path || p.original_path || p.storage_path : p.original_path || p.storage_path) : null;
            const input = inputFromSpecs(model, specs, features);
            const result = calculateScore(input, weights);
            return {
              model,
              specs,
              features,
              imageUrl: path ? publicImageUrl(p.bucket || 'bike-images', path) : null,
              score: result.overall,
              categories: result.categories,
              coverage: result.dataCoverage,
            };
          }),
        );
        if (!alive) return;
        const good = bundles.filter(Boolean) as BikeBundle[];
        // sort by score desc → 1st, 2nd, 3rd, 4th
        good.sort((a, b) => b.score - a.score);
        setBikes(good);
      } catch (e: any) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [compareIds, weights]);

  // ── build dynamic spec rows ────────────────────────────────────────────────
  const rows = useMemo(() => {
    const groupOrder: Record<string, number> = {
      Engine: 0, Performance: 1, Mileage: 2, Battery: 3, Range: 4, Charging: 5,
      Dimensions: 6, Transmission: 7, Brakes: 8, Suspension: 9, 'Wheels & Tyres': 10,
      Electrical: 11, Features: 12, Safety: 13, Comfort: 14, Warranty: 15, Service: 16, Other: 17,
    };
    interface Row {
      group: string;
      name: string;
      unit?: string | null;
      values: (string | number | boolean | null)[]; // per bike
      numeric: (number | null)[];
      lowerIsBetter: boolean;
    }
    const map = new Map<string, Row>();
    for (const b of bikes) {
      for (const s of b.specs) {
        if (s.variant_id) continue; // model-level comparison
        const key = `${s.spec_group || 'Other'}::${s.spec_name}`;
        const name = (s.spec_name || '').toLowerCase();
        const lowerIsBetter = /weight|price|consumption|charging time|cost/i.test(name);
        let row = map.get(key);
        if (!row) {
          row = { group: s.spec_group || 'Other', name: s.spec_name || 'Spec', unit: s.spec_unit, values: new Array(bikes.length).fill(null), numeric: new Array(bikes.length).fill(null), lowerIsBetter };
          map.set(key, row);
        }
        const idx = bikes.indexOf(b);
        const val = s.value_boolean != null ? s.value_boolean : s.value_numeric != null ? s.value_numeric : s.value_text;
        row.values[idx] = val;
        if (typeof val === 'number') row.numeric[idx] = val;
        else if (val === true || val === false) row.numeric[idx] = val ? 1 : 0;
      }
    }
    const all = Array.from(map.values());
    all.sort((a, b) => (groupOrder[a.group] ?? 99) - (groupOrder[b.group] ?? 99) || a.name.localeCompare(b.name));
    return all;
  }, [bikes]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof rows> = {};
    for (const r of rows) (g[r.group] ||= []).push(r);
    return g;
  }, [rows]);

  const bestIndex = (row: { numeric: (number | null)[]; lowerIsBetter: boolean }): number | null => {
    const nums = row.numeric.filter((n) => n != null) as number[];
    if (!nums.length) return null;
    if (nums.every((n) => n === nums[0])) return null; // all identical — no single best
    const target = row.lowerIsBetter ? Math.min(...nums) : Math.max(...nums);
    const winners = row.numeric.map((n, i) => (n === target ? i : -1)).filter((i) => i >= 0);
    if (winners.length !== 1) return null;
    return winners[0];
  };

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}ⁿᵈ`);

  if (!loading && compareIds.length < 2) {
    return (
      <div className="container-x py-12">
        <h1 className="mb-4 text-3xl font-black text-ink-900">Compare Bikes</h1>
        <EmptyState
          icon={<span className="text-5xl">⚖️</span>}
          title={compareIds.length === 1 ? 'Add one more bike to compare' : 'Select 2–4 bikes to compare'}
          desc="Open any bike card on New Bikes and hit “Compare”. The comparison tray appears at the bottom of the page."
          action={
            <div className="flex gap-2">
              <Link to="/new-bikes" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700">Browse New Bikes</Link>
              {compareIds.length === 1 && (
                <Button variant="outline" onClick={clearCompare}>Clear selection</Button>
              )}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-ink-900">Compare Bikes</h1>
          <p className="mt-1 text-sm text-ink-500">{bikes.length} bikes · ranked by CompareBike Score · missing specs shown as N/A</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPickerOpen(true)} disabled={compareIds.length >= 4}>+ Add bike</Button>
          <Button variant="ghost" className="!text-red-600" onClick={clearCompare}>Clear all</Button>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Scoring bikes…" />
      ) : error ? (
        <div className="card p-6 text-sm text-red-600">{error}</div>
      ) : (
        <>
          {/* Score ranking */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {bikes.map((b, i) => (
              <Card key={b.model.id} className={`p-4 ${i === 0 ? 'ring-2 ring-emerald-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{medal(i + 1)}</span>
                  {i === 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">Best match</span>}
                </div>
                <p className="mt-2 truncate text-sm font-black text-ink-900">{b.model.brand_name} {b.model.name}</p>
                <p className="text-xs text-ink-400">{inr(b.model.price_start)} · {fuelShort(b.model.fuel_type)}</p>
                <p className="mt-2 text-3xl font-black text-ink-900">{b.score.toFixed(1)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">CompareBike Score · {b.coverage}% data</p>
              </Card>
            ))}
          </div>

          {/* Category breakdown */}
          <Card className="mb-6 overflow-x-auto p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-ink-500">Score by category</p>
            <div className="min-w-[560px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-2 pr-4 font-bold">Category</th>
                    {bikes.map((b) => (
                      <th key={b.model.id} className="py-2 pr-4 font-bold">{b.model.brand_name} {b.model.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(SCORE_CATEGORY_LABELS).map((label) => (
                    <tr key={label} className="border-b border-ink-50 last:border-0">
                      <td className="py-2 pr-4 font-semibold text-ink-700">{label}</td>
                      {bikes.map((b) => {
                        const c = b.categories.find((x) => x.label === label);
                        const val = c && c.score != null ? c.score : null;
                        return (
                          <td key={b.model.id} className="py-2 pr-4">
                            {val == null ? (
                              <span className="text-ink-300">N/A</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-ink-100">
                                  <div className="h-full rounded-full bg-primary-500" style={{ width: `${val}%` }} />
                                </div>
                                <span className="text-xs font-bold text-ink-600">{val.toFixed(0)}</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">{SCORE_DISCLAIMER} Weights: {bikes.length ? formatWeights(weights) : ''}. Categories without data are excluded from a bike's score.</p>
          </Card>

          {/* Dynamic spec table */}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b-2 border-ink-200">
                  <th className="w-52 px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-ink-400">Specification</th>
                  {bikes.map((b, i) => (
                    <th key={b.model.id} className="px-4 py-3 text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{medal(i + 1)}</span>
                        <div>
                          <Link to={`/new-bikes/${b.model.brand_slug}/${b.model.slug}`} className="block font-black text-ink-900 hover:text-primary-600">
                            {b.model.brand_name} {b.model.name}
                          </Link>
                          <span className="text-xs font-medium text-ink-400">{inr(b.model.price_start)}</span>
                          <button onClick={() => removeCompare(b.model.id)} className="ml-2 text-xs font-bold text-red-500 hover:underline">remove</button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  <td className="px-4 py-2.5 font-bold text-ink-700">Price (ex-showroom)</td>
                  {bikes.map((b) => (
                    <td key={b.model.id} className="px-4 py-2.5 font-extrabold text-ink-900">{inr(b.model.price_start)}</td>
                  ))}
                </tr>
                <tr className="border-b border-ink-100">
                  <td className="px-4 py-2.5 font-bold text-ink-700">Fuel</td>
                  {bikes.map((b) => <td key={b.model.id} className="px-4 py-2.5">{fuelShort(b.model.fuel_type)}</td>)}
                </tr>
                <tr className="border-b border-ink-100">
                  <td className="px-4 py-2.5 font-bold text-ink-700">CompareBike Score</td>
                  {bikes.map((b) => <td key={b.model.id} className="px-4 py-2.5 font-black text-ink-900">{b.score.toFixed(1)}</td>)}
                </tr>
                {Object.entries(grouped).map(([group, gRows]) => (
                  <React.Fragment key={group}>
                    <tr className="bg-ink-900">
                      <td colSpan={bikes.length + 1} className="px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">{group}</td>
                    </tr>
                    {gRows.map((r) => {
                      const best = bestIndex(r);
                      return (
                        <tr key={r.name} className="border-b border-ink-50 hover:bg-ink-50/60">
                          <td className="px-4 py-2.5 text-ink-500">{r.name}</td>
                          {r.values.map((v, i) => (
                            <td key={i} className={`px-4 py-2.5 font-semibold ${v == null ? 'text-ink-300' : 'text-ink-900'} ${best === i ? 'bg-emerald-50' : ''}`}>
                              {formatVal(v, r.unit)}
                              {best === i && <span className="ml-1.5 text-emerald-600">✓</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
                {Object.keys(grouped).length === 0 && (
                  <tr>
                    <td colSpan={bikes.length + 1} className="px-4 py-8 text-center text-sm text-ink-400">
                      No specifications have been published for these bikes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <BikePicker open={pickerOpen} onClose={() => setPickerOpen(false)} currentIds={compareIds} onPick={(id) => { addCompare(id); }} />
    </div>
  );
}

function formatWeights(w: ScoreWeights | null): string {
  if (!w) return '';
  return Object.entries(w)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${SCORE_CATEGORY_LABELS[k as keyof ScoreWeights]} ${v}%`)
    .join(' · ');
}

function formatVal(v: string | number | boolean | null, unit?: string | null): string {
  if (v == null) return 'N/A';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return unit ? `${v} ${unit}` : String(v);
  return v;
}

function BikePicker({ open, onClose, currentIds, onPick }: { open: boolean; onClose: () => void; currentIds: string[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<BikeModel[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast } = useApp();

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    (async () => {
      try {
        const sb = (await import('../lib/supabase')).requireSupabase();
        let query = sb.from('bike_models').select('id, name, slug, brand_slug, brand_name, brands ( name, slug )').eq('is_published', true).order('popularity', { ascending: false, nullsFirst: true }).limit(100);
        if (q.trim().length >= 2) query = query.ilike('name', `%${q.trim()}%`);
        const { data } = await query;
        setOptions(((data || []) as any[]).map((m) => ({ ...m, brand_name: m.brands?.name, brand_slug: m.brands?.slug })));
      } catch {
        setOptions([]);
      } finally {
        setBusy(false);
      }
    })();
  }, [open, q]);

  return (
    <Modal open={open} onClose={onClose} title="Add a bike to compare">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by model name…"
        className="input-base mb-3"
      />
      {busy ? (
        <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary-600" /></div>
      ) : (
        <ul className="max-h-72 divide-y divide-ink-100 overflow-y-auto">
          {options.map((m) => {
            const inTray = currentIds.includes(m.id);
            const full = currentIds.length >= 4;
            return (
              <li key={m.id}>
                <button
                  disabled={inTray || full}
                  onClick={() => {
                    onPick(m.id);
                    toast(`${m.brand_name} ${m.name} added to compare`, 'success');
                  }}
                  className="flex w-full items-center justify-between px-2 py-2.5 text-left text-sm hover:bg-ink-50 disabled:opacity-40"
                >
                  <span>
                    <span className="font-bold text-ink-900">{m.brand_name} {m.name}</span>
                    <span className="block text-xs text-ink-400">{fuelShort(m.fuel_type)} · {inr(m.price_start)}</span>
                  </span>
                  <span className="text-xs font-bold text-primary-600">{inTray ? 'In tray' : full ? 'Tray full' : '+ Add'}</span>
                </button>
              </li>
            );
          })}
          {!options.length && <li className="px-2 py-6 text-center text-sm text-ink-400">No published models found.</li>}
        </ul>
      )}
    </Modal>
  );
}
