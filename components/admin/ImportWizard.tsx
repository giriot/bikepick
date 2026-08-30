'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ImportType } from '@/lib/import-schema';

const ACTION_TONE: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700',
  update: 'bg-brand-50 text-brand-700',
  unchanged: 'bg-surface text-ink-mute',
  error: 'bg-rose-50 text-rose-700',
};

export function ImportWizard({ types }: { types: ImportType[] }) {
  const router = useRouter();
  const [typeKey, setTypeKey] = useState(types[0].key);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<any>(null);

  const type = types.find((t) => t.key === typeKey)!;

  async function send(mode: 'preview' | 'apply') {
    if (!file) { setError('Choose a CSV file first'); return; }
    setBusy(mode); setError(null);
    const fd = new FormData();
    fd.append('file', file); fd.append('type', typeKey); fd.append('mode', mode);
    const res = await fetch('/api/admin/import', { method: 'POST', body: fd });
    const json = await res.json();
    setBusy(null);
    if (!json.ok) { setError(json.error || 'Import failed'); return; }
    if (mode === 'preview') { setPlan(json.data); setDone(null); }
    else { setDone(json.data); setPlan(null); setFile(null); router.refresh(); }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-[14px] font-semibold">1. What are you importing?</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {types.map((t) => (
            <button key={t.key} type="button" onClick={() => { setTypeKey(t.key); setPlan(null); setDone(null); }}
              className={`rounded-xl border p-3.5 text-left transition ${
                typeKey === t.key ? 'border-brand-400 bg-brand-50/50' : 'border-line hover:border-brand-300'}`}>
              <p className="text-[13.5px] font-semibold">{t.label}</p>
              <p className="mt-0.5 text-[12px] leading-4 text-ink-mute">{t.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold">2. Prepare your file</h2>
          <a href={`/api/admin/import/template?type=${typeKey}`} className="btn-outline btn-sm">Download CSV template</a>
        </div>
        <p className="mt-1 text-[12.5px] text-ink-mute">
          Rows are matched on <strong>{type.matchOn.join(' + ')}</strong>. Re-importing an updated file therefore updates
          existing records instead of duplicating them. Blank cells are left untouched — they never overwrite good data with nothing.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-medium text-brand-700">Column reference ({type.columns.length})</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-mute">
                <tr><th className="px-3 py-2 text-left">Column</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Notes</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {type.columns.map((c) => (
                  <tr key={c.name}>
                    <td className="px-3 py-1.5 font-mono text-[11.5px]">{c.name}{c.required && <span className="text-danger"> *</span>}</td>
                    <td className="px-3 py-1.5 text-ink-mute">{c.type}</td>
                    <td className="px-3 py-1.5 text-ink-mute">{c.help}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-[14px] font-semibold">3. Upload and preview</h2>
        {error && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,text/csv" className="field w-auto py-2"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setPlan(null); setDone(null); }} />
          <button className="btn-primary btn-sm" onClick={() => send('preview')} disabled={!file || busy !== null}>
            {busy === 'preview' ? 'Analysing…' : 'Preview changes'}
          </button>
        </div>
        <p className="hint">Nothing is written until you confirm the preview.</p>
      </section>

      {done && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-[14px] font-semibold text-emerald-900">Import finished</h2>
          <p className="mt-1 text-[13px] text-emerald-900/80">
            {done.created} created · {done.updated} updated · {done.skipped} skipped.
          </p>
          {done.failures?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12.5px] font-medium text-emerald-900">{done.failures.length} row(s) failed</summary>
              <ul className="mt-1.5 space-y-0.5">{done.failures.map((f: string) => <li key={f} className="text-[12px] text-emerald-900/80">{f}</li>)}</ul>
            </details>
          )}
        </section>
      )}

      {plan && (
        <section className="rounded-xl border border-line bg-white">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[14px] font-semibold">4. Review before applying</h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[['create', plan.totals.create, 'new records'], ['update', plan.totals.update, 'will change'],
                ['unchanged', plan.totals.unchanged, 'already up to date'], ['error', plan.totals.error, 'have errors']]
                .map(([k, v, label]) => (
                  <span key={k as string} className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium ${ACTION_TONE[k as string]}`}>
                    <strong>{v as number}</strong> {label as string}
                  </span>
                ))}
            </div>
            {plan.unknownColumns.length > 0 && (
              <p className="mt-2 text-[12px] text-amber-700">
                Ignored unrecognised column(s): {plan.unknownColumns.join(', ')}
              </p>
            )}
          </div>

          <div className="max-h-[440px] overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wide text-ink-mute">
                <tr><th className="px-4 py-2 text-left">Row</th><th className="px-4 py-2 text-left">Action</th><th className="px-4 py-2 text-left">What changes</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plan.rows.map((r: any) => (
                  <tr key={r.index} className="align-top">
                    <td className="px-4 py-2 font-medium">{r.label}</td>
                    <td className="px-4 py-2"><span className={`badge ${ACTION_TONE[r.action]}`}>{r.action}</span></td>
                    <td className="px-4 py-2">
                      {r.errors.length > 0 && <ul className="text-rose-700">{r.errors.map((e: string) => <li key={e}>• {e}</li>)}</ul>}
                      {r.action === 'create' && <span className="text-ink-mute">New record will be created</span>}
                      {r.action === 'unchanged' && <span className="text-ink-mute">Identical to the stored record</span>}
                      {r.changes.length > 0 && (
                        <ul className="space-y-0.5">
                          {r.changes.map((c: any) => (
                            <li key={c.field}>
                              <span className="font-mono text-[11.5px] text-ink-mute">{c.field}</span>{' '}
                              <span className="text-rose-600 line-through">{String(c.from ?? '—')}</span>{' → '}
                              <span className="font-medium text-emerald-700">{String(c.to)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
            <p className="text-[12.5px] text-ink-mute">
              {plan.truncated ? 'Showing the first 200 rows. All rows will be processed.' : 'Rows with errors are skipped automatically.'}
            </p>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => setPlan(null)}>Cancel</button>
              <button className="btn-primary btn-sm" onClick={() => send('apply')}
                disabled={busy !== null || plan.totals.create + plan.totals.update === 0}>
                {busy === 'apply' ? 'Importing…' : `Apply ${plan.totals.create + plan.totals.update} change(s)`}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
