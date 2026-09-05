'use client';

import { useState } from 'react';

type Summary = {
  queued: number; deferred: number; running: number; applied: number; failed: number; skipped: number;
  dueNow: number; fieldsFilled: number; nextRetryAt: string | null; lastError: string | null;
};
type Job = {
  id: string; status: string; attempts: number; max_attempts: number; next_run_at: string | null;
  last_error: string | null; provider: string | null; missing_before: number | null;
  fields_filled: number | null; filled_keys: string | null; suggested_keys?: string | null;
  product_name: string; brand_name: string; product_status: string; fuel_type: string | null;
};

const TONE: Record<string, string> = {
  applied: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  deferred: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  running: 'bg-sky-50 text-sky-700 border-sky-200',
  queued: 'bg-surface text-ink-soft border-line',
  skipped: 'bg-surface text-ink-mute border-line',
};

/**
 * Drives lib/ai-spec-queue: fills each model's spec sheet with the AI template,
 * and — the point of the queue — survives the free-tier Gemini 429s by marking
 * the job for a later retry instead of losing it. Every button here hits a real
 * endpoint; nothing is decorative.
 */
export function AiSpecQueuePanel({
  initialSummary, initialJobs,
}: { initialSummary: Summary; initialJobs: Job[] }) {
  const [summary, setSummary] = useState(initialSummary);
  const [jobs, setJobs] = useState(initialJobs);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(body: Record<string, unknown>, label: string) {
    setBusy(label); setError(null); setNote(null);
    try {
      const res = await fetch('/api/admin/ai-spec-queue', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setNote(json.message || 'Done');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    const res = await fetch('/api/admin/ai-spec-queue', { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (json?.ok) { setSummary(json.data.summary); setJobs(json.data.jobs); }
  }

  const running = busy !== null;
  const stats = [
    { label: 'Queued', value: summary.queued },
    { label: 'Waiting on AI quota', value: summary.deferred },
    { label: 'Running', value: summary.running },
    { label: 'Applied', value: summary.applied },
    { label: 'Failed', value: summary.failed },
    { label: 'Spec fields filled', value: summary.fieldsFilled },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-white px-3 py-2">
            <p className="text-[10.5px] uppercase tracking-wide text-ink-mute">{s.label}</p>
            <p className="text-lg font-semibold leading-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={running} onClick={() => call({ action: 'enqueue', statuses: includeDrafts ? ['published', 'draft'] : ['published'] }, 'scan')}>
          {running === 'scan' ? 'Scanning…' : 'Scan catalogue for gaps'}
        </Button>
        <Button disabled={running} onClick={() => call({ action: 'run', maxJobs: 3, budgetMs: 45000 }, 'run')}>
          {running === 'run' ? 'Running batch…' : 'Run next batch (3 models)'}
        </Button>
        <Button disabled={running} onClick={() => call({ action: 'run', maxJobs: 10, budgetMs: 110000 }, 'run10')}>
          {running === 'run10' ? 'Running…' : 'Run larger batch (10)'}
        </Button>
        <Button disabled={running} onClick={() => call({ action: 'retry-now' }, 'retry')}>
          {running === 'retry' ? 'Forcing…' : 'Force deferred jobs now'}
        </Button>
        <Button disabled={running || summary.applied === 0} onClick={() => call({ action: 'revert', ids: jobs.filter((j) => j.status === 'applied').map((j) => j.id).join(',') }, 'revert')}>
          {running === 'revert' ? 'Reverting…' : 'Undo last AI values (all applied)'}
        </Button>
        <Button disabled={running} onClick={() => call({ action: 'clear-finished' }, 'clear')}>
          {running === 'clear' ? 'Clearing…' : 'Clear finished jobs'}
        </Button>
        <a
          href="/api/admin/export/spec-sheet?status=all&onlygaps=0"
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium hover:bg-surface"
          title="One CSV: every model, every spec column, plus which fields are still empty"
        >
          Download single sheet (CSV)
        </a>
        <label className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-mute">
          <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} className="h-3.5 w-3.5" />
          include drafts when scanning
        </label>
      </div>

      {note && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{note}</p>}
      {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">{error}</p>}

      {summary.nextRetryAt && summary.deferred > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          {summary.deferred} job(s) are throttled by the AI provider and will retry automatically
          {summary.nextRetryAt ? ` — next attempt ${new Date(summary.nextRetryAt).toLocaleString('en-IN')}` : ''}.
          Adding another Gemini key (GEMINI_API_KEY_2) shortens this.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-line bg-surface text-[10.5px] uppercase tracking-wide text-ink-mute">
            <tr>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Tries</th>
              <th className="px-3 py-2">Gap</th>
              <th className="px-3 py-2">Filled</th>
              <th className="px-3 py-2">Next run</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-mute">
                Queue is empty. Use “Scan catalogue for gaps” to find models with unfinished spec sheets.
              </td></tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-line last:border-0 align-top">
                <td className="px-3 py-2">
                  <span className="font-medium">{j.brand_name} {j.product_name}</span>
                  <span className="ml-1.5 text-[10.5px] text-ink-mute">{j.product_status}{j.fuel_type === 'electric' ? ' · electric' : ''}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded border px-1.5 py-0.5 text-[10.5px] font-medium ${TONE[j.status] || TONE.skipped}`}>{j.status}</span>
                </td>
                <td className="px-3 py-2 tabular-nums">{j.attempts}/{j.max_attempts}</td>
                <td className="px-3 py-2 tabular-nums">{j.missing_before ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums">
                  {j.fields_filled ? `${j.fields_filled} field(s)` : '—'}
                  {j.filled_keys && <KeyList json={j.filled_keys} label="which fields" />}
                  {j.suggested_keys && <KeyList json={j.suggested_keys} label="held for review" tone="text-warn" />}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-ink-mute">
                  {['queued', 'deferred'].includes(j.status) && j.next_run_at ? new Date(j.next_run_at).toLocaleString('en-IN') : '—'}
                </td>
                <td className="max-w-[28rem] px-3 py-2 text-[11.5px] text-ink-mute">{j.last_error || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-mute">
        AI values are only ever written into fields that are still empty — curated specs are never overwritten — and each
        batch is recorded in the audit log with the exact keys it touched. Values remain AI-derived until you verify them on
        the model’s edit page.
      </p>
    </div>
  );
}

function KeyList({ json, label, tone = 'text-brand-600' }: { json: string; label: string; tone?: string }) {
  let keys: string[] = [];
  try { const parsed = JSON.parse(json); keys = Array.isArray(parsed) ? parsed : Object.keys(parsed); } catch { return null; }
  if (!keys.length) return null;
  return (
    <details className="mt-0.5">
      <summary className={`cursor-pointer text-[10.5px] ${tone}`}>{label} ({keys.length})</summary>
      <span className="text-[10.5px]">{keys.join(', ')}</span>
    </details>
  );
}

function Button({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium hover:bg-surface disabled:opacity-50"
    >
      {children}
    </button>
  );
}
