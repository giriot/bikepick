'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type CheckRow = {
  id: string;
  check_type: string;
  result: string;
  method: string | null;
  evidence_note: string | null;
};

const RESULT_OPTIONS = ['not_checked', 'passed', 'failed', 'unavailable'] as const;
const METHOD_OPTIONS = ['', 'document_review', 'phone_call', 'physical_visit', 'third_party', 'other'] as const;

const OPTIONAL_FOR_PUBLISH = new Set(['insurance_verification', 'loan_status', 'service_history']);

const LABELS: Record<string, string> = {
  seller_identity: 'Seller identity',
  ownership_declaration: 'Ownership declaration',
  rc_verification: 'RC verification',
  insurance_verification: 'Insurance verification',
  loan_status: 'Loan / NOC status',
  service_history: 'Service history',
  photo_authenticity: 'Photo authenticity',
  physical_inspection: 'Physical inspection',
};

function title(type: string) {
  return LABELS[type] || type.replace(/_/g, ' ');
}

export function UsedBikeChecks({ initial }: { initial: CheckRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setRow(id: string, patch: Partial<CheckRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  async function save(row: CheckRow) {
    setBusy(row.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/verifications/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ result: row.result, method: row.method || null, evidence_note: row.evidence_note || null }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not save verification check');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save verification check');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-line bg-surface p-4 text-[12.5px] text-ink-mute">No verification checks have been created for this listing.</p>;
  }

  return (
    <div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-3 rounded-xl border border-line bg-surface p-3.5 lg:grid-cols-[minmax(160px,0.8fr)_150px_170px_minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <p className="break-words text-[13px] font-semibold leading-5" title={title(row.check_type)}>{title(row.check_type)}</p>
              <p className="mt-0.5 text-[11px] text-ink-mute">
                {OPTIONAL_FOR_PUBLISH.has(row.check_type)
                  ? 'Optional for publishing · a passed result improves the trust score.'
                  : 'Required for publishing · only “passed” contributes to the trust score.'}
              </p>
            </div>
            <div>
              <label className="label" htmlFor={`check-result-${row.id}`}>Result</label>
              <select id={`check-result-${row.id}`} value={row.result} onChange={(e) => setRow(row.id, { result: e.target.value })} className="field m-0 py-2 text-[12px]">
                {RESULT_OPTIONS.map((result) => <option key={result} value={result}>{result.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`check-method-${row.id}`}>Method</label>
              <select id={`check-method-${row.id}`} value={row.method || ''} onChange={(e) => setRow(row.id, { method: e.target.value || null })} className="field m-0 py-2 text-[12px]">
                {METHOD_OPTIONS.map((method) => <option key={method} value={method}>{method ? method.replace(/_/g, ' ') : 'Not recorded'}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`check-note-${row.id}`}>Evidence note</label>
              <input id={`check-note-${row.id}`} value={row.evidence_note || ''} onChange={(e) => setRow(row.id, { evidence_note: e.target.value })} className="field m-0 py-2 text-[12px]" placeholder="What was checked?" maxLength={500} />
            </div>
            <button type="button" onClick={() => save(row)} disabled={busy === row.id} className="btn-outline btn-sm whitespace-nowrap">
              {busy === row.id ? 'Saving…' : 'Save check'}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-[12px] text-rose-700" role="alert">{error}</p>}
    </div>
  );
}
