import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getScoreWeights, saveScoreWeights } from '../../lib/api';
import { DEFAULT_WEIGHTS, SCORE_CATEGORY_LABELS } from '../../lib/score';
import type { ScoreWeights } from '../../lib/types';
type ScoreCategory = keyof ScoreWeights;
import { Button, Card, ErrorBlock, LoadingBlock } from '../../components/ui';

/**
 * /admin/scores — CompareBike Score weight configuration.
 * Weights per category (must total 100). Editing changes scores sitewide.
 */
export default function AdminScores() {
  const { toast } = useApp();
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setWeights(await getScoreWeights());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = Math.round(Object.values(weights).reduce((a, b) => a + b, 0));
  const set = (k: ScoreCategory, v: number) => setWeights((w) => ({ ...w, [k]: v }));

  const save = async () => {
    if (total !== 100) {
      toast(`Weights must total 100 (currently ${total}).`, 'error');
      return;
    }
    setBusy(true);
    try {
      await saveScoreWeights(weights);
      toast('Score weights saved — all CompareBike Scores now use the new mix.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await saveScoreWeights(DEFAULT_WEIGHTS);
      setWeights(DEFAULT_WEIGHTS);
      toast('Reset to default weights.', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} />;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-black text-ink-900">CompareBike Score Weights</h1>
      <p className="mb-6 max-w-3xl text-sm text-ink-500">
        The Score (0–100) blends six categories with the weights below. Higher weights = the category influences the score more. Weights must total <strong>100</strong>.
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <div className="space-y-4">
            {(Object.keys(weights) as ScoreCategory[]).map((k) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-bold text-ink-800">{SCORE_CATEGORY_LABELS[k]}</label>
                  <span className="text-sm font-black text-ink-900">{weights[k]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={weights[k]}
                  onChange={(e) => set(k, Number(e.target.value))}
                  className="w-full accent-orange-600"
                />
              </div>
            ))}
          </div>
          <div className={`mt-5 flex items-center justify-between rounded-lg p-3 text-sm font-black ${total === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            <span>Total</span>
            <span>{total} / 100 {total === 100 ? '✓' : '— must be 100'}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button loading={busy} onClick={save}>Save weights</Button>
            <Button variant="outline" onClick={reset}>Reset to default</Button>
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-ink-400">How the score is used</p>
          <ul className="space-y-2 text-sm text-ink-600">
            <li>• Ranks bikes in the <strong>Compare</strong> screen (🥇 🥈 🥉)</li>
            <li>• Shows in "Help me choose" matches with a one-line reason</li>
            <li>• Shown on each bike page & search results (when data allows)</li>
          </ul>
          <div className="mt-4 rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-500">
            ⚠ Scores are estimates from published specs. Bikes with missing data score on available categories only and are labelled accordingly.
          </div>
        </Card>
      </div>
    </div>
  );
}
