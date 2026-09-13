'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DocumentRow = {
  id: string;
  doc_type: string;
  status: string;
  note: string | null;
  href: string | null;
};

const STATUS_OPTIONS = ['pending', 'approved', 'rejected'] as const;

function labelFor(type: string) {
  return {
    identity: 'Identity proof',
    rc: 'Registration certificate (RC)',
    insurance: 'Insurance document',
    loan_noc: 'Loan closure / NOC',
    service_history: 'Service history',
    other: 'Other document',
  }[type] || type.replace(/_/g, ' ');
}

export function UsedBikeDocuments({ initial }: { initial: DocumentRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(row: DocumentRow, status: string) {
    setBusy(row.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/used-bike-documents/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not update document');
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status } : item));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update document');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-[12.5px] text-ink-mute">
        No seller documents uploaded yet. Do not publish this listing until the required checks are complete.
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className="min-w-0 rounded-xl border border-line bg-surface p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-[13px] font-semibold leading-5" title={labelFor(row.doc_type)}>{labelFor(row.doc_type)}</h3>
                {row.note && <p className="mt-1 break-words text-[11.5px] leading-4 text-ink-mute">{row.note}</p>}
              </div>
              {row.href ? (
                <a href={row.href} target="_blank" rel="noreferrer" className="btn-outline btn-sm shrink-0">Open ↗</a>
              ) : (
                <span className="shrink-0 text-[11px] text-ink-mute">Preview unavailable</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`document-status-${row.id}`}>Status for {labelFor(row.doc_type)}</label>
              <select
                id={`document-status-${row.id}`}
                value={row.status}
                onChange={(e) => save(row, e.target.value)}
                disabled={busy === row.id}
                className="field m-0 min-w-[140px] py-2 text-[12px]"
              >
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
              </select>
              {busy === row.id && <span className="text-[11.5px] text-ink-mute">Saving…</span>}
            </div>
          </article>
        ))}
      </div>
      {error && <p className="mt-3 text-[12px] text-rose-700" role="alert">{error}</p>}
    </div>
  );
}
