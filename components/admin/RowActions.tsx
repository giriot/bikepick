'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminAction } from '@/lib/admin-config';

const TONE: Record<string, string> = {
  primary: 'btn-primary', success: 'btn-primary bg-emerald-600 hover:bg-emerald-700',
  danger: 'btn-outline border-rose-200 text-rose-700 hover:bg-rose-50', neutral: 'btn-outline',
};

export function RowActions({ resource, id, row, actions, canDelete }: {
  resource: string; id: string; row: any; actions: AdminAction[]; canDelete?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<AdminAction | null>(null);
  const [reason, setReason] = useState('');

  const available = actions.filter((a) => !a.when || a.when.in.includes(String(row[a.when.column])));

  async function run(action: AdminAction, reasonText?: string) {
    setBusy(action.key); setError(null);
    const res = await fetch(`/api/admin/${resource}/${id}/action`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: action.key, reason: reasonText || '' }),
    });
    const json = await res.json();
    setBusy(null);
    if (!json.ok) { setError(json.error || 'Action failed'); return; }
    setReasonFor(null); setReason('');
    router.refresh();
  }

  async function remove() {
    if (!confirm('Delete this record? This is reversible only from the database.')) return;
    setBusy('delete');
    const res = await fetch(`/api/admin/${resource}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setBusy(null);
    if (!json.ok) { setError(json.error || 'Delete failed'); return; }
    router.refresh();
  }

  if (available.length === 0 && !canDelete) return null;

  return (
    <div className="space-y-2">
      {error && <p className="text-[12px] text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {available.map((a) => (
          <button key={a.key} disabled={!!busy}
            className={`${TONE[a.tone || 'neutral']} btn-sm`}
            onClick={() => (a.reasonColumn ? setReasonFor(a) : run(a))}>
            {busy === a.key ? 'Working…' : a.label}
          </button>
        ))}
        {canDelete && (
          <button className="btn-ghost btn-sm text-ink-mute" onClick={remove} disabled={!!busy}>
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>

      {reasonFor && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <label className="label" htmlFor={`reason-${id}`}>
            Reason — the person affected sees this
          </label>
          <textarea id={`reason-${id}`} rows={2} className="field" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Be specific so they know exactly what to fix." />
          <div className="mt-2 flex gap-2">
            <button className="btn-primary btn-sm" disabled={reason.trim().length < 5 || !!busy}
              onClick={() => run(reasonFor, reason)}>
              {busy ? 'Saving…' : `Confirm: ${reasonFor.label}`}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => { setReasonFor(null); setReason(''); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
